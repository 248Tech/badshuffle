const express = require('express');
const { fetchCsv } = require('../lib/sheetsParser');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // POST /api/sheets/preview
  router.post('/preview', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
      const result = await fetchCsv(url);
      const columns = result.meta.fields || [];
      const preview = result.data.slice(0, 10);
      res.json({ columns, preview, total: result.data.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/sheets/import
  router.post('/import', async (req, res) => {
    const { url, title_column, photo_column } = req.body;
    if (!url || !title_column) {
      return res.status(400).json({ error: 'url and title_column required' });
    }

    try {
      const result = await fetchCsv(url);
      const rows = result.data;

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      const upsertMany = db.transaction((rows) => {
        for (const row of rows) {
          const title = row[title_column] ? String(row[title_column]).trim() : '';
          if (!title) { skipped++; continue; }

          const photo_url = photo_column ? (row[photo_column] ? String(row[photo_column]).trim() : null) : null;
          const existing = db.prepare('SELECT id FROM items WHERE title = ? COLLATE NOCASE').get(title);

          if (existing) {
            db.prepare(`
              UPDATE items SET
                photo_url  = COALESCE(?, photo_url),
                source     = 'sheet',
                updated_at = datetime('now')
              WHERE id = ?
            `).run(photo_url || null, existing.id);
            updated++;
          } else {
            db.prepare(
              "INSERT INTO items (title, photo_url, source, hidden) VALUES (?, ?, 'sheet', 0)"
            ).run(title, photo_url || null);
            imported++;
          }
        }
      });

      upsertMany(rows);

      res.json({ imported, updated, skipped, total: rows.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};
