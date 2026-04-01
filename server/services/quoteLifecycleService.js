const { requireQuoteById } = require('../db/queries/quotes');
const quoteFulfillmentService = require('./quoteFulfillmentService');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function deleteQuote(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  db.prepare('DELETE FROM quotes WHERE id = ? AND org_id = ?').run(quoteId, ORG_ID);
  return { deleted: true };
}

function confirmQuote({ db, quoteId, actor, quoteService }) {
  const result = quoteService.transitionQuoteStatus({
    db,
    quoteId,
    fromStatuses: 'approved',
    toStatus: 'confirmed',
    actor,
    clearUnsignedChanges: true,
    description: 'Quote confirmed — inventory reserved',
  });
  quoteFulfillmentService.syncFulfillmentForQuote(db, quoteId);
  return result;
}

function closeQuote({ db, quoteId, actor, quoteService }) {
  return quoteService.transitionQuoteStatus({
    db,
    quoteId,
    fromStatuses: 'confirmed',
    toStatus: 'closed',
    actor,
    description: 'Quote closed — inventory released, damage charges enabled',
  });
}

function approveQuote({ db, quoteId, actor, quoteService }) {
  return quoteService.transitionQuoteStatus({
    db,
    quoteId,
    fromStatuses: ['draft', 'sent', 'approved', 'confirmed', 'closed'],
    toStatus: 'approved',
    actor,
    clearUnsignedChanges: true,
  });
}

function revertQuote({ db, quoteId, actor, quoteService }) {
  return quoteService.transitionQuoteStatus({
    db,
    quoteId,
    fromStatuses: ['draft', 'sent', 'approved', 'confirmed', 'closed'],
    toStatus: 'draft',
    actor,
    clearUnsignedChanges: true,
  });
}

function duplicateQuote({ db, sourceQuoteId, quoteService }) {
  return quoteService.duplicateQuote({ db, sourceQuoteId });
}

module.exports = {
  confirmQuote,
  closeQuote,
  approveQuote,
  revertQuote,
  deleteQuote,
  duplicateQuote,
};
