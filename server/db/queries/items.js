const DEFAULT_ORG_ID = 1;

function listDistinctCategories(db, orgId = DEFAULT_ORG_ID) {
  const rows = db.prepare(
    "SELECT DISTINCT category FROM items WHERE org_id = ? AND category IS NOT NULL AND category != '' ORDER BY category"
  ).all(orgId);
  return rows.map((r) => r.category);
}

function listPopularCategories(db, limit, orgId = DEFAULT_ORG_ID) {
  const rows = db.prepare(`
    SELECT i.category,
           COALESCE(SUM(s.times_quoted), 0) AS usage_count
    FROM items i
    LEFT JOIN item_stats s ON s.item_id = i.id
    WHERE i.org_id = ? AND i.category IS NOT NULL AND i.category != ''
    GROUP BY i.category
    ORDER BY usage_count DESC, i.category ASC
    LIMIT ?
  `).all(orgId, limit);
  return rows.map((r) => r.category);
}

function listItems(db, { search, hidden, category, limit, offset, excludeQuoteId, itemType }, orgId = DEFAULT_ORG_ID) {
  let query = `
    SELECT items.*,
      (SELECT COALESCE(SUM(qi.quantity),0) FROM quote_items qi
       WHERE qi.item_id = items.id) AS quantity_going_out
    FROM items WHERE org_id = ?
  `;
  const params = [orgId];

  if (search) {
    query += ' AND items.title LIKE ?';
    params.push(`%${search}%`);
  }
  if (hidden !== undefined) {
    query += ' AND items.hidden = ?';
    params.push(hidden === '1' ? 1 : 0);
  }
  if (category) {
    query += " AND LOWER(TRIM(COALESCE(items.category, ''))) = LOWER(?)";
    params.push(category);
  }
  if (excludeQuoteId != null && !Number.isNaN(excludeQuoteId)) {
    query += ' AND items.id NOT IN (SELECT item_id FROM quote_items WHERE quote_id = ?)';
    params.push(excludeQuoteId);
  }
  if (itemType) {
    query += " AND COALESCE(items.item_type, 'product') = ?";
    params.push(itemType);
  }

  let countQuery = 'SELECT COUNT(*) AS n FROM items WHERE org_id = ?';
  const countParams = [orgId];
  if (search) {
    countQuery += ' AND items.title LIKE ?';
    countParams.push(`%${search}%`);
  }
  if (hidden !== undefined) {
    countQuery += ' AND items.hidden = ?';
    countParams.push(hidden === '1' ? 1 : 0);
  }
  if (category) {
    countQuery += " AND LOWER(TRIM(COALESCE(items.category, ''))) = LOWER(?)";
    countParams.push(category);
  }
  if (excludeQuoteId != null && !Number.isNaN(excludeQuoteId)) {
    countQuery += ' AND items.id NOT IN (SELECT item_id FROM quote_items WHERE quote_id = ?)';
    countParams.push(excludeQuoteId);
  }
  if (itemType) {
    countQuery += " AND COALESCE(items.item_type, 'product') = ?";
    countParams.push(itemType);
  }

  const total = db.prepare(countQuery).get(...countParams).n;
  query += ' ORDER BY items.title ASC';
  if (limit > 0) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }
  const items = db.prepare(query).all(...params);
  return { items, total };
}

function getItemById(db, itemId, orgId = DEFAULT_ORG_ID) {
  return db.prepare(`
    SELECT items.*,
      (SELECT COALESCE(SUM(qi.quantity),0) FROM quote_items qi
       WHERE qi.item_id = items.id) AS quantity_going_out
    FROM items WHERE items.id = ? AND items.org_id = ?
  `).get(itemId, orgId) || null;
}

function listItemAssociations(db, itemId) {
  return db.prepare(`
    SELECT i.* FROM items i
    JOIN item_associations ia ON ia.child_id = i.id
    WHERE ia.parent_id = ?
    ORDER BY i.title ASC
  `).all(itemId);
}

function listItemAccessories(db, itemId) {
  return db.prepare(`
    SELECT i.* FROM items i
    JOIN item_accessories ia ON ia.accessory_id = i.id
    WHERE ia.item_id = ?
    ORDER BY i.title ASC
  `).all(itemId);
}

function listItemQuoteHistory(db, itemId) {
  return db.prepare(`
    SELECT q.id, q.name, q.event_date, qi.quantity, qi.label
    FROM quotes q JOIN quote_items qi ON qi.quote_id = q.id
    WHERE qi.item_id = ?
    ORDER BY q.created_at DESC LIMIT 20
  `).all(itemId);
}

module.exports = {
  listDistinctCategories,
  listPopularCategories,
  listItems,
  getItemById,
  listItemAssociations,
  listItemAccessories,
  listItemQuoteHistory,
};
