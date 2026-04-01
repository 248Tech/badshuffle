const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();
  const ORG_ID = 1;

  // GET /api/vendors
  router.get('/', (req, res) => {
    const vendors = db.prepare('SELECT * FROM vendors WHERE org_id = ? ORDER BY name ASC').all(ORG_ID);
    res.json({ vendors });
  });

  // POST /api/vendors
  router.post('/', (req, res) => {
    const { name, email, phone, address, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = db.prepare(
      'INSERT INTO vendors (org_id, name, email, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(ORG_ID, name, email || null, phone || null, address || null, notes || null);
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID);
    res.status(201).json({ vendor });
  });

  // PUT /api/vendors/:id
  router.put('/:id', (req, res) => {
    const { name, email, phone, address, notes } = req.body || {};
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ? AND org_id = ?').get(req.params.id, ORG_ID);
    if (!vendor) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE vendors SET
        name    = COALESCE(?, name),
        email   = COALESCE(?, email),
        phone   = COALESCE(?, phone),
        address = COALESCE(?, address),
        notes   = COALESCE(?, notes)
      WHERE id = ? AND org_id = ?
    `).run(
      name || null, email !== undefined ? (email || null) : null,
      phone !== undefined ? (phone || null) : null,
      address !== undefined ? (address || null) : null,
      notes !== undefined ? (notes || null) : null,
      req.params.id,
      ORG_ID
    );
    const updated = db.prepare('SELECT * FROM vendors WHERE id = ? AND org_id = ?').get(req.params.id, ORG_ID);
    res.json({ vendor: updated });
  });

  // DELETE /api/vendors/:id
  router.delete('/:id', (req, res) => {
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ? AND org_id = ?').get(req.params.id, ORG_ID);
    if (!vendor) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM vendors WHERE id = ? AND org_id = ?').run(req.params.id, ORG_ID);
    res.json({ ok: true });
  });

  return router;
};
