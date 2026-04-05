const express = require('express');
const crypto = require('crypto');
const {
  logActivity,
  markUnsignedChangesIfApproved,
  buildQuoteItemSnapshot,
  buildCustomItemSnapshot,
} = require('../lib/quoteActivity');
const { upsertItemStats, recalculateItemSalesStats } = require('../services/itemStatsService');
const quoteService = require('../services/quoteService');
const quoteListService = require('../services/quoteListService');
const quoteSectionService = require('../services/quoteSectionService');
const quoteItemService = require('../services/quoteItemService');
const quoteCustomItemService = require('../services/quoteCustomItemService');
const quoteContractService = require('../services/quoteContractService');
const quoteLifecycleService = require('../services/quoteLifecycleService');
const quoteFinanceService = require('../services/quoteFinanceService');
const quoteCoreService = require('../services/quoteCoreService');
const quoteFileService = require('../services/quoteFileService');
const quoteFulfillmentService = require('../services/quoteFulfillmentService');
const quotePullSheetService = require('../services/quotePullSheetService');
const { requireModulePermission } = require('../lib/permissionMiddleware');
const { ACCESS_MODIFY } = require('../lib/permissions');
const DISCOUNT_TYPES = new Set(['none', 'percent', 'fixed']);

module.exports = function makeRouter(db, uploadsDir) {
  const router = express.Router();
  const requireProjectModify = requireModulePermission(db, 'projects', ACCESS_MODIFY);
  const requireFulfillmentModify = requireModulePermission(db, 'fulfillment', ACCESS_MODIFY);

  // GET /api/quotes — include computed total, amount_paid, remaining_balance, overpaid; optional filters
  // Query params: search (name/client), status, event_from, event_to, has_balance, venue, page, limit, sort_by, sort_dir
  router.get('/', async (req, res) => {
    try {
      const result = await quoteListService.listQuotes(db, req.query || {}, {
        summarizeQuotesForList: quoteService.summarizeQuotesForList,
        diagnostics: req.app?.locals?.diagnostics || null,
        requestId: req.get('x-request-id') || null,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/summary — dashboard aggregates (must be before /:id)
  router.get('/summary', (req, res) => {
    try {
      res.json(quoteListService.buildQuoteSummary(db));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/pull-sheet/aggregate?ids=1,2,3
  router.get('/pull-sheet/aggregate', (req, res) => {
    try {
      res.json(quotePullSheetService.getAggregatePullSheet(db, req.query.ids, quoteSectionService));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/contract
  router.get('/:id/contract', (req, res) => {
    try {
      res.json(quoteContractService.getContract(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/quotes/:id/contract — create or update contract body (staff only)
  router.put('/:id/contract', requireProjectModify, (req, res) => {
    try {
      res.json(quoteContractService.updateContract(db, req.params.id, req.body || {}, req.user));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/contract/logs
  router.get('/:id/contract/logs', (req, res) => {
    try {
      res.json(quoteContractService.listContractLogs(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/files — list files attached to this quote
  router.get('/:id/files', (req, res) => {
    try {
      res.json(quoteFileService.listQuoteFiles(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/files — attach a file (body: { file_id })
  router.post('/:id/files', requireProjectModify, (req, res) => {
    try {
      res.json(quoteFileService.attachQuoteFile(db, req.params.id, req.body || {}, { logActivity, req }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/files/:fid
  router.delete('/:id/files/:fid', requireProjectModify, (req, res) => {
    try {
      res.json(quoteFileService.deleteQuoteFile(db, req.params.id, req.params.fid));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/payments
  router.get('/:id/payments', (req, res) => {
    try {
      res.json(quoteFinanceService.listPayments(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/payments — record a payment (body: amount, method, reference, note, paid_at)
  router.post('/:id/payments', requireProjectModify, (req, res) => {
    try {
      res.json(
        quoteFinanceService.addPayment(db, req.params.id, req.body || {}, {
          actor: req.user,
          logActivity,
          req,
        })
      );
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/payments/:pid — remove a payment
  router.delete('/:id/payments/:pid', requireProjectModify, (req, res) => {
    try {
      res.json(quoteFinanceService.deletePayment(db, req.params.id, req.params.pid, req.user));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/refund — record a refund (body: amount, note); adds negative payment and billing_history
  router.post('/:id/refund', requireProjectModify, (req, res) => {
    try {
      res.json(quoteFinanceService.addRefund(db, req.params.id, req.body || {}, req.user));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/activity — unified activity log (contract, payments, files, items)
  router.get('/:id/activity', (req, res) => {
    try {
      res.json(quoteCoreService.getQuoteActivity(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/pull-sheet
  router.get('/:id/pull-sheet', (req, res) => {
    try {
      res.json(quotePullSheetService.getPullSheet(db, req.params.id, quoteSectionService));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id
  router.get('/:id', async (req, res) => {
    try {
      res.json(await quoteCoreService.getQuoteDetail(db, req.params.id, {
        quoteSectionService,
        diagnostics: req.app?.locals?.diagnostics || null,
        requestId: req.get('x-request-id') || null,
      }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes
  router.post('/', requireProjectModify, async (req, res) => {
    try {
      res.status(201).json(await quoteCoreService.createQuote(db, req.body || {}, { quoteSectionService, req, logActivity }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/quotes/:id
  router.put('/:id', requireProjectModify, async (req, res) => {
    try {
      res.json(await quoteCoreService.updateQuote(db, req.params.id, req.body || {}, {
        quoteSectionService,
        logActivity,
        req,
      }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/ensure-public-token — set public_token if missing (for View Quote)
  router.post('/:id/ensure-public-token', requireProjectModify, (req, res) => {
    try {
      res.json(quoteCoreService.ensurePublicToken(db, req.params.id, () => crypto.randomBytes(24).toString('hex')));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/send — email; set status to 'sent', generate public_token
  router.post('/:id/send', requireProjectModify, async (req, res) => {
    try {
      const result = await quoteCoreService.sendQuote({
        db,
        uploadsDir,
        quoteId: req.params.id,
        actor: req.user,
        input: req.body || {},
        quoteService,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/unsigned-changes — dismiss "unsigned changes" banner without re-sending
  router.delete('/:id/unsigned-changes', requireProjectModify, (req, res) => {
    try {
      res.json(quoteCoreService.clearUnsignedChanges(db, req.params.id, { logActivity, req }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/confirm — transition approved → confirmed (hard inventory reservation)
  router.post('/:id/confirm', requireProjectModify, (req, res) => {
    try {
      const result = quoteLifecycleService.confirmQuote({
        db,
        quoteId: req.params.id,
        actor: req.user,
        quoteService,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/close — transition confirmed → closed (post-event, releases inventory)
  router.post('/:id/close', requireProjectModify, (req, res) => {
    try {
      const result = quoteLifecycleService.closeQuote({
        db,
        quoteId: req.params.id,
        actor: req.user,
        quoteService,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/damage-charges
  router.get('/:id/damage-charges', (req, res) => {
    try {
      res.json(quoteFinanceService.listDamageCharges(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/damage-charges — add a damage charge (closed quotes only)
  router.post('/:id/damage-charges', requireProjectModify, (req, res) => {
    try {
      const result = quoteFinanceService.addDamageCharge(db, req.params.id, req.body || {}, {
        actor: req.user,
        logActivity,
        req,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/damage-charges/:cid
  router.delete('/:id/damage-charges/:cid', requireProjectModify, (req, res) => {
    try {
      res.json(quoteFinanceService.deleteDamageCharge(db, req.params.id, req.params.cid, { logActivity, req }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/adjustments
  router.get('/:id/adjustments', (req, res) => {
    try {
      res.json(quoteFinanceService.listAdjustments(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/adjustments
  router.post('/:id/adjustments', requireProjectModify, (req, res) => {
    try {
      const result = quoteFinanceService.addAdjustment(db, req.params.id, req.body || {}, {
        logActivity,
        markUnsignedChangesIfApproved,
        req,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/quotes/:id/adjustments/:aid
  router.put('/:id/adjustments/:aid', requireProjectModify, (req, res) => {
    try {
      res.json(
        quoteFinanceService.updateAdjustment(db, req.params.id, req.params.aid, req.body || {}, {
          markUnsignedChangesIfApproved,
        })
      );
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/adjustments/:aid
  router.delete('/:id/adjustments/:aid', requireProjectModify, (req, res) => {
    try {
      res.json(
        quoteFinanceService.deleteAdjustment(db, req.params.id, req.params.aid, {
          logActivity,
          markUnsignedChangesIfApproved,
          req,
        })
      );
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/approve — set status to 'approved'
  router.post('/:id/approve', requireProjectModify, (req, res) => {
    try {
      const result = quoteLifecycleService.approveQuote({
        db,
        quoteId: req.params.id,
        actor: req.user,
        quoteService,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/revert — revert approved/sent back to draft
  router.post('/:id/revert', requireProjectModify, (req, res) => {
    try {
      const result = quoteLifecycleService.revertQuote({
        db,
        quoteId: req.params.id,
        actor: req.user,
        quoteService,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id
  router.delete('/:id', requireProjectModify, (req, res) => {
    try {
      res.json(quoteLifecycleService.deleteQuote(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/duplicate — create a copy (same details, items, custom items); no lead_id
  router.post('/:id/duplicate', requireProjectModify, (req, res) => {
    try {
      const result = quoteLifecycleService.duplicateQuote({ db, sourceQuoteId: req.params.id, quoteService });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/:id/sections', requireProjectModify, (req, res) => {
    try {
      const section = quoteSectionService.addSection(db, req.params.id, req.body || {});
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.status(201).json({ section });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/:id/sections/:sectionId', requireProjectModify, (req, res) => {
    try {
      const section = quoteSectionService.updateSection(db, req.params.id, req.params.sectionId, req.body || {});
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.json({ section });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/:id/sections/:sectionId/duplicate', requireProjectModify, (req, res) => {
    try {
      const section = quoteSectionService.duplicateSection(db, req.params.id, req.params.sectionId);
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.status(201).json({ section });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.delete('/:id/sections/:sectionId', requireProjectModify, (req, res) => {
    try {
      const result = quoteSectionService.deleteSection(db, req.params.id, req.params.sectionId, {
        logActivity,
        markUnsignedChangesIfApproved,
        req,
      });
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/items
  router.post('/:id/items', requireProjectModify, (req, res) => {
    try {
      const result = quoteItemService.addQuoteItem(db, req.params.id, req.body || {}, {
        quoteSectionService,
        upsertItemStats,
        recalculateItemSalesStats,
        buildQuoteItemSnapshot,
        logActivity,
        markUnsignedChangesIfApproved,
        req,
      });
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/quotes/:id/items/reorder — update sort_order for all items in bulk
  router.put('/:id/items/reorder', requireProjectModify, (req, res) => {
    try {
      const result = quoteItemService.reorderQuoteItems(db, req.params.id, req.body || {});
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/quotes/:id/items/:qitem_id — zero quantity removes the item
  router.put('/:id/items/:qitem_id', requireProjectModify, (req, res) => {
    try {
      const result = quoteItemService.updateQuoteItem(db, req.params.id, req.params.qitem_id, req.body || {}, {
        buildQuoteItemSnapshot,
        logActivity,
        markUnsignedChangesIfApproved,
        req,
        discountTypes: DISCOUNT_TYPES,
        recalculateItemSalesStats,
      });
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/items/:qitem_id
  router.delete('/:id/items/:qitem_id', requireProjectModify, (req, res) => {
    try {
      const result = quoteItemService.deleteQuoteItem(db, req.params.id, req.params.qitem_id, {
        buildQuoteItemSnapshot,
        logActivity,
        markUnsignedChangesIfApproved,
        req,
        recalculateItemSalesStats,
      });
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/custom-items
  router.post('/:id/custom-items', requireProjectModify, (req, res) => {
    try {
      const result = quoteCustomItemService.addCustomItem(db, req.params.id, req.body || {}, {
        quoteSectionService,
        buildCustomItemSnapshot,
        logActivity,
        markUnsignedChangesIfApproved,
        req,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/quotes/:id/custom-items/:cid — zero quantity removes the item
  router.put('/:id/custom-items/:cid', requireProjectModify, (req, res) => {
    try {
      const result = quoteCustomItemService.updateCustomItem(db, req.params.id, req.params.cid, req.body || {}, {
        buildCustomItemSnapshot,
        logActivity,
        markUnsignedChangesIfApproved,
        req,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/custom-items/:cid
  router.delete('/:id/custom-items/:cid', requireProjectModify, (req, res) => {
    try {
      const result = quoteCustomItemService.deleteCustomItem(db, req.params.id, req.params.cid, {
        buildCustomItemSnapshot,
        logActivity,
        markUnsignedChangesIfApproved,
        req,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/:id/fulfillment', (req, res) => {
    try {
      quoteFulfillmentService.syncFulfillmentForQuote(db, req.params.id);
      res.json(quoteFulfillmentService.listFulfillment(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/:id/fulfillment/items/:fulfillmentItemId/check-in', requireFulfillmentModify, (req, res) => {
    try {
      res.json(quoteFulfillmentService.checkInFulfillmentItem(db, req.params.id, req.params.fulfillmentItemId, req.body || {}, req.user));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/:id/fulfillment/notes', requireFulfillmentModify, (req, res) => {
    try {
      res.json(quoteFulfillmentService.addFulfillmentNote(db, req.params.id, req.body || {}, req.user));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
