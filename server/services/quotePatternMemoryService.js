const quoteService = require('./quoteService');

const ORG_ID = 1;
const MEMORY_VERSION = 1;

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIsoMonth(value) {
  const text = cleanText(value);
  if (!text || text.length < 7) return null;
  return text.slice(0, 7);
}

function getSeason(value) {
  const text = cleanText(value);
  if (!text || text.length < 7) return null;
  const month = Number(text.slice(5, 7));
  if (!Number.isFinite(month)) return null;
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'fall';
}

function getGuestBand(count) {
  const guests = Number(count || 0);
  if (guests <= 0) return 'unknown';
  if (guests < 50) return '1-49';
  if (guests < 100) return '50-99';
  if (guests < 150) return '100-149';
  if (guests < 200) return '150-199';
  if (guests < 300) return '200-299';
  return '300+';
}

function normalizeStatus(value) {
  return String(value || 'draft').trim().toLowerCase();
}

function getOutcomeBucket(status) {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'approved') return 'approved';
  if (status === 'closed') return 'closed';
  if (status === 'sent') return 'sent';
  return 'draft';
}

function getItemRows(db, quoteId) {
  return db.prepare(`
    SELECT
      qi.item_id,
      qi.quantity,
      qi.hidden_from_quote,
      i.title,
      i.category,
      i.taxable,
      i.is_subrental,
      i.unit_price
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.quote_id = ?
  `).all(quoteId);
}

function getCustomItemRows(db, quoteId) {
  return db.prepare(`
    SELECT title, quantity, taxable, unit_price
    FROM quote_custom_items
    WHERE quote_id = ?
  `).all(quoteId);
}

function getQuoteSnapshot(db, quoteId) {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
  if (!quote) return null;
  const itemRows = getItemRows(db, quoteId);
  const customItems = getCustomItemRows(db, quoteId);
  const totals = quoteService.computeQuoteTotals(db, quoteId, quote.tax_rate);
  return { quote, itemRows, customItems, totals };
}

function buildCategoryCounts(itemRows) {
  const counts = {};
  itemRows.forEach((row) => {
    const category = cleanText(row.category)?.toLowerCase() || 'uncategorized';
    counts[category] = (counts[category] || 0) + Number(row.quantity || 0);
  });
  return counts;
}

function buildItemIds(itemRows) {
  return [...new Set(itemRows.map((row) => Number(row.item_id)).filter(Boolean))].sort((a, b) => a - b);
}

function buildBundleSuggestions(itemRows, currentItemIds) {
  const current = new Set((currentItemIds || []).map((value) => Number(value)));
  const map = new Map();
  itemRows.forEach((row) => {
    const itemId = Number(row.item_id);
    if (!itemId || current.has(itemId)) return;
    const existing = map.get(itemId);
    if (existing) {
      existing.count += 1;
      existing.quantity += Number(row.quantity || 0);
    } else {
      map.set(itemId, {
        item_id: itemId,
        title: row.title,
        category: row.category || null,
        count: 1,
        quantity: Number(row.quantity || 0),
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => (b.count - a.count) || (b.quantity - a.quantity) || String(a.title || '').localeCompare(String(b.title || '')));
}

function buildFeatureRecord(snapshot) {
  const { quote, itemRows, customItems, totals } = snapshot;
  const visibleItems = itemRows.filter((row) => Number(row.hidden_from_quote || 0) !== 1);
  const clientName = [quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ').trim() || null;
  return {
    version: MEMORY_VERSION,
    quote_id: Number(quote.id),
    name: quote.name || `Quote ${quote.id}`,
    status: normalizeStatus(quote.status),
    event_type: cleanText(quote.event_type)?.toLowerCase() || null,
    guest_count: Number(quote.guest_count || 0),
    guest_band: getGuestBand(quote.guest_count),
    event_month: toIsoMonth(quote.event_date),
    season: getSeason(quote.event_date),
    event_date: quote.event_date || null,
    venue_name: cleanText(quote.venue_name),
    venue_contact: cleanText(quote.venue_contact),
    client_name: clientName,
    client_email: cleanText(quote.client_email),
    delivery_date: quote.delivery_date || null,
    rental_start: quote.rental_start || null,
    rental_end: quote.rental_end || null,
    pickup_date: quote.pickup_date || null,
    subtotal: Number(totals.subtotal || 0),
    total: Number(totals.total || 0),
    tax: Number(totals.tax || 0),
    item_count: visibleItems.length,
    custom_item_count: customItems.length,
    total_quantity: visibleItems.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    category_counts: buildCategoryCounts(visibleItems),
    item_ids: buildItemIds(visibleItems),
    taxable_items: visibleItems.filter((row) => Number(row.taxable || 0) === 1).length,
    subrental_items: visibleItems.filter((row) => Number(row.is_subrental || 0) === 1).length,
    outcome_bucket: getOutcomeBucket(normalizeStatus(quote.status)),
    has_unsigned_changes: Number(quote.has_unsigned_changes || 0) === 1,
  };
}

function buildTags(features) {
  const tags = new Set();
  if (features.event_type) tags.add(features.event_type);
  if (features.guest_band) tags.add(`guests:${features.guest_band}`);
  if (features.season) tags.add(`season:${features.season}`);
  if (features.event_month) tags.add(`month:${features.event_month}`);
  if (features.venue_name) tags.add(`venue:${features.venue_name.toLowerCase()}`);
  if (features.client_email) tags.add(`client:${features.client_email.toLowerCase()}`);
  if (features.outcome_bucket) tags.add(`outcome:${features.outcome_bucket}`);
  Object.entries(features.category_counts || {}).forEach(([category, quantity]) => {
    if (Number(quantity || 0) > 0) tags.add(`category:${category}`);
  });
  if (features.subrental_items > 0) tags.add('subrental');
  if (features.custom_item_count > 0) tags.add('custom-items');
  if (features.has_unsigned_changes) tags.add('unsigned-changes');
  return Array.from(tags).sort();
}

function buildSummary(features) {
  const parts = [features.status || 'draft'];
  if (features.event_type) parts.push(features.event_type);
  if (features.guest_count > 0) parts.push(`${features.guest_count} guests`);
  if (features.venue_name) parts.push(features.venue_name);
  return parts.join(' • ');
}

function upsertMemoryRecord(db, quoteId, reason = 'quote_sync') {
  const snapshot = getQuoteSnapshot(db, quoteId);
  if (!snapshot) return null;
  const features = buildFeatureRecord(snapshot);
  const tags = buildTags(features);
  const summary = buildSummary(features);
  const existing = db.prepare('SELECT id FROM quote_pattern_memories WHERE org_id = ? AND quote_id = ?').get(ORG_ID, quoteId);
  if (existing) {
    db.prepare(`
      UPDATE quote_pattern_memories
      SET quote_name = ?, status = ?, event_type = ?, guest_count = ?, event_date = ?, venue_name = ?, client_name = ?, total = ?, summary = ?, features_json = ?, tags_json = ?, last_synced_at = datetime('now'), sync_reason = ?
      WHERE id = ?
    `).run(
      features.name,
      features.status,
      features.event_type,
      features.guest_count,
      features.event_date,
      features.venue_name,
      features.client_name,
      features.total,
      summary,
      JSON.stringify(features),
      JSON.stringify(tags),
      reason,
      existing.id,
    );
    db.prepare('DELETE FROM quote_pattern_memory_tags WHERE memory_id = ?').run(existing.id);
    const insertTag = db.prepare('INSERT INTO quote_pattern_memory_tags (memory_id, tag, created_at) VALUES (?, ?, datetime(\'now\'))');
    tags.forEach((tag) => insertTag.run(existing.id, tag));
    return db.prepare('SELECT * FROM quote_pattern_memories WHERE id = ?').get(existing.id);
  }
  const result = db.prepare(`
    INSERT INTO quote_pattern_memories (
      org_id, quote_id, quote_name, status, event_type, guest_count, event_date, venue_name, client_name, total, summary, features_json, tags_json, sync_reason, created_at, updated_at, last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `).run(
    ORG_ID,
    quoteId,
    features.name,
    features.status,
    features.event_type,
    features.guest_count,
    features.event_date,
    features.venue_name,
    features.client_name,
    features.total,
    summary,
    JSON.stringify(features),
    JSON.stringify(tags),
    reason,
  );
  const memoryId = result.lastInsertRowid;
  const insertTag = db.prepare('INSERT INTO quote_pattern_memory_tags (memory_id, tag, created_at) VALUES (?, ?, datetime(\'now\'))');
  tags.forEach((tag) => insertTag.run(memoryId, tag));
  return db.prepare('SELECT * FROM quote_pattern_memories WHERE id = ?').get(memoryId);
}

function scoreSimilarity(target, candidate) {
  let score = 0;
  const reasons = [];
  if (candidate.quote_id === target.quote_id) return { score: -1, reasons: ['same quote'] };
  if (target.event_type && candidate.event_type === target.event_type) {
    score += 35;
    reasons.push(`same event type: ${candidate.event_type}`);
  }
  if (target.guest_band && candidate.guest_band === target.guest_band) {
    score += 22;
    reasons.push(`same guest band: ${candidate.guest_band}`);
  } else if (Number.isFinite(target.guest_count) && Number.isFinite(candidate.guest_count)) {
    const delta = Math.abs(target.guest_count - candidate.guest_count);
    const bonus = Math.max(0, 18 - Math.floor(delta / 10));
    if (bonus > 0) {
      score += bonus;
      reasons.push(`guest count proximity: Δ${delta}`);
    }
  }
  if (target.season && candidate.season === target.season) {
    score += 12;
    reasons.push(`same season: ${candidate.season}`);
  }
  if (target.venue_name && candidate.venue_name && target.venue_name.toLowerCase() === candidate.venue_name.toLowerCase()) {
    score += 30;
    reasons.push('same venue');
  }
  if (target.client_email && candidate.client_email && target.client_email.toLowerCase() === candidate.client_email.toLowerCase()) {
    score += 30;
    reasons.push('same client');
  }
  const targetItems = new Set((target.item_ids || []).map((id) => Number(id)));
  const candidateItems = new Set((candidate.item_ids || []).map((id) => Number(id)));
  let overlap = 0;
  targetItems.forEach((id) => { if (candidateItems.has(id)) overlap += 1; });
  if (overlap > 0) {
    score += Math.min(26, overlap * 4);
    reasons.push(`${overlap} overlapping items`);
  }
  const targetCategories = Object.keys(target.category_counts || {});
  const candidateCategories = new Set(Object.keys(candidate.category_counts || {}));
  const categoryOverlap = targetCategories.filter((category) => candidateCategories.has(category)).length;
  if (categoryOverlap > 0) {
    score += Math.min(16, categoryOverlap * 3);
    reasons.push(`${categoryOverlap} overlapping categories`);
  }
  if (candidate.outcome_bucket === 'confirmed' || candidate.outcome_bucket === 'approved') score += 10;
  if (candidate.outcome_bucket === 'closed') score -= 8;
  if (candidate.has_unsigned_changes) score -= 5;
  return { score, reasons };
}

function getMemoryFeaturesByQuoteId(db, quoteId) {
  const row = db.prepare('SELECT * FROM quote_pattern_memories WHERE org_id = ? AND quote_id = ?').get(ORG_ID, quoteId);
  if (!row) return null;
  return {
    row,
    features: safeJsonParse(row.features_json, {}),
    tags: safeJsonParse(row.tags_json, []),
  };
}

function ensureBackfill(db, limit = 200) {
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM quote_pattern_memories WHERE org_id = ?').get(ORG_ID);
  if (Number(countRow?.count || 0) > 0) return;
  const quoteRows = db.prepare(`
    SELECT id
    FROM quotes
    WHERE org_id = ?
    ORDER BY updated_at DESC, id DESC
    LIMIT ?
  `).all(ORG_ID, Math.max(1, Math.min(1000, Number(limit || 200))));
  quoteRows.forEach((row) => {
    try {
      upsertMemoryRecord(db, row.id, 'backfill');
    } catch {
      // Leave malformed historical quotes out of the initial memory pass.
    }
  });
}

function listSimilarQuotes(db, quoteId, limit = 5) {
  ensureBackfill(db);
  upsertMemoryRecord(db, quoteId, 'assistant_retrieval');
  const target = getMemoryFeaturesByQuoteId(db, quoteId);
  if (!target) return [];
  const rows = db.prepare('SELECT * FROM quote_pattern_memories WHERE org_id = ? AND quote_id != ? ORDER BY last_synced_at DESC').all(ORG_ID, quoteId);
  return rows
    .map((row) => {
      const candidate = safeJsonParse(row.features_json, {});
      const similarity = scoreSimilarity(target.features, candidate);
      return {
        memory_id: Number(row.id),
        quote_id: Number(row.quote_id),
        quote_name: row.quote_name,
        status: row.status,
        summary: row.summary,
        event_date: row.event_date || null,
        venue_name: row.venue_name || null,
        client_name: row.client_name || null,
        total: Number(row.total || 0),
        score: similarity.score,
        reasons: similarity.reasons,
        tags: safeJsonParse(row.tags_json, []),
        features: candidate,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => (b.score - a.score) || (String(b.event_date || '').localeCompare(String(a.event_date || ''))))
    .slice(0, Math.max(1, Math.min(20, Number(limit || 5))));
}

function getPatternSuggestions(db, quoteId, limit = 5) {
  const similar = listSimilarQuotes(db, quoteId, 8);
  const currentMemory = getMemoryFeaturesByQuoteId(db, quoteId);
  const currentItems = new Set((currentMemory?.features?.item_ids || []).map((id) => Number(id)));
  const quoteIds = similar.map((entry) => Number(entry.quote_id)).filter(Boolean);
  if (!quoteIds.length) return [];
  const rows = db.prepare(`
    SELECT qi.item_id, qi.quantity, i.title, i.category, qi.quote_id
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.quote_id IN (${quoteIds.map(() => '?').join(',')})
      AND COALESCE(qi.hidden_from_quote, 0) != 1
  `).all(...quoteIds);
  const bundles = buildBundleSuggestions(rows, Array.from(currentItems));
  return bundles.slice(0, Math.max(1, Math.min(10, Number(limit || 5)))).map((entry) => ({
    id: entry.item_id,
    title: entry.title,
    category: entry.category,
    reason: `Appears in ${entry.count} similar quotes`,
    supporting_quotes: similar.filter((row) => (row.features?.item_ids || []).includes(entry.item_id)).slice(0, 3).map((row) => ({
      id: row.quote_id,
      name: row.quote_name,
      score: row.score,
    })),
  }));
}

function listRecentMemoryRecords(db, limit = 20) {
  ensureBackfill(db);
  const rows = db.prepare(`
    SELECT *
    FROM quote_pattern_memories
    WHERE org_id = ?
    ORDER BY last_synced_at DESC, id DESC
    LIMIT ?
  `).all(ORG_ID, Math.max(1, Math.min(100, Number(limit || 20))));
  return rows.map((row) => ({
    id: Number(row.id),
    quote_id: Number(row.quote_id),
    quote_name: row.quote_name,
    status: row.status,
    event_type: row.event_type,
    guest_count: Number(row.guest_count || 0),
    event_date: row.event_date || null,
    venue_name: row.venue_name || null,
    client_name: row.client_name || null,
    total: Number(row.total || 0),
    summary: row.summary || '',
    sync_reason: row.sync_reason || null,
    last_synced_at: row.last_synced_at || null,
    tags: safeJsonParse(row.tags_json, []),
  }));
}

module.exports = {
  upsertMemoryRecord,
  listSimilarQuotes,
  getPatternSuggestions,
  listRecentMemoryRecords,
};
