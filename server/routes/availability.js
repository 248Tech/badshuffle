const express = require('express');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // A quote's blocked date range spans delivery_date → pickup_date (inclusive).
  // Falls back to event_date if no rental period is set.
  function getQuoteRange(q) {
    const dates = [];
    if (q.delivery_date) dates.push(q.delivery_date);
    if (q.rental_start)  dates.push(q.rental_start);
    if (q.rental_end)    dates.push(q.rental_end);
    if (q.pickup_date)   dates.push(q.pickup_date);
    if (dates.length === 0 && q.event_date) dates.push(q.event_date);
    if (dates.length === 0) return null;
    dates.sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  function rangesOverlap(a, b) {
    if (!a || !b) return false;
    return a.start <= b.end && a.end >= b.start;
  }

  // confirmed = hard reservation; closed = released; others use contract/changes flag
  function isReserved(q) {
    const status = q.status || 'draft';
    if (status === 'confirmed') return true;
    if (status === 'closed')    return false;
    return (q.signed_at != null && q.signed_at !== '') || q.has_unsigned_changes === 1;
  }

  function getOosSetting() {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'count_oos_oversold'").get();
    return row && row.value === '1';
  }

  // GET /api/availability/quote/:quoteId/items?ids=1,2,3
  // Returns stock and already-reserved counts for given item IDs on this quote's date range (for picker).
  // Response: { [item_id]: { stock, reserved_qty, potential_qty } }
  router.get('/quote/:quoteId/items', (req, res) => {
    const quoteId = parseInt(req.params.quoteId, 10);
    if (isNaN(quoteId)) return res.status(400).json({ error: 'Invalid quoteId' });
    const rawIds = req.query.ids;
    const itemIds = rawIds ? String(rawIds).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) : [];
    if (itemIds.length === 0) return res.json({});

    const targetQuote = db.prepare(`
      SELECT q.*, c.signed_at
      FROM quotes q
      LEFT JOIN contracts c ON c.quote_id = q.id
      WHERE q.id = ?
    `).get(quoteId);
    if (!targetQuote) return res.status(404).json({ error: 'Not found' });

    const targetRange = getQuoteRange(targetQuote);
    if (!targetRange) {
      const out = {};
      const rows = db.prepare(`
        SELECT id, quantity_in_stock FROM items WHERE id IN (${itemIds.map(() => '?').join(',')})
      `).all(...itemIds);
      rows.forEach(r => { out[r.id] = { stock: r.quantity_in_stock || 0, reserved_qty: 0, potential_qty: 0 }; });
      return res.json(out);
    }

    const ph = itemIds.map(() => '?').join(',');
    const otherQuotes = db.prepare(`
      SELECT DISTINCT q.id, q.name, q.event_date, q.rental_start, q.rental_end,
             q.delivery_date, q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
      FROM quotes q
      JOIN quote_items qi ON qi.quote_id = q.id
      LEFT JOIN contracts c ON c.quote_id = q.id
      WHERE q.id != ? AND qi.item_id IN (${ph})
        AND COALESCE(q.status, 'draft') != 'closed'
    `).all(quoteId, ...itemIds);

    const overlapping = otherQuotes.filter(oq => rangesOverlap(targetRange, getQuoteRange(oq)));
    const oqIds = overlapping.map(q => q.id);
    let oqItemMap = {};
    if (oqIds.length) {
      const oqPh = oqIds.map(() => '?').join(',');
      const oqItems = db.prepare(`
        SELECT quote_id, item_id, quantity FROM quote_items
        WHERE quote_id IN (${oqPh}) AND item_id IN (${ph})
      `).all(...oqIds, ...itemIds);
      oqItems.forEach(r => {
        if (!oqItemMap[r.quote_id]) oqItemMap[r.quote_id] = {};
        oqItemMap[r.quote_id][r.item_id] = r.quantity || 1;
      });
    }

    const itemRows = db.prepare(`
      SELECT id, quantity_in_stock FROM items WHERE id IN (${ph})
    `).all(...itemIds);

    const result = {};
    for (const row of itemRows) {
      const stock = row.quantity_in_stock || 0;
      let reservedQty = 0;
      let potentialQty = 0;
      for (const oq of overlapping) {
        const qty = (oqItemMap[oq.id] || {})[row.id];
        if (!qty) continue;
        if (isReserved(oq)) reservedQty += qty;
        else potentialQty += qty;
      }
      result[row.id] = { stock, reserved_qty: reservedQty, potential_qty: potentialQty };
    }
    res.json(result);
  });

  // GET /api/availability/quote/:quoteId
  // Returns per-item conflict status for a given quote.
  // Response: { hasRange: bool, conflicts: { [item_id]: { status, reserved_qty, potential_qty, stock, my_qty } } }
  router.get('/quote/:quoteId', (req, res) => {
    const quoteId = parseInt(req.params.quoteId, 10);
    if (isNaN(quoteId)) return res.status(400).json({ error: 'Invalid quoteId' });

    const targetQuote = db.prepare(`
      SELECT q.*, c.signed_at
      FROM quotes q
      LEFT JOIN contracts c ON c.quote_id = q.id
      WHERE q.id = ?
    `).get(quoteId);
    if (!targetQuote) return res.status(404).json({ error: 'Not found' });

    const targetRange = getQuoteRange(targetQuote);
    if (!targetRange) return res.json({ hasRange: false, conflicts: {} });

    const targetItems = db.prepare(`
      SELECT qi.item_id, qi.quantity, i.quantity_in_stock, i.title
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id = ?
    `).all(quoteId);

    if (!targetItems.length) return res.json({ hasRange: true, conflicts: {} });

    const countOos = getOosSetting();
    const itemIds = targetItems.map(i => i.item_id);
    const ph = itemIds.map(() => '?').join(',');

    // All other quotes that share any of these items and have some date info
    const otherQuotes = db.prepare(`
      SELECT DISTINCT q.id, q.name, q.event_date, q.rental_start, q.rental_end,
             q.delivery_date, q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
      FROM quotes q
      JOIN quote_items qi ON qi.quote_id = q.id
      LEFT JOIN contracts c ON c.quote_id = q.id
      WHERE q.id != ? AND qi.item_id IN (${ph})
        AND COALESCE(q.status, 'draft') != 'closed'
    `).all(quoteId, ...itemIds);

    // Pre-fetch each overlapping other-quote's item quantities
    const overlapping = otherQuotes.filter(oq => rangesOverlap(targetRange, getQuoteRange(oq)));
    const oqIds = overlapping.map(q => q.id);
    let oqItemMap = {}; // { quoteId: { itemId: qty } }
    if (oqIds.length) {
      const oqPh = oqIds.map(() => '?').join(',');
      const oqItems = db.prepare(`
        SELECT quote_id, item_id, quantity FROM quote_items
        WHERE quote_id IN (${oqPh}) AND item_id IN (${ph})
      `).all(...oqIds, ...itemIds);
      for (const r of oqItems) {
        if (!oqItemMap[r.quote_id]) oqItemMap[r.quote_id] = {};
        oqItemMap[r.quote_id][r.item_id] = r.quantity || 1;
      }
    }

    const conflicts = {};
    for (const ti of targetItems) {
      const stock = ti.quantity_in_stock || 0;
      const myQty = ti.quantity || 1;

      if (countOos && stock === 0) {
        conflicts[ti.item_id] = { status: 'reserved', reason: 'oos', reserved_qty: 0, potential_qty: 0, stock: 0, my_qty: myQty };
        continue;
      }

      let reservedQty = 0;
      let potentialQty = 0;

      for (const oq of overlapping) {
        const qty = (oqItemMap[oq.id] || {})[ti.item_id];
        if (!qty) continue;
        if (isReserved(oq)) reservedQty += qty;
        else potentialQty += qty;
      }

      let status = 'ok';
      if (reservedQty + myQty > stock) status = 'reserved';
      else if (reservedQty + potentialQty + myQty > stock) status = 'potential';

      // Always return stock/reserved_qty so UI can show "Only X available, Y already booked" even when under limit
      conflicts[ti.item_id] = { status, reserved_qty: reservedQty, potential_qty: potentialQty, stock, my_qty: myQty };
    }

    res.json({ hasRange: true, conflicts });
  });

  // GET /api/availability/conflicts
  // Returns all quotes that have at least one oversold or potentially-oversold item.
  router.get('/conflicts', (req, res) => {
    const countOos = getOosSetting();

    const allQuotes = db.prepare(`
      SELECT q.id, q.name, q.event_date, q.rental_start, q.rental_end, q.delivery_date,
             q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
      FROM quotes q
      LEFT JOIN contracts c ON c.quote_id = q.id
      WHERE COALESCE(q.status, 'draft') != 'closed'
    `).all();

    const quotesWithRange = allQuotes
      .map(q => ({ ...q, range: getQuoteRange(q), is_reserved: isReserved(q) }))
      .filter(q => q.range);

    if (!quotesWithRange.length) return res.json({ conflicts: [] });

    const qIds = quotesWithRange.map(q => q.id);
    const ph = qIds.map(() => '?').join(',');

    const allItems = db.prepare(`
      SELECT qi.quote_id, qi.item_id, qi.quantity, i.title, i.quantity_in_stock
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id IN (${ph})
    `).all(...qIds);

    // { quoteId: [ {item_id, quantity, title, quantity_in_stock} ] }
    const qItemMap = {};
    for (const r of allItems) {
      if (!qItemMap[r.quote_id]) qItemMap[r.quote_id] = [];
      qItemMap[r.quote_id].push(r);
    }

    const results = [];

    for (const q of quotesWithRange) {
      const items = qItemMap[q.id] || [];
      if (!items.length) continue;

      const itemConflicts = [];

      for (const qi of items) {
        const stock = qi.quantity_in_stock || 0;
        const myQty = qi.quantity || 1;

        if (countOos && stock === 0) {
          itemConflicts.push({ item_id: qi.item_id, title: qi.title, status: 'reserved', quantity_needed: myQty, stock: 0, reserved_qty: 0, potential_qty: 0, shortage: myQty });
          continue;
        }

        let reservedQty = 0;
        let potentialQty = 0;

        for (const oq of quotesWithRange) {
          if (oq.id === q.id) continue;
          if (!rangesOverlap(q.range, oq.range)) continue;
          const oqItem = (qItemMap[oq.id] || []).find(x => x.item_id === qi.item_id);
          if (!oqItem) continue;
          const oqQty = oqItem.quantity || 1;
          if (oq.is_reserved) reservedQty += oqQty;
          else potentialQty += oqQty;
        }

        let status = 'ok';
        if (reservedQty + myQty > stock) status = 'reserved';
        else if (reservedQty + potentialQty + myQty > stock) status = 'potential';

        if (status !== 'ok') {
          itemConflicts.push({
            item_id: qi.item_id, title: qi.title, status,
            quantity_needed: myQty, stock,
            reserved_qty: reservedQty, potential_qty: potentialQty,
            shortage: Math.max(0, reservedQty + myQty - stock)
          });
        }
      }

      if (itemConflicts.length) {
        results.push({
          quote_id: q.id, quote_name: q.name, event_date: q.event_date,
          rental_start: q.rental_start, rental_end: q.rental_end,
          delivery_date: q.delivery_date, pickup_date: q.pickup_date,
          is_reserved: q.is_reserved, status: q.status,
          items: itemConflicts
        });
      }
    }

    results.sort((a, b) => {
      const aRed = a.items.some(i => i.status === 'reserved') ? 0 : 1;
      const bRed = b.items.some(i => i.status === 'reserved') ? 0 : 1;
      if (aRed !== bRed) return aRed - bRed;
      return (a.event_date || '9999').localeCompare(b.event_date || '9999');
    });

    res.json({ conflicts: results });
  });

  // GET /api/availability/subrentals
  // Returns subrental items needed on quotes within the next 90 days.
  router.get('/subrentals', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const in90  = new Date(Date.now() + 90 * 864e5).toISOString().split('T')[0];

    const rows = db.prepare(`
      SELECT
        i.id AS item_id, i.title, i.vendor_id, v.name AS vendor_name,
        qi.quantity, q.id AS quote_id, q.name AS quote_name,
        q.event_date, q.rental_start, q.rental_end, q.delivery_date, q.pickup_date,
        q.status, q.has_unsigned_changes
      FROM items i
      JOIN quote_items qi ON qi.item_id = i.id
      JOIN quotes q ON q.id = qi.quote_id
      LEFT JOIN vendors v ON v.id = i.vendor_id
      WHERE i.is_subrental = 1
        AND (
          (q.rental_start IS NOT NULL AND q.rental_start <= ?)
          OR (q.event_date IS NOT NULL AND q.event_date <= ?)
        )
        AND (
          (q.pickup_date IS NOT NULL AND q.pickup_date >= ?)
          OR (q.rental_end IS NOT NULL AND q.rental_end >= ?)
          OR (q.event_date IS NOT NULL AND q.event_date >= ?)
        )
      ORDER BY COALESCE(q.rental_start, q.event_date) ASC
    `).all(in90, in90, today, today, today);

    res.json({ subrentals: rows });
  });

  return router;
};
