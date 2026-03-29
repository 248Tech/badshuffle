const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/messages?quote_id=N&direction=inbound
  router.get('/', (req, res) => {
    let sql = 'SELECT * FROM messages WHERE 1=1';
    const params = [];
    if (req.query.quote_id) {
      sql += ' AND quote_id = ?';
      params.push(req.query.quote_id);
    }
    if (req.query.direction) {
      sql += ' AND direction = ?';
      params.push(req.query.direction);
    }
    sql += ' ORDER BY sent_at DESC';
    const messages = db.prepare(sql).all(...params);
    res.json({ messages });
  });

  // POST /api/messages — internal team sends a message on a quote thread
  router.post('/', (req, res) => {
    const body = req.body || {};
    const {
      quote_id,
      body_text,
      subject,
      reply_to_id,
      attachments,
      links,
      message_type,
      rich_payload,
    } = body;

    if (!quote_id) {
      return res.status(400).json({ error: 'quote_id required' });
    }

    const quote = db.prepare('SELECT id, name, client_email FROM quotes WHERE id = ?').get(quote_id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    if (reply_to_id != null && reply_to_id !== '') {
      const parent = db.prepare('SELECT id, quote_id FROM messages WHERE id = ?').get(Number(reply_to_id));
      if (!parent || parent.quote_id !== quote.id) {
        return res.status(400).json({ error: 'Invalid reply_to_id' });
      }
    }

    const userEmail = req.user?.email || null;

    let finalBody = body_text != null ? String(body_text).trim() : '';
    const linkArr = Array.isArray(links)
      ? links.map((l) => String(l).trim()).filter(Boolean)
      : [];
    if (linkArr.length) {
      finalBody = finalBody ? `${finalBody}\n\n${linkArr.join('\n')}` : linkArr.join('\n');
    }

    const attArr = Array.isArray(attachments) ? attachments : [];
    const hasRich = message_type === 'rich' && rich_payload != null && typeof rich_payload === 'object';

    if (!finalBody && !hasRich && attArr.length === 0) {
      return res.status(400).json({ error: 'body_text, links, attachments, or rich payload required' });
    }

    if (!finalBody && attArr.length && !hasRich) {
      finalBody =
        attArr.map((a) => a.name || a.original_name || (a.file_id != null ? `File #${a.file_id}` : 'Attachment')).join(', ') ||
        'Attachment';
    }

    const attJson =
      attArr.length > 0
        ? JSON.stringify(
            attArr.map((a) => ({
              file_id: Number(a.file_id),
              name: a.name || a.original_name || null,
            }))
          )
        : null;
    const linkJson = linkArr.length > 0 ? JSON.stringify(linkArr) : null;
    const richJson = hasRich ? JSON.stringify(rich_payload) : null;
    const msgType = hasRich ? 'rich' : 'text';
    const replyId = reply_to_id != null && reply_to_id !== '' ? Number(reply_to_id) : null;

    try {
      db.prepare(`
        INSERT INTO messages (
          quote_id, direction, from_email, to_email, subject, body_text, status, sent_at, quote_name,
          reply_to_id, attachments_json, links_json, message_type, rich_payload_json
        )
        VALUES (?, 'outbound', ?, ?, ?, ?, 'sent', datetime('now'), ?, ?, ?, ?, ?, ?)
      `).run(
        quote.id,
        userEmail,
        quote.client_email || null,
        subject || 'Message regarding your quote',
        finalBody,
        quote.name || '',
        replyId,
        attJson,
        linkJson,
        msgType,
        richJson
      );
      const messages = db.prepare('SELECT * FROM messages WHERE quote_id = ? ORDER BY sent_at ASC').all(quote.id);
      res.json({ ok: true, messages });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/messages/unread-count
  router.get('/unread-count', (req, res) => {
    const row = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'unread'").get();
    res.json({ count: row ? row.count : 0 });
  });

  // PUT /api/messages/:id/read
  router.put('/:id/read', (req, res) => {
    db.prepare("UPDATE messages SET status = 'read' WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // DELETE /api/messages/:id
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  return router;
};
