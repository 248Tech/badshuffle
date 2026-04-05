const quoteRepository = require('../db/repositories/quoteRepository');
const { requireQuoteById } = require('../db/queries/quotes');
const itemQueries = require('../db/queries/items');
const { ensurePullSheetScanCode, ensureItemScanCode } = require('./scanCodeService');

const ORG_ID = 1;
const MAX_EXPANSION_DEPTH = 6;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getSectionMap(sections) {
  const fallback = (sections && sections.length > 0) ? sections[0] : { id: 'default', title: 'Quote Items' };
  const map = new Map((sections || []).map((section) => [String(section.id), section]));
  map.set(String(fallback.id), fallback);
  return { map, fallback };
}

function getSectionForItem(sectionMap, fallbackSection, sectionId) {
  return sectionMap.get(String(sectionId || fallbackSection.id)) || fallbackSection;
}

function pushGroupedRow(grouped, row) {
  const key = [
    row.section_id || 'default',
    row.item_id || `custom:${row.custom_item_id}`,
    row.source_type,
    row.parent_item_id || 'none',
  ].join(':');
  const existing = grouped.get(key);
  if (existing) {
    existing.quantity += row.quantity;
    return;
  }
  grouped.set(key, { ...row });
}

function buildRowFromInventoryItem(item, quantity, section, sourceType, parentRow = null) {
  return {
    row_key: `${sourceType}:${item.id}:${section.id}:${parentRow?.item_id || 'root'}`,
    item_id: Number(item.id),
    custom_item_id: null,
    section_id: section.id,
    section_title: section.title || 'Quote Items',
    title: item.title || 'Item',
    quantity: Math.max(1, Number(quantity || 1)),
    source_type: sourceType,
    parent_item_id: parentRow?.item_id || null,
    parent_title: parentRow?.title || null,
    item_type: item.item_type || 'product',
    internal_notes: item.internal_notes || null,
    category: item.category || null,
    photo_url: item.photo_url || null,
    scan_code: item.scan_code || null,
  };
}

function expandChildren(db, grouped, section, parentRow, quantity, trail, depth) {
  if (!parentRow?.item_id) return;
  if (depth >= MAX_EXPANSION_DEPTH) return;
  if (trail.has(parentRow.item_id)) return;

  const nextTrail = new Set(trail);
  nextTrail.add(parentRow.item_id);

  const accessories = itemQueries.listItemAccessories(db, parentRow.item_id);
  accessories.forEach((item) => {
    const row = buildRowFromInventoryItem(item, quantity, section, 'accessory', parentRow);
    pushGroupedRow(grouped, row);
    expandChildren(db, grouped, section, row, quantity, nextTrail, depth + 1);
  });

  const associations = itemQueries.listItemAssociations(db, parentRow.item_id);
  associations.forEach((item) => {
    const row = buildRowFromInventoryItem(item, quantity, section, 'associated', parentRow);
    pushGroupedRow(grouped, row);
    expandChildren(db, grouped, section, row, quantity, nextTrail, depth + 1);
  });
}

function ensurePullSheet(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const scanCode = ensurePullSheetScanCode(db, quoteId);
  return db.prepare('SELECT * FROM quote_pull_sheets WHERE quote_id = ?').get(quoteId) || { quote_id: quoteId, scan_code: scanCode };
}

function buildQuotePullSheet(db, quoteId, quoteSectionService) {
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const pullSheet = ensurePullSheet(db, quoteId);
  const sections = quoteSectionService.ensureSections(db, quoteId);
  const snapshot = quoteRepository.getQuoteDetailSnapshot(db, quoteId, ORG_ID);
  if (!snapshot) throw createError(404, 'Quote not found');

  const { map: sectionMap, fallback: fallbackSection } = getSectionMap(sections);
  const grouped = new Map();

  (snapshot.items || []).forEach((item) => {
    const section = getSectionForItem(sectionMap, fallbackSection, item.section_id);
    const scanCode = ensureItemScanCode(db, item.id);
    const baseRow = buildRowFromInventoryItem({ ...item, scan_code: scanCode }, Number(item.quantity || 1), section, 'quoted');
    pushGroupedRow(grouped, baseRow);
    expandChildren(db, grouped, section, baseRow, Number(item.quantity || 1), new Set(), 0);
  });

  (snapshot.customItems || []).forEach((item) => {
    const section = getSectionForItem(sectionMap, fallbackSection, item.section_id);
    pushGroupedRow(grouped, {
      row_key: `custom:${item.id}:${section.id}`,
      item_id: null,
      custom_item_id: Number(item.id),
      section_id: section.id,
      section_title: section.title || 'Quote Items',
      title: item.title || 'Custom item',
      quantity: Math.max(1, Number(item.quantity || 1)),
      source_type: 'custom',
      parent_item_id: null,
      parent_title: null,
      item_type: 'custom',
      internal_notes: item.notes || null,
      category: null,
      photo_url: item.photo_url || null,
      scan_code: null,
    });
  });

  const rows = Array.from(grouped.values())
    .sort((a, b) => {
      const sectionOrder = String(a.section_title || '').localeCompare(String(b.section_title || ''));
      if (sectionOrder !== 0) return sectionOrder;
      const sourceOrder = String(a.source_type || '').localeCompare(String(b.source_type || ''));
      if (sourceOrder !== 0) return sourceOrder;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

  const sectionRows = sections.map((section) => ({
    ...section,
    rows: rows.filter((row) => String(row.section_id) === String(section.id)),
  })).filter((section) => section.rows.length > 0);

  const summary = rows.reduce((acc, row) => {
    acc.total_rows += 1;
    acc.total_quantity += Number(row.quantity || 0);
    acc[row.source_type] = (acc[row.source_type] || 0) + Number(row.quantity || 0);
    return acc;
  }, {
    total_rows: 0,
    total_quantity: 0,
    quoted: 0,
    accessory: 0,
    associated: 0,
    custom: 0,
  });

  return {
    pull_sheet: {
      id: Number(pullSheet.id),
      quote_id: Number(quote.id),
      scan_code: pullSheet.scan_code,
      href: `/quotes/${quote.id}?tab=pull-sheet`,
    },
    quote: {
      id: Number(quote.id),
      name: quote.name,
      status: quote.status || 'draft',
      event_date: quote.event_date || null,
      rental_start: quote.rental_start || null,
      rental_end: quote.rental_end || null,
      delivery_date: quote.delivery_date || null,
      pickup_date: quote.pickup_date || null,
    },
    summary,
    sections: sectionRows,
    rows,
  };
}

function getPullSheet(db, quoteId, quoteSectionService) {
  return buildQuotePullSheet(db, quoteId, quoteSectionService);
}

function normalizeQuoteIds(quoteIds) {
  const values = Array.isArray(quoteIds) ? quoteIds : [quoteIds];
  const next = [];
  values.forEach((value) => {
    String(value || '')
      .split(',')
      .map((part) => Number(part))
      .filter((part) => Number.isInteger(part) && part > 0)
      .forEach((part) => {
        if (!next.includes(part)) next.push(part);
      });
  });
  return next;
}

function getAggregatePullSheet(db, quoteIds, quoteSectionService) {
  const ids = normalizeQuoteIds(quoteIds);
  if (!ids.length) throw createError(400, 'Select at least one project');

  const pullSheets = ids.map((quoteId) => buildQuotePullSheet(db, quoteId, quoteSectionService));
  const grouped = new Map();

  pullSheets.forEach((sheet) => {
    (sheet.rows || []).forEach((row) => {
      const key = [
        row.item_id || `custom:${String(row.title || '').toLowerCase()}`,
        row.source_type || 'quoted',
        row.parent_item_id || row.parent_title || 'none',
      ].join(':');
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += Number(row.quantity || 0);
        const prior = existing.quote_refs.find((entry) => entry.quote_id === sheet.quote.id);
        if (prior) {
          prior.quantity += Number(row.quantity || 0);
        } else {
          existing.quote_refs.push({
            quote_id: sheet.quote.id,
            quote_name: sheet.quote.name,
            quantity: Number(row.quantity || 0),
          });
        }
        return;
      }
      grouped.set(key, {
        ...row,
        row_key: `aggregate:${key}`,
        quantity: Number(row.quantity || 0),
        quote_refs: [{
          quote_id: sheet.quote.id,
          quote_name: sheet.quote.name,
          quantity: Number(row.quantity || 0),
        }],
      });
    });
  });

  const rows = Array.from(grouped.values()).sort((a, b) => {
    const categoryOrder = String(a.category || '').localeCompare(String(b.category || ''));
    if (categoryOrder !== 0) return categoryOrder;
    const titleOrder = String(a.title || '').localeCompare(String(b.title || ''));
    if (titleOrder !== 0) return titleOrder;
    return String(a.source_type || '').localeCompare(String(b.source_type || ''));
  });

  const summary = rows.reduce((acc, row) => {
    acc.total_rows += 1;
    acc.total_quantity += Number(row.quantity || 0);
    acc[row.source_type] = (acc[row.source_type] || 0) + Number(row.quantity || 0);
    return acc;
  }, {
    total_rows: 0,
    total_quantity: 0,
    total_projects: pullSheets.length,
    quoted: 0,
    accessory: 0,
    associated: 0,
    custom: 0,
  });

  return {
    pull_sheet: {
      id: null,
      scan_code: `AGG-${ids.join('-')}`,
      href: `/quotes/pull-sheets/export?mode=aggregate&ids=${ids.join(',')}`,
    },
    quotes: pullSheets.map((sheet) => sheet.quote),
    summary,
    sections: [{
      id: 'aggregate',
      title: 'Combined pull',
      rows,
    }],
    rows,
  };
}

module.exports = {
  ensurePullSheet,
  normalizeQuoteIds,
  buildQuotePullSheet,
  getPullSheet,
  getAggregatePullSheet,
};
