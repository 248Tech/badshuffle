const { getQuoteById } = require('../queries/quotes');

function countQuotesByWhere(db, whereSql = '', params = []) {
  const row = db.prepare(`SELECT COUNT(*) AS total FROM quotes ${whereSql}`).get(...params);
  return Number(row?.total || 0);
}

function listQuotesByWhere(db, whereSql = '', params = [], orderSql = '', limit = null, offset = null) {
  let sql = `SELECT * FROM quotes ${whereSql}${orderSql}`;
  const finalParams = params.slice();
  if (limit != null && offset != null) {
    sql += ' LIMIT ? OFFSET ?';
    finalParams.push(limit, offset);
  }
  return db.prepare(sql).all(...finalParams);
}

function getDefaultTaxRate(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
  return row ? parseFloat(row.value) : 0;
}

function listSummaryQuotes(db, orgId = 1) {
  return db.prepare(
    'SELECT id, name, status, event_date, guest_count, created_at, has_unsigned_changes FROM quotes WHERE org_id = ?'
  ).all(orgId);
}

function listQuoteActivityEntries(db, quoteId) {
  const entries = [];
  try {
    const contractLogs = db.prepare(
      'SELECT id, changed_at as created_at, user_email, old_body, new_body FROM contract_logs WHERE quote_id = ?'
    ).all(quoteId);
    contractLogs.forEach((r) => {
      const oldLen = (r.old_body || '').length;
      const newLen = (r.new_body || '').length;
      let desc = 'Contract updated';
      if (oldLen === 0 && newLen > 0) desc = 'Contract body created';
      else if (newLen === 0) desc = 'Contract body cleared';
      else desc = `Contract body updated (${oldLen} -> ${newLen} characters)`;
      entries.push({
        id: `c-${r.id}`,
        created_at: r.created_at,
        user_email: r.user_email,
        event_type: 'contract_updated',
        description: desc,
        old_value: oldLen ? `${oldLen} characters` : null,
        new_value: newLen ? `${newLen} characters` : null,
      });
    });
    const activityLogs = db.prepare(
      'SELECT id, created_at, user_email, event_type, description, old_value, new_value FROM quote_activity_log WHERE quote_id = ?'
    ).all(quoteId);
    activityLogs.forEach((r) => {
      entries.push({
        id: `a-${r.id}`,
        created_at: r.created_at,
        user_email: r.user_email,
        event_type: r.event_type,
        description: r.description,
        old_value: r.old_value,
        new_value: r.new_value,
      });
    });
    entries.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch (e) {}
  return entries;
}

function getQuoteItems(db, quoteId) {
  return db.prepare(`
    SELECT qi.id as qitem_id, qi.quantity, qi.label, qi.sort_order, qi.hidden_from_quote, qi.section_id,
           qi.unit_price_override, qi.discount_type, qi.discount_amount,
           qi.description as qi_description, qi.notes as qi_notes,
           i.id, i.title, i.photo_url, i.source, i.hidden,
           i.unit_price, i.taxable, i.category, i.labor_hours, i.is_subrental
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.quote_id = ?
    ORDER BY qi.sort_order ASC, qi.id ASC
  `).all(quoteId);
}

function getQuoteCustomItems(db, quoteId) {
  return db.prepare(
    'SELECT * FROM quote_custom_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(quoteId);
}

function getQuoteAdjustments(db, quoteId) {
  try {
    return db.prepare(
      'SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(quoteId);
  } catch (e) {
    return [];
  }
}

function getQuoteContractSummary(db, quoteId) {
  return db.prepare(
    'SELECT signed_at, signed_quote_total, signer_ip FROM contracts WHERE quote_id = ?'
  ).get(quoteId) || {};
}

function getQuoteAmountPaid(db, quoteId) {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS amount_paid FROM quote_payments WHERE quote_id = ?'
  ).get(quoteId) || {};
  return Number(row.amount_paid || 0);
}

function getQuoteDetailSnapshot(db, quoteId, orgId = 1) {
  const quote = getQuoteById(db, quoteId, orgId);
  if (!quote) return null;
  const contract = getQuoteContractSummary(db, quoteId);
  const amount_paid = getQuoteAmountPaid(db, quoteId);
  const signed_quote_total = contract.signed_quote_total != null ? Number(contract.signed_quote_total) : null;
  const signed_remaining_balance = signed_quote_total != null ? signed_quote_total - amount_paid : null;
  const today = new Date().toISOString().slice(0, 10);
  const is_expired = !!(quote.expires_at && quote.expires_at < today);

  return {
    quote,
    items: getQuoteItems(db, quoteId),
    customItems: getQuoteCustomItems(db, quoteId),
    adjustments: getQuoteAdjustments(db, quoteId),
    signed_at: contract.signed_at || null,
    signed_quote_total,
    signed_remaining_balance,
    amount_paid,
    is_expired,
  };
}

module.exports = {
  countQuotesByWhere,
  listQuotesByWhere,
  getDefaultTaxRate,
  listSummaryQuotes,
  listQuoteActivityEntries,
  getQuoteItems,
  getQuoteCustomItems,
  getQuoteAdjustments,
  getQuoteContractSummary,
  getQuoteAmountPaid,
  getQuoteDetailSnapshot,
};
