const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { decrypt } = require('../lib/crypto');
const { DB_PATH } = require('../db');
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

const SYSTEM_WRITEABLE_KEYS = ['autokill_enabled', 'update_check_enabled'];
const SYSTEM_READ_KEYS = [
  'autokill_enabled', 'update_check_enabled',
  'update_check_last', 'update_check_latest', 'update_available',
];

const dbUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');

module.exports = function adminRouter(db) {
  const router = express.Router();

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
      res.setHeader('Content-Disposition', `attachment; filename="badshuffle-backup-${date}.db"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      fs.createReadStream(DB_PATH).pipe(res);
    } catch (e) {
      console.error('[admin/db/export]', e);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // POST /api/admin/db/import — replace database with uploaded .db file
  router.post('/db/import', dbUpload.single('db'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const buf = req.file.buffer;
      if (buf.length < 16 || !buf.slice(0, 16).equals(SQLITE_MAGIC)) {
        return res.status(400).json({ error: 'Not a valid SQLite database file' });
      }
      db.reload(buf);
      res.json({ ok: true });
    } catch (e) {
      console.error('[admin/db/import]', e);
      res.status(500).json({ error: 'Import failed: ' + e.message });
    }
  });

  return router;
};
