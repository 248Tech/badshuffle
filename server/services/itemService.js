const itemQueries = require('../db/queries/items');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePositiveInt(value) {
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function validateTitle(title) {
  if (!title) throw createError(400, 'title required');
  if (/^\d+(\.\d+)?$/.test(String(title).trim())) {
    throw createError(400, 'title must not be a bare number');
  }
}

function listCategories(db) {
  return { categories: itemQueries.listDistinctCategories(db, ORG_ID) };
}

function listPopularCategories(db, rawLimit) {
  const limit = Math.max(1, Math.min(50, parseInt(rawLimit, 10) || 15));
  return { categories: itemQueries.listPopularCategories(db, limit, ORG_ID) };
}

function listCatalog(db, query) {
  const search = (query.search || '').trim();
  const hidden = query.hidden;
  const category = query.category && String(query.category).trim() ? String(query.category).trim() : null;
  const excludeQuoteId = query.exclude_quote_id != null && String(query.exclude_quote_id).trim() !== ''
    ? parseInt(query.exclude_quote_id, 10)
    : null;
  const itemType = query.item_type && ['product', 'group', 'accessory'].includes(query.item_type)
    ? query.item_type
    : null;
  const limit = query.limit != null ? Math.max(1, Math.min(500, parseInt(query.limit, 10) || 100)) : 0;
  const offset = query.offset != null ? Math.max(0, parseInt(query.offset, 10) || 0) : 0;
  return itemQueries.listItems(db, { search, hidden, category, limit, offset, excludeQuoteId, itemType }, ORG_ID);
}

function bulkUpsertItems(db, payloadItems) {
  const items = Array.isArray(payloadItems) ? payloadItems : [];
  if (!items.length) throw createError(400, 'items array required');

  let created = 0;
  let updated = 0;
  let errors = 0;
  for (const it of items) {
    const {
      title, photo_url, hidden = 0, quantity_in_stock, unit_price,
      category, description, contract_description, taxable, labor_hours,
    } = it;
    if (!title || /^\d+(\.\d+)?$/.test(String(title).trim())) {
      errors += 1;
      continue;
    }
    try {
      const existing = db.prepare('SELECT id FROM items WHERE org_id = ? AND title = ? COLLATE NOCASE').get(ORG_ID, title);
      if (existing) {
        db.prepare(`
          UPDATE items SET
            photo_url = COALESCE(?, photo_url),
            source = 'extension',
            hidden = ?,
            quantity_in_stock = COALESCE(?, quantity_in_stock),
            unit_price = COALESCE(?, unit_price),
            category = COALESCE(?, category),
            description = COALESCE(?, description),
            contract_description = COALESCE(?, contract_description),
            taxable = COALESCE(?, taxable),
            labor_hours = COALESCE(?, labor_hours),
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          photo_url || null, hidden ? 1 : 0,
          quantity_in_stock != null ? quantity_in_stock : null,
          unit_price != null ? unit_price : null,
          category || null, description || null, contract_description || null,
          taxable != null ? (taxable ? 1 : 0) : null,
          labor_hours != null ? labor_hours : null,
          existing.id
        );
        updated += 1;
      } else {
        db.prepare(`
          INSERT INTO items (org_id, title, photo_url, source, hidden, quantity_in_stock, unit_price,
                             category, description, contract_description, taxable, labor_hours)
          VALUES (?, ?, ?, 'extension', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ORG_ID, title, photo_url || null, hidden ? 1 : 0,
          quantity_in_stock != null ? quantity_in_stock : 0,
          unit_price != null ? unit_price : 0,
          category || null, description || null, contract_description || null,
          taxable != null ? (taxable ? 1 : 0) : 1,
          labor_hours != null ? labor_hours : 0
        );
        created += 1;
      }
    } catch (e) {
      errors += 1;
    }
  }
  return { created, updated, errors, total: items.length };
}

function upsertItem(db, body) {
  const {
    title, photo_url, source = 'manual', hidden = 0,
    quantity_in_stock, unit_price, category, description, contract_description, taxable, labor_hours,
  } = body;
  validateTitle(title);

  const existing = db.prepare('SELECT * FROM items WHERE org_id = ? AND title = ? COLLATE NOCASE').get(ORG_ID, title);
  if (existing) {
    db.prepare(`
      UPDATE items SET
        photo_url            = COALESCE(?, photo_url),
        source               = ?,
        hidden               = ?,
        quantity_in_stock    = COALESCE(?, quantity_in_stock),
        unit_price           = COALESCE(?, unit_price),
        category             = COALESCE(?, category),
        description          = COALESCE(?, description),
        contract_description = COALESCE(?, contract_description),
        taxable              = COALESCE(?, taxable),
        labor_hours          = COALESCE(?, labor_hours),
        updated_at           = datetime('now')
      WHERE id = ?
    `).run(
      photo_url || null, source, hidden ? 1 : 0,
      quantity_in_stock != null ? quantity_in_stock : null,
      unit_price != null ? unit_price : null,
      category || null,
      description || null,
      contract_description || null,
      taxable != null ? (taxable ? 1 : 0) : null,
      labor_hours != null ? labor_hours : null,
      existing.id
    );
    return { item: db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(existing.id, ORG_ID), created: false };
  }

  const result = db.prepare(`
    INSERT INTO items (org_id, title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description, contract_description, taxable, labor_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ORG_ID, title, photo_url || null, source, hidden ? 1 : 0,
    quantity_in_stock != null ? quantity_in_stock : 0,
    unit_price != null ? unit_price : 0,
    category || null, description || null, contract_description || null,
    taxable != null ? (taxable ? 1 : 0) : 1,
    labor_hours != null ? labor_hours : 0
  );
  return { item: db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID), created: true };
}

function getItemDetail(db, itemId) {
  const item = itemQueries.getItemById(db, itemId, ORG_ID);
  if (!item) throw createError(404, 'Not found');
  return {
    ...item,
    associations: itemQueries.listItemAssociations(db, item.id),
    quote_history: itemQueries.listItemQuoteHistory(db, item.id),
  };
}

function createItem(db, body) {
  const {
    title, photo_url, source = 'manual', hidden = 0,
    quantity_in_stock = 0, unit_price = 0, category, description, contract_description,
    taxable = 1, labor_hours = 0, is_subrental = 0, vendor_id, item_type = 'product',
  } = body;
  validateTitle(title);

  try {
    const result = db.prepare(`
      INSERT INTO items (org_id, title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description, contract_description, taxable, labor_hours, is_subrental, vendor_id, item_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ORG_ID, title, photo_url || null, source, hidden ? 1 : 0,
      quantity_in_stock, unit_price, category || null, description || null,
      contract_description || null, taxable ? 1 : 0,
      labor_hours != null ? labor_hours : 0,
      is_subrental ? 1 : 0, vendor_id != null ? vendor_id : null,
      item_type || 'product'
    );
    return { item: db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID) };
  } catch (e) {
    if (e.message.includes('UNIQUE')) throw createError(409, 'Title already exists');
    throw createError(500, e.message);
  }
}

function updateItem(db, itemId, body) {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(itemId, ORG_ID);
  if (!item) throw createError(404, 'Not found');
  const {
    title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description,
    contract_description, taxable, labor_hours, is_subrental, vendor_id, item_type,
  } = body;
  db.prepare(`
    UPDATE items SET
      title                = COALESCE(?, title),
      photo_url            = COALESCE(?, photo_url),
      source               = COALESCE(?, source),
      hidden               = COALESCE(?, hidden),
      quantity_in_stock    = COALESCE(?, quantity_in_stock),
      unit_price           = COALESCE(?, unit_price),
      category             = COALESCE(?, category),
      description          = COALESCE(?, description),
      contract_description = COALESCE(?, contract_description),
      taxable              = COALESCE(?, taxable),
      labor_hours          = COALESCE(?, labor_hours),
      is_subrental         = COALESCE(?, is_subrental),
      vendor_id            = COALESCE(?, vendor_id),
      item_type            = COALESCE(?, item_type),
      updated_at           = datetime('now')
    WHERE id = ? AND org_id = ?
  `).run(
    title || null,
    photo_url !== undefined ? photo_url : null,
    source || null,
    hidden !== undefined ? (hidden ? 1 : 0) : null,
    quantity_in_stock != null ? quantity_in_stock : null,
    unit_price != null ? unit_price : null,
    category !== undefined ? (category || null) : null,
    description !== undefined ? (description || null) : null,
    contract_description !== undefined ? (contract_description || null) : null,
    taxable != null ? (taxable ? 1 : 0) : null,
    labor_hours !== undefined ? (labor_hours != null ? labor_hours : 0) : null,
    is_subrental !== undefined ? (is_subrental ? 1 : 0) : null,
    vendor_id !== undefined ? (vendor_id != null ? vendor_id : null) : null,
    item_type || null,
    itemId,
    ORG_ID
  );
  return { item: db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(itemId, ORG_ID) };
}

function deleteItem(db, itemId) {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(itemId, ORG_ID);
  if (!item) throw createError(404, 'Not found');
  db.prepare('DELETE FROM items WHERE id = ? AND org_id = ?').run(itemId, ORG_ID);
  return { deleted: true };
}

function listAccessories(db, itemId) {
  return { items: itemQueries.listItemAccessories(db, itemId) };
}

function addAccessory(db, itemId, accessoryId) {
  if (!accessoryId) throw createError(400, 'accessory_id required');
  try {
    db.prepare('INSERT OR IGNORE INTO item_accessories (item_id, accessory_id) VALUES (?, ?)').run(itemId, accessoryId);
    return { ok: true };
  } catch (e) {
    throw createError(400, e.message);
  }
}

function deleteAccessory(db, itemId, accessoryId) {
  db.prepare('DELETE FROM item_accessories WHERE item_id = ? AND accessory_id = ?').run(itemId, accessoryId);
  return { deleted: true };
}

function listAssociations(db, itemId) {
  return { items: itemQueries.listItemAssociations(db, itemId) };
}

function addAssociation(db, itemId, childId) {
  if (!childId) throw createError(400, 'child_id required');
  try {
    db.prepare('INSERT OR IGNORE INTO item_associations (parent_id, child_id) VALUES (?, ?)').run(itemId, childId);
    return { ok: true };
  } catch (e) {
    throw createError(400, e.message);
  }
}

function deleteAssociation(db, itemId, childId) {
  db.prepare('DELETE FROM item_associations WHERE parent_id = ? AND child_id = ?').run(itemId, childId);
  return { deleted: true };
}

module.exports = {
  listCategories,
  listPopularCategories,
  listCatalog,
  bulkUpsertItems,
  upsertItem,
  getItemDetail,
  createItem,
  updateItem,
  deleteItem,
  listAccessories,
  addAccessory,
  deleteAccessory,
  listAssociations,
  addAssociation,
  deleteAssociation,
};
