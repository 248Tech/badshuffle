const { getQuoteById, requireQuoteById } = require('../db/queries/quotes');
const quoteRepository = require('../db/repositories/quoteRepository');
const { syncQuoteMapCache } = require('./mapboxGeocodeService');
const notificationService = require('./notificationService');
const quotePricingEngineService = require('./quotePricingEngineService');
const directoryContactsService = require('./directoryContactsService');
const quotePatternMemoryService = require('./quotePatternMemoryService');

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseOptionalInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

const ORG_ID = 1;

function getQuoteActivity(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  return { activity: quoteRepository.listQuoteActivityEntries(db, quoteId) };
}

async function getQuoteDetail(db, quoteId, deps) {
  const { quoteSectionService } = deps;
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const sections = quoteSectionService.ensureSections(db, quoteId);
  const snapshot = quoteRepository.getQuoteDetailSnapshot(db, quoteId, ORG_ID);
  const totals = await quotePricingEngineService.computeQuoteTotals(db, snapshot.quote, snapshot.quote.tax_rate, {
    diagnostics: deps.diagnostics,
    requestId: deps.requestId,
    route: deps.route || 'quote-detail',
    loadQuote: () => snapshot.quote,
  });
  const remaining_balance = Number(totals.total || 0) - Number(snapshot.amount_paid || 0);

  return {
    ...snapshot.quote,
    total: totals.total,
    contract_total: totals.total,
    subtotal: totals.subtotal,
    delivery_total: totals.deliveryTotal,
    custom_subtotal: totals.customSubtotal,
    adjustments_total: totals.adjTotal,
    taxable_amount: totals.taxableAmount,
    tax: totals.tax,
    rate: totals.rate,
    items: snapshot.items,
    customItems: snapshot.customItems,
    adjustments: snapshot.adjustments,
    sections,
    signed_at: snapshot.signed_at,
    signed_quote_total: snapshot.signed_quote_total,
    signed_remaining_balance: snapshot.signed_remaining_balance,
    amount_paid: snapshot.amount_paid,
    remaining_balance,
    overpaid: remaining_balance < 0,
    is_expired: snapshot.is_expired,
  };
}

async function createQuote(db, body, deps) {
  const { quoteSectionService, req, logActivity } = deps;
  const {
    name,
    guest_count = 0,
    event_date,
    event_type,
    notes,
    venue_name,
    venue_email,
    venue_phone,
    venue_address,
    venue_contact,
    venue_notes,
    quote_notes,
    tax_rate,
    client_first_name,
    client_last_name,
    client_email,
    client_phone,
    client_address,
    rental_start,
    rental_end,
    delivery_date,
    pickup_date,
  } = body || {};

  if (!name) throw createError(400, 'name required');
  if (String(name).length > 500) throw createError(400, 'name too long');
  const gc = Number(guest_count);
  if (!Number.isFinite(gc) || gc < 0 || gc > 1_000_000) throw createError(400, 'Invalid guest_count');

  const result = db.prepare(
    `INSERT INTO quotes (org_id, name, guest_count, event_date, event_type, notes, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate, client_first_name, client_last_name, client_email, client_phone, client_address, rental_start, rental_end, delivery_date, pickup_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ORG_ID,
    name,
    gc,
    event_date || null,
    event_type || null,
    notes || null,
    venue_name || null,
    venue_email || null,
    venue_phone || null,
    venue_address || null,
    venue_contact || null,
    venue_notes || null,
    quote_notes || null,
    tax_rate != null ? Number(tax_rate) : null,
    client_first_name || null,
    client_last_name || null,
    client_email || null,
    client_phone || null,
    client_address || null,
    rental_start || null,
    rental_end || null,
    delivery_date || null,
    pickup_date || null,
    req?.user?.sub || null
  );

  quoteSectionService.ensureSections(db, result.lastInsertRowid);
  directoryContactsService.syncQuoteDirectoryLinks(db, result.lastInsertRowid);
  quotePatternMemoryService.upsertMemoryRecord(db, result.lastInsertRowid, 'quote_created');
  await syncQuoteMapCache(db, result.lastInsertRowid);
  if (logActivity) {
    logActivity(db, result.lastInsertRowid, 'quote_created', 'Project created', null, null, req);
  }
  const quote = getQuoteById(db, result.lastInsertRowid, ORG_ID);
  notificationService.createNotification(db, {
    type: 'quote_created',
    title: 'Project created',
    body: `${quote.name || 'Untitled project'} was created`,
    href: `/quotes/${quote.id}`,
    entityType: 'quote',
    entityId: quote.id,
    actorUserId: req?.user?.sub || null,
    actorLabel: notificationService.buildActorLabel(req?.user),
  });
  return { quote };
}

async function updateQuote(db, quoteId, body, deps) {
  const { quoteSectionService, logActivity, req } = deps;
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const {
    name,
    guest_count,
    event_date,
    event_type,
    notes,
    lead_id,
    venue_name,
    venue_email,
    venue_phone,
    venue_address,
    venue_contact,
    venue_notes,
    quote_notes,
    tax_rate,
    client_first_name,
    client_last_name,
    client_email,
    client_phone,
    client_address,
    rental_start,
    rental_end,
    delivery_date,
    pickup_date,
    expires_at,
    expiration_message,
    payment_policy_id,
    rental_terms_id,
  } = body || {};

  if (name !== undefined && name !== null && String(name).length > 500) {
    throw createError(400, 'name too long');
  }
  if (guest_count !== undefined && guest_count !== null) {
    const g = Number(guest_count);
    if (!Number.isFinite(g) || g < 0 || g > 1_000_000) {
      throw createError(400, 'Invalid guest_count');
    }
  }
  if (lead_id !== undefined && lead_id !== null && lead_id !== '') {
    const lid = parseOptionalInt(lead_id);
    if (lid == null || lid < 1) throw createError(400, 'Invalid lead_id');
  }

  db.prepare(`
    UPDATE quotes SET
      name          = COALESCE(?, name),
      guest_count   = COALESCE(?, guest_count),
      event_date    = COALESCE(?, event_date),
      event_type    = COALESCE(?, event_type),
      notes         = COALESCE(?, notes),
      lead_id       = COALESCE(?, lead_id),
      venue_name    = COALESCE(?, venue_name),
      venue_email   = COALESCE(?, venue_email),
      venue_phone   = COALESCE(?, venue_phone),
      venue_address = COALESCE(?, venue_address),
      venue_contact = COALESCE(?, venue_contact),
      venue_notes   = COALESCE(?, venue_notes),
      quote_notes   = COALESCE(?, quote_notes),
      tax_rate      = ?,
      client_first_name = COALESCE(?, client_first_name),
      client_last_name  = COALESCE(?, client_last_name),
      client_email      = COALESCE(?, client_email),
      client_phone      = COALESCE(?, client_phone),
      client_address    = COALESCE(?, client_address),
      rental_start  = COALESCE(?, rental_start),
      rental_end    = COALESCE(?, rental_end),
      delivery_date = COALESCE(?, delivery_date),
      pickup_date   = COALESCE(?, pickup_date),
      expires_at         = ?,
      expiration_message = ?,
      payment_policy_id  = ?,
      rental_terms_id    = ?,
      updated_at    = datetime('now')
    WHERE id = ?
  `).run(
    name !== undefined ? name : null,
    guest_count !== undefined && guest_count !== null ? Math.round(Number(guest_count)) : null,
    event_date !== undefined ? event_date : null,
    event_type !== undefined ? event_type : null,
    notes !== undefined ? notes : null,
    lead_id !== undefined && lead_id !== null && lead_id !== '' ? parseOptionalInt(lead_id) : null,
    venue_name !== undefined ? venue_name : null,
    venue_email !== undefined ? venue_email : null,
    venue_phone !== undefined ? venue_phone : null,
    venue_address !== undefined ? venue_address : null,
    venue_contact !== undefined ? venue_contact : null,
    venue_notes !== undefined ? venue_notes : null,
    quote_notes !== undefined ? quote_notes : null,
    tax_rate !== undefined ? (tax_rate === null ? null : Number(tax_rate)) : quote.tax_rate,
    client_first_name !== undefined ? client_first_name : null,
    client_last_name !== undefined ? client_last_name : null,
    client_email !== undefined ? client_email : null,
    client_phone !== undefined ? client_phone : null,
    client_address !== undefined ? client_address : null,
    rental_start !== undefined ? (rental_start || null) : null,
    rental_end !== undefined ? (rental_end || null) : null,
    delivery_date !== undefined ? (delivery_date || null) : null,
    pickup_date !== undefined ? (pickup_date || null) : null,
    expires_at !== undefined ? (expires_at || null) : quote.expires_at,
    expiration_message !== undefined ? (expiration_message || null) : quote.expiration_message,
    payment_policy_id !== undefined ? (payment_policy_id || null) : quote.payment_policy_id,
    rental_terms_id !== undefined ? (rental_terms_id || null) : quote.rental_terms_id,
    quoteId
  );

  if (delivery_date !== undefined || rental_start !== undefined || rental_end !== undefined || pickup_date !== undefined) {
    const sections = quoteSectionService.ensureSections(db, quoteId);
    const primary = sections[0];
    if (primary) {
      db.prepare(`
        UPDATE quote_item_sections SET
          delivery_date = COALESCE(?, delivery_date),
          rental_start  = COALESCE(?, rental_start),
          rental_end    = COALESCE(?, rental_end),
          pickup_date   = COALESCE(?, pickup_date)
        WHERE id = ? AND quote_id = ?
      `).run(
        delivery_date !== undefined ? (delivery_date || null) : null,
        rental_start !== undefined ? (rental_start || null) : null,
        rental_end !== undefined ? (rental_end || null) : null,
        pickup_date !== undefined ? (pickup_date || null) : null,
        primary.id,
        quoteId
      );
    }
  }

  directoryContactsService.syncQuoteDirectoryLinks(db, quoteId);
  quotePatternMemoryService.upsertMemoryRecord(db, quoteId, 'quote_updated');
  await syncQuoteMapCache(db, quoteId);
  logActivity(db, quoteId, 'quote_updated', 'Project details updated', null, null, req);
  return { quote: getQuoteById(db, quoteId, ORG_ID) };
}

function ensurePublicToken(db, quoteId, createToken) {
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  if (!quote.public_token) {
    const token = createToken();
    db.prepare("UPDATE quotes SET public_token = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?").run(token, quoteId, ORG_ID);
  }
  return { quote: getQuoteById(db, quoteId, ORG_ID) };
}

async function sendQuote(params) {
  const { quoteService, ...rest } = params;
  return quoteService.sendQuote(rest);
}

function clearUnsignedChanges(db, quoteId, deps) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  db.prepare("UPDATE quotes SET has_unsigned_changes = 0, updated_at = datetime('now') WHERE id = ? AND org_id = ?").run(quoteId, ORG_ID);
  deps.logActivity(
    db,
    quoteId,
    'status_change',
    'Unsigned-changes flag cleared (dismissed by staff)',
    null,
    null,
    deps.req
  );
  return { ok: true };
}

module.exports = {
  getQuoteActivity,
  getQuoteDetail,
  createQuote,
  updateQuote,
  ensurePublicToken,
  sendQuote,
  clearUnsignedChanges,
};
