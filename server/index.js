const path = require('path');
const fs = require('fs');
const dotenvPath = typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), '.env')
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });
const express = require('express');
const cors = require('cors');
const initDb = require('./db');
const requireAuth = require('./lib/authMiddleware');
const requireAdmin = require('./lib/adminMiddleware');
const requireOperator = require('./lib/operatorMiddleware');
const authRouter = require('./routes/auth');
const singleInstance = require('./services/singleInstance');
const updateCheck = require('./services/updateCheck');
const emailPoller = require('./services/emailPoller');

const PORT = process.env.PORT || 3001;

// Resolve uploads directory (works both in dev and pkg)
const UPLOADS_DIR = typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'uploads')
  : path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
        'http://localhost:5173',
        'http://localhost:5174'
      ];
      if (!origin || allowed.includes(origin) || /^chrome-extension:\/\//.test(origin)) {
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

  // Public file serve — must be before auth so <img> tags work without Authorization header
  app.get('/api/files/:id/serve', (req, res) => {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Disposition', 'inline; filename="' + file.original_name.replace(/"/g, '') + '"');
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });

  // Public quote view (no auth)
  app.get('/api/quotes/public/:token', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(req.params.token);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const items = db.prepare(`
      SELECT qi.id as qitem_id, qi.quantity, qi.label, qi.sort_order,
             i.id, i.title, i.photo_url, i.unit_price, i.taxable, i.category
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id = ?
      ORDER BY qi.sort_order ASC, qi.id ASC
    `).all(quote.id);
    const customItems = db.prepare(
      'SELECT * FROM quote_custom_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(quote.id);
    res.json({ ...quote, items, customItems });
  });

  // Protected routes
  const auth = requireAuth(db);
  app.use('/api/files',     auth, require('./routes/files')(db, UPLOADS_DIR));
  app.use('/api/items',       auth, require('./routes/items')(db));
  app.use('/api/sheets',      auth, require('./routes/sheets')(db));
  app.use('/api/quotes',      auth, require('./routes/quotes')(db, UPLOADS_DIR));
  app.use('/api/stats',       auth, require('./routes/stats')(db));
  app.use('/api/ai',          auth, require('./routes/ai')(db));
  app.use('/api/settings',    auth, requireOperator(db), require('./routes/settings')(db));
  app.use('/api/templates',   auth, requireOperator(db), require('./routes/templates')(db));
  app.use('/api/leads',       auth, require('./routes/leads')(db));
  app.use('/api/messages',    auth, require('./routes/messages')(db));
  app.use('/api/admin',       requireAdmin(db), require('./routes/admin')(db));

  app.listen(PORT, () => {
    console.log(`BadShuffle server running on http://localhost:${PORT}`);
    // Non-blocking startup update check
    updateCheck.run(db).catch(function() {});
    // Start IMAP polling (no-op if not configured)
    emailPoller.startPolling(db, 5 * 60 * 1000);
  });
}

start().catch(e => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
