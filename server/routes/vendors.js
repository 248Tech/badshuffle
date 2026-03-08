const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/vendors
  router.get('/', (req, res) => {
    const vendors = db.prepare('SELECT * FROM vendors ORDER BY name ASC').all();
    res.json({ vendors });
  });

  // POST /api/vendors
  router.post('/', (req, res) => {
    const { name, email, phone, address, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = db.prepare(
      'INSERT INTO vendors (name, email, phone, address, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email || null, phone || null, address || null, notes || null);
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ vendor });
  });

  // PUT /api/vendors/:id
  router.put('/:id', (req, res) => {
    const { name, email, phone, address, notes } = req.body || {};
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE vendors SET
        name    = COALESCE(?, name),
        email   = COALESCE(?, email),
        phone   = COALESCE(?, phone),
        address = COALESCE(?, address),
        notes   = COALESCE(?, notes)
      WHERE id = ?
    `).run(
      name || null, email !== undefined ? (email || null) : null,
      phone !== undefined ? (phone || null) : null,
      address !== undefined ? (address || null) : null,
      notes !== undefined ? (notes || null) : null,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    res.json({ vendor: updated });
  });

  // DELETE /api/vendors/:id
  router.delete('/:id', (req, res) => {
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
};
