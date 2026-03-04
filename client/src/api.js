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
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

export { getToken, setToken, clearToken };

export const api = {
  // Auth
  auth: {
    status: () => request('/auth/status'),
    me: () => request('/auth/me'),
    setup: (body) => request('/auth/setup', { method: 'POST', body }),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    forgot: (body) => request('/auth/forgot', { method: 'POST', body }),
    reset: (body) => request('/auth/reset', { method: 'POST', body }),
    extensionToken: () => request('/auth/extension-token'),
    testMail: (body) => request('/auth/test-mail', { method: 'POST', body }),
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

  // Quotes
  getQuotes: () => request('/quotes'),
  getQuote: (id) => request(`/quotes/${id}`),
  createQuote: (body) => request('/quotes', { method: 'POST', body }),
  updateQuote: (id, body) => request(`/quotes/${id}`, { method: 'PUT', body }),
  deleteQuote: (id) => request(`/quotes/${id}`, { method: 'DELETE' }),
  sendQuote: (id) => request(`/quotes/${id}/send`, { method: 'POST' }),
  approveQuote: (id) => request(`/quotes/${id}/approve`, { method: 'POST' }),
  revertQuote: (id) => request(`/quotes/${id}/revert`, { method: 'POST' }),
  getPublicQuote: (token) => request(`/quotes/public/${token}`),
  addQuoteItem: (quoteId, body) => request(`/quotes/${quoteId}/items`, { method: 'POST', body }),
  updateQuoteItem: (quoteId, qitemId, body) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'PUT', body }),
  removeQuoteItem: (quoteId, qitemId) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (body) => request('/settings', { method: 'PUT', body }),

  // Leads
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/leads?${qs}`);
  },
  createLead: (body) => request('/leads', { method: 'POST', body }),
  updateLead: (id, body) => request(`/leads/${id}`, { method: 'PUT', body }),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),

  // Stats
  getStats: () => request('/stats'),
  getItemStats: (itemId) => request(`/stats/${itemId}`),

  // AI
  aiSuggest: (body) => request('/ai/suggest', { method: 'POST', body }),

  // Image proxy
  proxyImageUrl: (url) => `/api/proxy-image?url=${encodeURIComponent(url)}`
};
