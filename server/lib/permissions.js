const ACCESS_NONE = 'none';
const ACCESS_READ = 'read';
const ACCESS_MODIFY = 'modify';

const ACCESS_LEVELS = [ACCESS_NONE, ACCESS_READ, ACCESS_MODIFY];
const ACCESS_RANK = {
  [ACCESS_NONE]: 0,
  [ACCESS_READ]: 1,
  [ACCESS_MODIFY]: 2,
};

const PERMISSION_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'projects', label: 'Projects' },
  { key: 'fulfillment', label: 'Fulfillment' },
  { key: 'files', label: 'Files' },
  { key: 'messages', label: 'Messages' },
  { key: 'billing', label: 'Billing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'directory', label: 'Directory' },
  { key: 'maps', label: 'Maps' },
  { key: 'settings', label: 'Settings' },
  { key: 'admin', label: 'Admin' },
];

const DEFAULT_ROLE_DEFINITIONS = [
  { key: 'admin', name: 'Admin', description: 'Full system access', is_system: 1 },
  { key: 'operator', name: 'Operator', description: 'Staff user with broad operational access', is_system: 1 },
  { key: 'worker', name: 'Worker', description: 'Read-only project access with fulfillment actions', is_system: 1 },
  { key: 'user', name: 'User', description: 'Limited internal user', is_system: 1 },
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    dashboard: ACCESS_MODIFY,
    projects: ACCESS_MODIFY,
    fulfillment: ACCESS_MODIFY,
    files: ACCESS_MODIFY,
    messages: ACCESS_MODIFY,
    billing: ACCESS_MODIFY,
    inventory: ACCESS_MODIFY,
    directory: ACCESS_MODIFY,
    maps: ACCESS_MODIFY,
    settings: ACCESS_MODIFY,
    admin: ACCESS_MODIFY,
  },
  operator: {
    dashboard: ACCESS_READ,
    projects: ACCESS_MODIFY,
    fulfillment: ACCESS_MODIFY,
    files: ACCESS_MODIFY,
    messages: ACCESS_MODIFY,
    billing: ACCESS_MODIFY,
    inventory: ACCESS_MODIFY,
    directory: ACCESS_READ,
    maps: ACCESS_READ,
    settings: ACCESS_MODIFY,
    admin: ACCESS_NONE,
  },
  worker: {
    dashboard: ACCESS_READ,
    projects: ACCESS_READ,
    fulfillment: ACCESS_MODIFY,
    files: ACCESS_READ,
    messages: ACCESS_NONE,
    billing: ACCESS_NONE,
    inventory: ACCESS_NONE,
    directory: ACCESS_READ,
    maps: ACCESS_NONE,
    settings: ACCESS_NONE,
    admin: ACCESS_NONE,
  },
  user: {
    dashboard: ACCESS_READ,
    projects: ACCESS_READ,
    fulfillment: ACCESS_NONE,
    files: ACCESS_READ,
    messages: ACCESS_NONE,
    billing: ACCESS_NONE,
    inventory: ACCESS_NONE,
    directory: ACCESS_READ,
    maps: ACCESS_NONE,
    settings: ACCESS_NONE,
    admin: ACCESS_NONE,
  },
};

function normalizeAccessLevel(value, fallback = ACCESS_NONE) {
  const normalized = String(value || '').trim().toLowerCase();
  return ACCESS_LEVELS.includes(normalized) ? normalized : fallback;
}

function hasAccess(current, required = ACCESS_READ) {
  return (ACCESS_RANK[normalizeAccessLevel(current)] || 0) >= (ACCESS_RANK[normalizeAccessLevel(required)] || 0);
}

function getPermissionMapForRoleKey(roleKey) {
  const map = {};
  const source = DEFAULT_ROLE_PERMISSIONS[roleKey] || {};
  PERMISSION_MODULES.forEach((module) => {
    map[module.key] = normalizeAccessLevel(source[module.key], ACCESS_NONE);
  });
  return map;
}

module.exports = {
  ACCESS_NONE,
  ACCESS_READ,
  ACCESS_MODIFY,
  ACCESS_LEVELS,
  ACCESS_RANK,
  PERMISSION_MODULES,
  DEFAULT_ROLE_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeAccessLevel,
  hasAccess,
  getPermissionMapForRoleKey,
};
