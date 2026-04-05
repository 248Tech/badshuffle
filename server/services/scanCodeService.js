const crypto = require('crypto');

function randomSegment(size = 6) {
  return crypto.randomBytes(size).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, size).toUpperCase();
}

function generateItemScanCode() {
  return `ITEM-${randomSegment(10)}`;
}

function generatePullSheetScanCode() {
  return `PULL-${randomSegment(10)}`;
}

function ensureUniqueScanCode(db, tableName, nextCode) {
  let candidate = nextCode();
  while (db.prepare(`SELECT 1 AS found FROM ${tableName} WHERE scan_code = ? LIMIT 1`).get(candidate)) {
    candidate = nextCode();
  }
  return candidate;
}

function ensureItemScanCode(db, itemId) {
  const existing = db.prepare('SELECT id, scan_code FROM items WHERE id = ?').get(itemId);
  if (!existing) return null;
  if (existing.scan_code) return existing.scan_code;
  const scanCode = ensureUniqueScanCode(db, 'items', generateItemScanCode);
  db.prepare("UPDATE items SET scan_code = ?, updated_at = datetime('now') WHERE id = ?").run(scanCode, itemId);
  return scanCode;
}

function ensurePullSheetScanCode(db, quoteId) {
  const existing = db.prepare('SELECT id, scan_code FROM quote_pull_sheets WHERE quote_id = ?').get(quoteId);
  if (existing?.scan_code) return existing.scan_code;
  const scanCode = ensureUniqueScanCode(db, 'quote_pull_sheets', generatePullSheetScanCode);
  if (existing?.id) {
    db.prepare("UPDATE quote_pull_sheets SET scan_code = ?, updated_at = datetime('now') WHERE id = ?").run(scanCode, existing.id);
    return scanCode;
  }
  db.prepare('INSERT INTO quote_pull_sheets (quote_id, scan_code) VALUES (?, ?)').run(quoteId, scanCode);
  return scanCode;
}

function resolveScanCode(db, scanCode) {
  const normalized = String(scanCode || '').trim().toUpperCase();
  if (!normalized) return null;

  const item = db.prepare('SELECT id, title, scan_code FROM items WHERE scan_code = ?').get(normalized);
  if (item) {
    return {
      entityType: 'item',
      entityId: Number(item.id),
      scanCode: item.scan_code,
      label: item.title || 'Product',
      href: `/inventory/${item.id}`,
    };
  }

  const pullSheet = db.prepare(`
    SELECT ps.id, ps.quote_id, ps.scan_code, q.name
    FROM quote_pull_sheets ps
    JOIN quotes q ON q.id = ps.quote_id
    WHERE ps.scan_code = ?
  `).get(normalized);
  if (pullSheet) {
    return {
      entityType: 'pull_sheet',
      entityId: Number(pullSheet.id),
      quoteId: Number(pullSheet.quote_id),
      scanCode: pullSheet.scan_code,
      label: pullSheet.name || 'Pull sheet',
      href: `/quotes/${pullSheet.quote_id}?tab=pull-sheet`,
    };
  }

  return null;
}

module.exports = {
  ensureItemScanCode,
  ensurePullSheetScanCode,
  resolveScanCode,
};
