const path = require('path');
const dotenvPath = typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), '.env')
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });
const express = require('express');
const cors = require('cors');
const initDb = require('./db');
const requireAuth = require('./lib/authMiddleware');
const requireAdmin = require('./lib/adminMiddleware');
const authRouter = require('./routes/auth');
const singleInstance = require('./services/singleInstance');
const updateCheck = require('./services/updateCheck');

const PORT = process.env.PORT || 3001;

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
  process.on('SIGTERM', function() { releaseLock(); process.exit(0); });
  process.on('SIGINT',  function() { releaseLock(); process.exit(0); });

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

  // Protected routes
  const auth = requireAuth(db);
  app.use('/api/items',       auth, require('./routes/items')(db));
  app.use('/api/sheets',      auth, require('./routes/sheets')(db));
  app.use('/api/quotes',      auth, require('./routes/quotes')(db));
  app.use('/api/stats',       auth, require('./routes/stats')(db));
  app.use('/api/ai',          auth, require('./routes/ai')(db));
  app.use('/api/proxy-image', auth, require('./lib/imageProxy'));
  app.use('/api/settings',    auth, require('./routes/settings')(db));
  app.use('/api/leads',       auth, require('./routes/leads')(db));
  app.use('/api/admin',       requireAdmin(db), require('./routes/admin')(db));

  app.listen(PORT, () => {
    console.log(`BadShuffle server running on http://localhost:${PORT}`);
    // Non-blocking startup update check
    updateCheck.run(db).catch(function() {});
  });
}

start().catch(e => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
