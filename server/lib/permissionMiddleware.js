const { ACCESS_READ, normalizeAccessLevel, hasAccess } = require('./permissions');
const { getEffectivePermissionsForUser } = require('../db/queries/permissions');

function requireModulePermission(db, moduleKey, minimumLevel = ACCESS_READ) {
  return function permissionGuard(req, res, next) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const permissions = getEffectivePermissionsForUser(db, userId);
    const current = normalizeAccessLevel(permissions[moduleKey]);
    if (!hasAccess(current, minimumLevel)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.permissions = permissions;
    next();
  };
}

module.exports = {
  requireModulePermission,
};
