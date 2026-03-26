const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');

export function effectivePrice(item) {
  const base = item.unit_price_override != null ? item.unit_price_override : (item.unit_price || 0);
  if (item.discount_type === 'percent' && item.discount_amount > 0) {
    return base * (1 - item.discount_amount / 100);
  }
  if (item.discount_type === 'fixed' && item.discount_amount > 0) {
    return Math.max(0, base - item.discount_amount);
  }
  return base;
}

export function computeAdjustmentsTotal(adjustments, preTaxBase) {
  return (adjustments || []).reduce((sum, adj) => {
    const val = adj.value_type === 'percent' ? preTaxBase * (adj.amount / 100) : adj.amount;
    return sum + (adj.type === 'discount' ? -val : val);
  }, 0);
}

export function computeTotals({ items, customItems, adjustments, taxRate }) {
  const list = items || [];
  const equipment = list.filter((it) => !isLogistics(it));
  const logistics = list.filter((it) => isLogistics(it));

  const laborHours = list.reduce(
    (sum, it) => sum + (Number(it.labor_hours) || 0) * (it.quantity || 1),
    0
  );

  const subtotal = equipment.reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const deliveryTotal = logistics.reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);

  const taxableEquipment = equipment
    .filter((it) => it.taxable !== 0)
    .reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const taxableDelivery = logistics
    .filter((it) => it.taxable !== 0)
    .reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);

  const ciList = customItems || [];
  const customSubtotal = ciList.reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);
  const taxableCustom = ciList
    .filter((ci) => ci.taxable !== 0)
    .reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);

  const preTaxBase = subtotal + deliveryTotal + customSubtotal;
  const adjTotal = computeAdjustmentsTotal(adjustments, preTaxBase);
  const rate = parseFloat(taxRate) || 0;
  const tax = (taxableEquipment + taxableDelivery + taxableCustom) * (rate / 100);
  const grandTotal = preTaxBase + adjTotal + tax;

  return { laborHours, subtotal, deliveryTotal, customSubtotal, adjTotal, tax, total: grandTotal, rate };
}
