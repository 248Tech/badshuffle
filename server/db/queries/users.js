function getUserEmailById(db, userId, fallback = null) {
  if (!userId) return fallback;
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  return row && row.email ? row.email : fallback;
}

function slugifyUsernameBase(value) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return normalized || 'user';
}

function buildIdentityFields(profile = {}) {
  const first = String(profile.first_name || '').trim();
  const last = String(profile.last_name || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  const email = String(profile.email || '').trim().toLowerCase();
  const emailBase = email.includes('@') ? email.split('@')[0] : email;
  const usernameBase = slugifyUsernameBase(fullName || emailBase || 'user');
  const displayName = fullName || emailBase || email || 'User';
  return { usernameBase, displayName };
}

function getUniqueUsername(db, base, excludeUserId = null) {
  const normalizedBase = slugifyUsernameBase(base);
  let candidate = normalizedBase;
  let suffix = 2;
  const stmt = excludeUserId == null
    ? db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1')
    : db.prepare('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1');
  while (true) {
    const row = excludeUserId == null ? stmt.get(candidate) : stmt.get(candidate, excludeUserId);
    if (!row) return candidate;
    candidate = `${normalizedBase}.${suffix++}`;
  }
}

function ensureUserIdentityFields(db, userId) {
  if (!userId) return null;
  const row = db.prepare(`
    SELECT id, email, first_name, last_name, username, display_name
    FROM users
    WHERE id = ?
  `).get(userId);
  if (!row) return null;

  const next = {};
  const built = buildIdentityFields(row);
  if (!String(row.display_name || '').trim()) next.display_name = built.displayName;
  if (!String(row.username || '').trim()) next.username = getUniqueUsername(db, built.usernameBase, row.id);

  if (Object.keys(next).length > 0) {
    db.prepare(`
      UPDATE users
      SET
        username = COALESCE(?, username),
        display_name = COALESCE(?, display_name)
      WHERE id = ?
    `).run(next.username || null, next.display_name || null, row.id);
  }

  return getUserProfileById(db, userId);
}

function getUserProfileById(db, userId) {
  if (!userId) return null;
  return db.prepare(`
    SELECT
      id,
      email,
      role,
      org_id,
      approved,
      first_name,
      last_name,
      username,
      display_name,
      phone,
      photo_url,
      bio,
      created_at
    FROM users
    WHERE id = ?
  `).get(userId) || null;
}

function getUserByEmail(db, email) {
  const normalized = String(email || '').trim();
  if (!normalized) return null;
  return db.prepare(`
    SELECT
      id,
      email,
      role,
      org_id,
      approved,
      first_name,
      last_name,
      username,
      display_name,
      phone,
      photo_url,
      bio,
      created_at
    FROM users
    WHERE email = ?
  `).get(normalized) || null;
}

function updateUserProfile(db, userId, fields) {
  const identity = buildIdentityFields(fields);
  const username = getUniqueUsername(db, identity.usernameBase, userId);
  db.prepare(`
    UPDATE users
    SET
      email = ?,
      first_name = ?,
      last_name = ?,
      username = ?,
      display_name = ?,
      phone = ?,
      photo_url = ?,
      bio = ?
    WHERE id = ?
  `).run(
    fields.email,
    fields.first_name,
    fields.last_name,
    username,
    identity.displayName,
    fields.phone,
    fields.photo_url,
    fields.bio,
    userId
  );
  return getUserProfileById(db, userId);
}

function getActorEmail(db, actor, fallback = null) {
  if (actor && actor.email) return actor.email;
  return getUserEmailById(db, actor && actor.sub, fallback);
}

module.exports = {
  buildIdentityFields,
  ensureUserIdentityFields,
  getUniqueUsername,
  getUserEmailById,
  getUserProfileById,
  getUserByEmail,
  updateUserProfile,
  getActorEmail,
};
