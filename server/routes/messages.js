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
    const { quote_id, body_text, subject } = req.body || {};
    if (!quote_id || !body_text || !String(body_text).trim()) {
      return res.status(400).json({ error: 'quote_id and body_text required' });
    }
    const quote = db.prepare('SELECT id, name, client_email FROM quotes WHERE id = ?').get(quote_id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    const userEmail = req.user?.email || null;
    try {
      db.prepare(`
        INSERT INTO messages (quote_id, direction, from_email, to_email, subject, body_text, status, sent_at, quote_name)
        VALUES (?, 'outbound', ?, ?, ?, ?, 'sent', datetime('now'), ?)
      `).run(
        quote.id,
        userEmail,
        quote.client_email || null,
        subject || 'Message regarding your quote',
        String(body_text).trim(),
        quote.name || ''
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
