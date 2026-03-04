const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const SECRET = () => process.env.JWT_SECRET || 'change-me';
const BRUTE_WINDOW_MIN = 15;
const BRUTE_LIMIT = 5;

function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET(), { expiresIn: '7d' });
}

function checkBruteForce(db, ip) {
  const since = new Date(Date.now() - BRUTE_WINDOW_MIN * 60 * 1000).toISOString();
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at > ?"
  ).get(ip, since);
  return row ? row.cnt : 0;
}

module.exports = function authRouter(db) {
  const router = express.Router();

  // GET /api/auth/status — no auth required
  router.get('/status', (req, res) => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
    res.json({ setup: row.cnt > 0 });
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
      const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);

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
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      // Brute-force check
      const failCount = checkBruteForce(db, ip);
      if (failCount >= BRUTE_LIMIT) {
        const since = new Date(Date.now() - BRUTE_WINDOW_MIN * 60 * 1000).toISOString();
        const oldest = db.prepare(
          "SELECT attempted_at FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at > ? ORDER BY attempted_at ASC LIMIT 1"
        ).get(ip, since);
        const retryAfter = oldest
          ? Math.ceil((new Date(oldest.attempted_at).getTime() + BRUTE_WINDOW_MIN * 60 * 1000 - Date.now()) / 1000)
          : BRUTE_WINDOW_MIN * 60;
        return res.status(429).json({ error: 'Too many attempts', retryAfter: Math.max(retryAfter, 1) });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      const valid = user && await bcrypt.compare(password, user.password_hash);

      db.prepare('INSERT INTO login_attempts (ip, success) VALUES (?, ?)').run(ip, valid ? 1 : 0);

      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      res.json({ token: signToken(user) });
    } catch (e) {
      console.error('[auth/login]', e);
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
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        db.prepare('INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

        if (process.env.SMTP_HOST) {
          try {
            const mailer = getMailer();
            const appUrl = process.env.APP_URL || 'http://localhost:5173';
            await mailer.sendMail({
              from: process.env.SMTP_FROM || 'BadShuffle <noreply@localhost>',
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

      const now = new Date().toISOString();
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

  // GET /api/auth/extension-token — requires JWT auth
  router.get('/extension-token', (req, res) => {
    const header = req.headers.authorization || '';
    const jwtToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!jwtToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      jwt.verify(jwtToken, SECRET());
    } catch {
      return res.status(401).json({ error: 'Token invalid or expired' });
    }

    let row = db.prepare('SELECT token FROM extension_tokens LIMIT 1').get();
    if (!row) {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO extension_tokens (token) VALUES (?)').run(token);
      row = { token };
    }
    res.json({ token: row.token });
  });

  return router;
};
