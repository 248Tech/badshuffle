const jwt = require('jsonwebtoken');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change-me') {
    if (process.env.NODE_ENV === 'production') {
      // Already caught at startup in index.js — this is a safety net
      throw new Error('JWT_SECRET must be set to a strong random value');
    }
    // Dev/unset: warn once, then fall back
    if (!getSecret._warned) {
      console.warn('[auth] WARNING: JWT_SECRET is not set. Using insecure default. Set JWT_SECRET before deploying.');
      getSecret._warned = true;
    }
    return 'change-me';
  }
  return secret;
}
getSecret._warned = false;

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  // Guardrail: avoid spending CPU on extremely large tokens (DoS-ish input).
  if (!token || token.length > 10_000) return null;
  return token;
}

// requireAuth(db)                  — JWT only (default)
// requireAuth(db, { allowExtension: true }) — also accept x-extension-token (items/sheets sync only)
module.exports = function requireAuth(db, options) {
  const allowExtension = !!(options && options.allowExtension);

  return function(req, res, next) {
    // Extension token — only on routes that explicitly opt in
    if (allowExtension) {
      const extToken = req.headers['x-extension-token'];
      if (extToken) {
        const row = db.prepare('SELECT id FROM extension_tokens WHERE token = ?').get(extToken);
        if (row) {
          req.user = { sub: null, byExtension: true, extensionTokenId: row.id };
          return next();
        }
      }
    }

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const payload = jwt.verify(token, getSecret(), {
        algorithms: ['HS256'],
      });
      if (!payload || typeof payload !== 'object') {
        return res.status(401).json({ error: 'Token invalid or expired' });
      }
      req.user = payload;
      req.user.byExtension = false;
      // Compatibility: some routes expect req.user.id (others use req.user.sub).
      if (req.user.id == null && req.user.sub != null) req.user.id = req.user.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Token invalid or expired' });
    }
  };
};
