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

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      req.user = jwt.verify(token, getSecret());
      req.user.byExtension = false;
      next();
    } catch {
      res.status(401).json({ error: 'Token invalid or expired' });
    }
  };
};
