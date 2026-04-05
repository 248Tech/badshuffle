const express = require('express');

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildRangeWindow(rawRange) {
  const range = String(rawRange || 'lifetime').trim().toLowerCase();
  const today = startOfDay(new Date());
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisWeekStart = addDays(today, mondayOffset);
  const thisWeekEnd = addDays(thisWeekStart, 6);

  switch (range) {
    case 'past_year':
      return { key: range, start: formatDate(addDays(today, -365)), end: formatDate(today) };
    case 'last_6_months':
      return { key: range, start: formatDate(addDays(today, -183)), end: formatDate(today) };
    case 'last_30_days':
      return { key: range, start: formatDate(addDays(today, -30)), end: formatDate(today) };
    case 'last_week':
      return { key: range, start: formatDate(addDays(thisWeekStart, -7)), end: formatDate(addDays(thisWeekStart, -1)) };
    case 'this_week':
      return { key: range, start: formatDate(thisWeekStart), end: formatDate(thisWeekEnd) };
    case 'next_week':
      return { key: range, start: formatDate(addDays(thisWeekStart, 7)), end: formatDate(addDays(thisWeekEnd, 7)) };
    case 'next_30_days':
      return { key: range, start: formatDate(today), end: formatDate(addDays(today, 30)) };
    case 'next_6_months':
      return { key: range, start: formatDate(today), end: formatDate(addDays(today, 183)) };
    case 'next_year':
      return { key: range, start: formatDate(today), end: formatDate(addDays(today, 365)) };
    case 'lifetime':
    default:
      return { key: 'lifetime', start: null, end: null };
  }
}

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/stats
  router.get('/', (req, res) => {
    const window = buildRangeWindow(req.query.range);
    const params = [];
    let dateWhere = '';
    if (window.start && window.end) {
      dateWhere = `
        WHERE
          COALESCE(q.delivery_date, q.rental_start, q.event_date, q.pickup_date, q.rental_end) IS NOT NULL
          AND COALESCE(q.pickup_date, q.rental_end, q.event_date, q.delivery_date, q.rental_start) IS NOT NULL
          AND COALESCE(q.pickup_date, q.rental_end, q.event_date, q.delivery_date, q.rental_start) >= ?
          AND COALESCE(q.delivery_date, q.rental_start, q.event_date, q.pickup_date, q.rental_end) <= ?
      `;
      params.push(window.start, window.end);
    }

    const stats = db.prepare(`
      SELECT
        i.id, i.title, i.photo_url, i.source,
        COALESCE(a.times_quoted, 0) AS times_quoted,
        COALESCE(a.total_guests, 0) AS total_guests,
        COALESCE(a.sales_total, 0) AS sales_total,
        a.last_used_at,
        CASE
          WHEN COALESCE(a.total_guests, 0) = 0 THEN 0
          ELSE ROUND(CAST(COALESCE(a.times_quoted, 0) AS REAL) / NULLIF(a.total_guests, 0) * 100, 1)
        END AS probability_pct
      FROM items i
      LEFT JOIN (
        SELECT
          qi.item_id,
          COUNT(*) AS times_quoted,
          COALESCE(SUM(COALESCE(q.guest_count, 0)), 0) AS total_guests,
          COALESCE(SUM(
            MAX(0,
              CASE
                WHEN qi.discount_type = 'percent' THEN COALESCE(qi.unit_price_override, it.unit_price, 0) * (1 - (COALESCE(qi.discount_amount, 0) / 100.0))
                WHEN qi.discount_type = 'fixed' THEN COALESCE(qi.unit_price_override, it.unit_price, 0) - COALESCE(qi.discount_amount, 0)
                ELSE COALESCE(qi.unit_price_override, it.unit_price, 0)
              END
            ) * COALESCE(qi.quantity, 0)
          ), 0) AS sales_total,
          MAX(COALESCE(q.event_date, q.updated_at, q.created_at)) AS last_used_at
        FROM quote_items qi
        JOIN quotes q ON q.id = qi.quote_id
        JOIN items it ON it.id = qi.item_id
        ${dateWhere}
        GROUP BY qi.item_id
      ) a ON a.item_id = i.id
      WHERE i.hidden = 0
      ORDER BY sales_total DESC, times_quoted DESC, i.title ASC
    `).all(...params);

    res.json({ stats, range: window.key, window });
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
