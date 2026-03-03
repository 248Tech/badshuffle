const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/items
  router.get('/', (req, res) => {
    const { search, hidden } = req.query;
    let query = 'SELECT * FROM items WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND title LIKE ?';
      params.push(`%${search}%`);
    }
    if (hidden !== undefined) {
      query += ' AND hidden = ?';
      params.push(hidden === '1' ? 1 : 0);
    }
    query += ' ORDER BY title ASC';

    const items = db.prepare(query).all(...params);
    res.json({ items, total: items.length });
  });

  // GET /api/items/:id
  router.get('/:id', (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const associations = db.prepare(`
      SELECT i.* FROM items i
      JOIN item_associations ia ON ia.child_id = i.id
      WHERE ia.parent_id = ?
      ORDER BY i.title ASC
    `).all(item.id);

    res.json({ ...item, associations });
  });

  // POST /api/items
  router.post('/', (req, res) => {
    const { title, photo_url, source = 'manual', hidden = 0 } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    try {
      const result = db.prepare(
        'INSERT INTO items (title, photo_url, source, hidden) VALUES (?, ?, ?, ?)'
      ).run(title, photo_url || null, source, hidden ? 1 : 0);

      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ item });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Title already exists' });
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/items/upsert — must come BEFORE /:id route
  router.post('/upsert', (req, res) => {
    const { title, photo_url, source = 'manual', hidden = 0 } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const existing = db.prepare('SELECT * FROM items WHERE title = ? COLLATE NOCASE').get(title);

    if (existing) {
      db.prepare(`
        UPDATE items SET
          photo_url  = COALESCE(?, photo_url),
          source     = ?,
          hidden     = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(photo_url || null, source, hidden ? 1 : 0, existing.id);

      const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id);
      return res.json({ item: updated, created: false });
    }

    const result = db.prepare(
      'INSERT INTO items (title, photo_url, source, hidden) VALUES (?, ?, ?, ?)'
    ).run(title, photo_url || null, source, hidden ? 1 : 0);

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ item, created: true });
  });

  // PUT /api/items/:id
  router.put('/:id', (req, res) => {
    const { title, photo_url, source, hidden } = req.body;
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    db.prepare(`
      UPDATE items SET
        title      = COALESCE(?, title),
        photo_url  = COALESCE(?, photo_url),
        source     = COALESCE(?, source),
        hidden     = COALESCE(?, hidden),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title || null,
      photo_url !== undefined ? photo_url : null,
      source || null,
      hidden !== undefined ? (hidden ? 1 : 0) : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    res.json({ item: updated });
  });

  // DELETE /api/items/:id
  router.delete('/:id', (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  // GET /api/items/:id/associations
  router.get('/:id/associations', (req, res) => {
    const items = db.prepare(`
      SELECT i.* FROM items i
      JOIN item_associations ia ON ia.child_id = i.id
      WHERE ia.parent_id = ?
      ORDER BY i.title ASC
    `).all(req.params.id);
    res.json({ items });
  });

  // POST /api/items/:id/associations
  router.post('/:id/associations', (req, res) => {
    const { child_id } = req.body;
    if (!child_id) return res.status(400).json({ error: 'child_id required' });

    try {
      db.prepare(
        'INSERT OR IGNORE INTO item_associations (parent_id, child_id) VALUES (?, ?)'
      ).run(req.params.id, child_id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE /api/items/:id/associations/:child_id
  router.delete('/:id/associations/:child_id', (req, res) => {
    db.prepare(
      'DELETE FROM item_associations WHERE parent_id = ? AND child_id = ?'
    ).run(req.params.id, req.params.child_id);
    res.json({ deleted: true });
  });

  return router;
};
