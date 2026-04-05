const itemQueries = require('../db/queries/items');
const { generateItemDescription } = require('./agent/itemDescriptionService');
const { ensureItemScanCode } = require('./scanCodeService');
const { recalculateItemSalesStats, getItemStats } = require('./itemStatsService');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapItemWriteError(error) {
  if (String(error?.message || '').includes('UNIQUE')) {
    if (String(error.message).includes('serial_number')) return createError(409, 'Serial number already exists');
    return createError(409, 'Title already exists');
  }
  return createError(500, error?.message || 'Item write failed');
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
  const searchMode = String(query.search_mode || 'loose').trim().toLowerCase() === 'exact' ? 'exact' : 'loose';
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
  const result = itemQueries.listItems(db, { search, searchMode, hidden, category, limit, offset, excludeQuoteId, itemType }, ORG_ID);
  return {
    ...result,
    items: (result.items || []).map((item) => ({
      ...item,
      scan_code: item.scan_code || ensureItemScanCode(db, item.id),
    })),
  };
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
      category, description, contract_description, taxable, labor_hours, internal_notes, serial_number,
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
            internal_notes = COALESCE(?, internal_notes),
            serial_number = COALESCE(?, serial_number),
            taxable = COALESCE(?, taxable),
            labor_hours = COALESCE(?, labor_hours),
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          photo_url || null, hidden ? 1 : 0,
          quantity_in_stock != null ? quantity_in_stock : null,
          unit_price != null ? unit_price : null,
          category || null, description || null, contract_description || null,
          internal_notes || null,
          serial_number || null,
          taxable != null ? (taxable ? 1 : 0) : null,
          labor_hours != null ? labor_hours : null,
          existing.id
        );
        updated += 1;
      } else {
        db.prepare(`
          INSERT INTO items (org_id, title, photo_url, source, hidden, quantity_in_stock, unit_price,
                             category, description, contract_description, internal_notes, serial_number, taxable, labor_hours)
          VALUES (?, ?, ?, 'extension', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ORG_ID, title, photo_url || null, hidden ? 1 : 0,
          quantity_in_stock != null ? quantity_in_stock : 0,
          unit_price != null ? unit_price : 0,
          category || null, description || null, contract_description || null, internal_notes || null, serial_number || null,
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
    quantity_in_stock, unit_price, category, description, contract_description, internal_notes, serial_number, taxable, labor_hours,
  } = body;
  validateTitle(title);

  const existing = db.prepare('SELECT * FROM items WHERE org_id = ? AND title = ? COLLATE NOCASE').get(ORG_ID, title);
  if (existing) {
    try {
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
          internal_notes       = COALESCE(?, internal_notes),
          serial_number        = COALESCE(?, serial_number),
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
        internal_notes || null,
        serial_number || null,
        taxable != null ? (taxable ? 1 : 0) : null,
        labor_hours != null ? labor_hours : null,
        existing.id
      );
    } catch (error) {
      throw mapItemWriteError(error);
    }
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(existing.id, ORG_ID);
    return { item: { ...item, scan_code: ensureItemScanCode(db, existing.id) }, created: false };
  }

  let result;
  try {
    result = db.prepare(`
      INSERT INTO items (org_id, title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description, contract_description, internal_notes, serial_number, taxable, labor_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ORG_ID, title, photo_url || null, source, hidden ? 1 : 0,
      quantity_in_stock != null ? quantity_in_stock : 0,
      unit_price != null ? unit_price : 0,
      category || null, description || null, contract_description || null, internal_notes || null, serial_number || null,
      taxable != null ? (taxable ? 1 : 0) : 1,
      labor_hours != null ? labor_hours : 0
    );
  } catch (error) {
    throw mapItemWriteError(error);
  }
  {
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID);
    return { item: { ...item, scan_code: ensureItemScanCode(db, result.lastInsertRowid) }, created: true };
  }
}

function getItemDetail(db, itemId) {
  const item = itemQueries.getItemById(db, itemId, ORG_ID);
  if (!item) throw createError(404, 'Not found');
  const scanCode = ensureItemScanCode(db, item.id);
  recalculateItemSalesStats(db, item.id);
  return {
    ...item,
    scan_code: scanCode,
    stats: getItemStats(db, item.id),
    associations: itemQueries.listItemAssociations(db, item.id),
    quote_history: itemQueries.listItemQuoteHistory(db, item.id),
  };
}

async function generateDescriptionPreview(db, body) {
  const itemId = parsePositiveInt(body && body.item_id);
  const existing = itemId ? itemQueries.getItemById(db, itemId, ORG_ID) : null;
  if (itemId && !existing) throw createError(404, 'Item not found');

  const merged = {
    id: existing ? Number(existing.id) : null,
    title: body?.title !== undefined ? String(body.title || '').trim() : String(existing?.title || '').trim(),
    photo_url: body?.photo_url !== undefined ? String(body.photo_url || '').trim() : String(existing?.photo_url || '').trim(),
    source: body?.source !== undefined ? String(body.source || '').trim() : String(existing?.source || '').trim(),
    hidden: body?.hidden !== undefined ? (body.hidden ? 1 : 0) : Number(existing?.hidden || 0),
    quantity_in_stock: body?.quantity_in_stock !== undefined ? Number(body.quantity_in_stock || 0) : Number(existing?.quantity_in_stock || 0),
    unit_price: body?.unit_price !== undefined ? Number(body.unit_price || 0) : Number(existing?.unit_price || 0),
    category: body?.category !== undefined ? String(body.category || '').trim() : String(existing?.category || '').trim(),
    description: body?.description !== undefined ? String(body.description || '').trim() : String(existing?.description || '').trim(),
    internal_notes: body?.internal_notes !== undefined ? String(body.internal_notes || '').trim() : String(existing?.internal_notes || '').trim(),
    taxable: body?.taxable !== undefined ? (body.taxable ? 1 : 0) : Number(existing?.taxable ?? 1),
    item_type: body?.item_type !== undefined ? String(body.item_type || '').trim() : String(existing?.item_type || 'product').trim(),
    is_subrental: body?.is_subrental !== undefined ? (body.is_subrental ? 1 : 0) : Number(existing?.is_subrental || 0),
  };

  validateTitle(merged.title);

  const accessories = existing ? itemQueries.listItemAccessories(db, existing.id) : [];
  const associations = existing ? itemQueries.listItemAssociations(db, existing.id) : [];

  return generateItemDescription(db, {
    item: merged,
    accessories,
    associations,
    controls: {
      stylePreset: body?.style_preset,
      personaPreset: body?.persona_preset,
      variationLevel: body?.variation_level,
      customInstructions: body?.custom_instructions,
    },
  });
}

function createItem(db, body) {
  const {
    title, photo_url, source = 'manual', hidden = 0,
    quantity_in_stock = 0, unit_price = 0, category, description, contract_description,
    internal_notes, serial_number, taxable = 1, labor_hours = 0, is_subrental = 0, vendor_id, item_type = 'product',
  } = body;
  validateTitle(title);

  try {
    const result = db.prepare(`
      INSERT INTO items (org_id, title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description, contract_description, internal_notes, serial_number, taxable, labor_hours, is_subrental, vendor_id, item_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ORG_ID, title, photo_url || null, source, hidden ? 1 : 0,
      quantity_in_stock, unit_price, category || null, description || null,
      contract_description || null, internal_notes || null, serial_number || null, taxable ? 1 : 0,
      labor_hours != null ? labor_hours : 0,
      is_subrental ? 1 : 0, vendor_id != null ? vendor_id : null,
      item_type || 'product'
    );
    {
      const item = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(result.lastInsertRowid, ORG_ID);
      return { item: { ...item, scan_code: ensureItemScanCode(db, result.lastInsertRowid) } };
    }
  } catch (e) {
    throw mapItemWriteError(e);
  }
}

function updateItem(db, itemId, body) {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(itemId, ORG_ID);
  if (!item) throw createError(404, 'Not found');
  const {
    title, photo_url, source, hidden, quantity_in_stock, unit_price, category, description,
    contract_description, internal_notes, serial_number, taxable, labor_hours, is_subrental, vendor_id, item_type,
  } = body;
  try {
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
        internal_notes       = COALESCE(?, internal_notes),
        serial_number        = COALESCE(?, serial_number),
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
      internal_notes !== undefined ? (internal_notes || null) : null,
      serial_number !== undefined ? (serial_number || null) : null,
      taxable != null ? (taxable ? 1 : 0) : null,
      labor_hours !== undefined ? (labor_hours != null ? labor_hours : 0) : null,
      is_subrental !== undefined ? (is_subrental ? 1 : 0) : null,
      vendor_id !== undefined ? (vendor_id != null ? vendor_id : null) : null,
      item_type || null,
      itemId,
      ORG_ID
    );
  } catch (error) {
    throw mapItemWriteError(error);
  }
  {
    const nextItem = db.prepare('SELECT * FROM items WHERE id = ? AND org_id = ?').get(itemId, ORG_ID);
    return { item: { ...nextItem, scan_code: ensureItemScanCode(db, itemId) } };
  }
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
  generateDescriptionPreview,
  listAccessories,
  addAccessory,
  deleteAccessory,
  listAssociations,
  addAssociation,
  deleteAssociation,
};
