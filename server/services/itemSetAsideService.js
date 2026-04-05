const itemQueries = require('../db/queries/items');

const ORG_ID = 1;
const SET_ASIDE_REASONS = [
  { code: 'repair', label: 'Repair', icon: 'wrench' },
  { code: 'damage', label: 'Damage', icon: 'alert-triangle' },
  { code: 'hold_for_client', label: 'Hold For Client', icon: 'bookmark' },
  { code: 'missing', label: 'Missing', icon: 'search' },
  { code: 'cleaning', label: 'Cleaning', icon: 'sparkles' },
  { code: 'other', label: 'Other', icon: 'dot' },
];

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validReasonCode(value) {
  const code = String(value || '').trim();
  return SET_ASIDE_REASONS.some((reason) => reason.code === code) ? code : null;
}

function actorId(actor) {
  const id = Number(actor?.sub || actor?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getQuoteLabel(db, quoteId) {
  if (!quoteId) return '';
  const row = db.prepare('SELECT name FROM quotes WHERE id = ? AND org_id = ?').get(Number(quoteId), ORG_ID);
  return row?.name || '';
}

function suggestRelatedQuote(db, itemId) {
  const history = itemQueries.listItemQuoteHistory(db, itemId);
  if (!history.length) return null;
  const latest = history[0];
  return { id: Number(latest.id), label: latest.name || latest.label || 'Untitled project' };
}

function normalizeRecord(record) {
  return {
    id: Number(record.id),
    item_id: Number(record.item_id),
    item_title: record.item_title || '',
    item_photo_url: record.item_photo_url || '',
    quantity: Number(record.quantity || 0),
    reason_code: record.reason_code,
    reason_note: record.reason_note || '',
    related_quote_id: record.related_quote_id != null ? Number(record.related_quote_id) : null,
    related_quote_label: record.related_quote_label || '',
    created_by_user_id: record.created_by_user_id != null ? Number(record.created_by_user_id) : null,
    created_by_name: record.created_by_name || '',
    created_at: record.created_at,
    updated_at: record.updated_at,
    resolved_at: record.resolved_at || null,
    resolved_by_user_id: record.resolved_by_user_id != null ? Number(record.resolved_by_user_id) : null,
    resolved_by_name: record.resolved_by_name || '',
    resolution_reason: record.resolution_reason || '',
    resolution_disposition: record.resolution_disposition || '',
    resolution_quantity: Number(record.resolution_quantity || 0),
  };
}

function listSetAsides(db, { includeResolved = false } = {}) {
  let sql = `
    SELECT
      isa.*,
      i.title AS item_title,
      i.photo_url AS item_photo_url,
      COALESCE(cb.display_name, TRIM(COALESCE(cb.first_name, '') || ' ' || COALESCE(cb.last_name, '')), cb.email) AS created_by_name,
      COALESCE(rb.display_name, TRIM(COALESCE(rb.first_name, '') || ' ' || COALESCE(rb.last_name, '')), rb.email) AS resolved_by_name
    FROM item_set_asides isa
    JOIN items i ON i.id = isa.item_id
    LEFT JOIN users cb ON cb.id = isa.created_by_user_id
    LEFT JOIN users rb ON rb.id = isa.resolved_by_user_id
    WHERE i.org_id = ?
  `;
  const params = [ORG_ID];
  if (!includeResolved) sql += ' AND isa.resolved_at IS NULL';
  sql += ' ORDER BY COALESCE(isa.resolved_at, isa.created_at) DESC, isa.id DESC';
  const records = db.prepare(sql).all(...params).map(normalizeRecord);
  return { reasons: SET_ASIDE_REASONS, records };
}

function getSetAside(db, setAsideId) {
  const row = db.prepare(`
    SELECT
      isa.*,
      i.title AS item_title,
      i.photo_url AS item_photo_url,
      COALESCE(cb.display_name, TRIM(COALESCE(cb.first_name, '') || ' ' || COALESCE(cb.last_name, '')), cb.email) AS created_by_name,
      COALESCE(rb.display_name, TRIM(COALESCE(rb.first_name, '') || ' ' || COALESCE(rb.last_name, '')), rb.email) AS resolved_by_name
    FROM item_set_asides isa
    JOIN items i ON i.id = isa.item_id
    LEFT JOIN users cb ON cb.id = isa.created_by_user_id
    LEFT JOIN users rb ON rb.id = isa.resolved_by_user_id
    WHERE isa.id = ? AND i.org_id = ?
  `).get(Number(setAsideId), ORG_ID);
  return row ? normalizeRecord(row) : null;
}

function logEvent(db, setAsideId, payload = {}) {
  db.prepare(`
    INSERT INTO item_set_aside_events (
      set_aside_id, event_type, quantity, reason_code, note, disposition, actor_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    Number(setAsideId),
    String(payload.event_type || '').trim(),
    payload.quantity != null ? Number(payload.quantity) : null,
    payload.reason_code || null,
    payload.note || null,
    payload.disposition || null,
    payload.actor_user_id != null ? Number(payload.actor_user_id) : null
  );
}

function createSetAside(db, itemId, body = {}, actor) {
  const item = itemQueries.getItemById(db, itemId, ORG_ID);
  if (!item) throw createError(404, 'Item not found');
  const quantity = Number(body.quantity || 0);
  if (!Number.isFinite(quantity) || quantity < 1) throw createError(400, 'Quantity must be at least 1');
  const reasonCode = validReasonCode(body.reason_code);
  if (!reasonCode) throw createError(400, 'Valid reason is required');
  const suggestedQuote = suggestRelatedQuote(db, item.id);
  const relatedQuoteId = body.related_quote_id != null && body.related_quote_id !== '' ? Number(body.related_quote_id) : suggestedQuote?.id || null;
  const relatedQuoteLabel = body.related_quote_label ? String(body.related_quote_label).trim() : (getQuoteLabel(db, relatedQuoteId) || suggestedQuote?.label || '');
  const result = db.prepare(`
    INSERT INTO item_set_asides (
      item_id, quantity, reason_code, reason_note, related_quote_id, related_quote_label,
      created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    Number(item.id),
    quantity,
    reasonCode,
    String(body.reason_note || '').trim() || null,
    relatedQuoteId,
    relatedQuoteLabel || null,
    actorId(actor)
  );
  logEvent(db, result.lastInsertRowid, {
    event_type: 'created',
    quantity,
    reason_code: reasonCode,
    note: String(body.reason_note || '').trim() || null,
    actor_user_id: actorId(actor),
  });
  return { record: getSetAside(db, result.lastInsertRowid), suggested_quote: suggestedQuote || null };
}

function updateSetAside(db, setAsideId, body = {}, actor) {
  const existing = getSetAside(db, setAsideId);
  if (!existing) throw createError(404, 'Set aside record not found');
  if (existing.resolved_at) throw createError(400, 'Resolved set aside records cannot be edited');
  const quantity = body.quantity != null ? Number(body.quantity) : existing.quantity;
  if (!Number.isFinite(quantity) || quantity < 1) throw createError(400, 'Quantity must be at least 1');
  const reasonCode = body.reason_code !== undefined ? validReasonCode(body.reason_code) : existing.reason_code;
  if (!reasonCode) throw createError(400, 'Valid reason is required');
  const relatedQuoteId = body.related_quote_id !== undefined && body.related_quote_id !== ''
    ? Number(body.related_quote_id)
    : (body.related_quote_id === '' ? null : existing.related_quote_id);
  const relatedQuoteLabel = body.related_quote_label !== undefined
    ? String(body.related_quote_label || '').trim()
    : (relatedQuoteId ? getQuoteLabel(db, relatedQuoteId) || existing.related_quote_label : existing.related_quote_label);
  db.prepare(`
    UPDATE item_set_asides
    SET quantity = ?,
        reason_code = ?,
        reason_note = ?,
        related_quote_id = ?,
        related_quote_label = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    quantity,
    reasonCode,
    body.reason_note !== undefined ? (String(body.reason_note || '').trim() || null) : (existing.reason_note || null),
    relatedQuoteId,
    relatedQuoteLabel || null,
    Number(setAsideId)
  );
  logEvent(db, setAsideId, {
    event_type: 'updated',
    quantity,
    reason_code: reasonCode,
    note: body.reason_note !== undefined ? (String(body.reason_note || '').trim() || null) : null,
    actor_user_id: actorId(actor),
  });
  return { record: getSetAside(db, setAsideId) };
}

function resolveSetAside(db, setAsideId, body = {}, actor) {
  const existing = getSetAside(db, setAsideId);
  if (!existing) throw createError(404, 'Set aside record not found');
  if (existing.resolved_at) throw createError(400, 'Set aside record is already resolved');
  const quantity = Number(body.quantity || 0);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > existing.quantity) throw createError(400, 'Resolve quantity must be between 1 and the active set aside quantity');
  const disposition = String(body.disposition || '').trim();
  if (disposition !== 'return_to_inventory' && disposition !== 'remove_from_inventory') {
    throw createError(400, 'Disposition must be return_to_inventory or remove_from_inventory');
  }
  const resolutionReason = String(body.resolution_reason || '').trim();
  if (!resolutionReason) throw createError(400, 'Resolution reason is required');

  if (disposition === 'remove_from_inventory') {
    db.prepare(`
      UPDATE items
      SET quantity_in_stock = MAX(0, COALESCE(quantity_in_stock, 0) - ?),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(quantity, existing.item_id);
  }

  if (quantity === existing.quantity) {
    db.prepare(`
      UPDATE item_set_asides
      SET resolved_at = datetime('now'),
          resolved_by_user_id = ?,
          resolution_reason = ?,
          resolution_disposition = ?,
          resolution_quantity = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(actorId(actor), resolutionReason, disposition, quantity, Number(setAsideId));
  } else {
    db.prepare(`
      UPDATE item_set_asides
      SET quantity = quantity - ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(quantity, Number(setAsideId));
  }

  logEvent(db, setAsideId, {
    event_type: quantity === existing.quantity ? 'resolved' : 'partially_resolved',
    quantity,
    note: resolutionReason,
    disposition,
    actor_user_id: actorId(actor),
  });
  return { record: getSetAside(db, setAsideId) || null };
}

module.exports = {
  SET_ASIDE_REASONS,
  listSetAsides,
  createSetAside,
  updateSetAside,
  resolveSetAside,
  suggestRelatedQuote,
};
