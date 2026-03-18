const BASE = (import.meta.env.VITE_API_BASE || '') + '/api';

function getToken() { return localStorage.getItem('bs_token'); }
function setToken(t) { localStorage.setItem('bs_token', t); }
function clearToken() { localStorage.removeItem('bs_token'); }

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (resp.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

/** Public API call (no Authorization header) — for quote approval by token, etc. */
async function publicRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const resp = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

export { getToken, setToken, clearToken };

export const api = {
  // Auth
  auth: {
    status: () => request('/auth/status'),
    captchaConfig: () => publicRequest('/auth/captcha-config'),
    me: () => request('/auth/me'),
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
    list: () => request('/presence'),
  },

  // Admin
  admin: {
    getUsers:           ()           => request('/admin/users'),
    createUser:         (body)       => request('/admin/users', { method: 'POST', body }),
    approveUser:        (id)         => request(`/admin/users/${id}/approve`, { method: 'PUT' }),
    rejectUser:         (id)         => request(`/admin/users/${id}/reject`, { method: 'PUT' }),
    deleteUser:         (id)         => request(`/admin/users/${id}`, { method: 'DELETE' }),
    changeRole:         (id, role)   => request(`/admin/users/${id}/role`, { method: 'PUT', body: { role } }),
    getSystemSettings:  ()           => request('/admin/system'),
    updateSystemSettings: (body)     => request('/admin/system', { method: 'PUT', body }),
  },

  // Items
  getItems: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/items?${qs}`);
  },
  getItem: (id) => request(`/items/${id}`),
  createItem: (body) => request('/items', { method: 'POST', body }),
  upsertItem: (body) => request('/items/upsert', { method: 'POST', body }),
  updateItem: (id, body) => request(`/items/${id}`, { method: 'PUT', body }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  getCategories: () => request('/items/categories'),
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
  getQuotes: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request(query ? `/quotes?${query}` : '/quotes');
  },
  getQuotesSummary: () => request('/quotes/summary'),
  getQuote: (id) => request(`/quotes/${id}`),
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
  getDamageCharges: (id) => request(`/quotes/${id}/damage-charges`),
  addDamageCharge: (id, body) => request(`/quotes/${id}/damage-charges`, { method: 'POST', body }),
  removeDamageCharge: (id, cid) => request(`/quotes/${id}/damage-charges/${cid}`, { method: 'DELETE' }),
  getQuoteContract: (id) => request(`/quotes/${id}/contract`),
  getQuoteContractLogs: (id) => request(`/quotes/${id}/contract/logs`),
  updateQuoteContract: (id, body) => request(`/quotes/${id}/contract`, { method: 'PUT', body }),
  getPublicQuote: (token) => publicRequest(`/quotes/public/${token}`),
  approveQuoteByToken: (token) => publicRequest('/quotes/approve-by-token', { method: 'POST', body: { token } }),
  signContractByToken: (token, body) => publicRequest('/quotes/contract/sign', { method: 'POST', body: { token, ...body } }),
  getPublicMessages: (token) => publicRequest(`/quotes/public/${token}/messages`),
  sendPublicMessage: (token, body) => publicRequest(`/quotes/public/${token}/messages`, { method: 'POST', body }),
  getQuoteFiles: (id) => request(`/quotes/${id}/files`),
  addQuoteFile: (id, body) => request(`/quotes/${id}/files`, { method: 'POST', body }),
  removeQuoteFile: (quoteId, fileId) => request(`/quotes/${quoteId}/files/${fileId}`, { method: 'DELETE' }),
  getQuotePayments: (id) => request(`/quotes/${id}/payments`),
  addQuotePayment: (id, body) => request(`/quotes/${id}/payments`, { method: 'POST', body }),
  removeQuotePayment: (quoteId, paymentId) => request(`/quotes/${quoteId}/payments/${paymentId}`, { method: 'DELETE' }),
  recordRefund: (id, body) => request(`/quotes/${id}/refund`, { method: 'POST', body }),
  getQuoteActivity: (id) => request(`/quotes/${id}/activity`),
  addQuoteItem: (quoteId, body) => request(`/quotes/${quoteId}/items`, { method: 'POST', body }),
  updateQuoteItem: (quoteId, qitemId, body) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'PUT', body }),
  removeQuoteItem: (quoteId, qitemId) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'DELETE' }),
  reorderQuoteItems: (quoteId, order) => request(`/quotes/${quoteId}/items/reorder`, { method: 'PUT', body: { order } }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (body) => request('/settings', { method: 'PUT', body }),

  // Email templates (admin/operator)
  getTemplates: () => request('/templates'),
  getTemplate: (id) => request(`/templates/${id}`),
  createTemplate: (body) => request('/templates', { method: 'POST', body }),
  updateTemplate: (id, body) => request(`/templates/${id}`, { method: 'PUT', body }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  // Contract templates
  getContractTemplates: () => request('/templates/contract-templates'),
  createContractTemplate: (body) => request('/templates/contract-templates', { method: 'POST', body }),
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
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/leads?${qs}`);
  },
  createLead: (body) => request('/leads', { method: 'POST', body }),
  previewLeadsImport: (body) => request('/leads/preview', { method: 'POST', body }),
  importLeads: (body) => request('/leads/import', { method: 'POST', body }),
  updateLead: (id, body) => request(`/leads/${id}`, { method: 'PUT', body }),
  getLeadEvents: (id) => request(`/leads/${id}/events`),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),

  // Billing (operator)
  getBillingHistory: () => request('/billing/history'),

  // Stats
  getStats: () => request('/stats'),
  getItemStats: (itemId) => request(`/stats/${itemId}`),

  // AI
  aiSuggest: (body) => request('/ai/suggest', { method: 'POST', body }),

  // Image proxy
  proxyImageUrl: (url) => `/api/proxy-image?url=${encodeURIComponent(url)}`,

  // Files (media library)
  getFiles: () => request('/files'),
  uploadFiles: (formData) => {
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
  fileServeUrl: (id) => `/api/files/${id}/serve`,

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
  getMessages: (params) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(function(e) { return e[1] !== undefined && e[1] !== ''; }));
    return request('/messages?' + qs);
  },
  getUnreadCount:    () => request('/messages/unread-count'),
  markMessageRead:   (id) => request('/messages/' + id + '/read', { method: 'PUT' }),
  deleteMessage:     (id) => request('/messages/' + id, { method: 'DELETE' }),

  // Vendors
  getVendors:    ()           => request('/vendors'),
  createVendor:  (body)       => request('/vendors', { method: 'POST', body }),
  updateVendor:  (id, body)   => request(`/vendors/${id}`, { method: 'PUT', body }),
  deleteVendor:  (id)         => request(`/vendors/${id}`, { method: 'DELETE' }),

  // Availability
  getQuoteAvailability:     (quoteId) => request(`/availability/quote/${quoteId}`),
  getQuoteAvailabilityItems: (quoteId, itemIds) => {
    if (!itemIds?.length) return Promise.resolve({});
    const ids = Array.isArray(itemIds) ? itemIds.join(',') : String(itemIds);
    return request(`/availability/quote/${quoteId}/items?ids=${encodeURIComponent(ids)}`);
  },
  getConflicts:         ()        => request('/availability/conflicts'),
  getSubrentals:        ()        => request('/availability/subrentals'),

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
