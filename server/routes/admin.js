const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { decrypt } = require('../lib/crypto');

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

module.exports = function adminRouter(db) {
  const router = express.Router();

  // GET /api/admin/users
  router.get('/users', (req, res) => {
    const users = db.prepare('SELECT id, email, role, approved, created_at FROM users').all();
    res.json(users);
  });

  // POST /api/admin/users — create unapproved user
  router.post('/users', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const hash = await bcrypt.hash(password, 10);
      const result = db.prepare(
        "INSERT INTO users (email, password_hash, role, approved) VALUES (?, ?, 'user', 0)"
      ).run(email, hash);

      // Notify admin (self, since only admin calls this)
      const adminRow = db.prepare("SELECT email FROM users WHERE id = ?").get(req.user.sub);
      if (adminRow) {
        sendNotification(db, adminRow.email, `New user registered: ${email} — visit the admin panel to approve.`);
      }

      res.status(201).json({ id: result.lastInsertRowid, email, role: 'user', approved: 0 });
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

  return router;
};
