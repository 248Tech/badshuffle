/**
 * BadShuffle API v1 — versioned, consistent response envelope.
 * All responses use { data, meta } (success) or { error: { code, message }, meta } (error).
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const jwt = require('jsonwebtoken');
const envelopeMiddleware = require('../lib/apiEnvelope');
const { verifyFileServe, getSignedFileServePath } = require('../lib/fileServeAuth');
const { safeFilename } = require('../lib/safeFilename');

module.exports = function createV1Router(db, opts) {
  const { auth, requireAdmin, requireOperator, UPLOADS_DIR } = opts;
  const router = express.Router();
  const jwtSecret = () => process.env.JWT_SECRET || 'change-me';

  router.use(envelopeMiddleware);

  // Health (v1)
  router.get('/health', (req, res) => res.json({ ok: true }));

  // Auth (public)
  router.use('/auth', require('../routes/auth')(db));

  // Extension (public)
  router.use('/extension', require('../routes/extension'));

  // Proxy image (public)
  router.use('/proxy-image', require('../lib/imageProxy'));

  // File serve — allowed with Bearer auth OR valid signed URL (binary, no envelope)
  router.get('/files/:id/serve', (req, res) => {
    const fileId = req.params.id;
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    if (!file) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let allowed = false;
    if (bearer) {
      try {
        jwt.verify(bearer, jwtSecret());
        allowed = true;
      } catch {}
    }
    if (!allowed && req.query.sig && req.query.exp) {
      allowed = verifyFileServe(fileId, req.query.sig, req.query.exp);
    }
    if (!allowed) return res.status(401).json({ error: 'Unauthorized' });

    const filename = safeFilename(file.original_name);
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });

  // Public quote by token (no auth) — add signed file URLs for images
  router.get('/quotes/public/:token', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(req.params.token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const allItems = db.prepare(`
      SELECT qi.id as qitem_id, qi.quantity, qi.label, qi.sort_order, qi.hidden_from_quote,
             i.id, i.title, i.photo_url, i.unit_price, i.taxable, i.category, i.description
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id = ?
      ORDER BY qi.sort_order ASC, qi.id ASC
    `).all(quote.id);
    const items = allItems.filter(r => !r.hidden_from_quote);
    const customItems = db.prepare(
      'SELECT * FROM quote_custom_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(quote.id);
    const addSignedPhoto = (row) => {
      const pu = row.photo_url;
      if (pu != null && String(pu).trim() !== '' && /^\d+$/.test(String(pu).trim())) {
        row.signed_photo_url = getSignedFileServePath(String(pu).trim(), '/api/v1/files');
      }
      return row;
    };
    items.forEach(addSignedPhoto);
    customItems.forEach(addSignedPhoto);
    let contract = null;
    try {
      contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quote.id);
    } catch (e) {}
    const settingRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('company_name', 'company_email', 'company_logo')").all();
    const company = {};
    for (const r of settingRows) company[r.key] = r.value != null ? String(r.value) : '';
    let company_logo = company.company_logo ?? '';
    const signed_company_logo = (company_logo && /^\d+$/.test(String(company_logo).trim()))
      ? getSignedFileServePath(String(company_logo).trim(), '/api/v1/files') : null;
    res.json({
      ...quote,
      items,
      customItems,
      contract,
      company_name: company.company_name ?? '',
      company_email: company.company_email ?? '',
      company_logo: company_logo,
      signed_company_logo,
    });
  });

  router.post('/quotes/approve-by-token', (req, res) => {
    const token = (req.body && req.body.token) || '';
    if (!token) return res.status(400).json({ error: 'token required' });
    const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    db.prepare("UPDATE quotes SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(quote.id);
    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote.id);
    res.json({ quote: updated });
  });

  router.post('/quotes/contract/sign', (req, res) => {
    const token = (req.body && req.body.token) || '';
    const { signature_data, signer_name } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token required' });
    const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    let contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quote.id);
    if (!contract) {
      db.prepare('INSERT INTO contracts (quote_id, body_html, signed_at, signature_data, signer_name) VALUES (?, ?, datetime(\'now\'), ?, ?)')
        .run(quote.id, null, signature_data || null, signer_name || null);
    } else if (!contract.signed_at) {
      db.prepare('UPDATE contracts SET signed_at = datetime(\'now\'), signature_data = ?, signer_name = ?, updated_at = datetime(\'now\') WHERE quote_id = ?')
        .run(signature_data || null, signer_name || null, quote.id);
    }
    contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quote.id);
    res.json({ contract });
  });

  // Protected routes (auth, requireOperator, requireAdmin are from opts — already bound)
  router.use('/files', auth, require('../routes/files')(db, UPLOADS_DIR));
  router.use('/items', auth, require('../routes/items')(db));
  router.use('/sheets', auth, require('../routes/sheets')(db));
  router.use('/quotes', auth, require('../routes/quotes')(db, UPLOADS_DIR));
  router.use('/stats', auth, require('../routes/stats')(db));
  router.use('/ai', auth, require('../routes/ai')(db));
  router.use('/settings', auth, requireOperator, require('../routes/settings')(db));
  router.use('/templates', auth, requireOperator, require('../routes/templates')(db));
  router.use('/leads', auth, require('../routes/leads')(db));
  router.use('/messages', auth, require('../routes/messages')(db));
  router.use('/admin', requireAdmin, require('../routes/admin')(db));
  router.use('/billing', auth, requireOperator, require('../routes/billing')(db));
  router.use('/presence', auth, require('../routes/presence')());

  // OpenAPI spec (JSON) — no envelope so tools can consume raw spec
  router.get('/openapi.json', (req, res) => {
    const specPath = path.join(__dirname, 'openapi.json');
    if (!fs.existsSync(specPath)) return res.status(404).json({ error: 'OpenAPI spec not found' });
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(spec));
  });

  // API docs (Swagger UI) — skip envelope
  router.get('/docs', (req, res) => {
    const base = (req.get('x-forwarded-proto') && req.get('x-forwarded-host'))
      ? `${req.get('x-forwarded-proto')}://${req.get('x-forwarded-host')}`
      : `${req.protocol}://${req.get('host')}`;
    const specUrl = `${base}/api/v1/openapi.json`;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>BadShuffle API v1</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: "${specUrl}", dom_id: '#swagger-ui' });
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // v1 404
  router.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  return router;
};
