const DEFAULT_ORG_ID = 1;

function getQuoteById(db, quoteId, orgId = DEFAULT_ORG_ID) {
  return db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, orgId) || null;
}

function getQuoteIdRow(db, quoteId, orgId = DEFAULT_ORG_ID) {
  return db.prepare('SELECT id FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, orgId) || null;
}

function requireQuoteById(db, quoteId, message = 'Not found', orgId = DEFAULT_ORG_ID) {
  const quote = getQuoteById(db, quoteId, orgId);
  if (!quote) {
    const error = new Error(message);
    error.statusCode = 404;
    throw error;
  }
  return quote;
}

module.exports = {
  getQuoteById,
  getQuoteIdRow,
  requireQuoteById,
};
