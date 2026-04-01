const { requireQuoteById } = require('../db/queries/quotes');
const { getActorEmail } = require('../db/queries/users');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function listPayments(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  let payments = [];
  try {
    payments = db.prepare(
      'SELECT * FROM quote_payments WHERE quote_id = ? ORDER BY paid_at DESC, created_at DESC'
    ).all(quoteId);
  } catch (e) {
    payments = [];
  }
  return { payments };
}

function addPayment(db, quoteId, body, deps) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const { amount, method, reference, note, paid_at } = body || {};
  if (amount == null || amount === '') throw createError(400, 'amount required');
  const amt = parseFloat(amount);
  if (Number.isNaN(amt)) throw createError(400, 'amount must be a number');

  const { actor, logActivity, req } = deps;
  const userId = actor && actor.sub;
  const userEmail = getActorEmail(db, actor);

  try {
    db.prepare(
      'INSERT INTO quote_payments (quote_id, amount, method, status, reference, paid_at, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(quoteId, amt, method || null, 'charged', reference || null, paid_at || null, note || null, userId || null);
    logActivity(db, quoteId, 'payment_applied', `Recorded payment: $${amt.toFixed(2)} (${method || 'offline'})`, null, null, req);
    try {
      db.prepare(
        'INSERT INTO billing_history (quote_id, event_type, amount, note, user_email) VALUES (?, ?, ?, ?, ?)'
      ).run(quoteId, 'payment_received', amt, note || null, userEmail);
    } catch (e) {}
  } catch (e) {
    throw createError(500, e.message);
  }

  return listPayments(db, quoteId);
}

function deletePayment(db, quoteId, paymentId, actor) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const payment = db.prepare('SELECT * FROM quote_payments WHERE id = ? AND quote_id = ?').get(paymentId, quoteId);
  if (!payment) throw createError(404, 'Payment not found');

  const userEmail = getActorEmail(db, actor);
  try {
    db.prepare(
      'INSERT INTO billing_history (quote_id, event_type, amount, note, user_email) VALUES (?, ?, ?, ?, ?)'
    ).run(quoteId, 'payment_removed', payment.amount, payment.note || null, userEmail);
  } catch (e) {}

  db.prepare('DELETE FROM quote_payments WHERE id = ?').run(paymentId);
  return listPayments(db, quoteId);
}

function addRefund(db, quoteId, body, actor) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const { amount, note } = body || {};
  if (amount == null || amount === '') throw createError(400, 'amount required');
  const amt = parseFloat(amount);
  if (Number.isNaN(amt) || amt <= 0) throw createError(400, 'refund amount must be a positive number');

  const userId = actor && actor.sub;
  const userEmail = getActorEmail(db, actor);
  const refundAmount = -amt;

  try {
    db.prepare(
      'INSERT INTO quote_payments (quote_id, amount, method, status, note, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(quoteId, refundAmount, 'refund', 'refunded', note || null, userId || null);
    try {
      db.prepare(
        'INSERT INTO billing_history (quote_id, event_type, amount, note, user_email) VALUES (?, ?, ?, ?, ?)'
      ).run(quoteId, 'refunded', amt, note || null, userEmail);
    } catch (e) {}
  } catch (e) {
    throw createError(500, e.message);
  }

  return listPayments(db, quoteId);
}

function listDamageCharges(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  let charges = [];
  try {
    charges = db.prepare(
      'SELECT * FROM quote_damage_charges WHERE quote_id = ? ORDER BY created_at DESC'
    ).all(quoteId);
  } catch (e) {
    charges = [];
  }
  return { charges };
}

function addDamageCharge(db, quoteId, body, deps) {
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  if ((quote.status || 'draft') !== 'closed') {
    throw createError(400, 'Damage charges can only be added to closed quotes');
  }

  const { title, amount, note } = body || {};
  if (!title) throw createError(400, 'title required');
  const amt = parseFloat(amount);
  if (Number.isNaN(amt) || amt <= 0) throw createError(400, 'amount must be a positive number');

  const { actor, logActivity, req } = deps;
  const userId = actor && actor.sub;

  try {
    db.prepare(
      'INSERT INTO quote_damage_charges (quote_id, title, amount, note, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(quoteId, title, amt, note || null, userId || null);
    logActivity(db, quoteId, 'damage_charge_added', `Damage charge added: ${title} ($${amt.toFixed(2)})`, null, amt.toFixed(2), req);
  } catch (e) {
    throw createError(500, e.message);
  }

  return listDamageCharges(db, quoteId);
}

function deleteDamageCharge(db, quoteId, chargeId, deps) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const charge = db.prepare('SELECT * FROM quote_damage_charges WHERE id = ? AND quote_id = ?').get(chargeId, quoteId);
  if (!charge) throw createError(404, 'Charge not found');

  const { logActivity, req } = deps;
  db.prepare('DELETE FROM quote_damage_charges WHERE id = ?').run(chargeId);
  logActivity(
    db,
    quoteId,
    'damage_charge_removed',
    `Damage charge removed: ${charge.title} ($${Number(charge.amount).toFixed(2)})`,
    Number(charge.amount).toFixed(2),
    null,
    req
  );

  return { deleted: true, ...listDamageCharges(db, quoteId) };
}

function listAdjustments(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  let adjustments = [];
  try {
    adjustments = db.prepare(
      'SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(quoteId);
  } catch (e) {
    adjustments = [];
  }
  return { adjustments };
}

function addAdjustment(db, quoteId, body, deps) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const { label, type, value_type, amount, sort_order } = body || {};
  if (!label) throw createError(400, 'label required');
  if (!['discount', 'surcharge'].includes(type)) throw createError(400, 'type must be discount or surcharge');
  if (!['percent', 'fixed'].includes(value_type)) throw createError(400, 'value_type must be percent or fixed');
  const amt = parseFloat(amount);
  if (Number.isNaN(amt) || amt < 0) throw createError(400, 'amount must be a non-negative number');
  if (value_type === 'percent' && amt > 100) throw createError(400, 'percent amount cannot exceed 100');

  const { logActivity, markUnsignedChangesIfApproved, req } = deps;
  try {
    db.prepare(
      'INSERT INTO quote_adjustments (quote_id, label, type, value_type, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(quoteId, label, type, value_type, amt, sort_order != null ? sort_order : 0);
    logActivity(
      db,
      quoteId,
      'adjustment_added',
      `${type === 'discount' ? 'Discount' : 'Surcharge'} added: ${label} (${value_type === 'percent' ? `${amt}%` : `$${amt.toFixed(2)}`})`,
      null,
      null,
      req
    );
  } catch (e) {
    throw createError(500, e.message);
  }

  markUnsignedChangesIfApproved(db, quoteId);
  return listAdjustments(db, quoteId);
}

function updateAdjustment(db, quoteId, adjustmentId, body, deps) {
  const adj = db.prepare('SELECT * FROM quote_adjustments WHERE id = ? AND quote_id = ?').get(adjustmentId, quoteId);
  if (!adj) throw createError(404, 'Adjustment not found');

  const { label, type, value_type, amount, sort_order } = body || {};
  const newLabel = label !== undefined ? label : adj.label;
  const newType = type !== undefined ? type : adj.type;
  const newValueType = value_type !== undefined ? value_type : adj.value_type;
  const newAmt = amount !== undefined ? parseFloat(amount) : adj.amount;
  const newSort = sort_order !== undefined ? sort_order : adj.sort_order;

  if (!['discount', 'surcharge'].includes(newType)) throw createError(400, 'type must be discount or surcharge');
  if (!['percent', 'fixed'].includes(newValueType)) throw createError(400, 'value_type must be percent or fixed');
  if (Number.isNaN(newAmt) || newAmt < 0) throw createError(400, 'amount must be a non-negative number');

  db.prepare(
    'UPDATE quote_adjustments SET label=?, type=?, value_type=?, amount=?, sort_order=? WHERE id=?'
  ).run(newLabel, newType, newValueType, newAmt, newSort, adjustmentId);

  deps.markUnsignedChangesIfApproved(db, quoteId);
  return listAdjustments(db, quoteId);
}

function deleteAdjustment(db, quoteId, adjustmentId, deps) {
  const adj = db.prepare('SELECT * FROM quote_adjustments WHERE id = ? AND quote_id = ?').get(adjustmentId, quoteId);
  if (!adj) throw createError(404, 'Adjustment not found');

  db.prepare('DELETE FROM quote_adjustments WHERE id = ?').run(adjustmentId);
  deps.logActivity(db, quoteId, 'adjustment_removed', `Adjustment removed: ${adj.label}`, null, null, deps.req);
  deps.markUnsignedChangesIfApproved(db, quoteId);
  return { deleted: true, ...listAdjustments(db, quoteId) };
}

module.exports = {
  listPayments,
  addPayment,
  deletePayment,
  addRefund,
  listDamageCharges,
  addDamageCharge,
  deleteDamageCharge,
  listAdjustments,
  addAdjustment,
  updateAdjustment,
  deleteAdjustment,
};
