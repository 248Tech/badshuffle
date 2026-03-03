const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/stats
  router.get('/', (req, res) => {
    const stats = db.prepare(`
      SELECT
        i.id, i.title, i.photo_url, i.source,
        COALESCE(s.times_quoted, 0) as times_quoted,
        COALESCE(s.total_guests, 0) as total_guests,
        s.last_used_at,
        CASE
          WHEN COALESCE(s.total_guests, 0) = 0 THEN 0
          ELSE ROUND(CAST(s.times_quoted AS REAL) / NULLIF(s.total_guests, 0) * 100, 1)
        END as probability_pct
      FROM items i
      LEFT JOIN item_stats s ON s.item_id = i.id
      WHERE i.hidden = 0
      ORDER BY times_quoted DESC, i.title ASC
    `).all();

    res.json({ stats });
  });

  // GET /api/stats/:item_id
  router.get('/:item_id', (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.item_id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const stat = db.prepare('SELECT * FROM item_stats WHERE item_id = ?').get(req.params.item_id);
    const brackets = db.prepare(
      'SELECT * FROM usage_brackets WHERE item_id = ? ORDER BY bracket_min ASC'
    ).all(req.params.item_id);

    res.json({ item, stat: stat || null, brackets });
  });

  return router;
};
