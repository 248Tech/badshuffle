const express = require('express');

const ALLOWED_KEYS = ['tax_rate', 'currency', 'company_name', 'company_email'];

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/settings
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  });

  // PUT /api/settings
  router.put('/', (req, res) => {
    const body = req.body || {};
    const keys = Object.keys(body).filter(k => ALLOWED_KEYS.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid keys provided' });

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const k of keys) {
      stmt.run(k, String(body[k] ?? ''));
    }

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  });

  return router;
};
