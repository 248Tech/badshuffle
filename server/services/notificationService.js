const { hasAccess, ACCESS_READ } = require('../lib/permissions');
const { getEffectivePermissionsForUser } = require('../db/queries/permissions');

const EVENT_DEFINITIONS = [
  { type: 'user_online', label: 'User Online', description: 'A staff member comes back online after being offline.', module: 'directory', defaultEnabled: 1 },
  { type: 'user_offline', label: 'User Offline', description: 'A staff member goes offline after the idle threshold.', module: 'directory', defaultEnabled: 1 },
  { type: 'quote_created', label: 'Project Created', description: 'A new project is created.', module: 'projects', defaultEnabled: 1 },
  { type: 'quote_sent', label: 'Project Sent', description: 'A project quote is sent.', module: 'projects', defaultEnabled: 1 },
  { type: 'quote_signed', label: 'Project Signed', description: 'A project quote is signed.', module: 'projects', defaultEnabled: 1 },
  { type: 'quote_confirmed', label: 'Project Confirmed', description: 'A project is confirmed.', module: 'projects', defaultEnabled: 1 },
  { type: 'project_lost', label: 'Project Cancelled', description: 'A project is cancelled or closed out as lost.', module: 'projects', defaultEnabled: 1 },
  { type: 'fulfillment_started', label: 'Begin Work On Project', description: 'Fulfillment work begins on a project.', module: 'projects', defaultEnabled: 1 },
  { type: 'message_received', label: 'Message Received', description: 'A client or inbound message arrives.', module: 'messages', defaultEnabled: 1 },
  { type: 'message_sent', label: 'Message Sent', description: 'A staff member sends a message.', module: 'messages', defaultEnabled: 1 },
  { type: 'item_created', label: 'Product Created', description: 'A new inventory item is created.', module: 'inventory', defaultEnabled: 1 },
  { type: 'item_deleted', label: 'Product Deleted', description: 'An inventory item is deleted.', module: 'inventory', defaultEnabled: 1 },
  { type: 'item_property_updated', label: 'Product Property Updated', description: 'An inventory item title, description, or price is changed.', module: 'inventory', defaultEnabled: 1 },
  { type: 'file_uploaded', label: 'File Uploaded', description: 'A new file is uploaded.', module: 'files', defaultEnabled: 1 },
  { type: 'lead_created', label: 'Lead Created', description: 'A new lead is created.', module: 'directory', defaultEnabled: 1 },
];

const EVENT_MODULES = Object.fromEntries(EVENT_DEFINITIONS.map((entry) => [entry.type, entry.module]));
const EXCLUDE_ACTOR_TYPES = new Set([
  'quote_created',
  'quote_sent',
  'message_sent',
  'fulfillment_started',
  'item_created',
  'item_deleted',
  'item_property_updated',
  'file_uploaded',
  'lead_created',
]);
const ONLINE_NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000;
const DEFAULT_TIMEZONE = 'America/New_York';

function currentTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function parseTimestampMs(value) {
  if (!value) return 0;
  const ms = new Date(String(value).replace(' ', 'T') + 'Z').getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildActorLabel(actor) {
  const first = String(actor?.first_name || '').trim();
  const last = String(actor?.last_name || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || String(actor?.display_name || '').trim() || String(actor?.email || '').trim() || '';
}

function getOfflineThresholdMinutes(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'presence_offline_after_minutes'").get();
  const minutes = Number.parseInt(String(row?.value || '30'), 10);
  return Math.max(5, Math.min(240, Number.isFinite(minutes) ? minutes : 30));
}

function getOfflineThresholdMs(db) {
  return getOfflineThresholdMinutes(db) * 60 * 1000;
}

function getAppTimezone(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'app_timezone'").get();
  const value = String(row?.value || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function formatTimestampForTimezone(value, timezone) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

function listApprovedUsers(db) {
  return db.prepare(`
    SELECT id, email, role, approved, first_name, last_name, username, display_name, photo_url,
           live_notifications_enabled, live_notification_sound_enabled
    FROM users
    WHERE COALESCE(org_id, 1) = 1
      AND approved = 1
    ORDER BY email COLLATE NOCASE ASC
  `).all();
}

function userHasModule(db, userId, moduleKey) {
  if (!moduleKey) return true;
  return hasAccess(getEffectivePermissionsForUser(db, userId)?.[moduleKey], ACCESS_READ);
}

function ensureNotificationTypeRows(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO notification_type_settings (notification_type, enabled, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `);
  EVENT_DEFINITIONS.forEach((entry) => insert.run(entry.type, Number(entry.defaultEnabled || 0)));
}

function listNotificationSettings(db) {
  ensureNotificationTypeRows(db);
  const settingsRows = db.prepare(`
    SELECT notification_type, enabled
    FROM notification_type_settings
  `).all();
  const settingMap = new Map(settingsRows.map((row) => [row.notification_type, Number(row.enabled || 0)]));
  const groupRows = db.prepare(`
    SELECT ntg.notification_type, tg.id AS group_id, tg.name
    FROM notification_type_groups ntg
    JOIN team_groups tg ON tg.id = ntg.group_id
    ORDER BY tg.name COLLATE NOCASE ASC
  `).all();
  const groupMap = new Map();
  groupRows.forEach((row) => {
    if (!groupMap.has(row.notification_type)) groupMap.set(row.notification_type, []);
    groupMap.get(row.notification_type).push({ id: Number(row.group_id), name: row.name });
  });
  return {
    timezone: getAppTimezone(db),
    types: EVENT_DEFINITIONS.map((entry) => ({
      type: entry.type,
      label: entry.label,
      description: entry.description,
      module: entry.module,
      enabled: settingMap.has(entry.type) ? settingMap.get(entry.type) : Number(entry.defaultEnabled || 0),
      groups: groupMap.get(entry.type) || [],
    })),
  };
}

function updateNotificationSettings(db, payload = {}) {
  ensureNotificationTypeRows(db);
  const rows = Array.isArray(payload.types) ? payload.types : [];
  const upsert = db.prepare(`
    INSERT INTO notification_type_settings (notification_type, enabled, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(notification_type) DO UPDATE SET
      enabled = excluded.enabled,
      updated_at = datetime('now')
  `);
  const deleteGroups = db.prepare('DELETE FROM notification_type_groups WHERE notification_type = ?');
  const insertGroup = db.prepare(`
    INSERT OR IGNORE INTO notification_type_groups (notification_type, group_id, created_at)
    VALUES (?, ?, datetime('now'))
  `);
  rows.forEach((row) => {
    const type = String(row?.type || '').trim();
    if (!EVENT_MODULES[type]) return;
    upsert.run(type, row.enabled ? 1 : 0);
    deleteGroups.run(type);
    const groupIds = Array.from(new Set((Array.isArray(row.group_ids) ? row.group_ids : []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
    groupIds.forEach((groupId) => insertGroup.run(type, groupId));
  });
  return listNotificationSettings(db);
}

function getNotificationPreference(db, type) {
  ensureNotificationTypeRows(db);
  const definition = EVENT_DEFINITIONS.find((entry) => entry.type === type);
  if (!definition) return { enabled: true, groupIds: [] };
  const row = db.prepare(`
    SELECT enabled
    FROM notification_type_settings
    WHERE notification_type = ?
  `).get(type);
  const groupRows = db.prepare(`
    SELECT group_id
    FROM notification_type_groups
    WHERE notification_type = ?
  `).all(type);
  return {
    enabled: row ? Number(row.enabled || 0) === 1 : Number(definition.defaultEnabled || 0) === 1,
    groupIds: groupRows.map((groupRow) => Number(groupRow.group_id)).filter(Boolean),
  };
}

function getUsersInGroups(db, groupIds) {
  const ids = Array.from(new Set((groupIds || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
  if (!ids.length) return new Set();
  const rows = db.prepare(`
    SELECT DISTINCT user_id
    FROM team_group_members
    WHERE group_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);
  return new Set(rows.map((row) => Number(row.user_id)));
}

function notificationSelectSql(whereSql) {
  return `
    SELECT
      nr.id,
      nr.notification_id,
      nr.user_id,
      nr.presented_at,
      nr.read_at,
      nr.dismissed_at,
      nr.created_at AS recipient_created_at,
      n.type,
      n.title,
      n.body,
      n.href,
      n.entity_type,
      n.entity_id,
      n.actor_user_id,
      n.actor_label,
      n.actor_photo_url,
      n.metadata_json,
      n.created_at
    FROM notification_recipients nr
    JOIN notifications n ON n.id = nr.notification_id
    ${whereSql}
  `;
}

function normalizeNotificationRow(row, timezone) {
  return {
    id: Number(row.id),
    notification_id: Number(row.notification_id),
    user_id: Number(row.user_id),
    type: row.type,
    title: row.title,
    body: row.body || '',
    href: row.href || '',
    entity_type: row.entity_type || '',
    entity_id: row.entity_id != null ? Number(row.entity_id) : null,
    actor_user_id: row.actor_user_id != null ? Number(row.actor_user_id) : null,
    actor_label: row.actor_label || '',
    actor_photo_url: row.actor_photo_url || '',
    metadata: row.metadata_json ? safeJsonParse(row.metadata_json) : null,
    created_at: row.created_at,
    exact_time: formatTimestampForTimezone(row.created_at, timezone),
    timezone,
    presented_at: row.presented_at || null,
    read_at: row.read_at || null,
    dismissed_at: row.dismissed_at || null,
    unread: !row.read_at,
  };
}

function createNotification(db, event) {
  const type = String(event.type || '').trim();
  if (!type) return null;

  const preference = getNotificationPreference(db, type);
  if (!preference.enabled) return null;

  const moduleKey = EVENT_MODULES[type] || null;
  const actorUserId = event.actorUserId ? Number(event.actorUserId) : null;
  const groupedUsers = preference.groupIds.length ? getUsersInGroups(db, preference.groupIds) : null;
  const recipients = listApprovedUsers(db)
    .filter((user) => userHasModule(db, user.id, moduleKey))
    .filter((user) => !(actorUserId && EXCLUDE_ACTOR_TYPES.has(type) && Number(user.id) === actorUserId))
    .filter((user) => !groupedUsers || groupedUsers.has(Number(user.id)))
    .map((user) => Number(user.id));

  if (recipients.length === 0) return null;

  const info = db.prepare(`
    INSERT INTO notifications (
      type, title, body, href, entity_type, entity_id, actor_user_id, actor_label, actor_photo_url, metadata_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    type,
    String(event.title || '').trim() || type,
    event.body != null ? String(event.body).trim() || null : null,
    event.href != null ? String(event.href).trim() || null : null,
    event.entityType != null ? String(event.entityType).trim() || null : null,
    event.entityId != null ? Number(event.entityId) : null,
    actorUserId,
    event.actorLabel != null ? String(event.actorLabel).trim() || null : null,
    event.actorPhotoUrl != null ? String(event.actorPhotoUrl).trim() || null : null,
    event.metadata ? JSON.stringify(event.metadata) : null
  );

  const insertRecipient = db.prepare(`
    INSERT OR IGNORE INTO notification_recipients (notification_id, user_id, created_at)
    VALUES (?, ?, datetime('now'))
  `);
  recipients.forEach((userId) => insertRecipient.run(info.lastInsertRowid, userId));

  return getNotificationRecipientRows(db, Number(info.lastInsertRowid), recipients);
}

function getNotificationRecipientRows(db, notificationId, recipientIds = null) {
  let sql = `${notificationSelectSql('WHERE nr.notification_id = ?')}`;
  const params = [notificationId];
  if (Array.isArray(recipientIds) && recipientIds.length > 0) {
    sql += ` AND nr.user_id IN (${recipientIds.map(() => '?').join(',')})`;
    params.push(...recipientIds);
  }
  sql += ' ORDER BY nr.id DESC';
  const timezone = getAppTimezone(db);
  return db.prepare(sql).all(...params).map((row) => normalizeNotificationRow(row, timezone));
}

function listNotificationsForUser(db, userId, options = {}) {
  const limit = Math.max(1, Math.min(100, parseInt(String(options.limit || 20), 10) || 20));
  const unreadOnly = String(options.unread_only || '') === '1';
  const beforeId = options.before_id ? Number(options.before_id) : null;
  let sql = `${notificationSelectSql('WHERE nr.user_id = ? AND nr.dismissed_at IS NULL')}`;
  const params = [Number(userId)];
  if (beforeId) {
    sql += ' AND nr.id < ?';
    params.push(beforeId);
  }
  if (unreadOnly) sql += ' AND nr.read_at IS NULL';
  sql += ' ORDER BY nr.id DESC LIMIT ?';
  params.push(limit);
  const timezone = getAppTimezone(db);
  const items = db.prepare(sql).all(...params).map((row) => normalizeNotificationRow(row, timezone));
  return { notifications: items, timezone };
}

function getUnreadCount(db, userId) {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS count,
      MAX(id) AS latest_recipient_id
    FROM notification_recipients
    WHERE user_id = ?
      AND read_at IS NULL
      AND dismissed_at IS NULL
  `).get(Number(userId));
  const latest = db.prepare(`
    SELECT MAX(id) AS latest_recipient_id
    FROM notification_recipients
    WHERE user_id = ?
      AND dismissed_at IS NULL
  `).get(Number(userId));
  return {
    count: Number(row?.count || 0),
    latest_recipient_id: Number(latest?.latest_recipient_id || 0),
  };
}

function getFeedForUser(db, userId, afterId, limit = 20) {
  const cursor = Math.max(0, Number(afterId || 0));
  const rows = db.prepare(`
    ${notificationSelectSql('WHERE nr.user_id = ? AND nr.id > ? AND nr.dismissed_at IS NULL')}
    ORDER BY nr.id ASC
    LIMIT ?
  `).all(Number(userId), cursor, Math.max(1, Math.min(50, Number(limit) || 20)));
  const timezone = getAppTimezone(db);
  return {
    notifications: rows.map((row) => normalizeNotificationRow(row, timezone)),
    latest_recipient_id: rows.length ? Number(rows[rows.length - 1].id) : cursor,
    timezone,
  };
}

function markPresented(db, userId, recipientIds) {
  const ids = uniqueNumericIds(recipientIds);
  if (ids.length === 0) return { ok: true, updated: 0 };
  const info = db.prepare(`
    UPDATE notification_recipients
    SET presented_at = COALESCE(presented_at, datetime('now'))
    WHERE user_id = ?
      AND id IN (${ids.map(() => '?').join(',')})
  `).run(Number(userId), ...ids);
  return { ok: true, updated: Number(info.changes || 0) };
}

function markRead(db, userId, recipientId) {
  const info = db.prepare(`
    UPDATE notification_recipients
    SET read_at = COALESCE(read_at, datetime('now'))
    WHERE user_id = ?
      AND id = ?
  `).run(Number(userId), Number(recipientId));
  return { ok: true, updated: Number(info.changes || 0) };
}

function markAllRead(db, userId) {
  const info = db.prepare(`
    UPDATE notification_recipients
    SET read_at = COALESCE(read_at, datetime('now'))
    WHERE user_id = ?
      AND read_at IS NULL
      AND dismissed_at IS NULL
  `).run(Number(userId));
  return { ok: true, updated: Number(info.changes || 0) };
}

function dismissNotification(db, userId, recipientId) {
  const info = db.prepare(`
    DELETE FROM notification_recipients
    WHERE user_id = ?
      AND id = ?
  `).run(Number(userId), Number(recipientId));
  return { ok: true, updated: Number(info.changes || 0) };
}

function dismissNotificationsByType(db, userId, type) {
  const normalizedType = String(type || '').trim();
  if (!normalizedType) return { ok: true, updated: 0 };
  const info = db.prepare(`
    DELETE FROM notification_recipients
    WHERE user_id = ?
      AND notification_id IN (
        SELECT id
        FROM notifications
        WHERE type = ?
      )
  `).run(Number(userId), normalizedType);
  return { ok: true, updated: Number(info.changes || 0) };
}

function uniqueNumericIds(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
}

function notePresenceState(db, userId, nextState) {
  db.prepare('UPDATE user_presence SET presence_state = ? WHERE user_id = ?').run(String(nextState || 'offline'), Number(userId));
}

function handlePresenceHeartbeat(db, user, previousPresence = null) {
  const userId = Number(user?.sub || user?.id || 0);
  if (!userId) return null;
  const row = db.prepare(`
    SELECT p.user_id, p.current_label, p.last_seen_at, p.presence_state, u.first_name, u.last_name, u.display_name, u.email, u.photo_url
    FROM user_presence p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
  `).get(userId);
  const now = Date.now();
  const hadPreviousPresence = !!previousPresence;
  const thresholdMs = getOfflineThresholdMs(db);
  const lastActiveMs = parseTimestampMs(previousPresence?.last_active_at || previousPresence?.last_seen_at);
  const wasOnline = previousPresence?.presence_state === 'online' && lastActiveMs > 0 && (now - lastActiveMs) <= thresholdMs;
  const nextOnlineSince = wasOnline
    ? (previousPresence?.online_since_at || row?.online_since_at || currentTimestamp())
    : currentTimestamp();
  db.prepare(`
    UPDATE user_presence
    SET presence_state = 'online',
        online_since_at = ?,
        updated_at = datetime('now')
    WHERE user_id = ?
  `).run(nextOnlineSince, userId);
  if (!hadPreviousPresence || wasOnline) return null;
  const lastOnlineNotificationMs = parseTimestampMs(previousPresence?.online_notification_at);
  if (lastOnlineNotificationMs > 0 && (now - lastOnlineNotificationMs) < ONLINE_NOTIFICATION_COOLDOWN_MS) {
    return null;
  }
  db.prepare(`
    UPDATE user_presence
    SET online_notification_at = datetime('now')
    WHERE user_id = ?
  `).run(userId);
  const actorLabel = buildActorLabel(row || user);
  return createNotification(db, {
    type: 'user_online',
    title: `${actorLabel || 'User'} is online`,
    body: row?.current_label ? `Working in ${row.current_label}` : 'Active in BadShuffle',
    href: '/team',
    entityType: 'user',
    entityId: userId,
    actorUserId: userId,
    actorLabel,
    actorPhotoUrl: row?.photo_url || user?.photo_url || '',
  });
}

function sweepOfflineUsers(db) {
  const cutoff = new Date(Date.now() - getOfflineThresholdMs(db)).toISOString().replace('T', ' ').slice(0, 19);
  const rows = db.prepare(`
    SELECT p.user_id, p.current_label, p.last_active_at, p.last_seen_at, u.first_name, u.last_name, u.display_name, u.email, u.photo_url
    FROM user_presence p
    JOIN users u ON u.id = p.user_id
    WHERE p.presence_state = 'online'
      AND COALESCE(p.last_active_at, p.last_seen_at) IS NOT NULL
      AND COALESCE(p.last_active_at, p.last_seen_at) < ?
      AND u.approved = 1
  `).all(cutoff);
  rows.forEach((row) => {
    notePresenceState(db, row.user_id, 'offline');
    const actorLabel = buildActorLabel(row);
    createNotification(db, {
      type: 'user_offline',
      title: `${actorLabel || 'User'} went offline`,
      body: row.current_label ? `Last active in ${row.current_label}` : 'No longer active in BadShuffle',
      href: '/team',
      entityType: 'user',
      entityId: Number(row.user_id),
      actorUserId: Number(row.user_id),
      actorLabel,
      actorPhotoUrl: row.photo_url || '',
    });
  });
  return rows.length;
}

module.exports = {
  EVENT_DEFINITIONS,
  buildActorLabel,
  createNotification,
  getAppTimezone,
  getOfflineThresholdMs,
  listNotificationSettings,
  updateNotificationSettings,
  listNotificationsForUser,
  getUnreadCount,
  getFeedForUser,
  markPresented,
  markRead,
  markAllRead,
  dismissNotification,
  dismissNotificationsByType,
  handlePresenceHeartbeat,
  sweepOfflineUsers,
};
