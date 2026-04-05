const DEFAULT_ORG_ID = 1;

function normalizeDimensionSearchToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[’”″]/g, '')
    .replace(/\b(ft|feet|foot)\b/g, '')
    .replace(/\b(in|inch|inches)\b/g, '')
    .replace(/\s*x\s*/g, 'x')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizedSearchSql(columnSql) {
  return `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${columnSql}, ''), ' ', ''), '-', ''), '"', ''), '\'', ''), '’', ''), '″', ''), '.', ''), ',', ''), '(', ''), ')', ''))`;
}

function buildSearchPlan(search) {
  const raw = String(search || '').trim();
  if (!raw) {
    return {
      raw,
      compact: '',
      normalizedFull: '',
      phrasePatterns: [],
      normalizedPattern: '',
      normalizedTokens: [],
    };
  }
  const compact = raw.replace(/\s+/g, ' ').trim();
  const dequoted = compact.replace(/["']/g, '').replace(/[’”″]/g, '').trim();
  const collapsedX = dequoted.replace(/\s*x\s*/gi, 'x');
  const spacedX = dequoted.replace(/\s*x\s*/gi, ' x ');
  const candidates = [raw, compact, dequoted, collapsedX, spacedX]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const normalizedFull = normalizeDimensionSearchToken(raw);
  const normalizedTokens = Array.from(new Set(
    normalizedFull
      .split(/x|(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/g)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
  ));
  return {
    raw,
    compact,
    normalizedFull,
    phrasePatterns: Array.from(new Set(candidates)).map((value) => `%${value}%`),
    normalizedPattern: normalizedFull ? `%${normalizedFull}%` : '',
    normalizedTokens,
  };
}

function buildInventorySearchClause(searchPlan, searchMode = 'loose') {
  const titleNormalized = normalizedSearchSql('items.title');
  const categoryNormalized = normalizedSearchSql('items.category');
  const descriptionNormalized = normalizedSearchSql('items.description');
  const exactMode = String(searchMode || 'loose').trim().toLowerCase() === 'exact';

  const params = [];
  const orClauses = [];

  if (searchPlan.phrasePatterns.length > 0) {
    const phraseClauses = [
      ...searchPlan.phrasePatterns.map(() => 'items.title LIKE ?'),
    ];
    if (!exactMode) {
      phraseClauses.push(...searchPlan.phrasePatterns.map(() => 'COALESCE(items.category, \'\') LIKE ?'));
      phraseClauses.push(...searchPlan.phrasePatterns.map(() => 'COALESCE(items.description, \'\') LIKE ?'));
    }
    orClauses.push(`(${phraseClauses.join(' OR ')})`);
    params.push(...searchPlan.phrasePatterns);
    if (!exactMode) {
      params.push(...searchPlan.phrasePatterns);
      params.push(...searchPlan.phrasePatterns);
    }
  }

  if (searchPlan.normalizedPattern) {
    if (exactMode) {
      orClauses.push(`(${titleNormalized} LIKE ?)`);
      params.push(searchPlan.normalizedPattern);
    } else {
      orClauses.push(`(${titleNormalized} LIKE ? OR ${categoryNormalized} LIKE ? OR ${descriptionNormalized} LIKE ?)`);
      params.push(searchPlan.normalizedPattern, searchPlan.normalizedPattern, searchPlan.normalizedPattern);
    }
  }

  if (!exactMode && searchPlan.normalizedTokens.length > 0) {
    const tokenClauses = searchPlan.normalizedTokens.map(() => `(${titleNormalized} LIKE ? OR ${categoryNormalized} LIKE ? OR ${descriptionNormalized} LIKE ?)`);
    orClauses.push(`(${tokenClauses.join(' AND ')})`);
    searchPlan.normalizedTokens.forEach((token) => {
      const pattern = `%${token}%`;
      params.push(pattern, pattern, pattern);
    });
  }

  return {
    clause: orClauses.length > 0 ? ` AND (${orClauses.join(' OR ')})` : '',
    params,
  };
}

function buildInventorySearchOrder(searchPlan, searchMode = 'loose') {
  const exactMode = String(searchMode || 'loose').trim().toLowerCase() === 'exact';
  if (exactMode || !searchPlan.raw) return { clause: 'items.title ASC', params: [] };

  const titleNormalized = normalizedSearchSql('items.title');
  const raw = searchPlan.raw;
  const compact = searchPlan.compact || raw;
  const normalizedFull = searchPlan.normalizedFull || '';
  const prefixRaw = `${raw}%`;
  const prefixCompact = `${compact}%`;
  const prefixNormalized = normalizedFull ? `${normalizedFull}%` : '';

  const clause = `
    CASE
      WHEN LOWER(COALESCE(items.title, '')) = LOWER(?) THEN 0
      WHEN LOWER(COALESCE(items.title, '')) = LOWER(?) THEN 1
      WHEN ${titleNormalized} = ? THEN 2
      WHEN LOWER(COALESCE(items.title, '')) LIKE LOWER(?) THEN 3
      WHEN LOWER(COALESCE(items.title, '')) LIKE LOWER(?) THEN 4
      WHEN ${titleNormalized} LIKE ? THEN 5
      WHEN LOWER(COALESCE(items.title, '')) LIKE LOWER(?) THEN 6
      WHEN ${titleNormalized} LIKE ? THEN 7
      WHEN COALESCE(items.category, '') LIKE ? THEN 8
      WHEN COALESCE(items.description, '') LIKE ? THEN 9
      ELSE 10
    END,
    LENGTH(COALESCE(items.title, '')) ASC,
    items.title ASC
  `;

  return {
    clause,
    params: [
      raw,
      compact,
      normalizedFull,
      prefixRaw,
      prefixCompact,
      prefixNormalized || prefixCompact,
      `%${raw}%`,
      searchPlan.normalizedPattern || `%${normalizeDimensionSearchToken(raw)}%`,
      `%${compact}%`,
      `%${compact}%`,
    ],
  };
}

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

function listItems(db, { search, searchMode, hidden, category, limit, offset, excludeQuoteId, itemType }, orgId = DEFAULT_ORG_ID) {
  let query = `
    SELECT items.*,
      (SELECT COALESCE(SUM(qi.quantity),0) FROM quote_items qi
       WHERE qi.item_id = items.id) AS quantity_going_out
      ,
      (SELECT COALESCE(SUM(isa.quantity),0) FROM item_set_asides isa
       WHERE isa.item_id = items.id AND isa.resolved_at IS NULL) AS quantity_set_aside
    FROM items WHERE org_id = ?
  `;
  const params = [orgId];
  const searchPlan = buildSearchPlan(search);
  const searchClause = buildInventorySearchClause(searchPlan, searchMode);
  const searchOrder = buildInventorySearchOrder(searchPlan, searchMode);

  if (search) {
    query += searchClause.clause;
    params.push(...searchClause.params);
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
    countQuery += searchClause.clause;
    countParams.push(...searchClause.params);
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
  query += ` ORDER BY ${searchOrder.clause}`;
  params.push(...searchOrder.params);
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
       WHERE qi.item_id = items.id) AS quantity_going_out,
      (SELECT COALESCE(SUM(isa.quantity),0) FROM item_set_asides isa
       WHERE isa.item_id = items.id AND isa.resolved_at IS NULL) AS quantity_set_aside
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
