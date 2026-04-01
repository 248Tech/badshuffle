const {
  ACCESS_NONE,
  PERMISSION_MODULES,
  normalizeAccessLevel,
  getPermissionMapForRoleKey,
} = require('../../lib/permissions');

function listRoles(db) {
  return db.prepare(`
    SELECT key, name, description, is_system, created_at, updated_at
    FROM roles
    ORDER BY is_system DESC, name COLLATE NOCASE ASC, key COLLATE NOCASE ASC
  `).all();
}

function getRoleByKey(db, roleKey) {
  return db.prepare(`
    SELECT key, name, description, is_system, created_at, updated_at
    FROM roles
    WHERE key = ?
  `).get(roleKey) || null;
}

function listRolePermissions(db, roleKey) {
  const rows = db.prepare(`
    SELECT module_key, access_level
    FROM role_permissions
    WHERE role_key = ?
  `).all(roleKey);
  const out = {};
  PERMISSION_MODULES.forEach((module) => {
    out[module.key] = ACCESS_NONE;
  });
  rows.forEach((row) => {
    out[row.module_key] = normalizeAccessLevel(row.access_level);
  });
  return out;
}

function getEffectivePermissionsForRole(db, roleKey) {
  const role = getRoleByKey(db, roleKey);
  if (!role) return getPermissionMapForRoleKey('user');
  const current = listRolePermissions(db, roleKey);
  const fallback = getPermissionMapForRoleKey(roleKey);
  const merged = {};
  PERMISSION_MODULES.forEach((module) => {
    merged[module.key] = normalizeAccessLevel(current[module.key], fallback[module.key] || ACCESS_NONE);
  });
  return merged;
}

function getEffectivePermissionsForUser(db, userId) {
  const row = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  return getEffectivePermissionsForRole(db, row?.role || 'user');
}

function upsertRole(db, role) {
  db.prepare(`
    INSERT INTO roles (key, name, description, is_system)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      updated_at = datetime('now')
  `).run(role.key, role.name, role.description || null, Number(role.is_system || 0));
  return getRoleByKey(db, role.key);
}

function updateRolePermissions(db, roleKey, permissions) {
  const upsert = db.prepare(`
    INSERT INTO role_permissions (role_key, module_key, access_level, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(role_key, module_key) DO UPDATE SET
      access_level = excluded.access_level,
      updated_at = datetime('now')
  `);
  PERMISSION_MODULES.forEach((module) => {
    upsert.run(roleKey, module.key, normalizeAccessLevel(permissions[module.key]));
  });
  return listRolePermissions(db, roleKey);
}

module.exports = {
  listRoles,
  getRoleByKey,
  listRolePermissions,
  getEffectivePermissionsForRole,
  getEffectivePermissionsForUser,
  upsertRole,
  updateRolePermissions,
};
