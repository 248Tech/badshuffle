const { getQuoteById, requireQuoteById } = require('../db/queries/quotes');
const { getActorEmail } = require('../db/queries/users');
const notificationService = require('./notificationService');

const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getRangeFromSource(source) {
  const dates = [];
  if (source?.delivery_date) dates.push(source.delivery_date);
  if (source?.rental_start) dates.push(source.rental_start);
  if (source?.rental_end) dates.push(source.rental_end);
  if (source?.pickup_date) dates.push(source.pickup_date);
  if (dates.length === 0 && source?.event_date) dates.push(source.event_date);
  if (!dates.length) return { start: null, end: null };
  dates.sort();
  return { start: dates[0] || null, end: dates[dates.length - 1] || null };
}

function getFulfillmentStatus(row) {
  const quantity = Number(row.quantity || 0);
  const checkedIn = Number(row.checked_in_qty || 0);
  if (checkedIn <= 0) return 'out';
  if (checkedIn >= quantity) return 'returned';
  return 'partial';
}

function ensureFulfillmentStarted(db, quoteId, actor) {
  const existing = db.prepare(`
    SELECT id
    FROM quote_fulfillment_events
    WHERE quote_id = ?
      AND event_type = 'started'
    LIMIT 1
  `).get(quoteId);
  if (existing) return false;
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  db.prepare(`
    INSERT INTO quote_fulfillment_events (quote_id, fulfillment_item_id, event_type, quantity, note, created_by, user_email)
    VALUES (?, NULL, 'started', 0, ?, ?, ?)
  `).run(
    quoteId,
    'Work started',
    actor?.sub || actor?.id || null,
    getActorEmail(db, actor, null)
  );
  notificationService.createNotification(db, {
    type: 'fulfillment_started',
    title: 'Begin work on quote',
    body: `${quote.name || 'Untitled project'} entered fulfillment work`,
    href: `/quotes/${quoteId}`,
    entityType: 'quote',
    entityId: quoteId,
    actorUserId: actor?.sub || actor?.id || null,
    actorLabel: notificationService.buildActorLabel(actor),
  });
  return true;
}

function syncFulfillmentForQuote(db, quoteId) {
  const quote = getQuoteById(db, quoteId, ORG_ID);
  if (!quote) return;

  const rows = db.prepare(`
    SELECT
      qi.id AS qitem_id,
      qi.item_id,
      qi.section_id,
      qi.quantity,
      COALESCE(qi.label, i.title) AS item_title,
      COALESCE(s.title, 'Quote Items') AS section_title,
      q.delivery_date AS quote_delivery_date,
      q.rental_start AS quote_rental_start,
      q.rental_end AS quote_rental_end,
      q.pickup_date AS quote_pickup_date,
      q.event_date,
      s.delivery_date AS section_delivery_date,
      s.rental_start AS section_rental_start,
      s.rental_end AS section_rental_end,
      s.pickup_date AS section_pickup_date
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    JOIN quotes q ON q.id = qi.quote_id
    LEFT JOIN quote_item_sections s ON s.id = qi.section_id
    WHERE qi.quote_id = ?
    ORDER BY qi.id ASC
  `).all(quoteId);

  const upsert = db.prepare(`
    INSERT INTO quote_fulfillment_items (
      quote_id, qitem_id, item_id, section_id, item_title, section_title,
      range_start, range_end, quantity, checked_in_qty, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(quote_id, qitem_id) DO UPDATE SET
      item_id = excluded.item_id,
      section_id = excluded.section_id,
      item_title = excluded.item_title,
      section_title = excluded.section_title,
      range_start = excluded.range_start,
      range_end = excluded.range_end,
      quantity = excluded.quantity,
      checked_in_qty = MIN(quote_fulfillment_items.checked_in_qty, excluded.quantity),
      updated_at = datetime('now')
  `);

  const seenIds = [];
  rows.forEach((row) => {
    const range = getRangeFromSource(
      row.section_id != null
        ? {
            delivery_date: row.section_delivery_date,
            rental_start: row.section_rental_start,
            rental_end: row.section_rental_end,
            pickup_date: row.section_pickup_date,
          }
        : {
            delivery_date: row.quote_delivery_date,
            rental_start: row.quote_rental_start,
            rental_end: row.quote_rental_end,
            pickup_date: row.quote_pickup_date,
            event_date: row.event_date,
          }
    );
    upsert.run(
      quoteId,
      row.qitem_id,
      row.item_id,
      row.section_id || null,
      row.item_title || 'Item',
      row.section_title || 'Quote Items',
      range.start,
      range.end,
      Math.max(1, Number(row.quantity || 1)),
      0
    );
    seenIds.push(Number(row.qitem_id));
  });

  const existing = db.prepare('SELECT id, qitem_id, checked_in_qty, quantity FROM quote_fulfillment_items WHERE quote_id = ?').all(quoteId);
  existing.forEach((row) => {
    const qitemId = row.qitem_id != null ? Number(row.qitem_id) : null;
    if (qitemId != null && seenIds.includes(qitemId)) return;
    if (Number(row.checked_in_qty || 0) >= Number(row.quantity || 0)) {
      db.prepare('DELETE FROM quote_fulfillment_items WHERE id = ?').run(row.id);
      return;
    }
    db.prepare(`
      UPDATE quote_fulfillment_items
      SET qitem_id = NULL, quantity = checked_in_qty, updated_at = datetime('now')
      WHERE id = ?
    `).run(row.id);
  });
}

function listFulfillment(db, quoteId) {
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const items = db.prepare(`
    SELECT
      id,
      quote_id,
      qitem_id,
      item_id,
      section_id,
      item_title,
      section_title,
      range_start,
      range_end,
      quantity,
      checked_in_qty,
      created_at,
      updated_at
    FROM quote_fulfillment_items
    WHERE quote_id = ?
    ORDER BY section_title COLLATE NOCASE ASC, item_title COLLATE NOCASE ASC, id ASC
  `).all(quoteId).map((row) => ({
    ...row,
    quantity: Number(row.quantity || 0),
    checked_in_qty: Number(row.checked_in_qty || 0),
    outstanding_qty: Math.max(0, Number(row.quantity || 0) - Number(row.checked_in_qty || 0)),
    status: getFulfillmentStatus(row),
  }));

  const notes = db.prepare(`
    SELECT n.*, u.first_name, u.last_name, u.display_name
    FROM quote_fulfillment_notes n
    LEFT JOIN users u ON u.id = n.created_by
    WHERE n.quote_id = ?
    ORDER BY n.created_at DESC, n.id DESC
  `).all(quoteId);

  const summary = items.reduce((acc, item) => {
    acc.total_qty += item.quantity;
    acc.checked_in_qty += item.checked_in_qty;
    acc.outstanding_qty += item.outstanding_qty;
    return acc;
  }, { total_qty: 0, checked_in_qty: 0, outstanding_qty: 0 });

  return {
    quote: {
      id: quote.id,
      name: quote.name,
      status: quote.status || 'draft',
      event_date: quote.event_date || null,
    },
    summary,
    items,
    notes,
  };
}

function checkInFulfillmentItem(db, quoteId, fulfillmentItemId, body, actor) {
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  if (!['confirmed', 'closed'].includes(String(quote.status || 'draft'))) {
    throw createError(400, 'Fulfillment is only active for confirmed or closed projects');
  }
  const row = db.prepare(`
    SELECT *
    FROM quote_fulfillment_items
    WHERE id = ? AND quote_id = ?
  `).get(fulfillmentItemId, quoteId);
  if (!row) throw createError(404, 'Fulfillment item not found');

  const outstanding = Math.max(0, Number(row.quantity || 0) - Number(row.checked_in_qty || 0));
  if (outstanding <= 0) throw createError(400, 'Item already fully checked in');
  const qty = Math.max(1, Math.min(outstanding, parseInt(String(body?.quantity || 1), 10) || 1));
  const nextCheckedIn = Math.min(Number(row.quantity || 0), Number(row.checked_in_qty || 0) + qty);
  const actorEmail = getActorEmail(db, actor, null);
  const note = String(body?.note || '').trim().slice(0, 1000) || null;
  ensureFulfillmentStarted(db, quoteId, actor);

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE quote_fulfillment_items
      SET checked_in_qty = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextCheckedIn, fulfillmentItemId);
    db.prepare(`
      INSERT INTO quote_fulfillment_events (quote_id, fulfillment_item_id, event_type, quantity, note, created_by, user_email)
      VALUES (?, ?, 'check_in', ?, ?, ?, ?)
    `).run(quoteId, fulfillmentItemId, qty, note, actor?.sub || actor?.id || null, actorEmail);
  });
  tx();
  return listFulfillment(db, quoteId);
}

function addFulfillmentNote(db, quoteId, body, actor) {
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  if (!['confirmed', 'closed'].includes(String(quote.status || 'draft'))) {
    throw createError(400, 'Fulfillment notes are only available for confirmed or closed projects');
  }
  const note = String(body?.body || '').trim();
  if (!note) throw createError(400, 'Note is required');
  if (note.length > 4000) throw createError(400, 'Note too long');
  ensureFulfillmentStarted(db, quoteId, actor);
  db.prepare(`
    INSERT INTO quote_fulfillment_notes (quote_id, body, created_by, user_email)
    VALUES (?, ?, ?, ?)
  `).run(quoteId, note, actor?.sub || actor?.id || null, getActorEmail(db, actor, null));
  return listFulfillment(db, quoteId);
}

function getOutstandingFulfillmentRowsByQuoteAndItems(db, quoteIds, itemIds) {
  if (!quoteIds.length || !itemIds.length) return {};
  const quotePlaceholders = quoteIds.map(() => '?').join(',');
  const itemPlaceholders = itemIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT quote_id, item_id, section_id, range_start, range_end, quantity, checked_in_qty
    FROM quote_fulfillment_items
    WHERE quote_id IN (${quotePlaceholders})
      AND item_id IN (${itemPlaceholders})
      AND quantity > checked_in_qty
  `).all(...quoteIds, ...itemIds);
  const grouped = {};
  rows.forEach((row) => {
    if (!grouped[row.quote_id]) grouped[row.quote_id] = [];
    grouped[row.quote_id].push({
      item_id: Number(row.item_id),
      section_id: row.section_id != null ? Number(row.section_id) : null,
      quantity: Math.max(0, Number(row.quantity || 0) - Number(row.checked_in_qty || 0)),
      range: row.range_start && row.range_end ? { start: row.range_start, end: row.range_end } : null,
    });
  });
  return grouped;
}

module.exports = {
  syncFulfillmentForQuote,
  listFulfillment,
  checkInFulfillmentItem,
  addFulfillmentNote,
  getOutstandingFulfillmentRowsByQuoteAndItems,
};
