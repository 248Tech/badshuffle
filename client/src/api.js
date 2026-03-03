const BASE = (import.meta.env.VITE_API_BASE || '') + '/api';

async function request(path, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

export const api = {
  // Items
  getItems: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined));
    return request(`/items?${qs}`);
  },
  getItem: (id) => request(`/items/${id}`),
  createItem: (body) => request('/items', { method: 'POST', body }),
  upsertItem: (body) => request('/items/upsert', { method: 'POST', body }),
  updateItem: (id, body) => request(`/items/${id}`, { method: 'PUT', body }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  getAssociations: (id) => request(`/items/${id}/associations`),
  addAssociation: (id, child_id) => request(`/items/${id}/associations`, { method: 'POST', body: { child_id } }),
  removeAssociation: (id, child_id) => request(`/items/${id}/associations/${child_id}`, { method: 'DELETE' }),

  // Sheets
  previewSheet: (url) => request('/sheets/preview', { method: 'POST', body: { url } }),
  importSheet: (body) => request('/sheets/import', { method: 'POST', body }),

  // Quotes
  getQuotes: () => request('/quotes'),
  getQuote: (id) => request(`/quotes/${id}`),
  createQuote: (body) => request('/quotes', { method: 'POST', body }),
  updateQuote: (id, body) => request(`/quotes/${id}`, { method: 'PUT', body }),
  deleteQuote: (id) => request(`/quotes/${id}`, { method: 'DELETE' }),
  addQuoteItem: (quoteId, body) => request(`/quotes/${quoteId}/items`, { method: 'POST', body }),
  updateQuoteItem: (quoteId, qitemId, body) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'PUT', body }),
  removeQuoteItem: (quoteId, qitemId) => request(`/quotes/${quoteId}/items/${qitemId}`, { method: 'DELETE' }),

  // Stats
  getStats: () => request('/stats'),
  getItemStats: (itemId) => request(`/stats/${itemId}`),

  // AI
  aiSuggest: (body) => request('/ai/suggest', { method: 'POST', body }),

  // Image proxy
  proxyImageUrl: (url) => `/api/proxy-image?url=${encodeURIComponent(url)}`
};
