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
const quoteService = require('../services/quoteService');

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
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
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
    const quote = db.prepare(`
      SELECT id, name, status, event_date, guest_count, expires_at, expiration_message,
             quote_notes, tax_rate,
             rental_start, rental_end, delivery_date, pickup_date,
             has_unsigned_changes, updated_at,
             client_first_name, client_last_name, client_email, client_phone, client_address,
             venue_name, venue_email, venue_phone, venue_address,
             payment_policy_id, rental_terms_id
      FROM quotes WHERE public_token = ?
    `).get(req.params.token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const today = new Date().toISOString().slice(0, 10);
    const isExpired = !!(quote.expires_at && quote.expires_at < today);
    let sections = db.prepare(
      'SELECT * FROM quote_item_sections WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(quote.id);
    if (sections.length === 0) {
      const result = db.prepare(
        'INSERT INTO quote_item_sections (quote_id, title, delivery_date, rental_start, rental_end, pickup_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, 0)'
      ).run(
        quote.id,
        'Quote Items',
        quote.delivery_date || null,
        quote.rental_start || null,
        quote.rental_end || null,
        quote.pickup_date || null
      );
      const sectionId = result.lastInsertRowid;
      db.prepare('UPDATE quote_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(sectionId, quote.id);
      db.prepare('UPDATE quote_custom_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(sectionId, quote.id);
      sections = db.prepare(
        'SELECT * FROM quote_item_sections WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
      ).all(quote.id);
    } else {
      const fallbackId = sections[0].id;
      db.prepare('UPDATE quote_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(fallbackId, quote.id);
      db.prepare('UPDATE quote_custom_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(fallbackId, quote.id);
      sections = db.prepare(
        'SELECT * FROM quote_item_sections WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
      ).all(quote.id);
    }
    const allItems = db.prepare(`
      SELECT qi.id as qitem_id, qi.quantity, qi.label, qi.sort_order, qi.hidden_from_quote, qi.section_id,
             qi.unit_price_override, qi.discount_type, qi.discount_amount, qi.description as qi_description,
             i.id, i.title, i.photo_url, i.unit_price, i.taxable, i.category, i.description
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id = ?
      ORDER BY qi.sort_order ASC, qi.id ASC
    `).all(quote.id);
    const items = allItems
      .filter(r => !r.hidden_from_quote)
      .map(r => ({ ...r, description: r.qi_description || r.description || null }));
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
    let adjustments = [];
    try {
      adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(quote.id);
    } catch (e) {}
    const settingRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('company_name', 'company_email', 'company_logo', 'company_address', 'quote_view_default', 'quote_view_standard_enabled', 'quote_view_contract_enabled')").all();
    const company = {};
    for (const r of settingRows) company[r.key] = r.value != null ? String(r.value) : '';
    let company_logo = company.company_logo ?? '';
    const signed_company_logo = (company_logo && /^\d+$/.test(String(company_logo).trim()))
      ? getSignedFileServePath(String(company_logo).trim(), '/api/v1/files') : null;

    // Fetch payment policy and rental terms if linked
    let payment_policy = null;
    let rental_terms = null;
    try {
      if (quote.payment_policy_id) {
        payment_policy = db.prepare('SELECT * FROM payment_policies WHERE id = ?').get(quote.payment_policy_id);
      }
    } catch (e) {}
    try {
      if (quote.rental_terms_id) {
        rental_terms = db.prepare('SELECT * FROM rental_terms WHERE id = ?').get(quote.rental_terms_id);
      }
    } catch (e) {}

    res.json({
      ...quote,
      items,
      customItems,
      sections,
      contract,
      adjustments,
      company_name: company.company_name ?? '',
      company_email: company.company_email ?? '',
      company_address: company.company_address ?? '',
      company_logo: company_logo,
      signed_company_logo,
      is_expired: isExpired,
      payment_policy,
      rental_terms,
      quote_view_default: company.quote_view_default ?? 'standard',
      quote_view_standard_enabled: company.quote_view_standard_enabled ?? '1',
      quote_view_contract_enabled: company.quote_view_contract_enabled ?? '1',
    });
  });

  router.post('/quotes/approve-by-token', (req, res) => {
    const token = (req.body && req.body.token) || '';
    if (!token) return res.status(400).json({ error: 'token required' });
    const quote = db.prepare('SELECT id, status, expires_at FROM quotes WHERE public_token = ?').get(token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const today = new Date().toISOString().slice(0, 10);
    if (quote.expires_at && quote.expires_at < today) {
      return res.status(400).json({ error: 'This quote has expired and can no longer be approved' });
    }
    if (quote.status !== 'sent') {
      return res.status(409).json({ error: 'Quote is not in an approvable state' });
    }
    db.prepare("UPDATE quotes SET status = 'approved', has_unsigned_changes = 0, updated_at = datetime('now') WHERE id = ? AND status = 'sent'").run(quote.id);
    const updated = db.prepare('SELECT id, status, has_unsigned_changes, updated_at FROM quotes WHERE id = ?').get(quote.id);
    res.json({ quote: updated });
  });

  router.post('/quotes/contract/sign', async (req, res) => {
    try {
      const result = await quoteService.signPublicContract({
        db,
        uploadsDir: UPLOADS_DIR,
        token: (req.body && req.body.token) || '',
        signerName: (req.body && req.body.signer_name) || '',
        signerIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
        signerUserAgent: req.get('user-agent') || '',
        diagnostics: req.app?.locals?.diagnostics || null,
        requestId: req.get('x-request-id') || null,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
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
