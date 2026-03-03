const path = require('path');
const dotenvPath = typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), '.env')
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });
const express = require('express');
const cors = require('cors');
const initDb = require('./db');

const PORT = process.env.PORT || 3001;

async function start() {
  const db = await initDb();
  console.log('Database initialized');

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

  app.use('/api/items',  require('./routes/items')(db));
  app.use('/api/sheets', require('./routes/sheets')(db));
  app.use('/api/quotes', require('./routes/quotes')(db));
  app.use('/api/stats',  require('./routes/stats')(db));
  app.use('/api/ai',     require('./routes/ai')(db));
  app.use('/api/proxy-image', require('./lib/imageProxy'));
  app.use('/api/extension',  require('./routes/extension'));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.listen(PORT, () => {
    console.log(`BadShuffle server running on http://localhost:${PORT}`);
  });
}

start().catch(e => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
