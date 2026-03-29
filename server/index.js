// BadShuffle server — app version in repo root package.json (0.x pre-release)
const path = require('path');
const fs = require('fs');
const dotenvPath = typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), '.env')
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });

// Require strong JWT_SECRET in production
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change-me') {
    console.error('Fatal: JWT_SECRET must be set to a strong random value in production (not "change-me").');
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const initDb = require('./db');
const requireAuth = require('./lib/authMiddleware');
const requireAdmin = require('./lib/adminMiddleware');
const requireOperator = require('./lib/operatorMiddleware');
const authRouter = require('./routes/auth');
const singleInstance = require('./services/singleInstance');
const updateCheck = require('./services/updateCheck');
const quoteService = require('./services/quoteService');
const jwt = require('jsonwebtoken');
const { verifyFileServe, getSignedFileServePath } = require('./lib/fileServeAuth');
const { safeFilename } = require('./lib/safeFilename');
let emailPoller;
try {
  emailPoller = require('./services/emailPoller');
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.warn('[emailPoller] Optional dependency missing (imapflow). Run: npm install --prefix server. IMAP polling disabled.');
    emailPoller = { startPolling: () => {}, stopPolling: () => {} };
  } else throw e;
}

const PREFERRED_PORT = Number(process.env.PORT) || 3001;
const PORT_CONFIGURED = !!process.env.PORT;

function findOpenPort(port) {
  return new Promise((resolve, reject) => {
    const srv = require('net').createServer();
    srv.listen(port, '127.0.0.1', () => { srv.close(() => resolve(port)); });
    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(findOpenPort(port + 1));
      else reject(err);
    });
  });
}

// Resolve uploads directory (works both in dev and pkg)
const UPLOADS_DIR = process.env.UPLOADS_DIR || (typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'uploads')
  : path.join(__dirname, '../uploads'));

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

process.on('uncaughtException', (err) => {
  console.error('[process] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection:', reason);
});

async function start() {
  const db = await initDb();
  console.log('Database initialized');

  // Single-instance guard — kill any prior Badshuffle server if autokill is enabled
  const autokillRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('autokill_enabled');
  const autokillEnabled = (autokillRow ? autokillRow.value : '1') !== '0';
  await singleInstance.acquire(autokillEnabled);

  // Ensure lock is released on exit
  function releaseLock() { singleInstance.release(); }
  process.on('exit',   releaseLock);
  process.on('SIGTERM', function() { emailPoller.stopPolling(); releaseLock(); process.exit(0); });
  process.on('SIGINT',  function() { emailPoller.stopPolling(); releaseLock(); process.exit(0); });

  const app = express();

  app.use(cors({
    origin: (origin, cb) => {
      const allowed = [
        ...(process.env.APP_URL ? [process.env.APP_URL] : []),
      ];
      const isLocalhost = origin && /^http:\/\/localhost(:\d+)?$/.test(origin);
      if (!origin || isLocalhost || allowed.includes(origin) || /^chrome-extension:\/\//.test(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '20mb' }));

  // Public routes — no auth
  app.use('/api/auth', authRouter(db));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/extension', require('./routes/extension'));
  app.use('/api/proxy-image', require('./lib/imageProxy'));

  // File serve — allowed with Bearer auth OR valid signed URL (for public quote images)
  app.get('/api/files/:id/serve', (req, res) => {
    const fileId = req.params.id;
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    if (!file) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const secret = process.env.JWT_SECRET || 'change-me';
    let allowed = false;
    if (bearer || queryToken) {
      try {
        jwt.verify(bearer || queryToken, secret);
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

  // Public quote view (no auth) — add signed file URLs for images so public page can load them
  app.get('/api/quotes/public/:token', (req, res) => {
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
        row.signed_photo_url = getSignedFileServePath(String(pu).trim(), '/api/files');
      }
      return row;
    };
    items.forEach(addSignedPhoto);
    customItems.forEach(addSignedPhoto);
    let contract = null;
    try {
      contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quote.id);
    } catch (e) { /* contracts table may not exist yet */ }
    const settingRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('company_name', 'company_email', 'company_logo')").all();
    const company = {};
    for (const r of settingRows) company[r.key] = r.value != null ? String(r.value) : '';
    const company_name = company.company_name ?? '';
    const company_email = company.company_email ?? '';
    let company_logo = company.company_logo ?? '';
    const signed_company_logo = (company_logo && /^\d+$/.test(String(company_logo).trim()))
      ? getSignedFileServePath(String(company_logo).trim(), '/api/files') : null;
    let adjustments = [];
    try {
      adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(quote.id);
    } catch (e) {}
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
      company_name,
      company_email,
      company_logo,
      signed_company_logo,
      is_expired: isExpired,
      payment_policy,
      rental_terms,
    });
  });

  // Public quote approve by token (no auth)
  app.post('/api/quotes/approve-by-token', (req, res) => {
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

  // Public: get messages for a quote by token (client-facing thread)
  app.get('/api/quotes/public/:token/messages', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(req.params.token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const messages = db.prepare(
      'SELECT * FROM messages WHERE quote_id = ? ORDER BY sent_at ASC'
    ).all(quote.id);
    res.json({ messages });
  });

  // Public: client sends a message via quote token (no auth)
  app.post('/api/quotes/public/:token/messages', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(req.params.token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const { body_text, from_name, from_email } = req.body || {};
    if (!body_text || !String(body_text).trim()) return res.status(400).json({ error: 'Message required' });
    try {
      db.prepare(`
        INSERT INTO messages (quote_id, direction, from_email, to_email, subject, body_text, status, sent_at, quote_name)
        VALUES (?, 'inbound', ?, NULL, ?, ?, 'unread', datetime('now'), ?)
      `).run(
        quote.id,
        from_email || from_name || 'Client',
        'Message from ' + (from_name || 'client'),
        String(body_text).trim(),
        quote.name || ''
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Public contract sign by token (no auth)
  app.post('/api/quotes/contract/sign', (req, res) => {
    try {
      const result = quoteService.signPublicContract({
        db,
        uploadsDir: UPLOADS_DIR,
        token: (req.body && req.body.token) || '',
        signerName: (req.body && req.body.signer_name) || '',
        signerIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
        signerUserAgent: req.get('user-agent') || '',
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // Protected routes
  const auth = requireAuth(db);
  const requireOperatorDb = requireOperator(db);
  const requireAdminDb = requireAdmin(db);

  // API v1 — versioned, envelope responses at /api/v1
  const createV1Router = require('./api/v1');
  app.use('/api/v1', createV1Router(db, {
    auth,
    requireAdmin: requireAdminDb,
    requireOperator: requireOperatorDb,
    UPLOADS_DIR,
  }));

  app.use('/api/files',     auth, require('./routes/files')(db, UPLOADS_DIR));
  app.use('/api/items',       requireAuth(db, { allowExtension: true }), require('./routes/items')(db));
  app.use('/api/sheets',      requireAuth(db, { allowExtension: true }), require('./routes/sheets')(db));
  app.use('/api/quotes',      auth, require('./routes/quotes')(db, UPLOADS_DIR));
  app.use('/api/stats',       auth, require('./routes/stats')(db));
  app.use('/api/ai',          auth, require('./routes/ai')(db));
  app.use('/api/settings',    auth, requireOperatorDb, require('./routes/settings')(db));
  app.use('/api/templates',   auth, requireOperatorDb, require('./routes/templates')(db));
  app.use('/api/leads',       auth, require('./routes/leads')(db));
  app.use('/api/messages',    auth, require('./routes/messages')(db));
  app.use('/api/admin',       requireAdminDb, require('./routes/admin')(db));
  app.use('/api/billing',       auth, requireOperatorDb, require('./routes/billing')(db));
  app.use('/api/presence',      auth, require('./routes/presence')());
  app.use('/api/vendors',       auth, require('./routes/vendors')(db));
  app.use('/api/availability',  auth, require('./routes/availability')(db));
  app.use('/api/updates',       auth, require('./routes/updates')(db));

  // Public catalog — no auth (JSON API + server-rendered HTML + sitemap + robots)
  app.use(require('./routes/publicCatalog')(db));

  // API 404 — return JSON so clients get a consistent error shape
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // Global error handler — catches unhandled throws in route handlers and returns JSON
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[unhandled error]', err);
    const verboseRow = db.prepare("SELECT value FROM settings WHERE key = 'verbose_errors'").get();
    const verbose = verboseRow && verboseRow.value === '1';
    res.status(500).json({ error: verbose ? err.message : 'Internal server error' });
  });

  // Serve built React client (production/Docker)
  const CLIENT_DIST = path.join(__dirname, '../client/dist');
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  const PORT = PORT_CONFIGURED ? PREFERRED_PORT : await findOpenPort(PREFERRED_PORT);
  if (!PORT_CONFIGURED && PORT !== PREFERRED_PORT) {
    console.log(`[port] Port ${PREFERRED_PORT} in use — using ${PORT} instead.`);
  }

  app.listen(PORT, () => {
    singleInstance.updateLock({ port: PORT });
    console.log(`BadShuffle server running on http://localhost:${PORT}`);
    updateCheck.run(db).catch(function() {});
    emailPoller.startPolling(db, 5 * 60 * 1000);
  });
}

start().catch(e => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
