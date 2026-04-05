const BASE = (import.meta.env.VITE_API_BASE || '') + '/api';
const inflightRequests = new Map();

function getToken() { return localStorage.getItem('bs_token'); }
function setToken(t) { localStorage.setItem('bs_token', t); }

/** Signed file serve paths (from POST /files/serve-links); cleared on logout */
const fileServePathCache = new Map();

function parseExpMsFromServePath(p) {
  const m = /[?&]exp=(\d+)/.exec(p);
  return m ? parseInt(m[1], 10) : Date.now() + 3600000;
}

function rememberServePath(id, path) {
  const sid = String(id).trim();
  fileServePathCache.set(sid, { path, expMs: parseExpMsFromServePath(path) });
}

function appendVariantQuery(url, variant) {
  if (!variant) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}variant=${encodeURIComponent(variant)}`;
}

function getCachedServePath(id) {
  const sid = String(id ?? '').trim();
  if (!isNumericId(sid)) return null;
  const row = fileServePathCache.get(sid);
  if (!row || row.expMs <= Date.now() + 30_000) return null;
  return row.path;
}

function clearToken() {
  localStorage.removeItem('bs_token');
  fileServePathCache.clear();
  cachedSettings = null;
}
function isNumericId(value) { return /^\d+$/.test(String(value || '').trim()); }
let cachedSettings = null;
const DEFAULT_ALLOWED_FILE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.pdf',
]);

function normalizeAllowedFileType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('/')) return raw;
  if (raw.startsWith('.')) return raw;
  return `.${raw}`;
}

function parseAllowedFileTypes(value) {
  return String(value || '')
    .split(/[\s,]+/)
    .map(normalizeAllowedFileType)
    .filter(Boolean);
}

function getUploadFileTokens(file) {
  const tokens = [];
  const mime = normalizeAllowedFileType(file?.type);
  const extMatch = String(file?.name || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  const ext = normalizeAllowedFileType(extMatch ? extMatch[1] : '');
  if (ext) tokens.push(ext);
  if (mime && mime !== 'application/octet-stream') tokens.push(mime);
  return tokens;
}

async function getSettingsCached(force = false) {
  if (!force && cachedSettings) return cachedSettings;
  cachedSettings = await request('/settings');
  return cachedSettings;
}

async function ensureAllowedUploadTypes(formData) {
  const files = formData.getAll('files').filter((file) => file && typeof file.name === 'string');
  if (files.length === 0) return;

  const settings = await getSettingsCached();
  const configuredTypes = new Set(parseAllowedFileTypes(settings.allowed_file_types));
  const allowedTypes = new Set([...DEFAULT_ALLOWED_FILE_TYPES, ...configuredTypes]);
  const missingTypes = new Set();
  const rejectedFiles = [];

  for (const file of files) {
    const tokens = getUploadFileTokens(file);
    const isAllowed = tokens.some((token) => allowedTypes.has(token));
    if (!isAllowed) {
      rejectedFiles.push(file.name);
      tokens.forEach((token) => {
        if (!DEFAULT_ALLOWED_FILE_TYPES.has(token) && !configuredTypes.has(token)) missingTypes.add(token);
      });
    }
  }

  if (rejectedFiles.length === 0) return;

  const tokenList = Array.from(missingTypes);
  const prompt = `These file type(s) are not currently allowed: ${rejectedFiles.join(', ')}.${tokenList.length ? ` Add ${tokenList.join(', ')} to allowed file types?` : ' Add them to allowed file types?'}`;
  if (!window.confirm(prompt)) {
    throw new Error('Upload canceled. File type is not currently allowed.');
  }

  const nextTypes = Array.from(new Set([...configuredTypes, ...tokenList])).join(', ');
  cachedSettings = await request('/settings', { method: 'PUT', body: { allowed_file_types: nextTypes } });
}

function fileServeUrlForId(id, options = {}) {
  const cached = getCachedServePath(id);
  const variant = options && options.variant ? String(options.variant).trim() : '';
  if (cached) return appendVariantQuery(cached, variant);
  const sid = String(id ?? '').trim();
  if (!isNumericId(sid)) return appendVariantQuery(`/api/files/${sid}/serve`, variant);
  return appendVariantQuery(`/api/files/${sid}/serve`, variant);
}

function isAbortError(error) {
  return !!(error && (error.name === 'AbortError' || error.code === 20));
}

function buildFetchOptions(options = {}) {
  const {
    dedupeKey = null,
    cancelPrevious = false,
    signal,
    body,
    ...fetchOptions
  } = options;

  let controller = null;
  let cleanupExternalAbort = null;
  if (dedupeKey && cancelPrevious) {
    const previous = inflightRequests.get(dedupeKey);
    if (previous?.controller) previous.controller.abort();
    controller = new AbortController();
    if (signal) {
      if (signal.aborted) controller.abort();
      else {
        const abortFromExternal = () => controller.abort();
        signal.addEventListener('abort', abortFromExternal, { once: true });
        cleanupExternalAbort = () => signal.removeEventListener('abort', abortFromExternal);
      }
    }
  }

  const finalSignal = controller?.signal || signal;
  return {
    dedupeKey,
    cancelPrevious,
    body,
    fetchOptions: { ...fetchOptions, signal: finalSignal },
    controller,
    cleanupExternalAbort,
  };
}

async function request(path, options = {}) {
  const token = getToken();
  const { dedupeKey, fetchOptions, body, controller, cleanupExternalAbort } = buildFetchOptions(options);
  if (dedupeKey && !options.cancelPrevious) {
    const existing = inflightRequests.get(dedupeKey);
    if (existing?.promise) {
      cleanupExternalAbort?.();
      return existing.promise;
    }
  }
  const headers = { 'Content-Type': 'application/json', ...fetchOptions.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const run = async () => {
    const resp = await fetch(`${BASE}${path}`, {
      headers,
      ...fetchOptions,
      body: body ? JSON.stringify(body) : undefined
    });

    if (resp.status === 401) {
      clearToken();
      throw new Error('Unauthorized');
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  };

  const promise = run().finally(() => {
    cleanupExternalAbort?.();
    if (dedupeKey && inflightRequests.get(dedupeKey)?.promise === promise) {
      inflightRequests.delete(dedupeKey);
    }
  });

  if (dedupeKey) inflightRequests.set(dedupeKey, { promise, controller });
  return promise;
}

/** Public API call (no Authorization header) — for quote approval by token, etc. */
async function publicRequest(path, options = {}) {
  const { dedupeKey, fetchOptions, body, controller, cleanupExternalAbort } = buildFetchOptions(options);
  if (dedupeKey && !options.cancelPrevious) {
    const existing = inflightRequests.get(dedupeKey);
    if (existing?.promise) {
      cleanupExternalAbort?.();
      return existing.promise;
    }
  }
  const headers = { 'Content-Type': 'application/json', ...fetchOptions.headers };

  const run = async () => {
    const resp = await fetch(`${BASE}${path}`, {
      headers,
      ...fetchOptions,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  };

  const promise = run().finally(() => {
    cleanupExternalAbort?.();
    if (dedupeKey && inflightRequests.get(dedupeKey)?.promise === promise) {
      inflightRequests.delete(dedupeKey);
    }
  });

  if (dedupeKey) inflightRequests.set(dedupeKey, { promise, controller });
  return promise;
}

async function fetchAsset(path, options = {}) {
  const token = getToken();
  const resp = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}`, ...(options.headers || {}) } : (options.headers || {}),
    ...options,
  });
  if (resp.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  return resp;
}

/**
 * Batch-fetch signed /api/files/:id/serve?sig=&exp= URLs (requires login).
 * Call when loading grids (inventory, files, quote) so img/src and hrefs work without JWT in query strings.
 */
async function prefetchFileServeUrls(ids) {
  const list = [...new Set(
    ids
      .map((x) => String(x).trim())
      .filter(isNumericId)
      .filter((id) => !getCachedServePath(id))
  )].slice(0, 200);
  if (!list.length || !getToken()) return;
  try {
    const data = await request('/files/serve-links', { method: 'POST', body: { ids: list } });
    const paths = data.paths || {};
    for (const [fid, p] of Object.entries(paths)) {
      if (typeof p === 'string') rememberServePath(fid, p);
    }
  } catch {
    /* ignore */
  }
}

export { getToken, setToken, clearToken, isAbortError, prefetchFileServeUrls };

export const api = {
  // Auth
  auth: {
    status: () => request('/auth/status'),
    captchaConfig: () => publicRequest('/auth/captcha-config'),
    me: () => request('/auth/me', { dedupeKey: 'auth:me' }),
    updateMe: async (body) => {
      const data = await request('/auth/me', { method: 'PUT', body });
      if (data && data.token) setToken(data.token);
      return data;
    },
    setup: (body) => request('/auth/setup', { method: 'POST', body }),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    forgot: (body) => request('/auth/forgot', { method: 'POST', body }),
    reset: (body) => request('/auth/reset', { method: 'POST', body }),
    extensionToken: () => request('/auth/extension-token'),
    testMail: (body) => request('/auth/test-mail', { method: 'POST', body }),
    devLogin: () => publicRequest('/auth/dev-login', { method: 'POST' }),
  },

  // Presence (who's online, current page)
  presence: {
    update: (path) => request('/presence', { method: 'PUT', body: { path } }),
    list: () => request('/presence', { dedupeKey: 'presence:list' }),
  },

  team: {
    overview: () => request('/team'),
    groups: () => request('/team/groups'),
    createGroup: (body) => request('/team/groups', { method: 'POST', body }),
    updateGroupMembers: (id, body) => request(`/team/groups/${id}/members`, { method: 'PUT', body }),
    deleteGroupMember: (groupId, userId) => request(`/team/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
    deleteGroup: (id) => request(`/team/groups/${id}`, { method: 'DELETE' }),
  },

  notificationSettings: {
    list: () => request('/notification-settings'),
    update: (body) => request('/notification-settings', { method: 'PUT', body }),
  },

  notifications: {
    list: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      return request(`/notifications?${qs}`);
    },
    unreadCount: () => request('/notifications/unread-count', { dedupeKey: 'notifications:unread' }),
    feed: (afterId, limit = 20) => request(`/notifications/feed?after_id=${encodeURIComponent(afterId || 0)}&limit=${encodeURIComponent(limit)}`),
    markPresented: (ids) => request('/notifications/presented', { method: 'POST', body: { ids } }),
    markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
    dismiss: (id) => request(`/notifications/${id}/dismiss`, { method: 'PUT' }),
    dismissByType: (type) => request(`/notifications/dismiss-by-type/${encodeURIComponent(type)}`, { method: 'PUT' }),
    markAllRead: () => request('/notifications/read-all', { method: 'PUT' }),
  },

  // Admin
  admin: {
    getUsers:           ()           => request('/admin/users'),
    createUser:         (body)       => request('/admin/users', { method: 'POST', body }),
    approveUser:        (id)         => request(`/admin/users/${id}/approve`, { method: 'PUT' }),
    rejectUser:         (id)         => request(`/admin/users/${id}/reject`, { method: 'PUT' }),
    deleteUser:         (id)         => request(`/admin/users/${id}`, { method: 'DELETE' }),
    changeRole:         (id, role)   => request(`/admin/users/${id}/role`, { method: 'PUT', body: { role } }),
    getRoles:           ()           => request('/admin/roles'),
    createRole:         (body)       => request('/admin/roles', { method: 'POST', body }),
    updateRole:         (key, body)  => request(`/admin/roles/${key}`, { method: 'PUT', body }),
    updateRolePermissions: (key, body) => request(`/admin/roles/${key}/permissions`, { method: 'PUT', body }),
    getSystemSettings:  ()           => request('/admin/system'),
    updateSystemSettings: (body)     => request('/admin/system', { method: 'PUT', body }),
    getEncryptedSettingsDiagnostics: () => request('/admin/diagnostics/encrypted-settings'),
    listQuotePatternMemories: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      return request(`/admin/memory/quote-patterns${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    getSimilarQuotePatterns: (quoteId, params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      return request(`/admin/memory/quote-patterns/${quoteId}/similar${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    getRustEngineDiagnostics: () => request('/admin/diagnostics/rust-engine'),
    startRustEngine: () => request('/admin/diagnostics/rust-engine/start', { method: 'POST' }),
    stopRustEngine: () => request('/admin/diagnostics/rust-engine/stop', { method: 'POST' }),
    restartRustEngine: () => request('/admin/diagnostics/rust-engine/restart', { method: 'POST' }),
    getOnyxDiagnostics: () => request('/admin/diagnostics/onyx'),
    detectOnyx: () => request('/admin/diagnostics/onyx/detect', { method: 'POST' }),
    installOnyx: () => request('/admin/diagnostics/onyx/install', { method: 'POST' }),
    startOnyx: () => request('/admin/diagnostics/onyx/start', { method: 'POST' }),
    stopOnyx: () => request('/admin/diagnostics/onyx/stop', { method: 'POST' }),
    restartOnyx: () => request('/admin/diagnostics/onyx/restart', { method: 'POST' }),
    getLocalModelDiagnostics: () => request('/admin/diagnostics/local-models'),
    detectLocalModels: () => request('/admin/diagnostics/local-models/detect', { method: 'POST' }),
    installLocalModelRuntime: () => request('/admin/diagnostics/local-models/install', { method: 'POST' }),
    reinstallLocalModelRuntime: () => request('/admin/diagnostics/local-models/reinstall', { method: 'POST' }),
    startLocalModelRuntime: () => request('/admin/diagnostics/local-models/start', { method: 'POST' }),
    stopLocalModelRuntime: () => request('/admin/diagnostics/local-models/stop', { method: 'POST' }),
    restartLocalModelRuntime: () => request('/admin/diagnostics/local-models/restart', { method: 'POST' }),
    pullLocalModel: (model) => request('/admin/diagnostics/local-models/pull', { method: 'POST', body: { model } }),
    deleteLocalModel: (model) => request('/admin/diagnostics/local-models/delete', { method: 'POST', body: { model } }),
    getRustReleaseChecks: () => request('/admin/diagnostics/rust-engine/release-checks'),
    runRustParityReport: (body = {}) => request('/admin/diagnostics/rust-engine/parity-report', { method: 'POST', body }),
    compareRustEngineQuote: (quoteId, params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      return request(`/admin/diagnostics/rust-engine/compare/${quoteId}${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    compareRustEnginePricing: (quoteId, params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      return request(`/admin/diagnostics/rust-engine/pricing/${quoteId}${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    compareRustEnginePricingBatch: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      return request(`/admin/diagnostics/rust-engine/pricing${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    compareRustEngineBatch: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      return request(`/admin/diagnostics/rust-engine/compare${qs.toString() ? `?${qs.toString()}` : ''}`);
    },
    exportDb: () => {
      const token = getToken();
      return fetch(`${BASE}/admin/db/export`, { headers: { Authorization: `Bearer ${token}` } })
        .then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.blob(); });
    },
    importDb: (file) => {
      const token = getToken();
      const form = new FormData();
      form.append('db', file);
      return fetch(`${BASE}/admin/db/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
        .then(async resp => { const d = await resp.json().catch(() => ({})); if (!resp.ok) throw new Error(d.error || `HTTP ${resp.status}`); return d; });
    },
  },

  // Items
  getItems: (params = {}, requestOptions = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/items?${qs}`, requestOptions);
  },
  getItem: (id) => request(`/items/${id}`),
  createItem: (body) => request('/items', { method: 'POST', body }),
  upsertItem: (body) => request('/items/upsert', { method: 'POST', body }),
  bulkUpsertItems: (items) => request('/items/bulk-upsert', { method: 'POST', body: { items } }),
  generateItemDescriptionPreview: (body) => request('/items/generate-description-preview', { method: 'POST', body }),
  updateItem: (id, body) => request(`/items/${id}`, { method: 'PUT', body }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  barcodeSvgUrl: ({ format = 'qrcode', value, label = '' } = {}) => {
    const qs = new URLSearchParams();
    qs.set('format', String(format || 'qrcode'));
    qs.set('value', String(value || ''));
    if (label) qs.set('label', String(label));
    return `${BASE}/barcodes/render?${qs.toString()}`;
  },
  getBarcodeSvgBlob: async ({ format = 'qrcode', value, label = '' } = {}) => {
    const qs = new URLSearchParams();
    qs.set('format', String(format || 'qrcode'));
    qs.set('value', String(value || ''));
    if (label) qs.set('label', String(label));
    const resp = await fetchAsset(`/barcodes/render?${qs.toString()}`);
    return resp.blob();
  },
  getBarcodeSvgData: ({ format = 'qrcode', value, label = '' } = {}) => {
    const qs = new URLSearchParams();
    qs.set('format', String(format || 'qrcode'));
    qs.set('value', String(value || ''));
    if (label) qs.set('label', String(label));
    qs.set('inline', '1');
    return request(`/barcodes/render?${qs.toString()}`);
  },
  resolveScanCode: (code) => request(`/scan/${encodeURIComponent(code)}`),
  getSetAsides: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/items/set-aside?${qs}`);
  },
  createSetAside: (itemId, body) => request(`/items/${itemId}/set-aside`, { method: 'POST', body }),
  updateSetAside: (id, body) => request(`/items/set-aside/${id}`, { method: 'PUT', body }),
  resolveSetAside: (id, body) => request(`/items/set-aside/${id}/resolve`, { method: 'POST', body }),
  getCategories: () => request('/items/categories', { dedupeKey: 'items:categories' }),
  getPopularCategories: (limit = 15) => request(`/items/categories/popular?limit=${limit}`),
  getAssociations: (id) => request(`/items/${id}/associations`),
  addAssociation: (id, child_id) => request(`/items/${id}/associations`, { method: 'POST', body: { child_id } }),
  removeAssociation: (id, child_id) => request(`/items/${id}/associations/${child_id}`, { method: 'DELETE' }),

  // Sheets
  previewSheet: (url) => request('/sheets/preview', { method: 'POST', body: { url } }),
  importSheet: (body) => request('/sheets/import', { method: 'POST', body }),
  uploadSheet: (body) => request('/sheets/upload', { method: 'POST', body }),
  importSheetData: (body) => request('/sheets/import-data', { method: 'POST', body }),
  uploadPdf: (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/sheets/upload-pdf`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    }).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    });
  },
  importPdfQuote: (text) => request('/sheets/import-pdf-quote', { method: 'POST', body: { text } }),

  // Quotes — optional params: search, status, event_from, event_to, has_balance, venue
  getQuotes: (params = {}, requestOptions = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request(query ? `/quotes?${query}` : '/quotes', requestOptions);
  },
  getMapQuotePins: (requestOptions = {}) => request('/maps/quotes', requestOptions),
  getQuotesSummary: () => request('/quotes/summary', { dedupeKey: 'quotes:summary' }),
  getSalesAnalytics: (params = {}, requestOptions = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        if (value.length) qs.set(key, value.join(','));
        return;
      }
      qs.set(key, String(value));
    });
    const query = qs.toString();
    return request(query ? `/sales/analytics?${query}` : '/sales/analytics', requestOptions);
  },
  getQuote: (id, requestOptions = {}) => request(`/quotes/${id}`, requestOptions),
  createQuote: (body) => request('/quotes', { method: 'POST', body }),
  duplicateQuote: (id) => request(`/quotes/${id}/duplicate`, { method: 'POST' }),
  updateQuote: (id, body) => request(`/quotes/${id}`, { method: 'PUT', body }),
  deleteQuote: (id) => request(`/quotes/${id}`, { method: 'DELETE' }),
  sendQuote: (id, body) => request(`/quotes/${id}/send`, { method: 'POST', body: body || {} }),
  ensureQuotePublicToken: (id) => request(`/quotes/${id}/ensure-public-token`, { method: 'POST' }),
  approveQuote: (id) => request(`/quotes/${id}/approve`, { method: 'POST' }),
  revertQuote: (id) => request(`/quotes/${id}/revert`, { method: 'POST' }),
  confirmQuote: (id) => request(`/quotes/${id}/confirm`, { method: 'POST' }),
  closeQuote: (id) => request(`/quotes/${id}/close`, { method: 'POST' }),
  dismissUnsignedChanges: (id) => request(`/quotes/${id}/unsigned-changes`, { method: 'DELETE' }),
  getDamageCharges: (id) => request(`/quotes/${id}/damage-charges`),
  addDamageCharge: (id, body) => request(`/quotes/${id}/damage-charges`, { method: 'POST', body }),
  removeDamageCharge: (id, cid) => request(`/quotes/${id}/damage-charges/${cid}`, { method: 'DELETE' }),
  getQuoteContract: (id, requestOptions = {}) => request(`/quotes/${id}/contract`, requestOptions),
  getQuoteContractLogs: (id) => request(`/quotes/${id}/contract/logs`),
  updateQuoteContract: (id, body) => request(`/quotes/${id}/contract`, { method: 'PUT', body }),
  getPublicQuote: (token) => publicRequest(`/quotes/public/${token}`),
  approveQuoteByToken: (token) => publicRequest('/quotes/approve-by-token', { method: 'POST', body: { token } }),
  signContractByToken: (token, body) => publicRequest('/quotes/contract/sign', { method: 'POST', body: { token, ...body } }),
  getPublicMessages: (token) => publicRequest(`/quotes/public/${token}/messages`),
  sendPublicMessage: (token, body) => publicRequest(`/quotes/public/${token}/messages`, { method: 'POST', body }),
  getQuoteFiles: (id, requestOptions = {}) => request(`/quotes/${id}/files`, requestOptions),
  addQuoteFile: (id, body) => request(`/quotes/${id}/files`, { method: 'POST', body }),
  removeQuoteFile: (quoteId, fileId) => request(`/quotes/${quoteId}/files/${fileId}`, { method: 'DELETE' }),
  getQuotePayments: (id) => request(`/quotes/${id}/payments`),
  addQuotePayment: (id, body) => request(`/quotes/${id}/payments`, { method: 'POST', body }),
  removeQuotePayment: (quoteId, paymentId) => request(`/quotes/${quoteId}/payments/${paymentId}`, { method: 'DELETE' }),
  recordRefund: (id, body) => request(`/quotes/${id}/refund`, { method: 'POST', body }),
  getQuoteActivity: (id) => request(`/quotes/${id}/activity`),
  getQuoteFulfillment: (id) => request(`/quotes/${id}/fulfillment`),
  getQuotePullSheet: (id, requestOptions = {}) => request(`/quotes/${id}/pull-sheet`, requestOptions),
  getAggregateQuotePullSheet: (ids, requestOptions = {}) => {
    const qs = new URLSearchParams();
    if (Array.isArray(ids) ? ids.length : ids) qs.set('ids', Array.isArray(ids) ? ids.join(',') : String(ids));
    return request(`/quotes/pull-sheet/aggregate${qs.toString() ? `?${qs.toString()}` : ''}`, requestOptions);
  },
  checkInFulfillmentItem: (quoteId, fulfillmentItemId, body) => request(`/quotes/${quoteId}/fulfillment/items/${fulfillmentItemId}/check-in`, { method: 'POST', body }),
  addFulfillmentNote: (quoteId, body) => request(`/quotes/${quoteId}/fulfillment/notes`, { method: 'POST', body }),
  addQuoteItem: (quoteId, body) => request(`/quotes/${quoteId}/items`, { method: 'POST', body }),
  updateQuoteItem: (quoteId, qitemId, body) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'PUT', body }),
  removeQuoteItem: (quoteId, qitemId) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'DELETE' }),
  reorderQuoteItems: (quoteId, order) => request(`/quotes/${quoteId}/items/reorder`, { method: 'PUT', body: { order } }),
  addQuoteSection: (quoteId, body) => request(`/quotes/${quoteId}/sections`, { method: 'POST', body: body || {} }),
  updateQuoteSection: (quoteId, sectionId, body) => request(`/quotes/${quoteId}/sections/${sectionId}`, { method: 'PUT', body }),
  duplicateQuoteSection: (quoteId, sectionId) => request(`/quotes/${quoteId}/sections/${sectionId}/duplicate`, { method: 'POST' }),
  removeQuoteSection: (quoteId, sectionId) => request(`/quotes/${quoteId}/sections/${sectionId}`, { method: 'DELETE' }),

  // Settings
  getSettings: async (force = false) => {
    if (!force && cachedSettings) return cachedSettings;
    const settings = await request('/settings', { dedupeKey: 'settings' });
    cachedSettings = settings;
    return settings;
  },
  updateSettings: async (body) => {
    const settings = await request('/settings', { method: 'PUT', body });
    cachedSettings = settings;
    return settings;
  },
  getImageCompressionPreview: async ({ quality = 68, format = 'webp', avif = false, original = false } = {}) => {
    const token = getToken();
    const qs = new URLSearchParams();
    qs.set('quality', String(quality));
    qs.set('format', format);
    qs.set('avif', avif ? '1' : '0');
    if (original) qs.set('original', '1');
    const resp = await fetch(`${BASE}/settings/image-preview?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return resp.blob();
  },

  // Email templates (admin/operator)
  getTemplates: () => request('/templates'),
  getTemplate: (id) => request(`/templates/${id}`),
  createTemplate: (body) => request('/templates', { method: 'POST', body }),
  updateTemplate: (id, body) => request(`/templates/${id}`, { method: 'PUT', body }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  // Contract templates
  getContractTemplates: () => request('/templates/contract-templates'),
  createContractTemplate: (body) => request('/templates/contract-templates', { method: 'POST', body }),
  updateContractTemplate: (id, body) => request(`/templates/contract-templates/${id}`, { method: 'PUT', body }),
  deleteContractTemplate: (id) => request(`/templates/contract-templates/${id}`, { method: 'DELETE' }),
  // Payment policies
  getPaymentPolicies: () => request('/templates/payment-policies'),
  createPaymentPolicy: (body) => request('/templates/payment-policies', { method: 'POST', body }),
  updatePaymentPolicy: (id, body) => request(`/templates/payment-policies/${id}`, { method: 'PUT', body }),
  deletePaymentPolicy: (id) => request(`/templates/payment-policies/${id}`, { method: 'DELETE' }),
  // Rental terms
  getRentalTerms: () => request('/templates/rental-terms'),
  createRentalTerms: (body) => request('/templates/rental-terms', { method: 'POST', body }),
  updateRentalTerms: (id, body) => request(`/templates/rental-terms/${id}`, { method: 'PUT', body }),
  deleteRentalTerms: (id) => request(`/templates/rental-terms/${id}`, { method: 'DELETE' }),
  // Item accessories (permanent)
  getItemAccessories: (id) => request(`/items/${id}/accessories`),
  addItemAccessory: (id, body) => request(`/items/${id}/accessories`, { method: 'POST', body }),
  removeItemAccessory: (id, accessoryId) => request(`/items/${id}/accessories/${accessoryId}`, { method: 'DELETE' }),

  // Leads
  getLeads: (params = {}, requestOptions = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/leads?${qs}`, requestOptions);
  },
  createLead: (body) => request('/leads', { method: 'POST', body }),
  previewLeadsImport: (body) => request('/leads/preview', { method: 'POST', body }),
  importLeads: (body) => request('/leads/import', { method: 'POST', body }),
  updateLead: (id, body) => request(`/leads/${id}`, { method: 'PUT', body }),
  getLeadEvents: (id, requestOptions = {}) => request(`/leads/${id}/events`, requestOptions),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),

  // Billing (operator)
  getBillingHistory: (requestOptions = {}) => request('/billing/history', requestOptions),

  // Stats
  getStats: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/stats${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  getItemStats: (itemId) => request(`/stats/${itemId}`),

  // AI
  aiSuggest: (body) => request('/ai/suggest', { method: 'POST', body }),
  getQuoteAssistantMessages: (quoteId) => request(`/ai/quotes/${quoteId}/assistant`),
  sendQuoteAssistantMessage: (quoteId, body) => request(`/ai/quotes/${quoteId}/assistant`, { method: 'POST', body }),
  clearQuoteAssistantMessages: (quoteId) => request(`/ai/quotes/${quoteId}/assistant/clear`, { method: 'POST', body: {} }),

  // Team chat / Onyx chat
  getTeamChatThreads: () => request('/team-chat/threads'),
  createTeamChatThread: (body) => request('/team-chat/threads', { method: 'POST', body }),
  getTeamChatMessages: (threadId) => request(`/team-chat/threads/${threadId}/messages`),
  sendTeamChatMessage: (threadId, body) => request(`/team-chat/threads/${threadId}/messages`, { method: 'POST', body }),
  getQuoteAiMessages: (quoteId) => request(`/messages/quotes/${quoteId}/ai`),
  sendQuoteAiMessage: (quoteId, body) => request(`/messages/quotes/${quoteId}/ai`, { method: 'POST', body }),

  // Image proxy
  proxyImageUrl: (url, options) => {
    if (!url) return '';
    if (isNumericId(url)) return fileServeUrlForId(String(url).trim(), options);
    if (String(url).startsWith('/api/')) return String(url);
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  },

  // Files (media library)
  getFiles: () => request('/files'),
  uploadFiles: async (formData) => {
    await ensureAllowedUploadTypes(formData);
    const token = getToken();
    return fetch(`${BASE}/files/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    }).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    });
  },
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  renameFile: (id, name) => request(`/files/${id}`, { method: 'PATCH', body: { original_name: name } }),
  compressFile: (id) => request(`/files/${id}/compress`, { method: 'POST' }),
  getFileQuotes: (id) => request(`/files/${id}/quotes`),
  prefetchFileServeUrls,
  fileServeUrl: (id, options) => fileServeUrlForId(id, options),

  // Quote adjustments (discounts / surcharges)
  getAdjustments:    (qid)           => request(`/quotes/${qid}/adjustments`),
  addAdjustment:     (qid, body)     => request(`/quotes/${qid}/adjustments`, { method: 'POST', body }),
  updateAdjustment:  (qid, aid, body) => request(`/quotes/${qid}/adjustments/${aid}`, { method: 'PUT', body }),
  removeAdjustment:  (qid, aid)      => request(`/quotes/${qid}/adjustments/${aid}`, { method: 'DELETE' }),

  // Custom quote items
  addCustomItem:    (qid, body)       => request(`/quotes/${qid}/custom-items`, { method: 'POST', body }),
  updateCustomItem: (qid, cid, body)  => request(`/quotes/${qid}/custom-items/${cid}`, { method: 'PUT', body }),
  removeCustomItem: (qid, cid)        => request(`/quotes/${qid}/custom-items/${cid}`, { method: 'DELETE' }),

  // Messages
  getMessages: (params, requestOptions = {}) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(function(e) { return e[1] !== undefined && e[1] !== ''; }));
    return request('/messages?' + qs, requestOptions);
  },
  sendQuoteMessage:  (quoteId, body) => request('/messages', { method: 'POST', body: { quote_id: quoteId, ...body } }),
  getUnreadCount:    () => request('/messages/unread-count', { dedupeKey: 'messages:unread' }),
  markMessageRead:   (id) => request('/messages/' + id + '/read', { method: 'PUT' }),
  deleteMessage:     (id) => request('/messages/' + id, { method: 'DELETE' }),

  // Directory
  getClients:     (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
    return request(`/clients${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  createClient:   (body)       => request('/clients', { method: 'POST', body }),
  updateClient:   (id, body)   => request(`/clients/${id}`, { method: 'PUT', body }),
  getVenues:      (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
    return request(`/venues${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  createVenue:    (body)       => request('/venues', { method: 'POST', body }),
  updateVenue:    (id, body)   => request(`/venues/${id}`, { method: 'PUT', body }),
  getVendors:     ()           => request('/vendors'),
  createVendor:   (body)       => request('/vendors', { method: 'POST', body }),
  updateVendor:   (id, body)   => request(`/vendors/${id}`, { method: 'PUT', body }),
  deleteVendor:   (id)         => request(`/vendors/${id}`, { method: 'DELETE' }),

  // Availability
  getQuoteAvailability:     (quoteId, requestOptions = {}) => request(`/availability/quote/${quoteId}`, requestOptions),
  getQuoteAvailabilityItems: (quoteId, itemIds, sectionId = null) => {
    if (!itemIds?.length) return Promise.resolve({});
    const ids = Array.isArray(itemIds) ? itemIds.join(',') : String(itemIds);
    const qs = new URLSearchParams();
    qs.set('ids', ids);
    if (sectionId != null && sectionId !== '') qs.set('section_id', String(sectionId));
    return request(`/availability/quote/${quoteId}/items?${qs.toString()}`);
  },
  getConflicts:         ()        => request('/availability/conflicts', { dedupeKey: 'availability:conflicts' }),
  getSubrentals:        ()        => request('/availability/subrentals'),

  // Updates
  getUpdateStatus:   ()      => request('/updates'),
  getUpdateReleases: ()      => request('/updates/releases'),
  applyUpdate:       (tag)   => request('/updates/apply', { method: 'POST', body: { tag } }),

  // Public catalog (no auth)
  catalog: {
    getMeta:  ()           => publicRequest('/public/catalog-meta'),
    getItems: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
      return publicRequest(`/public/items?${qs}`);
    },
    getItem: (id) => publicRequest(`/public/items/${id}`),
  },
};
