const quoteService = require('./quoteService');
const notificationService = require('./notificationService');
const {
  listApprovedStaffUsers,
  upsertUserPresence,
  listPresenceRowsForUsers,
  listQuotesByCreators,
} = require('../db/queries/team');
const { ensureUserIdentityFields } = require('../db/queries/users');

const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function currentTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function buildDisplayName(user) {
  const first = String(user?.first_name || '').trim();
  const last = String(user?.last_name || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || String(user?.display_name || '').trim() || String(user?.email || '').trim() || 'Unknown user';
}

function pathToWorkLabel(path) {
  const raw = String(path || '').trim();
  if (!raw || raw === '/') return 'Dashboard';
  const normalized = raw.replace(/^\//, '');
  const map = {
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    quotes: 'Projects',
    maps: 'Maps',
    billing: 'Billing',
    leads: 'Leads',
    files: 'Files',
    messages: 'Messages',
    team: 'Team',
    profile: 'Profile',
    stats: 'Stats',
    extension: 'Extension',
    admin: 'Admin',
    templates: 'Templates',
    settings: 'Settings',
    directory: 'Directory',
    vendors: 'Vendors',
    'team/groups': 'Team Groups',
    'inventory/set-aside': 'Set Aside',
    'settings/notifications': 'Notification Settings',
    'inventory-settings': 'Inventory Settings',
    'message-settings': 'Message Settings',
  };
  if (map[normalized]) return map[normalized];
  if (normalized.startsWith('inventory/')) return 'Item';
  if (normalized.startsWith('quotes/')) return 'Project';
  if (normalized.startsWith('team/')) return 'Team';
  return normalized;
}

function parseDateOnly(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function startOfYear(date = new Date()) {
  const year = date.getUTCFullYear();
  return `${year}-01-01`;
}

function classifySignedRevenueQuote(quote) {
  const status = String(quote.status || 'draft');
  const hasSignedContract = !!quote.signed_at || ['approved', 'confirmed'].includes(status) || (status === 'closed' && quote.signed_quote_total != null);
  return hasSignedContract;
}

function salesWindowDate(quote) {
  return parseDateOnly(quote.event_date) || parseDateOnly(quote.created_at);
}

function buildPresenceState(presenceRow, nowMs, thresholdMs) {
  if (!presenceRow || !(presenceRow.last_active_at || presenceRow.last_seen_at)) {
    return {
      isOnline: false,
      lastSeenAt: null,
      lastActiveAt: null,
      onlineSinceAt: null,
      onlineForMs: 0,
      idleForMs: 0,
      currentPath: '',
      currentLabel: 'No recent activity',
    };
  }
  const lastSeenAt = presenceRow.last_seen_at || null;
  const lastActiveAt = presenceRow.last_active_at || presenceRow.last_seen_at || null;
  const lastActiveMs = new Date(String(lastActiveAt).replace(' ', 'T') + 'Z').getTime();
  const onlineSinceAt = presenceRow.online_since_at || lastActiveAt;
  const onlineSinceMs = new Date(String(onlineSinceAt).replace(' ', 'T') + 'Z').getTime();
  const idleForMs = Number.isFinite(lastActiveMs) ? Math.max(0, nowMs - lastActiveMs) : 0;
  const isOnline = Number.isFinite(lastActiveMs) && idleForMs <= thresholdMs;
  return {
    isOnline,
    lastSeenAt,
    lastActiveAt,
    onlineSinceAt: isOnline ? onlineSinceAt : null,
    onlineForMs: isOnline && Number.isFinite(onlineSinceMs) ? Math.max(0, nowMs - onlineSinceMs) : 0,
    idleForMs,
    currentPath: presenceRow.current_path || '',
    currentLabel: presenceRow.current_label || pathToWorkLabel(presenceRow.current_path),
  };
}

function updateUserPresence(db, user, currentPath) {
  if (!user || !user.sub) throw createError(401, 'Unauthorized');
  const previous = db.prepare(`
    SELECT user_id, current_path, current_label, last_seen_at, last_active_at, online_since_at, online_notification_at, presence_state
    FROM user_presence
    WHERE user_id = ?
  `).get(user.sub);
  const path = String(currentPath || '/');
  const label = pathToWorkLabel(path);
  const timestamp = currentTimestamp();
  upsertUserPresence(db, user.sub, path, label, timestamp);
  notificationService.handlePresenceHeartbeat(db, {
    ...user,
    current_label: label,
  }, previous);
  return {
    ok: true,
    presence: {
      userId: user.sub,
      email: user.email || `User ${user.sub}`,
      path,
      label,
      lastSeen: timestamp,
    },
  };
}

function listOnlinePresence(db) {
  const staffUsers = listApprovedStaffUsers(db).map((user) => ensureUserIdentityFields(db, user.id) || user);
  const userIds = staffUsers.map((user) => user.id);
  const presenceRows = listPresenceRowsForUsers(db, userIds);
  const byUserId = new Map(presenceRows.map((row) => [Number(row.user_id), row]));
  const nowMs = Date.now();
  const offlineThresholdMs = notificationService.getOfflineThresholdMs(db);
  const online = staffUsers
    .map((user) => {
      const presence = buildPresenceState(byUserId.get(Number(user.id)), nowMs, offlineThresholdMs);
      if (!presence.isOnline) return null;
      return {
        userId: user.id,
        full_name: buildDisplayName(user),
        username: user.username || '',
        display_name: user.display_name || '',
        email: user.email,
        photo_url: user.photo_url || '',
        path: presence.currentPath || '/',
        label: presence.currentLabel,
        lastSeen: presence.lastSeenAt,
        lastActiveAt: presence.lastActiveAt,
        onlineSinceAt: presence.onlineSinceAt,
        onlineForMs: presence.onlineForMs,
        idleForMs: presence.idleForMs,
      };
    })
    .filter(Boolean);
  return { online };
}

async function buildTeamOverview(db, options = {}) {
  const staffUsers = listApprovedStaffUsers(db).map((user) => ensureUserIdentityFields(db, user.id) || user);
  const userIds = staffUsers.map((user) => Number(user.id)).filter(Boolean);
  const presenceRows = listPresenceRowsForUsers(db, userIds);
  const byUserId = new Map(presenceRows.map((row) => [Number(row.user_id), row]));
  const quotes = listQuotesByCreators(db, userIds);
  const defaultTaxRateRow = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
  const defaultTaxRate = defaultTaxRateRow ? Number.parseFloat(defaultTaxRateRow.value || '0') || 0 : 0;
  const summarized = await quoteService.summarizeQuotesForList(db, quotes, defaultTaxRate, {
    diagnostics: options.diagnostics,
    requestId: options.requestId,
    route: 'team-overview',
  });
  const quotesByUser = new Map();
  summarized.forEach((quote) => {
    const userId = Number(quote.created_by || 0);
    if (!userId) return;
    if (!quotesByUser.has(userId)) quotesByUser.set(userId, []);
    quotesByUser.get(userId).push(quote);
  });

  const ytdStart = startOfYear(new Date());
  const today = todayDateOnly();
  const nowMs = Date.now();
  const offlineThresholdMs = notificationService.getOfflineThresholdMs(db);
  const members = staffUsers.map((user) => {
    const userId = Number(user.id);
    const userQuotes = (quotesByUser.get(userId) || []).slice().sort((a, b) => {
      return String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || Number(b.id) - Number(a.id);
    });
    const recentQuotes = userQuotes.slice(0, 3).map((quote) => ({
      id: quote.id,
      name: quote.name || 'Untitled project',
      status: quote.status || 'draft',
      event_date: quote.event_date || null,
      updated_at: quote.updated_at || quote.created_at || null,
    }));
    const salesTotalYtd = userQuotes.reduce((sum, quote) => {
      if (!classifySignedRevenueQuote(quote)) return sum;
      const quoteDate = salesWindowDate(quote);
      if (!quoteDate || quoteDate < ytdStart || quoteDate > today) return sum;
      const revenue = Number(quote.signed_quote_total != null ? quote.signed_quote_total : quote.total || 0);
      return sum + revenue;
    }, 0);
    const presence = buildPresenceState(byUserId.get(userId), nowMs, offlineThresholdMs);
    return {
      id: userId,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      full_name: buildDisplayName(user),
      username: user.username || '',
      display_name: user.display_name || '',
      phone: user.phone || '',
      photo_url: user.photo_url || '',
      bio: user.bio || '',
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      is_online: presence.isOnline,
      last_seen_at: presence.lastSeenAt,
      last_active_at: presence.lastActiveAt,
      online_since_at: presence.onlineSinceAt,
      online_for_ms: presence.onlineForMs,
      idle_for_ms: presence.idleForMs,
      current_path: presence.currentPath,
      current_label: presence.currentLabel,
      sales_total_ytd: salesTotalYtd,
      quote_count: userQuotes.length,
      recent_quotes: recentQuotes,
    };
  });

  return {
    range: {
      sales_start: ytdStart,
      sales_end: today,
    },
    members,
  };
}

function listGroupRows(db) {
  return db.prepare(`
    SELECT
      tg.id,
      tg.name,
      tg.description,
      tg.created_at,
      tg.updated_at,
      COUNT(tgm.user_id) AS member_count
    FROM team_groups tg
    LEFT JOIN team_group_members tgm ON tgm.group_id = tg.id
    GROUP BY tg.id
    ORDER BY tg.name COLLATE NOCASE ASC
  `).all();
}

function listGroupMembers(db) {
  return db.prepare(`
    SELECT
      tgm.group_id,
      u.id,
      u.email,
      u.role,
      u.first_name,
      u.last_name,
      u.username,
      u.display_name,
      u.photo_url
    FROM team_group_members tgm
    JOIN users u ON u.id = tgm.user_id
    WHERE u.approved = 1
    ORDER BY u.email COLLATE NOCASE ASC
  `).all();
}

function listAssignableMembers(db) {
  return listApprovedStaffUsers(db)
    .map((user) => ensureUserIdentityFields(db, user.id) || user)
    .map((user) => ({
      id: Number(user.id),
      email: user.email,
      role: user.role,
      full_name: buildDisplayName(user),
      username: user.username || '',
      display_name: user.display_name || '',
      photo_url: user.photo_url || '',
    }));
}

function buildTeamGroupsPayload(db) {
  const groups = listGroupRows(db);
  const membershipRows = listGroupMembers(db);
  const membersByGroup = new Map();
  membershipRows.forEach((row) => {
    if (!membersByGroup.has(Number(row.group_id))) membersByGroup.set(Number(row.group_id), []);
    membersByGroup.get(Number(row.group_id)).push({
      id: Number(row.id),
      email: row.email,
      role: row.role,
      full_name: buildDisplayName(row),
      username: row.username || '',
      display_name: row.display_name || '',
      photo_url: row.photo_url || '',
    });
  });
  return {
    groups: groups.map((group) => ({
      id: Number(group.id),
      name: group.name,
      description: group.description || '',
      member_count: Number(group.member_count || 0),
      created_at: group.created_at,
      updated_at: group.updated_at,
      members: membersByGroup.get(Number(group.id)) || [],
    })),
    members: listAssignableMembers(db),
  };
}

function createGroup(db, body = {}) {
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  if (!name) throw createError(400, 'Group name is required');
  try {
    const result = db.prepare(`
      INSERT INTO team_groups (name, description, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).run(name, description || null);
    return {
      group: db.prepare('SELECT id, name, description, created_at, updated_at FROM team_groups WHERE id = ?').get(result.lastInsertRowid),
    };
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) throw createError(409, 'Group name already exists');
    throw error;
  }
}

function deleteGroup(db, groupId) {
  const id = Number(groupId);
  const existing = db.prepare('SELECT id FROM team_groups WHERE id = ?').get(id);
  if (!existing) throw createError(404, 'Group not found');
  db.prepare('DELETE FROM team_groups WHERE id = ?').run(id);
  return { deleted: true };
}

function replaceGroupMembers(db, groupId, body = {}) {
  const id = Number(groupId);
  const existing = db.prepare('SELECT id FROM team_groups WHERE id = ?').get(id);
  if (!existing) throw createError(404, 'Group not found');
  const validUserIds = new Set(listAssignableMembers(db).map((member) => Number(member.id)));
  const nextUserIds = Array.from(new Set((Array.isArray(body.user_ids) ? body.user_ids : []).map((value) => Number(value)).filter((value) => validUserIds.has(value))));
  db.prepare('DELETE FROM team_group_members WHERE group_id = ?').run(id);
  const insert = db.prepare('INSERT OR IGNORE INTO team_group_members (group_id, user_id, created_at) VALUES (?, ?, datetime(\'now\'))');
  nextUserIds.forEach((userId) => insert.run(id, userId));
  db.prepare('UPDATE team_groups SET updated_at = datetime(\'now\') WHERE id = ?').run(id);
  return buildTeamGroupsPayload(db);
}

function removeGroupMember(db, groupId, userId) {
  const gid = Number(groupId);
  const uid = Number(userId);
  const existing = db.prepare('SELECT id FROM team_groups WHERE id = ?').get(gid);
  if (!existing) throw createError(404, 'Group not found');
  db.prepare('DELETE FROM team_group_members WHERE group_id = ? AND user_id = ?').run(gid, uid);
  db.prepare('UPDATE team_groups SET updated_at = datetime(\'now\') WHERE id = ?').run(gid);
  return { deleted: true };
}

module.exports = {
  ORG_ID,
  buildDisplayName,
  pathToWorkLabel,
  updateUserPresence,
  listOnlinePresence,
  buildTeamOverview,
  buildTeamGroupsPayload,
  createGroup,
  deleteGroup,
  replaceGroupMembers,
  removeGroupMember,
};
