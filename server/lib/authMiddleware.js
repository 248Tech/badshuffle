const jwt = require('jsonwebtoken');
const SECRET = () => process.env.JWT_SECRET || 'change-me';

module.exports = function requireAuth(db) {
  return function(req, res, next) {
    // Allow extension requests via static token (scoped: no admin/operator routes)
    const extToken = req.headers['x-extension-token'];
    if (extToken) {
      const row = db.prepare('SELECT id FROM extension_tokens WHERE token = ?').get(extToken);
      if (row) {
        req.user = { sub: null, byExtension: true };
        return next();
      }
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      req.user = jwt.verify(token, SECRET());
      req.user.byExtension = false;
      next();
    } catch {
      res.status(401).json({ error: 'Token invalid or expired' });
    }
  };
};
