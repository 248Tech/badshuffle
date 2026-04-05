const { getSettingValue } = require('../../db/queries/settings');
const { resolveProviderModelSetting } = require('./providerConfig');
const { generateProviderReply } = require('./agentProviderService');

function buildFallbackSuggestions(db, currentItems = []) {
  const excluded = currentItems.length
    ? currentItems.map(() => '?').join(',')
    : 'SELECT NULL WHERE 1=0';

  let query;
  let params;

  if (currentItems.length) {
    query = `
      SELECT i.id, i.title, i.photo_url, i.category,
             COALESCE(s.times_quoted, 0) AS times_quoted
      FROM items i
      LEFT JOIN item_stats s ON s.item_id = i.id
      WHERE i.hidden = 0
        AND i.id NOT IN (${excluded})
      ORDER BY times_quoted DESC, i.title ASC
      LIMIT 6
    `;
    params = currentItems;
  } else {
    query = `
      SELECT i.id, i.title, i.photo_url, i.category,
             COALESCE(s.times_quoted, 0) AS times_quoted
      FROM items i
      LEFT JOIN item_stats s ON s.item_id = i.id
      WHERE i.hidden = 0
      ORDER BY times_quoted DESC, i.title ASC
      LIMIT 6
    `;
    params = [];
  }

  const top = db.prepare(query).all(...params);
  return top.map((item) => ({
    id: item.id,
    title: item.title,
    photo_url: item.photo_url,
    category: item.category || null,
    reason: `Quoted ${item.times_quoted} times in past events`,
  }));
}

function getSuggestionConfig(db) {
  const enabled = String(getSettingValue(db, 'ai_suggest_enabled', '1') || '1') === '1';
  const selection = resolveProviderModelSetting(getSettingValue(db, 'ai_suggest_model', 'claude'), 'claude');
  return { enabled, provider: selection.provider, model: selection.model };
}

async function suggestItems(db, {
  guest_count = 0,
  event_type = 'event',
  current_items = [],
  current_item_details = [],
  quote_name = '',
  venue_name = '',
  section_titles = [],
} = {}) {
  const fallback = buildFallbackSuggestions(db, current_items);
  const config = getSuggestionConfig(db);
  if (!config.enabled) {
    return { suggestions: fallback, source: 'fallback', provider: 'disabled' };
  }

  try {
    const allItems = db.prepare(
      'SELECT id, title, category, quantity_in_stock FROM items WHERE hidden = 0 ORDER BY title ASC'
    ).all();

    const normalizedCurrentDetails = Array.isArray(current_item_details) && current_item_details.length > 0
      ? current_item_details
        .map((item) => ({
          id: Number(item.id || item.item_id || 0),
          title: String(item.title || item.label || '').trim(),
          quantity: Math.max(1, Number(item.quantity || 1)),
          category: String(item.category || '').trim(),
          section_title: String(item.section_title || '').trim(),
        }))
        .filter((item) => item.id > 0 && item.title)
      : current_items.map((id) => {
        const item = db.prepare('SELECT id, title, category FROM items WHERE id = ?').get(id);
        return item ? {
          id: Number(item.id),
          title: item.title,
          quantity: 1,
          category: item.category || '',
          section_title: '',
        } : null;
      }).filter(Boolean);

    const currentTitles = normalizedCurrentDetails.map((item) => {
      const bits = [`${item.title} x${item.quantity}`];
      if (item.category) bits.push(`[${item.category}]`);
      if (item.section_title) bits.push(`in ${item.section_title}`);
      return bits.join(' ');
    });

    const prompt = `Given an event with approximately ${guest_count} guests and event type "${event_type}", suggest 4-6 rental items from the available inventory that would complement the current quote.

Quote name: ${quote_name || 'Untitled quote'}
Venue: ${venue_name || 'not specified'}
Sections: ${section_titles.length ? section_titles.join(', ') : 'default section'}

Current quote items: ${currentTitles.length ? currentTitles.join(', ') : 'none yet'}

Available inventory (pick only from this list):
${allItems.map((item) => `- ${item.title} (id: ${item.id}, category: ${item.category || 'uncategorized'}, stock: ${Number(item.quantity_in_stock || 0)})`).join('\n')}

Respond with JSON only, format:
{"suggestions": [{"id": <number>, "title": "<string>", "reason": "<1 sentence why>"}]}

Do not suggest items already in the quote. Consider item quantities already present, the likely gaps in the setup, and what would complement the event type and guest count. Prefer genuinely additive suggestions over generic repeats.`;

    const reply = await generateProviderReply(db, {
      provider: config.provider,
      model: config.model,
      systemPrompt: 'You are an event rental assistant. Return strict JSON only.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 500,
      responseFormat: 'json',
    });

    const parsed = JSON.parse(String(reply.content || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, ''));
    const suggestions = (parsed.suggestions || []).map((suggestion) => {
      const item = db.prepare('SELECT photo_url, category FROM items WHERE id = ?').get(suggestion.id);
      return {
        ...suggestion,
        photo_url: item ? item.photo_url : null,
        category: item ? item.category : null,
      };
    }).filter((entry) => Number(entry.id) > 0 && String(entry.title || '').trim());

    return { suggestions, source: 'ai', provider: config.provider, model: config.model };
  } catch (error) {
    console.error('AI suggest error:', error.message);
    return { suggestions: fallback, source: 'fallback', provider: config.provider, model: config.model };
  }
}

module.exports = {
  suggestItems,
};
