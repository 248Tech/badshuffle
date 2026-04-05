function upsertItemStats(db, itemId, guestCount) {
  const existing = db.prepare(
    'SELECT id, times_quoted, total_guests, sales_total FROM item_stats WHERE item_id = ?'
  ).get(itemId);

  if (existing) {
    db.prepare(`
      UPDATE item_stats
      SET times_quoted = times_quoted + 1,
          total_guests = total_guests + ?,
          last_used_at = datetime('now')
      WHERE item_id = ?
    `).run(guestCount, itemId);
  } else {
    db.prepare(
      "INSERT INTO item_stats (item_id, times_quoted, total_guests, sales_total, last_used_at) VALUES (?, 1, ?, 0, datetime('now'))"
    ).run(itemId, guestCount);
  }

  if (guestCount > 0) {
    const bracketMin = Math.floor(guestCount / 25) * 25;
    const bracketMax = bracketMin + 24;
    const existingBracket = db.prepare(
      'SELECT id FROM usage_brackets WHERE item_id = ? AND bracket_min = ?'
    ).get(itemId, bracketMin);

    if (existingBracket) {
      db.prepare('UPDATE usage_brackets SET times_used = times_used + 1 WHERE id = ?')
        .run(existingBracket.id);
    } else {
      db.prepare(
        'INSERT INTO usage_brackets (item_id, bracket_min, bracket_max, times_used) VALUES (?, ?, ?, 1)'
      ).run(itemId, bracketMin, bracketMax);
    }
  }
}

function lineRevenue(row) {
  const quantity = Number(row?.quantity || 0);
  const base = row?.unit_price_override != null
    ? Number(row.unit_price_override || 0)
    : Number(row?.unit_price || 0);
  const discountType = String(row?.discount_type || 'none').trim();
  const discountAmount = Number(row?.discount_amount || 0);
  let effective = base;
  if (discountType === 'percent') effective = base * (1 - (discountAmount / 100));
  else if (discountType === 'fixed') effective = base - discountAmount;
  effective = Math.max(0, effective);
  return effective * Math.max(0, quantity);
}

function recalculateItemSalesStats(db, itemId) {
  const quoteRows = db.prepare(`
    SELECT qi.quantity, qi.unit_price_override, qi.discount_type, qi.discount_amount, i.unit_price
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.item_id = ?
  `).all(itemId);
  const salesTotal = quoteRows.reduce((sum, row) => sum + lineRevenue(row), 0);
  const existing = db.prepare('SELECT id FROM item_stats WHERE item_id = ?').get(itemId);
  if (existing) {
    db.prepare('UPDATE item_stats SET sales_total = ? WHERE item_id = ?').run(salesTotal, itemId);
  } else {
    db.prepare(
      "INSERT INTO item_stats (item_id, times_quoted, total_guests, sales_total, last_used_at) VALUES (?, 0, 0, ?, NULL)"
    ).run(itemId, salesTotal);
  }
  return salesTotal;
}

function getItemStats(db, itemId) {
  return db.prepare(
    'SELECT item_id, times_quoted, total_guests, sales_total, last_used_at FROM item_stats WHERE item_id = ?'
  ).get(itemId) || {
    item_id: Number(itemId),
    times_quoted: 0,
    total_guests: 0,
    sales_total: 0,
    last_used_at: null,
  };
}

module.exports = {
  upsertItemStats,
  recalculateItemSalesStats,
  getItemStats,
};
