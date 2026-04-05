const express = require('express');
const leadService = require('../services/leadService');
const notificationService = require('../services/notificationService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/leads
  router.get('/', (req, res) => {
    try {
      res.json(leadService.listAllLeads(db, req.query || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/leads/:id/events — timeline for a lead (must be before GET /:id if we had one; we only have PUT /:id)
  router.get('/:id/events', (req, res) => {
    try {
      res.json(leadService.listEvents(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/leads
  router.post('/', (req, res) => {
    try {
      const result = leadService.createLead(db, req.body || {});
      notificationService.createNotification(db, {
        type: 'lead_created',
        title: 'Lead created',
        body: `${result.lead?.name || result.lead?.email || 'New lead'} was created`,
        href: '/leads',
        entityType: 'lead',
        entityId: result.lead?.id || null,
        actorUserId: req.user?.sub || req.user?.id || null,
        actorLabel: notificationService.buildActorLabel(req.user),
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/leads/:id
  router.put('/:id', (req, res) => {
    try {
      res.json(leadService.updateLead(db, req.params.id, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/leads/preview — body: { url } or { filename, data }. Returns columns, suggestedMapping, preview rows.
  router.post('/preview', async (req, res) => {
    try {
      res.json(await leadService.previewImport(req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  });

  // POST /api/leads/import — body: { url } or { filename, data }, optional columnMapping: { name: 'Full Name', ... }
  router.post('/import', async (req, res) => {
    try {
      res.json(await leadService.importLeads(db, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  });

  // DELETE /api/leads/:id
  router.delete('/:id', (req, res) => {
    try {
      res.json(leadService.deleteLead(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
