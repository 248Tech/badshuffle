function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function computeTotalsFromRows(quote, items, customItems, adjustments, explicitTaxRate = null) {
  let subtotal = 0;
  let deliveryTotal = 0;
  let customSubtotal = 0;
  let taxableAmount = 0;

  items.forEach((row) => {
    if (row.hidden_from_quote) return;
    let unitPrice = row.unit_price_override != null ? row.unit_price_override : (row.unit_price || 0);
    if (row.discount_type === 'percent' && row.discount_amount > 0) unitPrice = unitPrice * (1 - row.discount_amount / 100);
    if (row.discount_type === 'fixed' && row.discount_amount > 0) unitPrice = Math.max(0, unitPrice - row.discount_amount);
    const line = unitPrice * (row.quantity || 1);
    if ((row.category || '').toLowerCase().includes('logistics')) deliveryTotal += line;
    else subtotal += line;
    if (row.taxable) taxableAmount += line;
  });

  customItems.forEach((row) => {
    const line = (row.quantity || 1) * (row.unit_price || 0);
    customSubtotal += line;
    if (row.taxable) taxableAmount += line;
  });

  const preTax = subtotal + deliveryTotal + customSubtotal;
  let adjTotal = 0;
  adjustments.forEach((adj) => {
    const val = adj.value_type === 'percent' ? preTax * (Number(adj.amount || 0) / 100) : Number(adj.amount || 0);
    adjTotal += adj.type === 'discount' ? -val : val;
  });
  const rate = explicitTaxRate != null ? Number(explicitTaxRate || 0) : Number(quote.tax_rate || 0);
  const tax = rate > 0 ? taxableAmount * (rate / 100) : 0;
  return {
    subtotal,
    deliveryTotal,
    customSubtotal,
    adjTotal,
    taxableAmount,
    tax,
    rate,
    total: preTax + adjTotal + tax,
  };
}

function computeQuoteTotalsLegacy(db, quoteOrId, explicitTaxRate = null, options = {}) {
  const loadQuote = typeof options.loadQuote === 'function'
    ? options.loadQuote
    : (database, quoteId) => database.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
  const quote = typeof quoteOrId === 'object' ? quoteOrId : loadQuote(db, quoteOrId);
  if (!quote) throw createHttpError(404, 'Not found');

  const items = db.prepare(`
    SELECT qi.quantity, qi.hidden_from_quote, qi.unit_price_override, qi.discount_type, qi.discount_amount,
           i.unit_price, i.taxable, i.category
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.quote_id = ?
  `).all(quote.id);
  const customItems = db.prepare('SELECT quantity, unit_price, taxable FROM quote_custom_items WHERE quote_id = ?').all(quote.id);
  const adjustments = db.prepare('SELECT type, value_type, amount FROM quote_adjustments WHERE quote_id = ?').all(quote.id);
  return computeTotalsFromRows(quote, items, customItems, adjustments, explicitTaxRate);
}

module.exports = {
  computeTotalsFromRows,
  computeQuoteTotalsLegacy,
};
