const quoteService = require('./quoteService');
const {
  listApprovedStaffUsers,
  upsertUserPresence,
  listPresenceRowsForUsers,
  listQuotesByCreators,
} = require('../db/queries/team');
const { ensureUserIdentityFields } = require('../db/queries/users');

const ONLINE_MS = 2 * 60 * 1000;
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function currentTimestamp() {
  return new Date().toISOString();
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

function buildPresenceState(presenceRow, nowMs) {
  if (!presenceRow || !presenceRow.last_seen_at) {
    return {
      isOnline: false,
      lastSeenAt: null,
      currentPath: '',
      currentLabel: 'No recent activity',
    };
  }
  const lastSeenMs = new Date(presenceRow.last_seen_at).getTime();
  const isOnline = Number.isFinite(lastSeenMs) && (nowMs - lastSeenMs) <= ONLINE_MS;
  return {
    isOnline,
    lastSeenAt: presenceRow.last_seen_at,
    currentPath: presenceRow.current_path || '',
    currentLabel: presenceRow.current_label || pathToWorkLabel(presenceRow.current_path),
  };
}

function updateUserPresence(db, user, currentPath) {
  if (!user || !user.sub) throw createError(401, 'Unauthorized');
  const path = String(currentPath || '/');
  const label = pathToWorkLabel(path);
  const timestamp = currentTimestamp();
  upsertUserPresence(db, user.sub, path, label, timestamp);
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
  const online = staffUsers
    .map((user) => {
      const presence = buildPresenceState(byUserId.get(Number(user.id)), nowMs);
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
      };
    })
    .filter(Boolean);
  return { online };
}

function buildTeamOverview(db) {
  const staffUsers = listApprovedStaffUsers(db).map((user) => ensureUserIdentityFields(db, user.id) || user);
  const userIds = staffUsers.map((user) => Number(user.id)).filter(Boolean);
  const presenceRows = listPresenceRowsForUsers(db, userIds);
  const byUserId = new Map(presenceRows.map((row) => [Number(row.user_id), row]));
  const quotes = listQuotesByCreators(db, userIds);
  const defaultTaxRateRow = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
  const defaultTaxRate = defaultTaxRateRow ? Number.parseFloat(defaultTaxRateRow.value || '0') || 0 : 0;
  const summarized = quoteService.summarizeQuotesForList(db, quotes, defaultTaxRate);
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
    const presence = buildPresenceState(byUserId.get(userId), nowMs);
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

module.exports = {
  ORG_ID,
  ONLINE_MS,
  buildDisplayName,
  pathToWorkLabel,
  updateUserPresence,
  listOnlinePresence,
  buildTeamOverview,
};
