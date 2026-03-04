const jwt = require('jsonwebtoken');
const SECRET = () => process.env.JWT_SECRET || 'change-me';

module.exports = function requireAuth(db) {
  return function(req, res, next) {
    // Allow extension requests via static token
    const extToken = req.headers['x-extension-token'];
    if (extToken) {
      const row = db.prepare('SELECT id FROM extension_tokens WHERE token = ?').get(extToken);
      if (row) return next();
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      req.user = jwt.verify(token, SECRET());
      next();
    } catch {
      res.status(401).json({ error: 'Token invalid or expired' });
    }
  };
};
