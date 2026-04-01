const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const nodemailer = require('nodemailer');
const { decrypt } = require('../lib/crypto');
const {
  buildIdentityFields,
  ensureUserIdentityFields,
  getUserProfileById,
  getUserByEmail,
  getUniqueUsername,
  updateUserProfile,
} = require('../db/queries/users');
const { getEffectivePermissionsForUser } = require('../db/queries/permissions');

function verifyRecaptcha(secretKey, responseToken, remoteIp) {
  return new Promise((resolve) => {
    const body = `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(responseToken)}${remoteIp ? '&remoteip=' + encodeURIComponent(remoteIp) : ''}`;
    const req = https.request({
      hostname: 'www.google.com',
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(!!json.success);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

const SECRET = () => process.env.JWT_SECRET || 'change-me';
const BRUTE_WINDOW_MIN = 15;
const BRUTE_LIMIT = 5;

// Rate limit state for test-mail endpoint
const testMailCounts = new Map();
setInterval(() => testMailCounts.clear(), 60 * 1000);

function getMailerFromDb(db) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all('smtp_%');
  const s = {};
  for (const r of rows) s[r.key] = r.value;

  const host   = s.smtp_host   || process.env.SMTP_HOST   || '';
  const port   = +(s.smtp_port || process.env.SMTP_PORT   || 587);
  const secure = (s.smtp_secure || process.env.SMTP_SECURE || 'false') === 'true';
  const user   = s.smtp_user   || process.env.SMTP_USER   || '';
  const pass   = decrypt(s.smtp_pass_enc || '') || process.env.SMTP_PASS || '';
  const from   = s.smtp_from   || process.env.SMTP_FROM   || 'BadShuffle <noreply@localhost>';

  const configured = !!host;
  const transporter = configured
    ? nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    : null;

  return { transporter, from, configured };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET(), { expiresIn: '7d', algorithm: 'HS256' });
}

function sqliteNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString().replace('T', ' ').slice(0, 19);
}

function sanitizeOptionalText(value, maxLength) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function sanitizeEmail(value) {
  return String(value || '').trim().slice(0, 255);
}

function serializeUserProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    approved: Number(row.approved || 0),
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    username: row.username || '',
    display_name: row.display_name || '',
    phone: row.phone || '',
    photo_url: row.photo_url || '',
    bio: row.bio || '',
    created_at: row.created_at || null,
    permissions: row.permissions || null,
  };
}

function checkBruteForce(db, ip) {
  const since = sqliteNow(-BRUTE_WINDOW_MIN * 60 * 1000);
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at > ?"
  ).get(ip, since);
  return row ? row.cnt : 0;
}

module.exports = function authRouter(db) {
  const router = express.Router();
  const requireAuth = require('../lib/authMiddleware')(db);
  const requireAdmin = require('../lib/adminMiddleware')(db);
  const requireOperator = require('../lib/operatorMiddleware')(db);

  // GET /api/auth/status — no auth required
  router.get('/status', (req, res) => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
    res.json({ setup: row.cnt > 0 });
  });

  // GET /api/auth/captcha-config — no auth; used by login page to show math + reCAPTCHA
  router.get('/captcha-config', (req, res) => {
    const rows = db.prepare(
      "SELECT key, value FROM settings WHERE key IN ('recaptcha_enabled', 'recaptcha_site_key')"
    ).all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    const recaptcha_enabled = (settings.recaptcha_enabled || '0') === '1';
    const recaptcha_site_key = (settings.recaptcha_site_key || '').trim();
    res.json({
      math_required: true,
      recaptcha_enabled: recaptcha_enabled && recaptcha_site_key.length > 0,
      recaptcha_site_key: recaptcha_site_key || ''
    });
  });

  // POST /api/auth/dev-login — dev-only auto-login (blocked in production)
  router.post('/dev-login', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }
    const DEV_EMAIL = 'admin@admin.com';
    const DEV_PASS  = 'admin123';
    try {
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(DEV_EMAIL);
      if (!user) {
        const hash = await bcrypt.hash(DEV_PASS, 10);
        const identity = buildIdentityFields({ email: DEV_EMAIL });
        const result = db.prepare(
          "INSERT INTO users (email, password_hash, role, approved, username, display_name) VALUES (?, ?, 'admin', 1, ?, ?)"
        ).run(DEV_EMAIL, hash, getUniqueUsername(db, identity.usernameBase), identity.displayName);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        // Ensure extension token exists
        const hasExt = db.prepare('SELECT id FROM extension_tokens LIMIT 1').get();
        if (!hasExt) {
          db.prepare('INSERT INTO extension_tokens (token) VALUES (?)').run(crypto.randomBytes(32).toString('hex'));
        }
      }
      res.json({ token: signToken(user) });
    } catch (e) {
      console.error('[auth/dev-login]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/auth/setup — create first admin (only if no users exist)
  router.post('/setup', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
      if (existing.cnt > 0) return res.status(409).json({ error: 'Setup already complete' });

      const hash = await bcrypt.hash(password, 10);
      const identity = buildIdentityFields({ email });
      const result = db.prepare(
        "INSERT INTO users (email, password_hash, role, approved, username, display_name) VALUES (?, ?, 'admin', 1, ?, ?)"
      ).run(email, hash, getUniqueUsername(db, identity.usernameBase), identity.displayName);

      // Generate extension token on first setup
      const extToken = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO extension_tokens (token) VALUES (?)').run(extToken);

      const user = { id: result.lastInsertRowid, email };
      res.json({ token: signToken(user) });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already in use' });
      console.error('[auth/setup]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    try {
      const { email, password, math_a, math_b, math_answer, recaptcha_response } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      // Math question (always required)
      const a = parseInt(math_a, 10);
      const b = parseInt(math_b, 10);
      const answer = parseInt(math_answer, 10);
      if (isNaN(a) || isNaN(b) || isNaN(answer) || a + b !== answer) {
        return res.status(400).json({ error: 'Incorrect answer to the math question' });
      }

      // reCAPTCHA v2 (when enabled and secret key set)
      const recaptchaRows = db.prepare(
        "SELECT key, value FROM settings WHERE key IN ('recaptcha_enabled', 'recaptcha_secret_key')"
      ).all();
      const recaptchaSettings = {};
      for (const r of recaptchaRows) recaptchaSettings[r.key] = r.value;
      const recaptchaEnabled = (recaptchaSettings.recaptcha_enabled || '0') === '1';
      const recaptchaSecret = (recaptchaSettings.recaptcha_secret_key || '').trim();
      if (recaptchaEnabled && recaptchaSecret) {
        if (!recaptcha_response || typeof recaptcha_response !== 'string') {
          return res.status(400).json({ error: 'Please complete the reCAPTCHA' });
        }
        const recaptchaOk = await verifyRecaptcha(recaptchaSecret, recaptcha_response, ip);
        if (!recaptchaOk) return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }

      // Brute-force check
      const failCount = checkBruteForce(db, ip);
      if (failCount >= BRUTE_LIMIT) {
        const since = sqliteNow(-BRUTE_WINDOW_MIN * 60 * 1000);
        const oldest = db.prepare(
          "SELECT attempted_at FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at > ? ORDER BY attempted_at ASC LIMIT 1"
        ).get(ip, since);
        const retryAfter = oldest
          ? Math.ceil((new Date(oldest.attempted_at.replace(' ', 'T') + 'Z').getTime() + BRUTE_WINDOW_MIN * 60 * 1000 - Date.now()) / 1000)
          : BRUTE_WINDOW_MIN * 60;
        return res.status(429).json({ error: 'Too many attempts', retryAfter: Math.max(retryAfter, 1) });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      let valid = false;
      if (user && typeof user.password_hash === 'string' && user.password_hash.length > 0) {
        try {
          valid = await bcrypt.compare(password, user.password_hash);
        } catch (bcryptErr) {
          console.error('[auth/login] bcrypt.compare failed:', bcryptErr.message);
          return res.status(500).json({ error: 'Server error during login' });
        }
      }

      db.prepare('INSERT INTO login_attempts (ip, success) VALUES (?, ?)').run(ip, valid ? 1 : 0);

      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      if (!user.approved) return res.status(403).json({ error: 'Account pending admin approval' });

      const payload = { sub: user.id, email: user.email };
      if (payload.sub == null || payload.email == null) {
        console.error('[auth/login] User row missing id or email:', Object.keys(user));
        return res.status(500).json({ error: 'Server error' });
      }
      const token = signToken(user);
      res.json({ token });
    } catch (e) {
      console.error('[auth/login]', e.message || e);
      if (e.stack) console.error(e.stack);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/auth/forgot
  router.post('/forgot', async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: 'Email required' });

      // Always return success to prevent user enumeration
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (user && user.approved) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = sqliteNow(60 * 60 * 1000);
        db.prepare('INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

        const { transporter, from, configured } = getMailerFromDb(db);
        if (configured) {
          try {
            const appUrl = process.env.APP_URL || 'http://localhost:5173';
            await transporter.sendMail({
              from,
              to: email,
              subject: 'BadShuffle — Password Reset',
              text: `Reset your password:\n\n${appUrl}/reset?token=${token}\n\nThis link expires in 1 hour.`,
              html: `<p>Click the link below to reset your BadShuffle password:</p><p><a href="${appUrl}/reset?token=${token}">${appUrl}/reset?token=${token}</a></p><p>This link expires in 1 hour.</p>`
            });
          } catch (mailErr) {
            console.error('[auth/forgot] SMTP error:', mailErr.message);
          }
        } else {
          // Dev fallback — log to console
          const appUrl = process.env.APP_URL || 'http://localhost:5173';
          console.log(`[auth/forgot] Reset link: ${appUrl}/reset?token=${token}`);
        }
      }

      res.json({ ok: true });
    } catch (e) {
      console.error('[auth/forgot]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/auth/reset
  router.post('/reset', async (req, res) => {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const now = sqliteNow();
      const row = db.prepare(
        "SELECT * FROM reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?"
      ).get(token, now);

      if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });

      const hash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
      db.prepare('UPDATE reset_tokens SET used = 1 WHERE id = ?').run(row.id);

      res.json({ ok: true });
    } catch (e) {
      console.error('[auth/reset]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/auth/me — requires JWT auth, returns current user profile
  router.get('/me', requireAuth, (req, res) => {
    const row = ensureUserIdentityFields(db, req.user && (req.user.id || req.user.sub));
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(serializeUserProfile({
      ...row,
      permissions: getEffectivePermissionsForUser(db, row.id),
    }));
  });

  // PUT /api/auth/me — current user profile update
  router.put('/me', requireAuth, (req, res) => {
    try {
      const userId = req.user && (req.user.id || req.user.sub);
      const current = ensureUserIdentityFields(db, userId);
      if (!current) return res.status(404).json({ error: 'User not found' });

      const nextEmail = sanitizeEmail(req.body && req.body.email);
      if (!nextEmail) return res.status(400).json({ error: 'Email is required' });
      const existing = getUserByEmail(db, nextEmail);
      if (existing && Number(existing.id) !== Number(userId)) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      const updated = updateUserProfile(db, userId, {
        email: nextEmail,
        first_name: sanitizeOptionalText(req.body && req.body.first_name, 80),
        last_name: sanitizeOptionalText(req.body && req.body.last_name, 80),
        phone: sanitizeOptionalText(req.body && req.body.phone, 40),
        photo_url: sanitizeOptionalText(req.body && req.body.photo_url, 255),
        bio: sanitizeOptionalText(req.body && req.body.bio, 2000),
      });
      const token = signToken(updated);
      res.json({ ...serializeUserProfile({
        ...updated,
        permissions: getEffectivePermissionsForUser(db, updated.id),
      }), token });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      console.error('[auth/me PUT]', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/auth/extension-token — requires admin (or operator per HANDOFF C5: admin-only)
  router.get('/extension-token', requireAuth, requireAdmin, (req, res) => {
    let row = db.prepare('SELECT token FROM extension_tokens LIMIT 1').get();
    if (!row) {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO extension_tokens (token) VALUES (?)').run(token);
      row = { token };
    }
    res.json({ token: row.token });
  });

  // POST /api/auth/test-mail — operator/admin only (was public; locked down for security)
  router.post('/test-mail', requireAuth, requireOperator, async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const count = (testMailCounts.get(ip) || 0) + 1;
    testMailCounts.set(ip, count);
    if (count > 5) return res.status(429).json({ error: 'Too many test email requests' });

    try {
      const body = req.body || {};
      // Body fields take precedence; fall back to DB/env
      const dbRows = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all('smtp_%');
      const dbSettings = {};
      for (const r of dbRows) dbSettings[r.key] = r.value;

      const host   = body.smtp_host   || dbSettings.smtp_host   || process.env.SMTP_HOST   || '';
      const port   = +(body.smtp_port || dbSettings.smtp_port   || process.env.SMTP_PORT   || 587);
      const secure = String(body.smtp_secure !== undefined ? body.smtp_secure : (dbSettings.smtp_secure || process.env.SMTP_SECURE || 'false')) === 'true';
      const user   = body.smtp_user   || dbSettings.smtp_user   || process.env.SMTP_USER   || '';
      // smtp_pass in body is raw plaintext; DB version is encrypted
      const pass   = body.smtp_pass   || decrypt(dbSettings.smtp_pass_enc || '') || process.env.SMTP_PASS || '';
      const from   = body.smtp_from   || dbSettings.smtp_from   || process.env.SMTP_FROM   || 'BadShuffle <noreply@localhost>';
      const to     = body.to          || from;

      if (!host) return res.status(400).json({ error: 'smtp_host is required' });

      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transporter.sendMail({
        from,
        to,
        subject: 'BadShuffle — Test Email',
        text: 'This is a test email from BadShuffle. Your mail server is configured correctly.',
      });

      res.json({ ok: true });
    } catch (e) {
      console.error('[auth/test-mail]', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
