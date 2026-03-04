const express = require('express');
const { encrypt, decrypt } = require('../lib/crypto');
const requireOperator = require('../lib/operatorMiddleware');

const ALLOWED_KEYS = [
  'tax_rate', 'currency', 'company_name', 'company_email',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass_enc', 'smtp_from',
];

module.exports = function makeRouter(db) {
  const router = express.Router();
  const op = requireOperator(db);

  // GET /api/settings — any authenticated user can read
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      if (row.key === 'smtp_pass_enc') {
        settings['smtp_pass'] = decrypt(row.value); // client sees smtp_pass (decrypted)
      } else {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  });

  // PUT /api/settings — operator or admin only
  router.put('/', op, (req, res) => {
    const body = req.body || {};
    const keys = Object.keys(body).filter(k => ALLOWED_KEYS.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid keys provided' });

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const k of keys) {
      let val = String(body[k] ?? '');
      if (k === 'smtp_pass_enc') val = encrypt(val); // raw password comes in, encrypted goes out
      stmt.run(k, val);
    }

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      if (row.key === 'smtp_pass_enc') {
        settings['smtp_pass'] = decrypt(row.value);
      } else {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  });

  return router;
};
