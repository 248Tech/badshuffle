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
