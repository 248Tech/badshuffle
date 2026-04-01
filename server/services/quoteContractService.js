const { requireQuoteById } = require('../db/queries/quotes');
const { getActorEmail } = require('../db/queries/users');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getContract(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  let contract = null;
  try {
    contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quoteId);
  } catch (e) {
    contract = null;
  }
  return { contract: contract || null };
}

function updateContract(db, quoteId, body, actor) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const { body_html } = body || {};
  const existing = db.prepare('SELECT id, body_html FROM contracts WHERE quote_id = ?').get(quoteId);
  const oldBody = existing ? (existing.body_html || null) : null;
  const newBody = body_html !== undefined ? (body_html || null) : oldBody;

  if (existing) {
    db.prepare("UPDATE contracts SET body_html = ?, updated_at = datetime('now') WHERE quote_id = ?")
      .run(newBody, quoteId);
  } else {
    db.prepare('INSERT INTO contracts (quote_id, body_html) VALUES (?, ?)').run(quoteId, newBody);
  }

  const userId = actor && actor.sub;
  const userEmail = getActorEmail(db, actor);
  try {
    db.prepare(
      'INSERT INTO contract_logs (quote_id, user_id, user_email, old_body, new_body) VALUES (?, ?, ?, ?, ?)'
    ).run(quoteId, userId || null, userEmail, oldBody, newBody);
  } catch (e) {
    console.error('[quotes] Failed to write contract log:', e.message);
  }

  const contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quoteId);
  return { contract };
}

function listContractLogs(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  let logs = [];
  try {
    logs = db.prepare(
      'SELECT id, quote_id, changed_at, user_id, user_email, old_body, new_body FROM contract_logs WHERE quote_id = ? ORDER BY changed_at DESC'
    ).all(quoteId);
  } catch (e) {
    logs = [];
  }
  return { logs };
}

module.exports = {
  getContract,
  updateContract,
  listContractLogs,
};
