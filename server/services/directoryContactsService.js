const ORG_ID = 1;

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function lower(value) {
  return cleanText(value)?.toLowerCase() || '';
}

function normalizePhone(value) {
  return cleanText(value)?.replace(/[^0-9+]/g, '') || '';
}

function getClientDisplayName(row) {
  const name = [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim();
  return name || row?.email || row?.phone || 'Unnamed client';
}

function getVenueDisplayName(row) {
  return row?.name || row?.address || row?.email || 'Unnamed venue';
}

function toClientPayload(input = {}) {
  return {
    first_name: cleanText(input.client_first_name ?? input.first_name),
    last_name: cleanText(input.client_last_name ?? input.last_name),
    email: cleanText(input.client_email ?? input.email),
    phone: cleanText(input.client_phone ?? input.phone),
    address: cleanText(input.client_address ?? input.address),
    notes: cleanText(input.notes),
  };
}

function toVenuePayload(input = {}) {
  return {
    name: cleanText(input.venue_name ?? input.name),
    email: cleanText(input.venue_email ?? input.email),
    phone: cleanText(input.venue_phone ?? input.phone),
    address: cleanText(input.venue_address ?? input.address),
    contact: cleanText(input.venue_contact ?? input.contact),
    notes: cleanText(input.notes),
  };
}

function hasClientIdentity(payload) {
  return !!(payload.first_name || payload.last_name || payload.email || payload.phone || payload.address);
}

function hasVenueIdentity(payload) {
  return !!(payload.name || payload.email || payload.phone || payload.address || payload.contact);
}

function listClientRows(db) {
  return db.prepare('SELECT * FROM clients WHERE org_id = ? ORDER BY id ASC').all(ORG_ID);
}

function listVenueRows(db) {
  return db.prepare('SELECT * FROM venues WHERE org_id = ? ORDER BY id ASC').all(ORG_ID);
}

function findExistingClient(db, payload, existingId = null) {
  if (existingId) {
    const exact = db.prepare('SELECT * FROM clients WHERE id = ? AND org_id = ?').get(existingId, ORG_ID);
    if (exact) return exact;
  }
  const rows = listClientRows(db);
  const email = lower(payload.email);
  const phone = normalizePhone(payload.phone);
  const first = lower(payload.first_name);
  const last = lower(payload.last_name);
  const address = lower(payload.address);
  return rows.find((row) => {
    if (email && lower(row.email) === email) return true;
    if (phone && normalizePhone(row.phone) === phone && first && last && lower(row.first_name) === first && lower(row.last_name) === last) return true;
    if (!email && first && last && lower(row.first_name) === first && lower(row.last_name) === last && address && lower(row.address) === address) return true;
    return false;
  }) || null;
}

function findExistingVenue(db, payload, existingId = null) {
  if (existingId) {
    const exact = db.prepare('SELECT * FROM venues WHERE id = ? AND org_id = ?').get(existingId, ORG_ID);
    if (exact) return exact;
  }
  const rows = listVenueRows(db);
  const email = lower(payload.email);
  const phone = normalizePhone(payload.phone);
  const name = lower(payload.name);
  const address = lower(payload.address);
  return rows.find((row) => {
    if (name && address && lower(row.name) === name && lower(row.address) === address) return true;
    if (email && lower(row.email) === email && name && lower(row.name) === name) return true;
    if (phone && normalizePhone(row.phone) === phone && name && lower(row.name) === name) return true;
    return false;
  }) || null;
}

function createClient(db, input = {}) {
  const payload = toClientPayload(input);
  if (!hasClientIdentity(payload)) {
    const error = new Error('Client name, email, phone, or address is required');
    error.statusCode = 400;
    throw error;
  }
  const result = db.prepare(
    "INSERT INTO clients (org_id, first_name, last_name, email, phone, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).run(ORG_ID, payload.first_name, payload.last_name, payload.email, payload.phone, payload.address, payload.notes);
  return db.prepare('SELECT * FROM clients WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID);
}

function updateClient(db, clientId, input = {}) {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ? AND org_id = ?').get(clientId, ORG_ID);
  if (!existing) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }
  const payload = toClientPayload(input);
  const next = {
    first_name: input.first_name !== undefined ? payload.first_name : existing.first_name,
    last_name: input.last_name !== undefined ? payload.last_name : existing.last_name,
    email: input.email !== undefined ? payload.email : existing.email,
    phone: input.phone !== undefined ? payload.phone : existing.phone,
    address: input.address !== undefined ? payload.address : existing.address,
    notes: input.notes !== undefined ? payload.notes : existing.notes,
  };
  if (!hasClientIdentity(next)) {
    const error = new Error('Client name, email, phone, or address is required');
    error.statusCode = 400;
    throw error;
  }
  db.prepare(
    "UPDATE clients SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?"
  ).run(next.first_name, next.last_name, next.email, next.phone, next.address, next.notes, clientId, ORG_ID);
  return db.prepare('SELECT * FROM clients WHERE id = ? AND org_id = ?').get(clientId, ORG_ID);
}

function createVenue(db, input = {}) {
  const payload = toVenuePayload(input);
  if (!hasVenueIdentity(payload) || !payload.name) {
    const error = new Error('Venue name is required');
    error.statusCode = 400;
    throw error;
  }
  const result = db.prepare(
    "INSERT INTO venues (org_id, name, email, phone, address, contact, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).run(ORG_ID, payload.name, payload.email, payload.phone, payload.address, payload.contact, payload.notes);
  return db.prepare('SELECT * FROM venues WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID);
}

function updateVenue(db, venueId, input = {}) {
  const existing = db.prepare('SELECT * FROM venues WHERE id = ? AND org_id = ?').get(venueId, ORG_ID);
  if (!existing) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }
  const payload = toVenuePayload(input);
  const next = {
    name: input.name !== undefined ? payload.name : existing.name,
    email: input.email !== undefined ? payload.email : existing.email,
    phone: input.phone !== undefined ? payload.phone : existing.phone,
    address: input.address !== undefined ? payload.address : existing.address,
    contact: input.contact !== undefined ? payload.contact : existing.contact,
    notes: input.notes !== undefined ? payload.notes : existing.notes,
  };
  if (!hasVenueIdentity(next) || !next.name) {
    const error = new Error('Venue name is required');
    error.statusCode = 400;
    throw error;
  }
  db.prepare(
    "UPDATE venues SET name = ?, email = ?, phone = ?, address = ?, contact = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?"
  ).run(next.name, next.email, next.phone, next.address, next.contact, next.notes, venueId, ORG_ID);
  return db.prepare('SELECT * FROM venues WHERE id = ? AND org_id = ?').get(venueId, ORG_ID);
}

function upsertClientFromQuote(db, quote) {
  const payload = toClientPayload(quote);
  if (!hasClientIdentity(payload)) return null;
  const existing = findExistingClient(db, payload, quote.client_id || null);
  if (existing) {
    db.prepare(
      "UPDATE clients SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?"
    ).run(payload.first_name, payload.last_name, payload.email, payload.phone, payload.address, existing.id, ORG_ID);
    return db.prepare('SELECT * FROM clients WHERE id = ? AND org_id = ?').get(existing.id, ORG_ID);
  }
  const result = db.prepare(
    "INSERT INTO clients (org_id, first_name, last_name, email, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).run(ORG_ID, payload.first_name, payload.last_name, payload.email, payload.phone, payload.address);
  return db.prepare('SELECT * FROM clients WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID);
}

function upsertVenueFromQuote(db, quote) {
  const payload = toVenuePayload(quote);
  if (!hasVenueIdentity(payload) || !payload.name) return null;
  const existing = findExistingVenue(db, payload, quote.venue_id || null);
  if (existing) {
    db.prepare(
      "UPDATE venues SET name = ?, email = ?, phone = ?, address = ?, contact = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?"
    ).run(payload.name, payload.email, payload.phone, payload.address, payload.contact, existing.id, ORG_ID);
    return db.prepare('SELECT * FROM venues WHERE id = ? AND org_id = ?').get(existing.id, ORG_ID);
  }
  const result = db.prepare(
    "INSERT INTO venues (org_id, name, email, phone, address, contact, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).run(ORG_ID, payload.name, payload.email, payload.phone, payload.address, payload.contact);
  return db.prepare('SELECT * FROM venues WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID);
}

function syncQuoteDirectoryLinks(db, quoteInput) {
  const quote = typeof quoteInput === 'object' && quoteInput
    ? quoteInput
    : db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quoteInput, ORG_ID);
  if (!quote) return { client: null, venue: null };
  const client = upsertClientFromQuote(db, quote);
  const venue = upsertVenueFromQuote(db, quote);
  db.prepare('UPDATE quotes SET client_id = ?, venue_id = ? WHERE id = ? AND org_id = ?').run(client?.id || null, venue?.id || null, quote.id, ORG_ID);
  return { client, venue };
}

function syncAllQuotesToDirectories(db) {
  const quotes = db.prepare('SELECT * FROM quotes WHERE org_id = ? ORDER BY id ASC').all(ORG_ID);
  quotes.forEach((quote) => syncQuoteDirectoryLinks(db, quote));
}

function attachQuotesToRows(db, rows, type) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const key = type === 'clients' ? 'client_id' : 'venue_id';
  const quoteRows = db.prepare(
    `SELECT id, name, status, event_date, created_at, guest_count, venue_name, client_first_name, client_last_name, ${key} AS entity_id
     FROM quotes
     WHERE org_id = ? AND ${key} IN (${placeholders})
     ORDER BY COALESCE(event_date, created_at) DESC, id DESC`
  ).all(ORG_ID, ...ids);
  const grouped = new Map(ids.map((id) => [id, []]));
  quoteRows.forEach((quote) => {
    grouped.get(quote.entity_id)?.push({
      id: quote.id,
      name: quote.name,
      status: quote.status,
      event_date: quote.event_date,
      created_at: quote.created_at,
      guest_count: quote.guest_count,
      venue_name: quote.venue_name || null,
      client_name: [quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ').trim() || null,
    });
  });
  return rows.map((row) => {
    const quotes = grouped.get(row.id) || [];
    return {
      ...row,
      display_name: type === 'clients' ? getClientDisplayName(row) : getVenueDisplayName(row),
      quote_count: quotes.length,
      last_order_at: quotes[0]?.event_date || quotes[0]?.created_at || null,
      recent_quotes: quotes.slice(0, 6),
    };
  });
}

function buildSearchWhere(type, query) {
  const trimmed = cleanText(query);
  if (!trimmed) return { sql: 'WHERE org_id = ?', params: [ORG_ID] };
  const like = `%${trimmed}%`;
  if (type === 'clients') {
    return {
      sql: "WHERE org_id = ? AND (COALESCE(first_name, '') LIKE ? OR COALESCE(last_name, '') LIKE ? OR COALESCE(email, '') LIKE ? OR COALESCE(phone, '') LIKE ? OR COALESCE(address, '') LIKE ?)",
      params: [ORG_ID, like, like, like, like, like],
    };
  }
  return {
    sql: "WHERE org_id = ? AND (COALESCE(name, '') LIKE ? OR COALESCE(email, '') LIKE ? OR COALESCE(phone, '') LIKE ? OR COALESCE(address, '') LIKE ? OR COALESCE(contact, '') LIKE ?)",
    params: [ORG_ID, like, like, like, like, like],
  };
}

function listClients(db, query = {}) {
  syncAllQuotesToDirectories(db);
  const { sql, params } = buildSearchWhere('clients', query.q);
  const rows = db.prepare(`SELECT * FROM clients ${sql} ORDER BY COALESCE(last_name, ''), COALESCE(first_name, ''), id DESC`).all(...params);
  return { clients: attachQuotesToRows(db, rows, 'clients') };
}

function listVenues(db, query = {}) {
  syncAllQuotesToDirectories(db);
  const { sql, params } = buildSearchWhere('venues', query.q);
  const rows = db.prepare(`SELECT * FROM venues ${sql} ORDER BY COALESCE(name, ''), id DESC`).all(...params);
  return { venues: attachQuotesToRows(db, rows, 'venues') };
}

module.exports = {
  getClientDisplayName,
  getVenueDisplayName,
  listClients,
  createClient,
  updateClient,
  listVenues,
  createVenue,
  updateVenue,
  syncQuoteDirectoryLinks,
  syncAllQuotesToDirectories,
};
