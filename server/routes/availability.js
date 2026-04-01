const express = require('express');
const { getSettingValue } = require('../db/queries/settings');
const quoteFulfillmentService = require('../services/quoteFulfillmentService');

module.exports = function makeRouter(db) {
  const router = express.Router();

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

  function getOosSetting() {
    return getSettingValue(db, 'count_oos_oversold', '0') === '1';
  }

  function getQuoteSectionsMap(quoteIds) {
    if (!quoteIds.length) return new Map();
    const placeholders = quoteIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT id, quote_id, delivery_date, rental_start, rental_end, pickup_date
      FROM quote_item_sections
      WHERE quote_id IN (${placeholders})
    `).all(...quoteIds);
    const map = new Map();
    rows.forEach((row) => map.set(Number(row.id), row));
    return map;
  }

  function loadCurrentItemEntries(quoteIds, itemIds) {
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

  function loadLatestSignedSnapshotEntries(quoteIds, itemIds) {
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
      if (existing) {
        existing.quantity += entry.quantity || 0;
      } else {
        map.set(key, {
          item_id: entry.item_id,
          section_id: entry.section_id,
          quantity: entry.quantity || 0,
          range: entry.range || null,
        });
      }
    });
    return map;
  }

  function buildQuoteReservationEntries(quotes, itemIds) {
    const quoteIds = quotes.map((quote) => Number(quote.id));
    const currentEntriesByQuote = loadCurrentItemEntries(quoteIds, itemIds);
    const signedEntriesByQuote = loadLatestSignedSnapshotEntries(quoteIds, itemIds);
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
        const reservedEntries = fulfillmentEntries.length
          ? fulfillmentEntries
          : (signedMap.size ? Array.from(signedMap.values()) : currentEntries);
        const potentialEntries = [];

        currentMap.forEach((entry, key) => {
          const signedQty = signedMap.get(key)?.quantity || 0;
          const delta = Math.max(0, (entry.quantity || 0) - signedQty);
          if (delta > 0) {
            potentialEntries.push({
              item_id: entry.item_id,
              section_id: entry.section_id,
              quantity: delta,
              range: entry.range || null,
            });
          }
        });

        result[quoteId] = { reserved: reservedEntries, potential: potentialEntries };
        return;
      }

      const fulfillmentEntries = fulfillmentEntriesByQuote[quoteId] || [];
      if (fulfillmentEntries.length) {
        result[quoteId] = { reserved: fulfillmentEntries, potential: [] };
        return;
      }

      if (isQuoteReserved(quote)) {
        result[quoteId] = { reserved: currentEntries, potential: [] };
      } else {
        result[quoteId] = { reserved: [], potential: currentEntries };
      }
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

  function getTargetRangeForQuote(quoteId, sectionId) {
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
      if (section) {
        return { quote, range: getRangeFromSource(section) || getRangeFromSource(quote) };
      }
    }
    return { quote, range: getRangeFromSource(quote) };
  }

  router.get('/quote/:quoteId/items', (req, res) => {
    const quoteId = parseInt(req.params.quoteId, 10);
    const sectionId = req.query.section_id != null ? parseInt(req.query.section_id, 10) : null;
    if (isNaN(quoteId)) return res.status(400).json({ error: 'Invalid quoteId' });
    const rawIds = req.query.ids;
    const itemIds = rawIds ? String(rawIds).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)) : [];
    if (itemIds.length === 0) return res.json({});

    const { quote: targetQuote, range: targetRange } = getTargetRangeForQuote(quoteId, sectionId);
    if (!targetQuote) return res.status(404).json({ error: 'Not found' });

    const itemPlaceholders = itemIds.map(() => '?').join(',');
    const itemRows = db.prepare(`
      SELECT id, quantity_in_stock
      FROM items
      WHERE id IN (${itemPlaceholders})
    `).all(...itemIds);

    if (!targetRange) {
      const out = {};
      itemRows.forEach((row) => {
        out[row.id] = { stock: row.quantity_in_stock || 0, reserved_qty: 0, potential_qty: 0 };
      });
      return res.json(out);
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

    const reservationEntries = buildQuoteReservationEntries(otherQuotes, itemIds);
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
        stock: row.quantity_in_stock || 0,
        reserved_qty: reservedQty,
        potential_qty: potentialQty,
      };
    });

    res.json(result);
  });

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

    const targetQuoteRange = getRangeFromSource(targetQuote);
    if (!targetQuoteRange) return res.json({ hasRange: false, conflicts: {} });

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

    if (!targetItems.length) return res.json({ hasRange: true, conflicts: {} });

    const countOos = getOosSetting();
    const itemIds = Array.from(new Set(targetItems.map((item) => Number(item.item_id))));
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

    const reservationEntries = buildQuoteReservationEntries(otherQuotes, itemIds);
    const conflicts = {};

    itemIds.forEach((itemId) => {
      const rows = targetItems.filter((item) => Number(item.item_id) === Number(itemId));
      const stock = Number(rows[0]?.quantity_in_stock || 0);
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

      conflicts[itemId] = { status, reserved_qty: reservedQty, potential_qty: potentialQty, stock, my_qty: myQty };
    });

    res.json({ hasRange: true, conflicts });
  });

  router.get('/conflicts', (req, res) => {
    const countOos = getOosSetting();

    const allQuotes = db.prepare(`
      SELECT q.id, q.name, q.event_date, q.rental_start, q.rental_end, q.delivery_date,
             q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
      FROM quotes q
      LEFT JOIN contracts c ON c.quote_id = q.id
      WHERE COALESCE(q.status, 'draft') != 'closed'
    `).all();

    const quoteIds = allQuotes.map((quote) => Number(quote.id));
    if (!quoteIds.length) return res.json({ conflicts: [] });

    const placeholders = quoteIds.map(() => '?').join(',');
    const allItems = db.prepare(`
      SELECT qi.quote_id, qi.item_id, qi.quantity, qi.section_id, i.title, i.quantity_in_stock
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id IN (${placeholders})
    `).all(...quoteIds);

    const itemIds = Array.from(new Set(allItems.map((row) => Number(row.item_id))));
    const reservationEntries = buildQuoteReservationEntries(allQuotes, itemIds);
    const sectionMap = getQuoteSectionsMap(quoteIds);
    const qItemMap = {};

    allItems.forEach((row) => {
      if (!qItemMap[row.quote_id]) qItemMap[row.quote_id] = [];
      const section = row.section_id != null ? sectionMap.get(Number(row.section_id)) : null;
      const range = getRangeFromSource(section) || getRangeFromSource(allQuotes.find((quote) => Number(quote.id) === Number(row.quote_id)));
      qItemMap[row.quote_id].push({
        item_id: Number(row.item_id),
        quantity: Number(row.quantity || 1),
        title: row.title,
        quantity_in_stock: Number(row.quantity_in_stock || 0),
        range,
      });
    });

    const results = [];

    allQuotes.forEach((quote) => {
      const items = qItemMap[quote.id] || [];
      if (!items.length) return;

      const itemConflicts = [];

      items.forEach((item) => {
        const stock = item.quantity_in_stock || 0;
        const myQty = item.quantity || 1;

        if (countOos && stock === 0) {
          itemConflicts.push({
            item_id: item.item_id,
            title: item.title,
            status: 'reserved',
            quantity_needed: myQty,
            stock: 0,
            reserved_qty: 0,
            potential_qty: 0,
            shortage: myQty,
          });
          return;
        }

        let reservedQty = 0;
        let potentialQty = 0;

        allQuotes.forEach((otherQuote) => {
          if (Number(otherQuote.id) === Number(quote.id)) return;
          const entries = reservationEntries[otherQuote.id] || { reserved: [], potential: [] };
          reservedQty += sumOverlappingQuantity(entries.reserved, item.item_id, item.range);
          potentialQty += sumOverlappingQuantity(entries.potential, item.item_id, item.range);
        });

        let status = 'ok';
        if (reservedQty + myQty > stock) status = 'reserved';
        else if (reservedQty + potentialQty + myQty > stock) status = 'potential';

        if (status !== 'ok') {
          itemConflicts.push({
            item_id: item.item_id,
            title: item.title,
            status,
            quantity_needed: myQty,
            stock,
            reserved_qty: reservedQty,
            potential_qty: potentialQty,
            shortage: Math.max(0, reservedQty + myQty - stock),
          });
        }
      });

      if (itemConflicts.length) {
        results.push({
          quote_id: quote.id,
          quote_name: quote.name,
          event_date: quote.event_date,
          rental_start: quote.rental_start,
          rental_end: quote.rental_end,
          delivery_date: quote.delivery_date,
          pickup_date: quote.pickup_date,
          is_reserved: isQuoteReserved(quote),
          status: quote.status,
          items: itemConflicts,
        });
      }
    });

    results.sort((a, b) => {
      const aRed = a.items.some((item) => item.status === 'reserved') ? 0 : 1;
      const bRed = b.items.some((item) => item.status === 'reserved') ? 0 : 1;
      if (aRed !== bRed) return aRed - bRed;
      return (a.event_date || '9999').localeCompare(b.event_date || '9999');
    });

    res.json({ conflicts: results });
  });

  // GET /api/availability/subrentals
  // Returns subrental items needed on quotes within the next 90 days.
  router.get('/subrentals', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const in90 = new Date(Date.now() + 90 * 864e5).toISOString().split('T')[0];

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
          (q.rental_end IS NOT NULL AND q.rental_end >= ?)
          OR (q.event_date IS NOT NULL AND q.event_date >= ?)
        )
        AND COALESCE(q.status, 'draft') != 'closed'
      ORDER BY COALESCE(q.rental_start, q.event_date) ASC, q.id ASC
    `).all(in90, in90, today, today);

    res.json({ items: rows });
  });

  return router;
};
