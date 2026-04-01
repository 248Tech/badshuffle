export const ACCESS_NONE = 'none';
export const ACCESS_READ = 'read';
export const ACCESS_MODIFY = 'modify';

const ACCESS_RANK = {
  [ACCESS_NONE]: 0,
  [ACCESS_READ]: 1,
  [ACCESS_MODIFY]: 2,
};

export function normalizeAccessLevel(value, fallback = ACCESS_NONE) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === ACCESS_NONE || normalized === ACCESS_READ || normalized === ACCESS_MODIFY) return normalized;
  return fallback;
}

export function hasPermission(permissions, moduleKey, minimum = ACCESS_READ) {
  const current = normalizeAccessLevel(permissions?.[moduleKey], ACCESS_NONE);
  return (ACCESS_RANK[current] || 0) >= (ACCESS_RANK[normalizeAccessLevel(minimum)] || 0);
}
