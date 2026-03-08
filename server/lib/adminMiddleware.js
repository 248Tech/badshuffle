const requireAuth = require('./authMiddleware');

module.exports = function adminMiddleware(db) {
  const auth = requireAuth(db);
  return (req, res, next) => {
    auth(req, res, () => {
      if (!req.user) return res.status(403).json({ error: 'Forbidden' });
      if (req.user.byExtension) return res.status(403).json({ error: 'Admin access requires login (extension token not allowed)' });
      const row = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.sub);
      if (!row || row.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      next();
    });
  };
};
