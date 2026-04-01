const { getQuoteIdRow } = require('../db/queries/quotes');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function addCustomItem(db, quoteId, body, deps) {
  const { quoteSectionService, buildCustomItemSnapshot, logActivity, markUnsignedChangesIfApproved, req } = deps;
  const quote = getQuoteIdRow(db, quoteId, ORG_ID);
  if (!quote) throw createError(404, 'Quote not found');

  const { title, unit_price = 0, quantity = 1, photo_url, taxable = 1, sort_order = 0, section_id } = body || {};
  if (!title) throw createError(400, 'title required');

  const sections = quoteSectionService.ensureSections(db, quoteId);
  const targetSectionId = section_id != null ? Number(section_id) : sections[0]?.id;

  const result = db.prepare(
    'INSERT INTO quote_custom_items (quote_id, title, unit_price, quantity, photo_url, taxable, sort_order, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(quoteId, title, unit_price, quantity, photo_url || null, taxable ? 1 : 0, sort_order, targetSectionId || null);

  const item = db.prepare('SELECT * FROM quote_custom_items WHERE id = ?').get(result.lastInsertRowid);
  const newVal = buildCustomItemSnapshot({ title, unit_price, quantity: quantity || 1 });
  logActivity(db, quoteId, 'custom_item_added', 'Added custom item: ' + title, null, newVal, req);
  markUnsignedChangesIfApproved(db, quoteId);
  return { item };
}

function updateCustomItem(db, quoteId, customItemId, body, deps) {
  const { buildCustomItemSnapshot, logActivity, markUnsignedChangesIfApproved, req } = deps;
  const { title, unit_price, quantity, photo_url, taxable, sort_order, section_id } = body || {};
  const oldRow = db.prepare('SELECT title, unit_price, quantity FROM quote_custom_items WHERE id = ? AND quote_id = ?').get(customItemId, quoteId);
  if (!oldRow) throw createError(404, 'Not found');

  const qtyNum = quantity !== undefined && quantity !== null ? Number(quantity) : null;
  if (qtyNum === 0) {
    const oldVal = buildCustomItemSnapshot(oldRow);
    db.prepare('DELETE FROM quote_custom_items WHERE id = ? AND quote_id = ?').run(customItemId, quoteId);
    logActivity(db, quoteId, 'custom_item_removed', 'Removed custom item (zero quantity)', oldVal, null, req);
    markUnsignedChangesIfApproved(db, quoteId);
    return { deleted: true };
  }

  db.prepare(`
    UPDATE quote_custom_items SET
      title      = COALESCE(?, title),
      unit_price = COALESCE(?, unit_price),
      quantity   = COALESCE(?, quantity),
      photo_url  = COALESCE(?, photo_url),
      taxable    = COALESCE(?, taxable),
      sort_order = COALESCE(?, sort_order),
      section_id = COALESCE(?, section_id)
    WHERE id = ? AND quote_id = ?
  `).run(
    title !== undefined ? title : null,
    unit_price !== undefined ? unit_price : null,
    quantity !== undefined ? quantity : null,
    photo_url !== undefined ? photo_url : null,
    taxable !== undefined ? (taxable ? 1 : 0) : null,
    sort_order !== undefined ? sort_order : null,
    section_id !== undefined ? section_id : null,
    customItemId,
    quoteId
  );

  const newRow = db.prepare('SELECT title, unit_price, quantity FROM quote_custom_items WHERE id = ? AND quote_id = ?').get(customItemId, quoteId);
  const oldVal = buildCustomItemSnapshot(oldRow);
  const newVal = buildCustomItemSnapshot(newRow);
  if (oldVal !== newVal) {
    logActivity(db, quoteId, 'custom_item_updated', 'Updated custom item: ' + (newRow.title || ''), oldVal, newVal, req);
  }
  markUnsignedChangesIfApproved(db, quoteId);
  const item = db.prepare('SELECT * FROM quote_custom_items WHERE id = ?').get(customItemId);
  return { item };
}

function deleteCustomItem(db, quoteId, customItemId, deps) {
  const { buildCustomItemSnapshot, logActivity, markUnsignedChangesIfApproved, req } = deps;
  const oldRow = db.prepare('SELECT title, unit_price, quantity FROM quote_custom_items WHERE id = ? AND quote_id = ?').get(customItemId, quoteId);
  const oldVal = buildCustomItemSnapshot(oldRow);
  db.prepare('DELETE FROM quote_custom_items WHERE id = ? AND quote_id = ?').run(customItemId, quoteId);
  if (oldVal) logActivity(db, quoteId, 'custom_item_removed', 'Removed custom item', oldVal, null, req);
  markUnsignedChangesIfApproved(db, quoteId);
  return { deleted: true };
}

module.exports = {
  addCustomItem,
  updateCustomItem,
  deleteCustomItem,
};
