const requireAuth = require('./authMiddleware');

module.exports = function operatorMiddleware(db) {
  const auth = requireAuth(db);
  return (req, res, next) => {
    auth(req, res, () => {
      if (!req.user) return res.status(403).json({ error: 'Forbidden' });
      const row = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.sub);
      if (!row) return res.status(403).json({ error: 'Operator or Admin access required' });
      if (row.role !== 'admin' && row.role !== 'operator') {
        return res.status(403).json({ error: 'Operator or Admin access required' });
      }
      next();
    });
  };
};
