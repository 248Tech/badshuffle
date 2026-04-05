const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const archiver = require('archiver');
const fetch = require('node-fetch');
const { spawnSync } = require('child_process');
const { decrypt } = require('../lib/crypto');
const rustEngineClient = require('../services/rustEngineClient');
const rustInventoryParityService = require('../services/rustInventoryParityService');
const rustPricingParityService = require('../services/rustPricingParityService');
const rustEngineLifecycleService = require('../services/rustEngineLifecycleService');
const onyxLifecycleService = require('../services/onyxLifecycleService');
const localModelLifecycleService = require('../services/localModelLifecycleService');
const quotePatternMemoryService = require('../services/quotePatternMemoryService');
const packageJson = require('../../package.json');
const { buildIdentityFields, getUniqueUsername } = require('../db/queries/users');
const { PERMISSION_MODULES, normalizeAccessLevel } = require('../lib/permissions');
const {
  listRoles,
  getRoleByKey,
  listRolePermissions,
  upsertRole,
  updateRolePermissions,
} = require('../db/queries/permissions');

function getSmtpSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all('smtp_%');
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return {
    host:     s.smtp_host     || process.env.SMTP_HOST     || '',
    port:     +(s.smtp_port   || process.env.SMTP_PORT     || 587),
    secure:   (s.smtp_secure  || process.env.SMTP_SECURE   || 'false') === 'true',
    user:     s.smtp_user     || process.env.SMTP_USER     || '',
    pass:     decrypt(s.smtp_pass_enc || '') || process.env.SMTP_PASS || '',
    from:     s.smtp_from     || process.env.SMTP_FROM     || 'BadShuffle <noreply@localhost>',
  };
}

async function sendNotification(db, to, text) {
  try {
    const cfg = getSmtpSettings(db);
    if (!cfg.host) {
      console.log(`[admin/notify] → ${to}: ${text}`);
      return;
    }
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({ from: cfg.from, to, subject: 'BadShuffle account update', text });
  } catch (e) {
    console.error('[admin/notify] SMTP error:', e.message);
  }
}

const SYSTEM_WRITEABLE_KEYS = ['autokill_enabled', 'update_check_enabled', 'rust_autostart_enabled', 'onyx_local_autostart_enabled'];
const SYSTEM_READ_KEYS = [
  'autokill_enabled', 'update_check_enabled', 'rust_autostart_enabled', 'onyx_local_autostart_enabled',
  'update_check_last', 'update_check_latest', 'update_available',
];
const ENCRYPTED_SETTING_KEYS = [
  'smtp_pass_enc',
  'imap_pass_enc',
  'ai_claude_key_enc',
  'ai_openai_key_enc',
  'ai_gemini_key_enc',
];

const dbUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const UPLOADS_DIR = process.env.UPLOADS_DIR || (typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'uploads')
  : path.join(__dirname, '../../uploads'));
const DIST_DIR = path.join(__dirname, '../../dist');
const ROOT_DIR = path.join(__dirname, '../..');
const RELEASE_CHECKS_DIR = path.join(DIST_DIR, 'release-checks');
const RELEASE_CHECKS_MANIFEST = path.join(RELEASE_CHECKS_DIR, 'manifest.json');
const RELEASE_CHECKS_SUMMARY = path.join(DIST_DIR, 'RELEASE-CHECKS.md');
const RELEASE_CHECKS_PARITY_JSON = path.join(RELEASE_CHECKS_DIR, 'rust-parity-latest.json');
const AI_REPORTS_DIR = path.join(__dirname, '../../AI/reports');
const AI_PARITY_REPORT_MD = path.join(AI_REPORTS_DIR, 'rust-parity-latest.md');
const AI_PARITY_REPORT_JSON = path.join(__dirname, '../../AI/reports/rust-parity-latest.json');
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clearDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function formatCompactLine(comparison) {
  if (comparison.error) return `- Quote ${comparison.quote_id}: error: ${comparison.error}`;
  const parts = [
    `Quote ${comparison.quote_id}`,
    `summary=${comparison.summary_match ? 'match' : 'mismatch'}`,
  ];
  if (comparison.items_match != null) parts.push(`items=${comparison.items_match ? 'match' : 'mismatch'}`);
  if (comparison.summary_compact?.changed_count) parts.push(`summary_changes=${comparison.summary_compact.changed_count}`);
  if (comparison.items_compact?.changed_count) parts.push(`item_changes=${comparison.items_compact.changed_count}`);
  return `- ${parts.join(' | ')}`;
}

function buildRustParityReport(result, opts) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('# Rust Parity Report');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Version: v${packageJson.version}`);
  lines.push(`Context: ${opts.context || 'manual'}`);
  lines.push('');
  lines.push('## Run Config');
  lines.push('');
  lines.push(`- Quote ids: ${result.quote_ids.join(', ') || 'none'}`);
  lines.push(`- Include items: ${opts.include_items === true ? 'yes' : 'no'}`);
  if (opts.item_limit_per_quote != null && opts.item_limit_per_quote !== '') {
    lines.push(`- Item limit per quote: ${opts.item_limit_per_quote}`);
  }
  if (opts.limit != null && opts.limit !== '') {
    lines.push(`- Batch limit: ${opts.limit}`);
  }
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- Quotes checked: ${result.totals.quotes_checked}`);
  lines.push(`- Summary mismatches: ${result.totals.summary_mismatches}`);
  lines.push(`- Item mismatches: ${result.totals.item_mismatches}`);
  lines.push(`- Errors: ${result.totals.errors}`);
  lines.push('');
  lines.push('## Per Quote');
  lines.push('');
  result.comparisons.forEach((comparison) => {
    lines.push(formatCompactLine(comparison));
  });
  lines.push('');
  if (result.comparisons.some((comparison) => comparison.summary_diff || comparison.items_diff || comparison.error)) {
    lines.push('## Mismatch Details');
    lines.push('');
    result.comparisons.forEach((comparison) => {
      if (!comparison.summary_diff && !comparison.items_diff && !comparison.error) return;
      lines.push(`### Quote ${comparison.quote_id}`);
      lines.push('');
      if (comparison.error) lines.push(`- Error: ${comparison.error}`);
      if (comparison.summary_compact) lines.push(`- Summary compact: ${JSON.stringify(comparison.summary_compact)}`);
      if (comparison.items_compact) lines.push(`- Items compact: ${JSON.stringify(comparison.items_compact)}`);
      lines.push('');
    });
  }
  return lines.join('\n');
}

function buildRustParityJson(result, opts) {
  return {
    generated_at: new Date().toISOString(),
    version: packageJson.version,
    context: opts.context || 'manual',
    run_config: {
      quote_ids: result.quote_ids,
      include_items: opts.include_items === true,
      item_limit_per_quote: opts.item_limit_per_quote != null ? Number(opts.item_limit_per_quote) : null,
      batch_limit: opts.limit != null ? Number(opts.limit) : null,
    },
    totals: result.totals,
    comparisons: result.comparisons.map((comparison) => ({
      quote_id: comparison.quote_id,
      section_id: comparison.section_id ?? null,
      item_ids: comparison.item_ids || [],
      include_items: comparison.include_items === true,
      summary_match: comparison.summary_match,
      items_match: comparison.items_match,
      error: comparison.error || null,
      summary_compact: comparison.summary_compact || null,
      items_compact: comparison.items_compact || null,
    })),
  };
}

function extractZipArchive(zipPath, destDir) {
  ensureDir(destDir);
  if (process.platform === 'win32') {
    const cmd = [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
    ];
    const result = spawnSync('powershell', cmd, { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'Could not extract backup archive').trim());
    }
    return;
  }
  const result = spawnSync('unzip', ['-oq', zipPath, '-d', destDir], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Could not extract backup archive').trim());
  }
}

function restoreUploadsFromDirectory(importRoot) {
  const uploadCandidates = [
    path.join(importRoot, 'uploads'),
    importRoot,
  ];
  const uploadsSource = uploadCandidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
  if (!uploadsSource) return 0;

  ensureDir(UPLOADS_DIR);
  clearDirectory(UPLOADS_DIR);
  let restored = 0;
  for (const entry of fs.readdirSync(uploadsSource)) {
    const sourcePath = path.join(uploadsSource, entry);
    if (!fs.statSync(sourcePath).isFile()) continue;
    fs.copyFileSync(sourcePath, path.join(UPLOADS_DIR, entry));
    restored += 1;
  }
  return restored;
}

module.exports = function adminRouter(db) {
  const router = express.Router();

  function scanEncryptedSettings() {
    const rows = db.prepare(`
      SELECT key, value
      FROM settings
      WHERE key IN (${ENCRYPTED_SETTING_KEYS.map(() => '?').join(',')})
    `).all(...ENCRYPTED_SETTING_KEYS);
    return rows.map((row) => {
      const raw = String(row.value || '');
      let valid = true;
      let error = '';
      let preview = '';
      try {
        preview = decrypt(raw);
      } catch (err) {
        valid = false;
        error = err.message || 'Could not decrypt';
      }
      return {
        key: row.key,
        has_value: raw.trim().length > 0,
        valid,
        error,
        value_length: raw.length,
        decrypted_preview_length: valid ? preview.length : 0,
      };
    });
  }

  // GET /api/admin/users
  router.get('/users', (req, res) => {
    const users = db.prepare('SELECT id, email, first_name, last_name, username, display_name, role, approved, created_at FROM users').all();
    res.json(users);
  });

  router.get('/roles', (req, res) => {
    const roles = listRoles(db).map((role) => ({
      ...role,
      permissions: listRolePermissions(db, role.key),
    }));
    res.json({ roles, modules: PERMISSION_MODULES });
  });

  router.post('/roles', (req, res) => {
    try {
      const key = String(req.body?.key || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      const name = String(req.body?.name || '').trim();
      const description = String(req.body?.description || '').trim();
      if (!key) return res.status(400).json({ error: 'Role key is required' });
      if (!name) return res.status(400).json({ error: 'Role name is required' });
      const role = upsertRole(db, { key, name, description, is_system: 0 });
      updateRolePermissions(db, key, req.body?.permissions || {});
      res.status(201).json({ role: { ...role, permissions: listRolePermissions(db, key) } });
    } catch (e) {
      console.error('[admin/createRole]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.put('/roles/:key', (req, res) => {
    try {
      const current = getRoleByKey(db, req.params.key);
      if (!current) return res.status(404).json({ error: 'Role not found' });
      const name = String(req.body?.name || '').trim() || current.name;
      const description = String(req.body?.description || '').trim();
      const role = upsertRole(db, {
        key: current.key,
        name,
        description,
        is_system: current.is_system,
      });
      if (req.body?.permissions && typeof req.body.permissions === 'object') {
        updateRolePermissions(db, current.key, req.body.permissions);
      }
      res.json({ role: { ...role, permissions: listRolePermissions(db, current.key) } });
    } catch (e) {
      console.error('[admin/updateRole]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.put('/roles/:key/permissions', (req, res) => {
    try {
      const role = getRoleByKey(db, req.params.key);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      const permissions = {};
      PERMISSION_MODULES.forEach((module) => {
        permissions[module.key] = normalizeAccessLevel(req.body?.[module.key]);
      });
      updateRolePermissions(db, role.key, permissions);
      res.json({ ok: true, permissions: listRolePermissions(db, role.key) });
    } catch (e) {
      console.error('[admin/updateRolePermissions]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/admin/users — create unapproved user
  router.post('/users', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const hash = await bcrypt.hash(password, 10);
      const identity = buildIdentityFields({ email });
      const result = db.prepare(
        "INSERT INTO users (email, password_hash, role, approved, username, display_name) VALUES (?, ?, 'user', 0, ?, ?)"
      ).run(email, hash, getUniqueUsername(db, identity.usernameBase), identity.displayName);

      // Notify admin (self, since only admin calls this)
      const adminRow = db.prepare("SELECT email FROM users WHERE id = ?").get(req.user.sub);
      if (adminRow) {
        sendNotification(db, adminRow.email, `New user registered: ${email} — visit the admin panel to approve.`);
      }

      res.status(201).json({ id: result.lastInsertRowid, email, username: getUniqueUsername(db, identity.usernameBase, result.lastInsertRowid), display_name: identity.displayName, role: 'user', approved: 0 });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already in use' });
      console.error('[admin/createUser]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PUT /api/admin/users/:id/approve
  router.put('/users/:id/approve', (req, res) => {
    try {
      const id = +req.params.id;
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      db.prepare('UPDATE users SET approved = 1 WHERE id = ?').run(id);

      sendNotification(db, user.email, 'Your BadShuffle account has been approved. You can now log in.');

      res.json({ ok: true });
    } catch (e) {
      console.error('[admin/approve]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PUT /api/admin/users/:id/reject
  router.put('/users/:id/reject', (req, res) => {
    try {
      const id = +req.params.id;
      if (id === req.user.sub) return res.status(400).json({ error: 'Cannot reject yourself' });

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      db.prepare('DELETE FROM users WHERE id = ?').run(id);

      sendNotification(db, user.email, 'Your BadShuffle account request has been rejected.');

      res.json({ ok: true });
    } catch (e) {
      console.error('[admin/reject]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PUT /api/admin/users/:id/role  — change a user's role
  router.put('/users/:id/role', (req, res) => {
    try {
      const id = +req.params.id;
      const { role } = req.body || {};
      const nextRole = String(role || '').trim();
      const roleRow = getRoleByKey(db, nextRole);
      if (!roleRow) return res.status(400).json({ error: 'Role is invalid' });

      // Guard: can't demote yourself off admin if you're the only one
      if (id === req.user.sub && nextRole !== 'admin') {
        const cnt = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get();
        if (cnt && cnt.cnt <= 1) return res.status(400).json({ error: 'Cannot demote the only admin' });
      }

      const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(nextRole, id);
      if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ ok: true });
    } catch (e) {
      console.error('[admin/changeRole]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/admin/system  — read system/startup settings + update status
  router.get('/system', (req, res) => {
    const placeholders = SYSTEM_READ_KEYS.map(function() { return '?'; }).join(',');
    const rows = db.prepare('SELECT key, value FROM settings WHERE key IN (' + placeholders + ')').all(...SYSTEM_READ_KEYS);
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;

    var version = '0.0.0';
    try { version = require('../../package.json').version; } catch {}
    settings.current_version = version;

    res.json(settings);
  });

  router.get('/diagnostics/encrypted-settings', (req, res) => {
    try {
      const results = scanEncryptedSettings();
      res.json({
        ok: results.every((row) => row.valid || !row.has_value),
        rows: results,
      });
    } catch (e) {
      console.error('[admin/encrypted-settings]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });


  router.get('/diagnostics/onyx', async (req, res) => {
    try {
      res.json(await onyxLifecycleService.detect(db));
    } catch (e) {
      console.error('[admin/onyx]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/onyx/install', async (req, res) => {
    try {
      res.json(await onyxLifecycleService.install(db));
    } catch (e) {
      console.error('[admin/onyx/install]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/onyx/start', async (req, res) => {
    try {
      res.json(await onyxLifecycleService.start(db));
    } catch (e) {
      console.error('[admin/onyx/start]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/onyx/stop', async (req, res) => {
    try {
      res.json(await onyxLifecycleService.stop(db));
    } catch (e) {
      console.error('[admin/onyx/stop]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/onyx/restart', async (req, res) => {
    try {
      res.json(await onyxLifecycleService.restart(db));
    } catch (e) {
      console.error('[admin/onyx/restart]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/onyx/detect', async (req, res) => {
    try {
      res.json(await onyxLifecycleService.detect(db));
    } catch (e) {
      console.error('[admin/onyx/detect]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/diagnostics/local-models', async (req, res) => {
    try {
      res.json(await localModelLifecycleService.detect(db));
    } catch (e) {
      console.error('[admin/local-models]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/install', async (req, res) => {
    try {
      const result = await localModelLifecycleService.install(db);
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/local-models/install]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/reinstall', async (req, res) => {
    try {
      const result = await localModelLifecycleService.install(db);
      if (!result.ok) return res.status(500).json(result);
      res.json({ ...result, reinstalled: true });
    } catch (e) {
      console.error('[admin/local-models/reinstall]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/start', async (req, res) => {
    try {
      const result = await localModelLifecycleService.start(db);
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/local-models/start]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/stop', async (req, res) => {
    try {
      const result = await localModelLifecycleService.stop(db);
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/local-models/stop]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/restart', async (req, res) => {
    try {
      const result = await localModelLifecycleService.restart(db);
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/local-models/restart]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/detect', async (req, res) => {
    try {
      res.json(await localModelLifecycleService.detect(db));
    } catch (e) {
      console.error('[admin/local-models/detect]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/pull', async (req, res) => {
    try {
      const result = await localModelLifecycleService.pullModel(db, req.body?.model || '');
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/local-models/pull]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/diagnostics/local-models/delete', async (req, res) => {
    try {
      const result = await localModelLifecycleService.deleteModel(db, req.body?.model || '');
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/local-models/delete]', e);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/diagnostics/rust-engine', async (req, res) => {
    try {
      res.json(await rustEngineLifecycleService.getStatus());
    } catch (e) {
      console.error('[admin/rust-engine]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/diagnostics/rust-engine/start', async (req, res) => {
    try {
      const result = await rustEngineLifecycleService.start();
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/rust-engine/start]', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  router.post('/diagnostics/rust-engine/stop', async (req, res) => {
    try {
      const result = await rustEngineLifecycleService.stop();
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/rust-engine/stop]', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  router.post('/diagnostics/rust-engine/restart', async (req, res) => {
    try {
      const result = await rustEngineLifecycleService.restart();
      if (!result.ok) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      console.error('[admin/rust-engine/restart]', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  router.get('/memory/quote-patterns', (req, res) => {
    try {
      const limit = Number(req.query.limit || 15);
      res.json({ records: quotePatternMemoryService.listRecentMemoryRecords(db, limit) });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message });
    }
  });

  router.get('/memory/quote-patterns/:quoteId/similar', (req, res) => {
    try {
      const limit = Number(req.query.limit || 5);
      res.json({ matches: quotePatternMemoryService.listSimilarQuotes(db, req.params.quoteId, limit) });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message });
    }
  });

  router.get('/diagnostics/rust-engine/release-checks', (req, res) => {
    try {
      const manifest = readJsonIfExists(RELEASE_CHECKS_MANIFEST);
      const packagedSummary = readTextIfExists(RELEASE_CHECKS_SUMMARY);
      const packagedParityJson = readJsonIfExists(RELEASE_CHECKS_PARITY_JSON);
      const latestParity = readJsonIfExists(AI_PARITY_REPORT_JSON);
      const packaged = !!manifest;
      res.json({
        packaged,
        source: packaged ? 'dist' : (latestParity ? 'ai-report' : 'none'),
        manifest,
        packaged_summary: packagedSummary,
        packaged_parity_json: packagedParityJson,
        latest_parity: latestParity,
        paths: {
          manifest: path.relative(path.join(__dirname, '../..'), RELEASE_CHECKS_MANIFEST),
          summary: path.relative(path.join(__dirname, '../..'), RELEASE_CHECKS_SUMMARY),
          packaged_parity_json: path.relative(path.join(__dirname, '../..'), RELEASE_CHECKS_PARITY_JSON),
          latest_parity_json: path.relative(path.join(__dirname, '../..'), AI_PARITY_REPORT_JSON),
        },
      });
    } catch (e) {
      console.error('[admin/rust-engine/release-checks]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/diagnostics/rust-engine/parity-report', async (req, res) => {
    try {
      const quoteIds = String(req.body?.quote_ids || '')
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter((value) => !isNaN(value));
      const limit = req.body?.limit != null && req.body.limit !== ''
        ? parseInt(req.body.limit, 10)
        : 5;
      const includeItems = String(req.body?.include_items || '1') === '1';
      const itemLimitPerQuote = req.body?.item_limit_per_quote != null && req.body.item_limit_per_quote !== ''
        ? parseInt(req.body.item_limit_per_quote, 10)
        : 5;
      const reportOptions = {
        quote_ids: quoteIds,
        limit,
        include_items: includeItems,
        item_limit_per_quote: itemLimitPerQuote,
        context: String(req.body?.context || 'admin-manual'),
      };
      const result = await rustInventoryParityService.compareQuotes(db, {
        quoteIds,
        limit,
        includeItems,
        itemLimitPerQuote,
      });
      const reportJson = buildRustParityJson(result, reportOptions);
      const reportMarkdown = buildRustParityReport(result, reportOptions);
      ensureDir(AI_REPORTS_DIR);
      fs.writeFileSync(AI_PARITY_REPORT_MD, reportMarkdown);
      fs.writeFileSync(AI_PARITY_REPORT_JSON, JSON.stringify(reportJson, null, 2));
      res.json({
        ok: true,
        report_path: path.relative(path.join(__dirname, '../..'), AI_PARITY_REPORT_MD),
        report_json_path: path.relative(path.join(__dirname, '../..'), AI_PARITY_REPORT_JSON),
        markdown: reportMarkdown,
        json: reportJson,
        totals: result.totals,
      });
    } catch (e) {
      console.error('[admin/rust-engine/parity-report]', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  router.get('/diagnostics/rust-engine/compare/:quoteId', async (req, res) => {
    try {
      const quoteId = parseInt(req.params.quoteId, 10);
      if (isNaN(quoteId)) return res.status(400).json({ error: 'Invalid quoteId' });
      const itemIds = String(req.query.item_ids || '')
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter((value) => !isNaN(value));
      const sectionId = req.query.section_id != null && req.query.section_id !== ''
        ? parseInt(req.query.section_id, 10)
        : null;
      const includeItems = String(req.query.include_items || '0') === '1' || itemIds.length > 0;
      const itemLimitPerQuote = req.query.item_limit_per_quote != null && req.query.item_limit_per_quote !== ''
        ? parseInt(req.query.item_limit_per_quote, 10)
        : null;
      const comparison = await rustInventoryParityService.compareQuote(db, quoteId, {
        itemIds,
        sectionId,
        includeItems,
        itemLimitPerQuote,
      });
      res.json(comparison);
    } catch (e) {
      console.error('[admin/rust-engine/compare]', e);
      res.status(e.statusCode || 500).json({ error: e.message || 'Server error' });
    }
  });

  router.get('/diagnostics/rust-engine/pricing/:quoteId', async (req, res) => {
    try {
      const quoteId = parseInt(req.params.quoteId, 10);
      if (isNaN(quoteId)) return res.status(400).json({ error: 'Invalid quoteId' });
      const explicitTaxRate = req.query.explicit_tax_rate != null && req.query.explicit_tax_rate !== ''
        ? parseFloat(req.query.explicit_tax_rate)
        : null;
      const comparison = await rustPricingParityService.compareQuotePricing(db, quoteId, explicitTaxRate);
      res.json(comparison);
    } catch (e) {
      console.error('[admin/rust-engine/pricing]', e);
      res.status(e.statusCode || 500).json({ error: e.message || 'Server error' });
    }
  });

  router.get('/diagnostics/rust-engine/pricing', async (req, res) => {
    try {
      const quoteIds = String(req.query.quote_ids || '')
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter((value) => !isNaN(value));
      const limit = req.query.limit != null && req.query.limit !== ''
        ? parseInt(req.query.limit, 10)
        : 5;
      const explicitTaxRate = req.query.explicit_tax_rate != null && req.query.explicit_tax_rate !== ''
        ? parseFloat(req.query.explicit_tax_rate)
        : null;
      const comparison = await rustPricingParityService.compareQuotesPricing(db, {
        quoteIds,
        limit,
        explicitTaxRate,
      });
      res.json(comparison);
    } catch (e) {
      console.error('[admin/rust-engine/pricingMany]', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  router.get('/diagnostics/rust-engine/compare', async (req, res) => {
    try {
      const quoteIds = String(req.query.quote_ids || '')
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter((value) => !isNaN(value));
      const limit = req.query.limit != null && req.query.limit !== ''
        ? parseInt(req.query.limit, 10)
        : 10;
      const includeItems = String(req.query.include_items || '0') === '1';
      const itemLimitPerQuote = req.query.item_limit_per_quote != null && req.query.item_limit_per_quote !== ''
        ? parseInt(req.query.item_limit_per_quote, 10)
        : null;
      const comparison = await rustInventoryParityService.compareQuotes(db, {
        quoteIds,
        limit,
        includeItems,
        itemLimitPerQuote,
      });
      res.json(comparison);
    } catch (e) {
      console.error('[admin/rust-engine/compareMany]', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // PUT /api/admin/system  — update toggle settings (admin only)
  router.put('/system', (req, res) => {
    const body = req.body || {};
    const keys = Object.keys(body).filter(function(k) { return SYSTEM_WRITEABLE_KEYS.includes(k); });
    if (keys.length === 0) return res.status(400).json({ error: 'No valid keys' });

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const k of keys) {
      stmt.run(k, String(body[k] != null ? body[k] : ''));
    }
    res.json({ ok: true });
  });

  // DELETE /api/admin/users/:id
  router.delete('/users/:id', (req, res) => {
    try {
      const id = +req.params.id;
      if (id === req.user.sub) return res.status(400).json({ error: 'Cannot delete yourself' });

      const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
      if (result.changes === 0) return res.status(404).json({ error: 'User not found' });

      res.json({ ok: true });
    } catch (e) {
      console.error('[admin/deleteUser]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/admin/db/export — download the SQLite database file
  router.get('/db/export', (req, res) => {
    try {
      db._save();
      if (!fs.existsSync(DB_PATH)) return res.status(404).json({ error: 'Database file not found' });
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Disposition', `attachment; filename="badshuffle-backup-${date}.zip"`);
      res.setHeader('Content-Type', 'application/zip');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        console.error('[admin/db/export]', err);
        if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
        else res.destroy(err);
      });
      archive.pipe(res);
      archive.file(DB_PATH, { name: 'badshuffle.db' });
      if (fs.existsSync(UPLOADS_DIR)) {
        archive.directory(UPLOADS_DIR, 'uploads');
      }
      archive.finalize();
    } catch (e) {
      console.error('[admin/db/export]', e);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // POST /api/admin/db/import — replace database with uploaded .db or bundled .zip backup
  router.post('/db/import', dbUpload.single('db'), (req, res) => {
    let tempDir = null;
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const buf = req.file.buffer;
      let dbBuffer = null;
      let restoredUploads = 0;

      if (buf.length >= 16 && buf.slice(0, 16).equals(SQLITE_MAGIC)) {
        dbBuffer = buf;
      } else if (buf.length >= 4 && buf.slice(0, 4).equals(ZIP_MAGIC)) {
        tempDir = createTempDir('badshuffle-import-');
        const archivePath = path.join(tempDir, 'backup.zip');
        fs.writeFileSync(archivePath, buf);
        extractZipArchive(archivePath, tempDir);
        const dbCandidate = path.join(tempDir, 'badshuffle.db');
        if (!fs.existsSync(dbCandidate)) {
          return res.status(400).json({ error: 'Backup archive is missing badshuffle.db' });
        }
        dbBuffer = fs.readFileSync(dbCandidate);
        if (dbBuffer.length < 16 || !dbBuffer.slice(0, 16).equals(SQLITE_MAGIC)) {
          return res.status(400).json({ error: 'Backup archive contains an invalid database file' });
        }
        restoredUploads = restoreUploadsFromDirectory(tempDir);
      } else {
        return res.status(400).json({ error: 'Upload a valid .db backup or bundled .zip backup' });
      }

      db.reload(dbBuffer);
      res.json({ ok: true, restored_uploads: restoredUploads });
    } catch (e) {
      console.error('[admin/db/import]', e);
      res.status(500).json({ error: 'Import failed: ' + e.message });
    } finally {
      if (tempDir) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    }
  });

  return router;
};
