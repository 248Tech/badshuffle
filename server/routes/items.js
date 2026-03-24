const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/items/categories — must come before /:id
  router.get('/categories', (req, res) => {
    const rows = db.prepare(
      "SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != '' ORDER BY category"
    ).all();
    res.json({ categories: rows.map(r => r.category) });
  });

  // GET /api/items/categories/popular — categories by quote usage (for quote builder filter)
  router.get('/categories/popular', (req, res) => {
    const { limit = 15 } = req.query;
    const rows = db.prepare(`
      SELECT i.category,
             COALESCE(SUM(s.times_quoted), 0) AS usage_count
      FROM items i
      LEFT JOIN item_stats s ON s.item_id = i.id
      WHERE i.category IS NOT NULL AND i.category != ''
      GROUP BY i.category
      ORDER BY usage_count DESC, i.category ASC
      LIMIT ?
    `).all(Math.max(1, Math.min(50, parseInt(limit, 10) || 15)));
    res.json({ categories: rows.map(r => r.category) });
  });

  // GET /api/items
  router.get('/', (req, res) => {
    const { search, hidden, category, limit, offset, exclude_quote_id, item_type } = req.query;
    let query = `
      SELECT items.*,
        (SELECT COALESCE(SUM(qi.quantity),0) FROM quote_items qi
         WHERE qi.item_id = items.id) AS quantity_going_out
      FROM items WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND items.title LIKE ?';
      params.push(`%${search}%`);
    }
    if (hidden !== undefined) {
      query += ' AND items.hidden = ?';
      params.push(hidden === '1' ? 1 : 0);
    }
    const categoryNorm = category && String(category).trim() ? String(category).trim() : null;
    if (categoryNorm) {
      query += " AND LOWER(TRIM(COALESCE(items.category, ''))) = LOWER(?)";
      params.push(categoryNorm);
    }
    const excludeQuoteId = exclude_quote_id != null && String(exclude_quote_id).trim() !== '' ? parseInt(exclude_quote_id, 10) : null;
    if (excludeQuoteId != null && !Number.isNaN(excludeQuoteId)) {
      query += ' AND items.id NOT IN (SELECT item_id FROM quote_items WHERE quote_id = ?)';
      params.push(excludeQuoteId);
    }
    if (item_type && ['product', 'group', 'accessory'].includes(item_type)) {
      query += " AND COALESCE(items.item_type, 'product') = ?";
      params.push(item_type);
    }
    const countQuery = `SELECT COUNT(*) AS n FROM items WHERE 1=1${search ? ' AND items.title LIKE ?' : ''}${hidden !== undefined ? ' AND items.hidden = ?' : ''}${categoryNorm ? " AND LOWER(TRIM(COALESCE(items.category, ''))) = LOWER(?)" : ''}${excludeQuoteId != null && !Number.isNaN(excludeQuoteId) ? ' AND items.id NOT IN (SELECT item_id FROM quote_items WHERE quote_id = ?)' : ''}`;
    const total = db.prepare(countQuery).get(...params).n;

    query += ' ORDER BY items.title ASC';
    const lim = limit != null ? Math.max(1, Math.min(500, parseInt(limit, 10) || 100)) : 0;
    const off = offset != null ? Math.max(0, parseInt(offset, 10) || 0) : 0;
    if (lim > 0) {
      query += ' LIMIT ? OFFSET ?';
      params.push(lim, off);
    }
    const items = db.prepare(query).all(...params);
    res.json({ items, total });
  });

  // POST /api/items/bulk-upsert — accepts { items: [...] }, used by extension JSON export
  router.post('/bulk-upsert', (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'items array required' });

    let created = 0, updated = 0, errors = 0;
    for (const it of items) {
      const { title, photo_url, hidden = 0, quantity_in_stock, unit_price,
              category, description, contract_description, taxable, labor_hours } = it;
      if (!title) { errors++; continue; }
      try {
        const existing = db.prepare('SELECT id FROM items WHERE title = ? COLLATE NOCASE').get(title);
        if (existing) {
          db.prepare(`
            UPDATE items SET
              photo_url = COALESCE(?, photo_url),
              source = 'extension',
              hidden = ?,
              quantity_in_stock = COALESCE(?, quantity_in_stock),
              unit_price = COALESCE(?, unit_price),
              category = COALESCE(?, category),
              description = COALESCE(?, description),
              contract_description = COALESCE(?, contract_description),
              taxable = COALESCE(?, taxable),
              labor_hours = COALESCE(?, labor_hours),
              updated_at = datetime('now')
            WHERE id = ?
          `).run(
            photo_url || null, hidden ? 1 : 0,
            quantity_in_stock != null ? quantity_in_stock : null,
            unit_price != null ? unit_price : null,
            category || null, description || null, contract_description || null,
            taxable != null ? (taxable ? 1 : 0) : null,
            labor_hours != null ? labor_hours : null,
            existing.id
          );
          updated++;
        } else {
          db.prepare(`
            INSERT INTO items (title, photo_url, source, hidden, quantity_in_stock, unit_price,
                               category, description, contract_description, taxable, labor_hours)
            VALUES (?, ?, 'extension', ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            title, photo_url || null, hidden ? 1 : 0,
            quantity_in_stock != null ? quantity_in_stock : 0,
            unit_price != null ? unit_price : 0,
            category || null, description || null, contract_description || null,
            taxable != null ? (taxable ? 1 : 0) : 1,
            labor_hours != null ? labor_hours : 0
          );
          created++;
        }
      } catch (e) {
        errors++;
      }
    }
    res.json({ created, updated, errors, total: items.length });
  });

  // POST /api/items/upsert — must come BEFORE /:id route
  router.post('/upsert', (req, res) => {
    const {
      title, photo_url, source = 'manual', hidden = 0,
      quantity_in_stock, unit_price, category, description, contract_description, taxable, labor_hours
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const existing = db.prepare('SELECT * FROM items WHERE title = ? COLLATE NOCASE').get(title);

    if (existing) {
      db.prepare(`
        UPDATE items SET
          photo_url            = COALESCE(?, photo_url),
          source               = ?,
          hidden               = ?,
          quantity_in_stock    = COALESCE(?, quantity_in_stock),
          unit_price           = COALESCE(?, unit_price),
          category             = COALESCE(?, category),
          description          = COALESCE(?, description),
          contract_description = COALESCE(?, contract_description),
          taxable              = COALESCE(?, taxable),
          labor_hours          = COALESCE(?, labor_hours),
          updated_at           = datetime('now')
        WHERE id = ?
      `).run(
        photo_url || null, source, hidden ? 1 : 0,
        quantity_in_stock != null ? quantity_in_stock : null,
        unit_price != null ? unit_price : null,
        category || null,
        description || null,
        contract_description || null,
        taxable != null ? (taxable ? 1 : 0) : null,
        labor_hours != null ? labor_hours : null,
        existing.id
      );
      const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id);
      return res.json({ item: updated, created: false });
    }

    const result = db.prepare(`
      INSERT INTO items (title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description, contract_description, taxable, labor_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, photo_url || null, source, hidden ? 1 : 0,
      quantity_in_stock != null ? quantity_in_stock : 0,
      unit_price != null ? unit_price : 0,
      category || null, description || null, contract_description || null,
      taxable != null ? (taxable ? 1 : 0) : 1,
      labor_hours != null ? labor_hours : 0
    );
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ item, created: true });
  });

  // GET /api/items/:id
  router.get('/:id', (req, res) => {
    const item = db.prepare(`
      SELECT items.*,
        (SELECT COALESCE(SUM(qi.quantity),0) FROM quote_items qi
         WHERE qi.item_id = items.id) AS quantity_going_out
      FROM items WHERE items.id = ?
    `).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const associations = db.prepare(`
      SELECT i.* FROM items i
      JOIN item_associations ia ON ia.child_id = i.id
      WHERE ia.parent_id = ?
      ORDER BY i.title ASC
    `).all(item.id);

    const quote_history = db.prepare(`
      SELECT q.id, q.name, q.event_date, qi.quantity, qi.label
      FROM quotes q JOIN quote_items qi ON qi.quote_id = q.id
      WHERE qi.item_id = ?
      ORDER BY q.created_at DESC LIMIT 20
    `).all(item.id);

    res.json({ ...item, associations, quote_history });
  });

  // POST /api/items
  router.post('/', (req, res) => {
    const {
      title, photo_url, source = 'manual', hidden = 0,
      quantity_in_stock = 0, unit_price = 0, category, description, contract_description,
      taxable = 1, labor_hours = 0, is_subrental = 0, vendor_id, item_type = 'product'
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    try {
      const result = db.prepare(`
        INSERT INTO items (title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description, contract_description, taxable, labor_hours, is_subrental, vendor_id, item_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title, photo_url || null, source, hidden ? 1 : 0,
        quantity_in_stock, unit_price, category || null, description || null,
        contract_description || null, taxable ? 1 : 0,
        labor_hours != null ? labor_hours : 0,
        is_subrental ? 1 : 0, vendor_id != null ? vendor_id : null,
        item_type || 'product'
      );
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ item });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Title already exists' });
      res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/items/:id
  router.put('/:id', (req, res) => {
    const {
      title, photo_url, source, hidden,
      quantity_in_stock, unit_price, category, description, contract_description,
      taxable, labor_hours, is_subrental, vendor_id, item_type
    } = req.body;
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    db.prepare(`
      UPDATE items SET
        title                = COALESCE(?, title),
        photo_url            = COALESCE(?, photo_url),
        source               = COALESCE(?, source),
        hidden               = COALESCE(?, hidden),
        quantity_in_stock    = COALESCE(?, quantity_in_stock),
        unit_price           = COALESCE(?, unit_price),
        category             = COALESCE(?, category),
        description          = COALESCE(?, description),
        contract_description = COALESCE(?, contract_description),
        taxable              = COALESCE(?, taxable),
        labor_hours          = COALESCE(?, labor_hours),
        is_subrental         = COALESCE(?, is_subrental),
        vendor_id            = COALESCE(?, vendor_id),
        item_type            = COALESCE(?, item_type),
        updated_at           = datetime('now')
      WHERE id = ?
    `).run(
      title || null,
      photo_url !== undefined ? photo_url : null,
      source || null,
      hidden !== undefined ? (hidden ? 1 : 0) : null,
      quantity_in_stock != null ? quantity_in_stock : null,
      unit_price != null ? unit_price : null,
      category !== undefined ? (category || null) : null,
      description !== undefined ? (description || null) : null,
      contract_description !== undefined ? (contract_description || null) : null,
      taxable != null ? (taxable ? 1 : 0) : null,
      labor_hours !== undefined ? (labor_hours != null ? labor_hours : 0) : null,
      is_subrental !== undefined ? (is_subrental ? 1 : 0) : null,
      vendor_id !== undefined ? (vendor_id != null ? vendor_id : null) : null,
      item_type || null,
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
  // GET /api/items/:id/accessories — permanent accessories for a product
  router.get('/:id/accessories', (req, res) => {
    const items = db.prepare(`
      SELECT i.* FROM items i
      JOIN item_accessories ia ON ia.accessory_id = i.id
      WHERE ia.item_id = ?
      ORDER BY i.title ASC
    `).all(req.params.id);
    res.json({ items });
  });

  // POST /api/items/:id/accessories
  router.post('/:id/accessories', (req, res) => {
    const { accessory_id } = req.body;
    if (!accessory_id) return res.status(400).json({ error: 'accessory_id required' });
    try {
      db.prepare(
        'INSERT OR IGNORE INTO item_accessories (item_id, accessory_id) VALUES (?, ?)'
      ).run(req.params.id, accessory_id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE /api/items/:id/accessories/:accessory_id
  router.delete('/:id/accessories/:accessory_id', (req, res) => {
    db.prepare(
      'DELETE FROM item_accessories WHERE item_id = ? AND accessory_id = ?'
    ).run(req.params.id, req.params.accessory_id);
    res.json({ deleted: true });
  });

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
