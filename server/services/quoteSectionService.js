const { getQuoteById, getQuoteIdRow } = require('../db/queries/quotes');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function listSections(db, quoteId) {
  return db.prepare(
    'SELECT * FROM quote_item_sections WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(quoteId);
}

function ensureSections(db, quoteId) {
  let sections = listSections(db, quoteId);
  if (sections.length === 0) {
    const quote = getQuoteById(db, quoteId, ORG_ID);
    const result = db.prepare(
      'INSERT INTO quote_item_sections (quote_id, title, delivery_date, rental_start, rental_end, pickup_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, 0)'
    ).run(
      quoteId,
      'Quote Items',
      quote?.delivery_date || null,
      quote?.rental_start || null,
      quote?.rental_end || null,
      quote?.pickup_date || null
    );
    const sectionId = result.lastInsertRowid;
    db.prepare('UPDATE quote_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(sectionId, quoteId);
    db.prepare('UPDATE quote_custom_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(sectionId, quoteId);
    sections = listSections(db, quoteId);
  } else {
    const fallbackId = sections[0].id;
    db.prepare('UPDATE quote_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(fallbackId, quoteId);
    db.prepare('UPDATE quote_custom_items SET section_id = ? WHERE quote_id = ? AND section_id IS NULL').run(fallbackId, quoteId);
  }
  return sections;
}

function addSection(db, quoteId, body = {}) {
  const quote = getQuoteIdRow(db, quoteId, ORG_ID);
  if (!quote) throw createError(404, 'Quote not found');

  const sections = ensureSections(db, quoteId);
  const { title, delivery_date, rental_start, rental_end, pickup_date } = body;
  const nextSort = sections.length;
  const result = db.prepare(
    'INSERT INTO quote_item_sections (quote_id, title, delivery_date, rental_start, rental_end, pickup_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    quoteId,
    (title || '').trim() || `Quote Items ${nextSort + 1}`,
    delivery_date || null,
    rental_start || null,
    rental_end || null,
    pickup_date || null,
    nextSort
  );

  return db.prepare('SELECT * FROM quote_item_sections WHERE id = ?').get(result.lastInsertRowid);
}

function updateSection(db, quoteId, sectionId, body = {}) {
  const { title, delivery_date, rental_start, rental_end, pickup_date, sort_order } = body;
  const section = db.prepare('SELECT * FROM quote_item_sections WHERE id = ? AND quote_id = ?').get(sectionId, quoteId);
  if (!section) throw createError(404, 'Section not found');

  db.prepare(`
    UPDATE quote_item_sections SET
      title = COALESCE(?, title),
      delivery_date = ?,
      rental_start = ?,
      rental_end = ?,
      pickup_date = ?,
      sort_order = COALESCE(?, sort_order)
    WHERE id = ? AND quote_id = ?
  `).run(
    title !== undefined ? ((title || '').trim() || 'Quote Items') : null,
    delivery_date !== undefined ? (delivery_date || null) : section.delivery_date,
    rental_start !== undefined ? (rental_start || null) : section.rental_start,
    rental_end !== undefined ? (rental_end || null) : section.rental_end,
    pickup_date !== undefined ? (pickup_date || null) : section.pickup_date,
    sort_order !== undefined ? sort_order : null,
    sectionId,
    quoteId
  );

  const firstSection = listSections(db, quoteId)[0];
  if (firstSection && Number(firstSection.id) === Number(sectionId)) {
    const synced = db.prepare('SELECT delivery_date, rental_start, rental_end, pickup_date FROM quote_item_sections WHERE id = ?').get(sectionId);
    db.prepare(`
      UPDATE quotes SET
        delivery_date = ?,
        rental_start = ?,
        rental_end = ?,
        pickup_date = ?,
        updated_at = datetime('now')
      WHERE id = ? AND org_id = ?
    `).run(
      synced.delivery_date || null,
      synced.rental_start || null,
      synced.rental_end || null,
      synced.pickup_date || null,
      quoteId,
      ORG_ID
    );
  }

  return db.prepare('SELECT * FROM quote_item_sections WHERE id = ?').get(sectionId);
}

function duplicateSection(db, quoteId, sectionId) {
  const section = db.prepare('SELECT * FROM quote_item_sections WHERE id = ? AND quote_id = ?').get(sectionId, quoteId);
  if (!section) throw createError(404, 'Section not found');

  const duplicateTx = db.transaction(() => {
    const count = db.prepare('SELECT COUNT(*) as count FROM quote_item_sections WHERE quote_id = ?').get(quoteId).count || 0;
    const result = db.prepare(
      'INSERT INTO quote_item_sections (quote_id, title, delivery_date, rental_start, rental_end, pickup_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      quoteId,
      `${section.title || 'Quote Items'} (copy)`,
      section.delivery_date || null,
      section.rental_start || null,
      section.rental_end || null,
      section.pickup_date || null,
      count
    );
    const newSectionId = result.lastInsertRowid;
    const items = db.prepare(
      'SELECT item_id, quantity, label, sort_order, hidden_from_quote, unit_price_override, discount_type, discount_amount, description, notes FROM quote_items WHERE quote_id = ? AND section_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(quoteId, sectionId);
    const itemInsert = db.prepare(
      'INSERT INTO quote_items (quote_id, item_id, quantity, label, sort_order, hidden_from_quote, unit_price_override, discount_type, discount_amount, description, notes, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    items.forEach((item) => {
      itemInsert.run(quoteId, item.item_id, item.quantity, item.label, item.sort_order, item.hidden_from_quote, item.unit_price_override, item.discount_type, item.discount_amount, item.description, item.notes, newSectionId);
    });

    const customItems = db.prepare(
      'SELECT title, unit_price, quantity, photo_url, taxable, sort_order FROM quote_custom_items WHERE quote_id = ? AND section_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(quoteId, sectionId);
    const customInsert = db.prepare(
      'INSERT INTO quote_custom_items (quote_id, title, unit_price, quantity, photo_url, taxable, sort_order, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    customItems.forEach((item) => {
      customInsert.run(quoteId, item.title, item.unit_price, item.quantity, item.photo_url, item.taxable, item.sort_order, newSectionId);
    });

    return db.prepare('SELECT * FROM quote_item_sections WHERE id = ?').get(newSectionId);
  });

  return duplicateTx();
}

function deleteSection(db, quoteId, sectionId, { logActivity, markUnsignedChangesIfApproved, req }) {
  const sections = ensureSections(db, quoteId);
  if (sections.length <= 1) throw createError(400, 'At least one section is required');

  const section = db.prepare('SELECT * FROM quote_item_sections WHERE id = ? AND quote_id = ?').get(sectionId, quoteId);
  if (!section) throw createError(404, 'Section not found');

  const deleteTx = db.transaction(() => {
    const deletedItemCount = db.prepare('SELECT COUNT(*) as count FROM quote_items WHERE quote_id = ? AND section_id = ?').get(quoteId, sectionId)?.count || 0;
    const deletedCustomItemCount = db.prepare('SELECT COUNT(*) as count FROM quote_custom_items WHERE quote_id = ? AND section_id = ?').get(quoteId, sectionId)?.count || 0;
    db.prepare('DELETE FROM quote_items WHERE quote_id = ? AND section_id = ?').run(quoteId, sectionId);
    db.prepare('DELETE FROM quote_custom_items WHERE quote_id = ? AND section_id = ?').run(quoteId, sectionId);
    db.prepare('DELETE FROM quote_item_sections WHERE id = ? AND quote_id = ?').run(sectionId, quoteId);
    logActivity(
      db,
      quoteId,
      'section_deleted',
      `Deleted quote items area: ${section.title || 'Quote Items'}`,
      `${deletedItemCount + deletedCustomItemCount} items`,
      null,
      req
    );
    markUnsignedChangesIfApproved(db, quoteId);
    return { deleted: true, deleted_item_count: deletedItemCount, deleted_custom_item_count: deletedCustomItemCount };
  });

  return deleteTx();
}

module.exports = {
  listSections,
  ensureSections,
  addSection,
  updateSection,
  duplicateSection,
  deleteSection,
};
