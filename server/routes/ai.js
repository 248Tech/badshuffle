const express = require('express');

let OpenAI;
try { OpenAI = require('openai'); } catch {}

module.exports = function makeRouter(db) {
  const router = express.Router();

  // POST /api/ai/suggest
  router.post('/suggest', async (req, res) => {
    const { guest_count = 0, event_type = 'event', current_items = [] } = req.body;

    const fallbackSuggest = () => {
      const excluded = current_items.length
        ? current_items.map(() => '?').join(',')
        : 'SELECT NULL WHERE 1=0';

      let query;
      let params;

      if (current_items.length) {
        query = `
          SELECT i.id, i.title, i.photo_url,
                 COALESCE(s.times_quoted, 0) as times_quoted
          FROM items i
          LEFT JOIN item_stats s ON s.item_id = i.id
          WHERE i.hidden = 0
            AND i.id NOT IN (${excluded})
          ORDER BY times_quoted DESC, i.title ASC
          LIMIT 6
        `;
        params = current_items;
      } else {
        query = `
          SELECT i.id, i.title, i.photo_url,
                 COALESCE(s.times_quoted, 0) as times_quoted
          FROM items i
          LEFT JOIN item_stats s ON s.item_id = i.id
          WHERE i.hidden = 0
          ORDER BY times_quoted DESC, i.title ASC
          LIMIT 6
        `;
        params = [];
      }

      const top = db.prepare(query).all(...params);

      return res.json({
        suggestions: top.map(i => ({
          id: i.id,
          title: i.title,
          photo_url: i.photo_url,
          reason: `Quoted ${i.times_quoted} times in past events`
        })),
        source: 'fallback'
      });
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!OpenAI || !apiKey || apiKey.startsWith('sk-...') || apiKey === '') {
      return fallbackSuggest();
    }

    try {
      const openai = new OpenAI({ apiKey });

      const allItems = db.prepare(
        'SELECT id, title FROM items WHERE hidden = 0 ORDER BY title ASC'
      ).all();

      const currentTitles = current_items.map(id => {
        const item = db.prepare('SELECT title FROM items WHERE id = ?').get(id);
        return item ? item.title : null;
      }).filter(Boolean);

      const prompt = `You are an event rental assistant. Given an event with approximately ${guest_count} guests and event type "${event_type}", suggest 4-6 rental items from the available inventory that would complement the current quote.

Current quote items: ${currentTitles.length ? currentTitles.join(', ') : 'none yet'}

Available inventory (pick only from this list):
${allItems.map(i => `- ${i.title} (id: ${i.id})`).join('\n')}

Respond with JSON only, format:
{"suggestions": [{"id": <number>, "title": "<string>", "reason": "<1 sentence why>"}]}

Do not suggest items already in the quote. Pick items that make sense for the guest count and event type.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.7
      });

      const parsed = JSON.parse(completion.choices[0].message.content);

      const suggestions = (parsed.suggestions || []).map(s => {
        const item = db.prepare('SELECT photo_url FROM items WHERE id = ?').get(s.id);
        return { ...s, photo_url: item ? item.photo_url : null };
      });

      res.json({ suggestions, source: 'ai' });
    } catch (e) {
      console.error('AI suggest error:', e.message);
      return fallbackSuggest();
    }
  });

  return router;
};
