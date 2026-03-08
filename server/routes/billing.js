module.exports = function makeRouter(db) {
  const express = require('express');
  const router = express.Router();

  // GET /api/billing/history — all billing history for Billing page (payment_received, payment_removed, refunded)
  router.get('/history', (req, res) => {
    let rows = [];
    try {
      rows = db.prepare(`
        SELECT bh.id, bh.quote_id, bh.event_type, bh.amount, bh.note, bh.created_at, bh.user_email,
               q.name AS quote_name
        FROM billing_history bh
        JOIN quotes q ON q.id = bh.quote_id
        ORDER BY bh.created_at DESC
        LIMIT 500
      `).all();
    } catch (e) {}
    res.json({ history: rows });
  });

  return router;
};
