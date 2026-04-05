const { getSettingValue } = require('../db/queries/settings');
const quoteFulfillmentService = require('./quoteFulfillmentService');
const rustEngineClient = require('./rustEngineClient');

function getQuoteMeta(db, quoteId) {
  const row = db.prepare(`
    SELECT id, name, status, event_date, delivery_date, rental_start, rental_end, pickup_date
    FROM quotes
    WHERE id = ?
  `).get(quoteId);
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.name || `Quote ${row.id}`),
    status: String(row.status || 'draft'),
    event_date: row.event_date || null,
    delivery_date: row.delivery_date || null,
    rental_start: row.rental_start || null,
    rental_end: row.rental_end || null,
    pickup_date: row.pickup_date || null,
  };
}

function getSectionMeta(db, quoteId, sectionId) {
  if (sectionId == null || sectionId === '') return null;
  const row = db.prepare(`
    SELECT id, quote_id, title, delivery_date, rental_start, rental_end, pickup_date
    FROM quote_item_sections
    WHERE id = ? AND quote_id = ?
  `).get(sectionId, quoteId);
  if (!row) return null;
  return {
    id: Number(row.id),
    quote_id: Number(row.quote_id),
    title: String(row.title || `Section ${row.id}`),
    delivery_date: row.delivery_date || null,
    rental_start: row.rental_start || null,
    rental_end: row.rental_end || null,
    pickup_date: row.pickup_date || null,
    range: getRangeFromSource(row),
  };
}

function getItemMetaMap(db, itemIds) {
  const ids = Array.isArray(itemIds) ? itemIds.map((value) => Number(value)).filter(Boolean) : [];
  if (!ids.length) return {};
  const rows = db.prepare(`
    SELECT id, title, category
    FROM items
    WHERE id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);
  return rows.reduce((acc, row) => {
    acc[Number(row.id)] = {
      id: Number(row.id),
      title: String(row.title || `Item ${row.id}`),
      category: row.category || null,
    };
    return acc;
  }, {});
}

function getRangeFromSource(source) {
  const dates = [];
  if (source?.delivery_date) dates.push(source.delivery_date);
  if (source?.rental_start) dates.push(source.rental_start);
  if (source?.rental_end) dates.push(source.rental_end);
  if (source?.pickup_date) dates.push(source.pickup_date);
  if (dates.length === 0 && source?.event_date) dates.push(source.event_date);
  if (dates.length === 0) return null;
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

function rangesOverlap(a, b) {
  if (!a || !b) return false;
  return a.start <= b.end && a.end >= b.start;
}

function isQuoteReserved(quote) {
  const status = quote.status || 'draft';
  if (status === 'confirmed') return true;
  if (status === 'closed') return false;
  return quote.signed_at != null && quote.signed_at !== '';
}

function getOosSetting(db) {
  return getSettingValue(db, 'count_oos_oversold', '0') === '1';
}

function getActiveSetAsideQuantities(db, itemIds) {
  if (!itemIds.length) return new Map();
  const rows = db.prepare(`
    SELECT item_id, COALESCE(SUM(quantity), 0) AS quantity
    FROM item_set_asides
    WHERE resolved_at IS NULL
      AND item_id IN (${itemIds.map(() => '?').join(',')})
    GROUP BY item_id
  `).all(...itemIds);
  return new Map(rows.map((row) => [Number(row.item_id), Number(row.quantity || 0)]));
}

function loadCurrentItemEntries(db, quoteIds, itemIds) {
  if (!quoteIds.length || !itemIds.length) return {};
  const quotePlaceholders = quoteIds.map(() => '?').join(',');
  const itemPlaceholders = itemIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT
      qi.quote_id,
      qi.item_id,
      qi.section_id,
      qi.quantity,
      q.event_date,
      q.delivery_date AS quote_delivery_date,
      q.rental_start AS quote_rental_start,
      q.rental_end AS quote_rental_end,
      q.pickup_date AS quote_pickup_date,
      s.delivery_date AS section_delivery_date,
      s.rental_start AS section_rental_start,
      s.rental_end AS section_rental_end,
      s.pickup_date AS section_pickup_date
    FROM quote_items qi
    JOIN quotes q ON q.id = qi.quote_id
    LEFT JOIN quote_item_sections s ON s.id = qi.section_id
    WHERE qi.quote_id IN (${quotePlaceholders}) AND qi.item_id IN (${itemPlaceholders})
  `).all(...quoteIds, ...itemIds);

  const grouped = {};
  rows.forEach((row) => {
    const source = row.section_id != null ? {
      delivery_date: row.section_delivery_date,
      rental_start: row.section_rental_start,
      rental_end: row.section_rental_end,
      pickup_date: row.section_pickup_date,
    } : {
      delivery_date: row.quote_delivery_date,
      rental_start: row.quote_rental_start,
      rental_end: row.quote_rental_end,
      pickup_date: row.quote_pickup_date,
      event_date: row.event_date,
    };
    const range = getRangeFromSource(source) || getRangeFromSource({
      delivery_date: row.quote_delivery_date,
      rental_start: row.quote_rental_start,
      rental_end: row.quote_rental_end,
      pickup_date: row.quote_pickup_date,
      event_date: row.event_date,
    });
    if (!grouped[row.quote_id]) grouped[row.quote_id] = [];
    grouped[row.quote_id].push({
      item_id: Number(row.item_id),
      section_id: row.section_id != null ? Number(row.section_id) : null,
      quantity: Number(row.quantity || 1),
      range,
    });
  });
  return grouped;
}

function loadLatestSignedSnapshotEntries(db, quoteIds, itemIds) {
  if (!quoteIds.length || !itemIds.length) return {};
  const quotePlaceholders = quoteIds.map(() => '?').join(',');
  const itemPlaceholders = itemIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT csi.quote_id, csi.item_id, csi.section_id, csi.quantity, csi.range_start, csi.range_end
    FROM contract_signature_items csi
    JOIN (
      SELECT quote_id, MAX(signature_event_id) AS signature_event_id
      FROM contract_signature_items
      WHERE quote_id IN (${quotePlaceholders})
      GROUP BY quote_id
    ) latest
      ON latest.quote_id = csi.quote_id
     AND latest.signature_event_id = csi.signature_event_id
    WHERE csi.item_id IN (${itemPlaceholders})
  `).all(...quoteIds, ...itemIds);

  const grouped = {};
  rows.forEach((row) => {
    if (!grouped[row.quote_id]) grouped[row.quote_id] = [];
    grouped[row.quote_id].push({
      item_id: Number(row.item_id),
      section_id: row.section_id != null ? Number(row.section_id) : null,
      quantity: Number(row.quantity || 1),
      range: row.range_start && row.range_end ? { start: row.range_start, end: row.range_end } : null,
    });
  });
  return grouped;
}

function aggregateEntriesByItemAndSection(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const key = `${entry.item_id}::${entry.section_id == null ? 'null' : entry.section_id}`;
    const existing = map.get(key);
    if (existing) existing.quantity += entry.quantity || 0;
    else map.set(key, { ...entry });
  });
  return map;
}

function buildQuoteReservationEntries(db, quotes, itemIds) {
  const quoteIds = quotes.map((quote) => Number(quote.id));
  const currentEntriesByQuote = loadCurrentItemEntries(db, quoteIds, itemIds);
  const signedEntriesByQuote = loadLatestSignedSnapshotEntries(db, quoteIds, itemIds);
  const fulfillmentEntriesByQuote = quoteFulfillmentService.getOutstandingFulfillmentRowsByQuoteAndItems(db, quoteIds, itemIds);
  const result = {};

  quotes.forEach((quote) => {
    const quoteId = Number(quote.id);
    const currentEntries = currentEntriesByQuote[quoteId] || [];
    const signedEntries = signedEntriesByQuote[quoteId] || [];
    const hasUnsignedChanges = Number(quote.has_unsigned_changes || 0) === 1;

    if (hasUnsignedChanges) {
      const signedMap = aggregateEntriesByItemAndSection(signedEntries);
      const currentMap = aggregateEntriesByItemAndSection(currentEntries);
      const fulfillmentEntries = fulfillmentEntriesByQuote[quoteId] || [];
      const reservedEntries = fulfillmentEntries.length ? fulfillmentEntries : (signedMap.size ? Array.from(signedMap.values()) : currentEntries);
      const potentialEntries = [];
      currentMap.forEach((entry, key) => {
        const signedQty = signedMap.get(key)?.quantity || 0;
        const delta = Math.max(0, (entry.quantity || 0) - signedQty);
        if (delta > 0) potentialEntries.push({ ...entry, quantity: delta });
      });
      result[quoteId] = { reserved: reservedEntries, potential: potentialEntries };
      return;
    }

    const fulfillmentEntries = fulfillmentEntriesByQuote[quoteId] || [];
    if (fulfillmentEntries.length) {
      result[quoteId] = { reserved: fulfillmentEntries, potential: [] };
      return;
    }

    result[quoteId] = isQuoteReserved(quote)
      ? { reserved: currentEntries, potential: [] }
      : { reserved: [], potential: currentEntries };
  });

  return result;
}

function sumOverlappingQuantity(entries, itemId, targetRange) {
  return entries.reduce((total, entry) => {
    if (entry.item_id !== Number(itemId)) return total;
    if (!rangesOverlap(targetRange, entry.range)) return total;
    return total + Number(entry.quantity || 0);
  }, 0);
}

function getTargetRangeForQuote(db, quoteId, sectionId) {
  const quote = db.prepare(`
    SELECT q.*, c.signed_at
    FROM quotes q
    LEFT JOIN contracts c ON c.quote_id = q.id
    WHERE q.id = ?
  `).get(quoteId);
  if (!quote) return { quote: null, range: null };
  if (sectionId != null) {
    const section = db.prepare(`
      SELECT id, quote_id, delivery_date, rental_start, rental_end, pickup_date
      FROM quote_item_sections
      WHERE id = ? AND quote_id = ?
    `).get(sectionId, quoteId);
    if (section) return { quote, range: getRangeFromSource(section) || getRangeFromSource(quote) };
  }
  return { quote, range: getRangeFromSource(quote) };
}

function legacyQuoteItems(db, quoteId, itemIds, sectionId = null) {
  const { quote: targetQuote, range: targetRange } = getTargetRangeForQuote(db, quoteId, sectionId);
  if (!targetQuote) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }
  const itemPlaceholders = itemIds.map(() => '?').join(',');
  const itemRows = db.prepare(`SELECT id, quantity_in_stock FROM items WHERE id IN (${itemPlaceholders})`).all(...itemIds);
  const setAsideMap = getActiveSetAsideQuantities(db, itemIds);
  if (!targetRange) {
    const out = {};
    itemRows.forEach((row) => {
      const setAsideQty = Number(setAsideMap.get(Number(row.id)) || 0);
      out[row.id] = { stock: Math.max(0, (row.quantity_in_stock || 0) - setAsideQty), reserved_qty: 0, potential_qty: 0, set_aside_qty: setAsideQty };
    });
    return out;
  }
  const otherQuotes = db.prepare(`
    SELECT DISTINCT q.id, q.name, q.event_date, q.rental_start, q.rental_end,
           q.delivery_date, q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
    FROM quotes q
    JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN contracts c ON c.quote_id = q.id
    WHERE q.id != ? AND qi.item_id IN (${itemPlaceholders})
      AND COALESCE(q.status, 'draft') != 'closed'
  `).all(quoteId, ...itemIds);
  const reservationEntries = buildQuoteReservationEntries(db, otherQuotes, itemIds);
  const result = {};
  itemRows.forEach((row) => {
    let reservedQty = 0;
    let potentialQty = 0;
    otherQuotes.forEach((otherQuote) => {
      const entries = reservationEntries[otherQuote.id] || { reserved: [], potential: [] };
      reservedQty += sumOverlappingQuantity(entries.reserved, row.id, targetRange);
      potentialQty += sumOverlappingQuantity(entries.potential, row.id, targetRange);
    });
    result[row.id] = {
      stock: Math.max(0, (row.quantity_in_stock || 0) - Number(setAsideMap.get(Number(row.id)) || 0)),
      reserved_qty: reservedQty,
      potential_qty: potentialQty,
      set_aside_qty: Number(setAsideMap.get(Number(row.id)) || 0),
    };
  });
  return result;
}

function legacyQuoteSummary(db, quoteId) {
  const targetQuote = db.prepare(`
    SELECT q.*, c.signed_at
    FROM quotes q
    LEFT JOIN contracts c ON c.quote_id = q.id
    WHERE q.id = ?
  `).get(quoteId);
  if (!targetQuote) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }
  const targetQuoteRange = getRangeFromSource(targetQuote);
  if (!targetQuoteRange) return { hasRange: false, conflicts: {} };
  const targetItems = db.prepare(`
    SELECT
      qi.item_id,
      qi.quantity,
      qi.section_id,
      i.quantity_in_stock,
      i.title,
      s.delivery_date AS section_delivery_date,
      s.rental_start AS section_rental_start,
      s.rental_end AS section_rental_end,
      s.pickup_date AS section_pickup_date
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    LEFT JOIN quote_item_sections s ON s.id = qi.section_id
    WHERE qi.quote_id = ?
  `).all(quoteId);
  if (!targetItems.length) return { hasRange: true, conflicts: {} };
  const countOos = getOosSetting(db);
  const itemIds = Array.from(new Set(targetItems.map((item) => Number(item.item_id))));
  const setAsideMap = getActiveSetAsideQuantities(db, itemIds);
  const itemPlaceholders = itemIds.map(() => '?').join(',');
  const otherQuotes = db.prepare(`
    SELECT DISTINCT q.id, q.name, q.event_date, q.rental_start, q.rental_end,
           q.delivery_date, q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
    FROM quotes q
    JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN contracts c ON c.quote_id = q.id
    WHERE q.id != ? AND qi.item_id IN (${itemPlaceholders})
      AND COALESCE(q.status, 'draft') != 'closed'
  `).all(quoteId, ...itemIds);
  const reservationEntries = buildQuoteReservationEntries(db, otherQuotes, itemIds);
  const conflicts = {};
  itemIds.forEach((itemId) => {
    const rows = targetItems.filter((item) => Number(item.item_id) === Number(itemId));
    const setAsideQty = Number(setAsideMap.get(Number(itemId)) || 0);
    const stock = Math.max(0, Number(rows[0]?.quantity_in_stock || 0) - setAsideQty);
    const myQty = rows.reduce((total, row) => total + Number(row.quantity || 1), 0);
    if (countOos && stock === 0) {
      conflicts[itemId] = { status: 'reserved', reason: 'oos', reserved_qty: 0, potential_qty: 0, stock: 0, my_qty: myQty };
      return;
    }
    let reservedQty = 0;
    let potentialQty = 0;
    rows.forEach((row) => {
      const targetRange = getRangeFromSource({
        delivery_date: row.section_delivery_date,
        rental_start: row.section_rental_start,
        rental_end: row.section_rental_end,
        pickup_date: row.section_pickup_date,
      }) || targetQuoteRange;
      otherQuotes.forEach((otherQuote) => {
        const entries = reservationEntries[otherQuote.id] || { reserved: [], potential: [] };
        reservedQty += sumOverlappingQuantity(entries.reserved, itemId, targetRange);
        potentialQty += sumOverlappingQuantity(entries.potential, itemId, targetRange);
      });
    });
    let status = 'ok';
    if (reservedQty + myQty > stock) status = 'reserved';
    else if (reservedQty + potentialQty + myQty > stock) status = 'potential';
    conflicts[itemId] = { status, reserved_qty: reservedQty, potential_qty: potentialQty, stock, my_qty: myQty, set_aside_qty: setAsideQty };
  });
  return { hasRange: true, conflicts };
}

function diffObjects(left, right) {
  const leftString = JSON.stringify(left);
  const rightString = JSON.stringify(right);
  if (leftString === rightString) return null;
  return { left, right };
}

function normalizeQuoteSummaryShape(value) {
  if (!value || typeof value !== 'object') return value;
  return {
    hasRange: value.hasRange != null ? value.hasRange : value.has_range,
    conflicts: value.conflicts || {},
  };
}

function normalizeQuoteItemsShape(value) {
  return value || {};
}

function getQuoteItemIds(db, quoteId, limit = null) {
  const n = limit == null || limit === '' ? null : Number(limit);
  const safeLimit = n != null && Number.isFinite(n) ? Math.max(1, Math.min(200, n)) : null;
  const rows = db.prepare(`
    SELECT DISTINCT item_id
    FROM quote_items
    WHERE quote_id = ?
    ORDER BY item_id ASC
  `).all(quoteId);
  const ids = rows.map((row) => Number(row.item_id)).filter(Boolean);
  return safeLimit != null ? ids.slice(0, safeLimit) : ids;
}

function summarizeQuoteDiff(diff, itemMetaMap = {}) {
  if (!diff) return null;
  const left = diff.left || {};
  const right = diff.right || {};
  const leftKeys = Object.keys(left.conflicts || left || {});
  const rightKeys = Object.keys(right.conflicts || right || {});
  const allKeys = Array.from(new Set(leftKeys.concat(rightKeys))).sort((a, b) => Number(a) - Number(b));
  const changedKeys = allKeys.filter((key) => JSON.stringify((left.conflicts || left)[key]) !== JSON.stringify((right.conflicts || right)[key]));
  return {
    changed_keys: changedKeys.slice(0, 20),
    changed_items: changedKeys.slice(0, 20).map((key) => ({
      item_id: Number(key),
      title: itemMetaMap[key]?.title || `Item ${key}`,
    })),
    changed_count: changedKeys.length,
    left_count: leftKeys.length,
    right_count: rightKeys.length,
  };
}

function summarizeItemDiff(diff, itemMetaMap = {}) {
  if (!diff) return null;
  const left = diff.left || {};
  const right = diff.right || {};
  const keys = Array.from(new Set(Object.keys(left).concat(Object.keys(right)))).sort((a, b) => Number(a) - Number(b));
  const changedKeys = keys.filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
  return {
    changed_item_ids: changedKeys.slice(0, 20),
    changed_items: changedKeys.slice(0, 20).map((key) => ({
      item_id: Number(key),
      title: itemMetaMap[key]?.title || `Item ${key}`,
    })),
    changed_count: changedKeys.length,
  };
}

function listParityQuoteIds(db, limit = 10) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 10;
  const rows = db.prepare(`
    SELECT DISTINCT q.id
    FROM quotes q
    JOIN quote_items qi ON qi.quote_id = q.id
    WHERE COALESCE(q.status, 'draft') != 'closed'
      AND (
        q.delivery_date IS NOT NULL
        OR q.rental_start IS NOT NULL
        OR q.rental_end IS NOT NULL
        OR q.pickup_date IS NOT NULL
        OR q.event_date IS NOT NULL
      )
    ORDER BY q.id ASC
    LIMIT ?
  `).all(safeLimit);
  return rows.map((row) => Number(row.id)).filter(Boolean);
}

async function compareQuote(db, quoteId, options = {}) {
  const includeItems = options.includeItems === true || String(options.includeItems || '') === '1';
  const explicitItemIds = Array.isArray(options.itemIds) ? options.itemIds.map((v) => Number(v)).filter(Boolean) : [];
  const itemIds = explicitItemIds.length
    ? explicitItemIds
    : (includeItems ? getQuoteItemIds(db, quoteId, options.itemLimitPerQuote || null) : []);
  const sectionId = options.sectionId != null && options.sectionId !== '' ? Number(options.sectionId) : null;
  const quoteMeta = getQuoteMeta(db, quoteId);
  const sectionMeta = getSectionMeta(db, quoteId, sectionId);
  const itemMetaMap = getItemMetaMap(db, itemIds);
  const targetRange = sectionMeta?.range || getRangeFromSource(quoteMeta);
  const quoteSummaryLegacy = normalizeQuoteSummaryShape(legacyQuoteSummary(db, quoteId));
  const quoteSummaryRustPayload = await rustEngineClient.checkQuoteSummary({ quoteId });
  const quoteSummaryRust = normalizeQuoteSummaryShape(rustEngineClient.normalizeCheckResult(quoteSummaryRustPayload));
  let quoteItemsLegacy = null;
  let quoteItemsRust = null;
  if (itemIds.length) {
    quoteItemsLegacy = normalizeQuoteItemsShape(legacyQuoteItems(db, quoteId, itemIds, sectionId));
    const quoteItemsRustPayload = await rustEngineClient.checkQuoteItems({ quoteId, itemIds, sectionId });
    quoteItemsRust = normalizeQuoteItemsShape(rustEngineClient.normalizeCheckResult(quoteItemsRustPayload));
  }
  return {
    quote_id: quoteId,
    quote: quoteMeta,
    section_id: sectionId,
    section: sectionMeta,
    target_range: targetRange,
    item_ids: itemIds,
    items: itemIds.map((itemId) => itemMetaMap[itemId] || { id: Number(itemId), title: `Item ${itemId}`, category: null }),
    include_items: includeItems,
    summary_match: JSON.stringify(quoteSummaryLegacy) === JSON.stringify(quoteSummaryRust),
    items_match: itemIds.length ? JSON.stringify(quoteItemsLegacy) === JSON.stringify(quoteItemsRust) : null,
    summary_diff: diffObjects(quoteSummaryLegacy, quoteSummaryRust),
    items_diff: itemIds.length ? diffObjects(quoteItemsLegacy, quoteItemsRust) : null,
    summary_compact: summarizeQuoteDiff(diffObjects(quoteSummaryLegacy, quoteSummaryRust), itemMetaMap),
    items_compact: itemIds.length ? summarizeItemDiff(diffObjects(quoteItemsLegacy, quoteItemsRust), itemMetaMap) : null,
    legacy: {
      quote_summary: quoteSummaryLegacy,
      quote_items: quoteItemsLegacy,
    },
    rust: {
      quote_summary: quoteSummaryRust,
      quote_items: quoteItemsRust,
    },
  };
}

async function compareQuotes(db, options = {}) {
  const requestedQuoteIds = Array.isArray(options.quoteIds)
    ? options.quoteIds.map((value) => Number(value)).filter(Boolean)
    : [];
  const quoteIds = requestedQuoteIds.length ? requestedQuoteIds : listParityQuoteIds(db, options.limit || 10);
  const comparisons = [];
  for (const quoteId of quoteIds) {
    try {
      const comparison = await compareQuote(db, quoteId, {
        includeItems: options.includeItems,
        itemLimitPerQuote: options.itemLimitPerQuote,
      });
      comparisons.push(comparison);
    } catch (error) {
      comparisons.push({
        quote_id: quoteId,
        error: error?.message || String(error),
        summary_match: false,
        items_match: null,
      });
    }
  }
  const summaryMismatchCount = comparisons.filter((row) => row.summary_match === false).length;
  const itemMismatchCount = comparisons.filter((row) => row.items_match === false).length;
  const errorCount = comparisons.filter((row) => row.error).length;
  return {
    quote_ids: quoteIds,
    totals: {
      quotes_checked: comparisons.length,
      summary_mismatches: summaryMismatchCount,
      item_mismatches: itemMismatchCount,
      errors: errorCount,
    },
    comparisons,
  };
}

module.exports = {
  legacyQuoteItems,
  legacyQuoteSummary,
  compareQuote,
  compareQuotes,
  getQuoteItemIds,
  listParityQuoteIds,
};
