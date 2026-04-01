const fs = require('fs');
const path = require('path');
const os = require('os');
const { getSettingValue, upsertSettingValue } = require('../db/queries/settings');
const { DB_PATH } = require('../db');

function resolveLogDir(db) {
  const configured = getSettingValue(db, 'diagnostics_log_path', '');
  const base = typeof process.pkg !== 'undefined'
    ? path.join(path.dirname(process.execPath), 'diagnostics')
    : path.join(__dirname, '../diagnostics');
  const dir = configured && configured.trim()
    ? path.resolve(configured)
    : base;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function isEnabled(db) {
  return getSettingValue(db, 'diagnostics_enabled', '0') === '1';
}

function getHealthIntervalMs(db) {
  const raw = getSettingValue(db, 'diagnostics_health_interval_sec', '');
  const n = Number(raw || 60);
  if (!Number.isFinite(n) || n <= 0) return 60_000;
  const clamped = Math.max(10, Math.min(3600, n));
  return clamped * 1000;
}

function writeJsonLine(logDir, filename, payload) {
  try {
    const full = path.join(logDir, filename);
    const line = JSON.stringify(payload) + os.EOL;
    fs.appendFileSync(full, line);
  } catch (e) {
    // Best-effort only; never throw from diagnostics.
    // eslint-disable-next-line no-console
    console.error('[diagnostics] Failed to write log:', e && e.message);
  }
}

function captureProcessSnapshot(extra) {
  return {
    ts: new Date().toISOString(),
    pid: process.pid,
    argv: process.argv,
    nodeVersion: process.version,
    platform: process.platform,
    release: process.release,
    env: {
      NODE_ENV: process.env.NODE_ENV || null,
      PORT: process.env.PORT || null,
    },
    memory: process.memoryUsage(),
    uptimeSec: process.uptime(),
    dbPath: DB_PATH,
    ...extra,
  };
}

function createRequestRecorder(maxEntries) {
  const entries = [];
  return {
    middleware(req, res, next) {
      const start = Date.now();
      const info = {
        ts: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection?.remoteAddress || null,
        userId: req.user && (req.user.id || req.user.sub) || null,
        status: null,
        durationMs: null,
      };
      res.on('finish', () => {
        info.status = res.statusCode;
        info.durationMs = Date.now() - start;
      });
      entries.push(info);
      if (entries.length > maxEntries) entries.shift();
      next();
    },
    getSnapshot() {
      return entries.slice();
    },
  };
}

function initDiagnostics(db, app) {
  if (!isEnabled(db)) {
    return { enabled: false, release: () => {} };
  }

  const logDir = resolveLogDir(db);
  upsertSettingValue(db, 'diagnostics_log_path', logDir);

  const recorder = createRequestRecorder(50);
  app.use(recorder.middleware);

  const healthIntervalMs = getHealthIntervalMs(db);
  const healthTimer = setInterval(() => {
    const payload = captureProcessSnapshot({
      kind: 'health',
      recentRequests: recorder.getSnapshot(),
    });
    writeJsonLine(logDir, 'health.log', payload);
  }, healthIntervalMs);
  if (healthTimer.unref) healthTimer.unref();

  let lastErrorContext = null;

  function recordPreCrashContext(kind, data) {
    lastErrorContext = {
      kind,
      data,
      at: new Date().toISOString(),
      recentRequests: recorder.getSnapshot(),
    };
    const payload = captureProcessSnapshot({
      kind,
      preCrash: lastErrorContext,
    });
    writeJsonLine(logDir, 'precrash.log', payload);
  }

  function writeCrashDump(kind, err) {
    const payload = captureProcessSnapshot({
      kind,
      error: {
        message: err && err.message,
        stack: err && err.stack,
        name: err && err.name,
      },
      lastErrorContext,
      recentRequests: recorder.getSnapshot(),
    });
    const filename = 'crash-' + Date.now() + '.log';
    writeJsonLine(logDir, filename, payload);
  }

  return {
    enabled: true,
    logDir,
    recordPreCrashContext,
    writeCrashDump,
    getRecentRequests: recorder.getSnapshot,
    release() {
      clearInterval(healthTimer);
    },
  };
}

module.exports = {
  initDiagnostics,
};

