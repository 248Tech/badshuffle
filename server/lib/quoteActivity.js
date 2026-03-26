function getActor(ctx) {
  if (!ctx) return null;
  return ctx.user ? ctx.user : ctx;
}

function getUserEmail(db, actor) {
  if (!actor) return null;
  if (actor.email) return actor.email;
  if (!actor.sub) return null;
  return db.prepare('SELECT email FROM users WHERE id = ?').get(actor.sub)?.email || null;
}

function logActivity(db, quoteId, eventType, description, oldValue, newValue, ctx) {
  const actor = getActor(ctx);
  const userId = actor && actor.sub ? actor.sub : null;
  const userEmail = getUserEmail(db, actor);

  try {
    db.prepare(
      'INSERT INTO quote_activity_log (quote_id, event_type, description, old_value, new_value, user_id, user_email) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(quoteId, eventType, description || null, oldValue || null, newValue || null, userId, userEmail);
  } catch (e) {}
}

function markUnsignedChangesIfApproved(db, quoteId) {
  const q = db.prepare('SELECT status FROM quotes WHERE id = ?').get(quoteId);
  if (q && (q.status === 'approved' || q.status === 'confirmed')) {
    db.prepare("UPDATE quotes SET has_unsigned_changes = 1, updated_at = datetime('now') WHERE id = ?").run(quoteId);
  }
}

function buildQuoteItemSnapshot(row) {
  if (!row) return null;
  const title = ((row.label || row.item_title || '').trim() || row.item_title || 'Item');
  const unitPrice = Number(row.unit_price || 0).toFixed(2);
  const qty = row.quantity ?? 1;
  return `Title: ${title}, Unit price: $${unitPrice}, Qty: ${qty}`;
}

function buildCustomItemSnapshot(row) {
  if (!row) return null;
  const title = row.title || '';
  const unitPrice = Number(row.unit_price || 0).toFixed(2);
  const qty = row.quantity ?? 1;
  return `Title: ${title}, Unit price: $${unitPrice}, Qty: ${qty}`;
}

module.exports = {
  logActivity,
  markUnsignedChangesIfApproved,
  buildQuoteItemSnapshot,
  buildCustomItemSnapshot,
};
