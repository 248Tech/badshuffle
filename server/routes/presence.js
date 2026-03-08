// In-memory presence: userId -> { email, path, lastSeen }
const presence = new Map();
const ONLINE_MS = 2 * 60 * 1000; // 2 minutes

function prune() {
  const now = Date.now();
  for (const [id, data] of presence.entries()) {
    if (now - data.lastSeen > ONLINE_MS) presence.delete(id);
  }
}

module.exports = function makePresenceRouter() {
  const express = require('express');
  const router = express.Router();

  // PUT /api/presence — update current user's presence (path)
  router.put('/', (req, res) => {
    const user = req.user;
    if (!user || !user.sub) return res.status(401).json({ error: 'Unauthorized' });
    const path = (req.body && req.body.path) ? String(req.body.path) : '/';
    presence.set(String(user.sub), {
      userId: user.sub,
      email: user.email || `User ${user.sub}`,
      path,
      lastSeen: Date.now()
    });
    prune();
    res.json({ ok: true });
  });

  // GET /api/presence — list online users (lastSeen within ONLINE_MS)
  router.get('/', (req, res) => {
    prune();
    const list = Array.from(presence.values())
      .filter(p => Date.now() - p.lastSeen <= ONLINE_MS)
      .map(({ userId, email, path, lastSeen }) => ({ userId, email, path, lastSeen }));
    res.json({ online: list });
  });

  return router;
};
