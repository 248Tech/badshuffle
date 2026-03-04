const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/leads
  router.get('/', (req, res) => {
    const { search, page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${where}`).get(...params).n;
    const leads = db.prepare(
      `SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset);

    res.json({ leads, total, page: pageNum, limit: limitNum });
  });

  // POST /api/leads
  router.post('/', (req, res) => {
    const { name, email, phone, event_date, event_type, source_url, notes, quote_id } = req.body || {};
    const result = db.prepare(`
      INSERT INTO leads (name, email, phone, event_date, event_type, source_url, notes, quote_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name || null, email || null, phone || null,
      event_date || null, event_type || null,
      source_url || null, notes || null,
      quote_id !== undefined ? quote_id : null
    );
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ lead });
  });

  // PUT /api/leads/:id
  router.put('/:id', (req, res) => {
    const { quote_id } = req.body || {};
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE leads SET quote_id = ? WHERE id = ?').run(
      quote_id !== undefined ? quote_id : lead.quote_id,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    res.json({ lead: updated });
  });

  // DELETE /api/leads/:id
  router.delete('/:id', (req, res) => {
    const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  return router;
};
