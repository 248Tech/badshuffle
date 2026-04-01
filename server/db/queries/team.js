const ORG_ID = 1;

function listApprovedStaffUsers(db) {
  return db.prepare(`
    SELECT
      id,
      email,
      role,
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
    WHERE COALESCE(org_id, 1) = ?
      AND approved = 1
      AND role IN ('admin', 'operator')
    ORDER BY email COLLATE NOCASE ASC
  `).all(ORG_ID);
}

function upsertUserPresence(db, userId, currentPath, currentLabel, lastSeenAt) {
  db.prepare(`
    INSERT INTO user_presence (user_id, current_path, current_label, last_seen_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      current_path = excluded.current_path,
      current_label = excluded.current_label,
      last_seen_at = excluded.last_seen_at,
      updated_at = datetime('now')
  `).run(userId, currentPath, currentLabel, lastSeenAt);
}

function listPresenceRowsForUsers(db, userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(', ');
  return db.prepare(`
    SELECT user_id, current_path, current_label, last_seen_at, updated_at
    FROM user_presence
    WHERE user_id IN (${placeholders})
  `).all(...userIds);
}

function listQuotesByCreators(db, userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(', ');
  return db.prepare(`
    SELECT q.*, c.signed_at, c.signed_quote_total
    FROM quotes q
    LEFT JOIN contracts c ON c.quote_id = q.id
    WHERE COALESCE(q.org_id, 1) = ?
      AND q.created_by IN (${placeholders})
    ORDER BY q.updated_at DESC, q.id DESC
  `).all(ORG_ID, ...userIds);
}

module.exports = {
  listApprovedStaffUsers,
  upsertUserPresence,
  listPresenceRowsForUsers,
  listQuotesByCreators,
};
