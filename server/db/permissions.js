const {
  DEFAULT_ROLE_DEFINITIONS,
  PERMISSION_MODULES,
  getPermissionMapForRoleKey,
} = require('../lib/permissions');

function seedRolesAndPermissions(db) {
  const insertRole = db.prepare(`
    INSERT INTO roles (key, name, description, is_system)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system,
      updated_at = datetime('now')
  `);
  const insertPermission = db.prepare(`
    INSERT INTO role_permissions (role_key, module_key, access_level)
    VALUES (?, ?, ?)
    ON CONFLICT(role_key, module_key) DO NOTHING
  `);

  DEFAULT_ROLE_DEFINITIONS.forEach((role) => {
    insertRole.run(role.key, role.name, role.description || null, Number(role.is_system || 0));
    const permissionMap = getPermissionMapForRoleKey(role.key);
    PERMISSION_MODULES.forEach((module) => {
      insertPermission.run(role.key, module.key, permissionMap[module.key] || 'none');
    });
  });
}

module.exports = {
  seedRolesAndPermissions,
};
