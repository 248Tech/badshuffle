const quoteService = require('./quoteService');
const rustEngineClient = require('./rustEngineClient');

function getQuoteMeta(db, quoteId) {
  const row = db.prepare(`
    SELECT id, name, status
    FROM quotes
    WHERE id = ?
  `).get(quoteId);
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.name || `Quote ${row.id}`),
    status: String(row.status || 'draft'),
  };
}

function listPricingQuoteIds(db, limit = 10) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 10;
  const rows = db.prepare(`
    SELECT DISTINCT q.id
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN quote_custom_items qci ON qci.quote_id = q.id
    WHERE COALESCE(q.status, 'draft') != 'closed'
      AND (qi.id IS NOT NULL OR qci.id IS NOT NULL)
    ORDER BY q.id ASC
    LIMIT ?
  `).all(safeLimit);
  return rows.map((row) => Number(row.id)).filter(Boolean);
}

function normalizeTotals(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    subtotal: Number(value.subtotal || 0),
    deliveryTotal: Number(value.deliveryTotal != null ? value.deliveryTotal : value.delivery_total || 0),
    customSubtotal: Number(value.customSubtotal != null ? value.customSubtotal : value.custom_subtotal || 0),
    adjTotal: Number(value.adjTotal != null ? value.adjTotal : value.adjustment_total || 0),
    taxableAmount: Number(value.taxableAmount != null ? value.taxableAmount : value.taxable_amount || 0),
    rate: Number(value.rate != null ? value.rate : value.tax_rate || 0),
    tax: Number(value.tax || 0),
    total: Number(value.total || 0),
  };
}

function diffPricing(left, right) {
  if (!left || !right) return { left, right };
  const keys = ['subtotal', 'deliveryTotal', 'customSubtotal', 'adjTotal', 'taxableAmount', 'rate', 'tax', 'total'];
  const changed = keys
    .map((key) => {
      const leftValue = Number(left[key] || 0);
      const rightValue = Number(right[key] || 0);
      const delta = Number((rightValue - leftValue).toFixed(6));
      return Math.abs(delta) > 0.000001 ? { key, left: leftValue, right: rightValue, delta } : null;
    })
    .filter(Boolean);
  return changed.length ? { changed } : null;
}

async function compareQuotePricing(db, quoteId, explicitTaxRate = null) {
  const legacy = normalizeTotals(quoteService.computeQuoteTotals(db, quoteId, explicitTaxRate));
  const rustPayload = await rustEngineClient.checkQuotePricing({ quoteId, explicitTaxRate });
  const rust = normalizeTotals(rustEngineClient.normalizeCheckResult(rustPayload));
  const diff = diffPricing(legacy, rust);
  return {
    quote_id: Number(quoteId),
    quote: getQuoteMeta(db, quoteId),
    explicit_tax_rate: explicitTaxRate == null ? null : Number(explicitTaxRate),
    match: !diff,
    diff,
    legacy,
    rust,
  };
}

async function compareQuotesPricing(db, options = {}) {
  const requestedQuoteIds = Array.isArray(options.quoteIds)
    ? options.quoteIds.map((value) => Number(value)).filter(Boolean)
    : [];
  const quoteIds = requestedQuoteIds.length ? requestedQuoteIds : listPricingQuoteIds(db, options.limit || 10);
  const comparisons = [];
  for (const quoteId of quoteIds) {
    try {
      comparisons.push(await compareQuotePricing(db, quoteId, options.explicitTaxRate ?? null));
    } catch (error) {
      comparisons.push({
        quote_id: quoteId,
        quote: getQuoteMeta(db, quoteId),
        match: false,
        error: error?.message || String(error),
      });
    }
  }
  return {
    quote_ids: quoteIds,
    totals: {
      quotes_checked: comparisons.length,
      mismatches: comparisons.filter((row) => row.match === false).length,
      errors: comparisons.filter((row) => row.error).length,
    },
    comparisons,
  };
}

module.exports = {
  compareQuotePricing,
  compareQuotesPricing,
};
