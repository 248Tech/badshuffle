const express = require('express');
const { encrypt, decrypt } = require('../lib/crypto');

const ALLOWED_KEYS = [
  'tax_rate', 'currency', 'company_name', 'company_email', 'company_logo',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass_enc', 'smtp_from',
  'imap_host', 'imap_port', 'imap_secure', 'imap_user', 'imap_pass_enc', 'imap_poll_enabled',
  'quote_inventory_filter_mode', 'quote_inventory_max_categories', 'quote_inventory_manual_categories',
  'recaptcha_enabled', 'recaptcha_site_key', 'recaptcha_secret_key',
  'company_address', 'mapbox_access_token', 'map_default_style', 'google_places_api_key', 'count_oos_oversold',
  'ai_claude_key_enc', 'ai_openai_key_enc', 'ai_gemini_key_enc',
  'ai_suggest_enabled', 'ai_suggest_model',
  'ai_pdf_import_enabled', 'ai_pdf_import_model',
  'ai_email_draft_enabled', 'ai_email_draft_model',
  'ai_description_enabled', 'ai_description_model',
  'ui_theme',
];

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/settings
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      if (row.key === 'smtp_pass_enc') {
        settings['smtp_pass'] = decrypt(row.value);
      } else if (row.key === 'imap_pass_enc') {
        settings['imap_pass'] = decrypt(row.value);
      } else if (row.key === 'ai_claude_key_enc') {
        settings['ai_claude_key'] = decrypt(row.value);
      } else if (row.key === 'ai_openai_key_enc') {
        settings['ai_openai_key'] = decrypt(row.value);
      } else if (row.key === 'ai_gemini_key_enc') {
        settings['ai_gemini_key'] = decrypt(row.value);
      } else {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  });

  // PUT /api/settings
  router.put('/', (req, res) => {
    const body = req.body || {};
    // Also accept smtp_pass/imap_pass as aliases (encrypt + store as _enc)
    if (body.smtp_pass !== undefined) body.smtp_pass_enc = body.smtp_pass;
    if (body.imap_pass !== undefined) body.imap_pass_enc = body.imap_pass;
    // Accept ai_*_key as aliases for encrypted variants
    if (body.ai_claude_key !== undefined) body.ai_claude_key_enc = body.ai_claude_key;
    if (body.ai_openai_key !== undefined) body.ai_openai_key_enc = body.ai_openai_key;
    if (body.ai_gemini_key !== undefined) body.ai_gemini_key_enc = body.ai_gemini_key;

    const keys = Object.keys(body).filter(k => ALLOWED_KEYS.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'No valid keys provided' });

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const k of keys) {
      let val = String(body[k] !== null && body[k] !== undefined ? body[k] : '');
      if (k === 'smtp_pass_enc' || k === 'imap_pass_enc' || k === 'ai_claude_key_enc' || k === 'ai_openai_key_enc' || k === 'ai_gemini_key_enc') val = encrypt(val);
      stmt.run(k, val);
    }

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      if (row.key === 'smtp_pass_enc') {
        settings['smtp_pass'] = decrypt(row.value);
      } else if (row.key === 'imap_pass_enc') {
        settings['imap_pass'] = decrypt(row.value);
      } else if (row.key === 'ai_claude_key_enc') {
        settings['ai_claude_key'] = decrypt(row.value);
      } else if (row.key === 'ai_openai_key_enc') {
        settings['ai_openai_key'] = decrypt(row.value);
      } else if (row.key === 'ai_gemini_key_enc') {
        settings['ai_gemini_key'] = decrypt(row.value);
      } else {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  });

  // POST /api/settings/test-imap
  router.post('/test-imap', async (req, res) => {
    const { imap_host, imap_port, imap_secure, imap_user, imap_pass } = req.body || {};
    if (!imap_host || !imap_user) {
      return res.status(400).json({ error: 'imap_host and imap_user are required' });
    }
    try {
      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: imap_host,
        port: parseInt(imap_port || '993'),
        secure: imap_secure !== false && imap_secure !== 'false',
        auth: { user: imap_user, pass: imap_pass || '' },
        logger: false
      });
      await client.connect();
      await client.logout();
      res.json({ ok: true, message: 'IMAP connection successful' });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  return router;
};
