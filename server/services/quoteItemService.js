function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePositiveInt(v, fallback) {
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

const ORG_ID = 1;

function addQuoteItem(db, quoteId, body, deps) {
  const { quoteSectionService, upsertItemStats, buildQuoteItemSnapshot, logActivity, markUnsignedChangesIfApproved, req } = deps;
  const { item_id, quantity = 1, label, sort_order = 0, hidden_from_quote, section_id } = body || {};
  if (!item_id) throw createError(400, 'item_id required');

  const itemIdNum = parsePositiveInt(item_id, NaN);
  if (!Number.isFinite(itemIdNum)) throw createError(400, 'Invalid item_id');

  const qty = Math.min(1_000_000, Math.max(1, parsePositiveInt(quantity, 1)));
  let sortOrderVal = 0;
  if (sort_order !== undefined && sort_order !== null) {
    const s = parseInt(String(sort_order), 10);
    if (!Number.isFinite(s) || s < 0 || s > 1_000_000) {
      throw createError(400, 'Invalid sort_order');
    }
    sortOrderVal = s;
  }

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
  if (!quote) throw createError(404, 'Quote not found');

  const item = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(itemIdNum, ORG_ID);
  if (!item) throw createError(404, 'Item not found');

  const hidden = hidden_from_quote ? 1 : 0;
  const sections = quoteSectionService.ensureSections(db, quoteId);
  const targetSectionId = section_id != null ? Number(section_id) : sections[0]?.id;
  const result = db.prepare(
    'INSERT INTO quote_items (quote_id, item_id, quantity, label, sort_order, hidden_from_quote, section_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(quoteId, itemIdNum, qty, label || null, sortOrderVal, hidden, targetSectionId || null);

  upsertItemStats(db, itemIdNum, quote.guest_count || 0);

  const qitem = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(result.lastInsertRowid);
  const title = (label || item.title || '').trim() || item.title || 'Item';
  const newVal = buildQuoteItemSnapshot({ label: title, item_title: item.title, unit_price: item.unit_price, quantity: qty });
  logActivity(db, quoteId, 'item_added', 'Added line item: ' + title, null, newVal, req);
  markUnsignedChangesIfApproved(db, quoteId);
  return { qitem };
}

function reorderQuoteItems(db, quoteId, body) {
  const quoteIdNum = parseInt(String(quoteId), 10);
  if (Number.isNaN(quoteIdNum)) throw createError(400, 'Invalid id');
  const quote = db.prepare('SELECT id FROM quotes WHERE id = ? AND org_id = ?').get(quoteIdNum, ORG_ID);
  if (!quote) throw createError(404, 'Quote not found');
  const { order } = body || {};
  if (!Array.isArray(order)) throw createError(400, 'order must be an array');

  const ids = [];
  for (let i = 0; i < order.length; i += 1) {
    const n = parseInt(String(order[i]), 10);
    if (!Number.isFinite(n) || n < 1) {
      throw createError(400, 'order must contain positive integer quote line ids');
    }
    ids.push(n);
  }

  const update = db.prepare('UPDATE quote_items SET sort_order = ? WHERE id = ? AND quote_id = ?');
  const tx = db.transaction(() => {
    ids.forEach((qitemId, idx) => {
      update.run(idx, qitemId, quoteIdNum);
    });
  });
  tx();
  return { ok: true };
}

function updateQuoteItem(db, quoteId, qitemId, body, deps) {
  const { buildQuoteItemSnapshot, logActivity, markUnsignedChangesIfApproved, req, discountTypes } = deps;
  const quote = db.prepare('SELECT id FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
  if (!quote) throw createError(404, 'Not found');
  const { quantity, label, sort_order, hidden_from_quote, unit_price_override, discount_type, discount_amount, description, notes, section_id } = body || {};
  const oldRow = db.prepare(`
    SELECT qi.quantity, qi.label, qi.unit_price_override, i.title as item_title, i.unit_price
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.id = ? AND qi.quote_id = ?
  `).get(qitemId, quoteId);
  if (!oldRow) throw createError(404, 'Not found');

  const qtyNum = quantity !== undefined && quantity !== null ? Number(quantity) : null;
  if (qtyNum === 0) {
    const oldVal = buildQuoteItemSnapshot(oldRow);
    db.prepare('DELETE FROM quote_items WHERE id = ? AND quote_id = ?').run(qitemId, quoteId);
    logActivity(db, quoteId, 'item_removed', 'Removed line item (zero quantity)', oldVal, null, req);
    markUnsignedChangesIfApproved(db, quoteId);
    return { deleted: true };
  }

  let newOverride = oldRow.unit_price_override;
  if (unit_price_override !== undefined) {
    newOverride = unit_price_override === null ? null : parseFloat(unit_price_override);
  }

  if (discount_type !== undefined && discount_type !== null) {
    const dt = String(discount_type).trim();
    if (!discountTypes.has(dt)) throw createError(400, 'Invalid discount_type');
  }

  db.prepare(`
    UPDATE quote_items SET
      quantity            = COALESCE(?, quantity),
      label               = COALESCE(?, label),
      sort_order          = COALESCE(?, sort_order),
      section_id          = COALESCE(?, section_id),
      hidden_from_quote   = COALESCE(?, hidden_from_quote),
      unit_price_override = ?,
      discount_type       = COALESCE(?, discount_type),
      discount_amount     = COALESCE(?, discount_amount),
      description         = COALESCE(?, description),
      notes               = COALESCE(?, notes)
    WHERE id = ? AND quote_id = ?
  `).run(
    quantity !== undefined ? quantity : null,
    label !== undefined ? label : null,
    sort_order !== undefined ? sort_order : null,
    section_id !== undefined ? section_id : null,
    hidden_from_quote !== undefined ? (hidden_from_quote ? 1 : 0) : null,
    newOverride !== undefined ? newOverride : null,
    discount_type !== undefined ? discount_type : null,
    discount_amount !== undefined ? parseFloat(discount_amount) : null,
    description !== undefined ? description : null,
    notes !== undefined ? notes : null,
    qitemId,
    quoteId
  );

  const qitem = db.prepare(`
    SELECT qi.quantity, qi.label, i.title as item_title, i.unit_price
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.id = ? AND qi.quote_id = ?
  `).get(qitemId, quoteId);
  const newTitle = (qitem.label || qitem.item_title || '').trim() || qitem.item_title || 'Item';
  const oldVal = buildQuoteItemSnapshot(oldRow);
  const newVal = buildQuoteItemSnapshot(qitem);
  if (oldVal !== newVal) {
    logActivity(db, quoteId, 'item_updated', 'Updated line item: ' + newTitle, oldVal, newVal, req);
  }
  const qitemFull = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(qitemId);
  return { qitem: qitemFull };
}

function deleteQuoteItem(db, quoteId, qitemId, deps) {
  const { buildQuoteItemSnapshot, logActivity, markUnsignedChangesIfApproved, req } = deps;
  const quote = db.prepare('SELECT id FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
  if (!quote) throw createError(404, 'Not found');
  const oldRow = db.prepare(`
    SELECT qi.quantity, qi.label, i.title as item_title, i.unit_price
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.id = ? AND qi.quote_id = ?
  `).get(qitemId, quoteId);
  const oldVal = buildQuoteItemSnapshot(oldRow);
  db.prepare('DELETE FROM quote_items WHERE id = ? AND quote_id = ?').run(qitemId, quoteId);
  if (oldVal) logActivity(db, quoteId, 'item_removed', 'Removed line item', oldVal, null, req);
  markUnsignedChangesIfApproved(db, quoteId);
  return { deleted: true };
}

module.exports = {
  addQuoteItem,
  reorderQuoteItems,
  updateQuoteItem,
  deleteQuoteItem,
};
