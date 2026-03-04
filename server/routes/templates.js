const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/templates
  router.get('/', (req, res) => {
    const list = db.prepare('SELECT id, name, subject, is_default, created_at FROM email_templates ORDER BY name').all();
    res.json({ templates: list });
  });

  // GET /api/templates/:id
  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  // POST /api/templates
  router.post('/', (req, res) => {
    const { name, subject = '', body_html, body_text, is_default } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    if (is_default) {
      db.prepare('UPDATE email_templates SET is_default = 0').run();
    }
    const result = db.prepare(
      `INSERT INTO email_templates (name, subject, body_html, body_text, is_default, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(name, subject || '', body_html || null, body_text || null, is_default ? 1 : 0);
    const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  });

  // PUT /api/templates/:id
  router.put('/:id', (req, res) => {
    const { name, subject, body_html, body_text, is_default } = req.body || {};
    const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (is_default) {
      db.prepare('UPDATE email_templates SET is_default = 0').run();
    }
    db.prepare(`
      UPDATE email_templates SET
        name       = COALESCE(?, name),
        subject    = COALESCE(?, subject),
        body_html  = COALESCE(?, body_html),
        body_text  = COALESCE(?, body_text),
        is_default = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ?? existing.name,
      subject !== undefined ? subject : existing.subject,
      body_html !== undefined ? body_html : existing.body_html,
      body_text !== undefined ? body_text : existing.body_text,
      is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
      req.params.id
    );
    const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
    res.json(row);
  });

  // DELETE /api/templates/:id
  router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM email_templates WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  });

  return router;
};
