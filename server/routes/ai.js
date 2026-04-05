const express = require('express');
const { ACCESS_READ, ACCESS_MODIFY } = require('../lib/permissions');
const { requireModulePermission } = require('../lib/permissionMiddleware');
const quoteAssistantService = require('../services/quoteAssistantService');
const { suggestItems } = require('../services/agent/itemSuggestionService');

module.exports = function makeRouter(db) {
  const router = express.Router();
  const requireProjectsRead = requireModulePermission(db, 'projects', ACCESS_READ);
  const requireProjectsModify = requireModulePermission(db, 'projects', ACCESS_MODIFY);

  // POST /api/ai/suggest
  router.post('/suggest', async (req, res) => {
    try {
      res.json(await suggestItems(db, req.body || {}));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.get('/quotes/:id/assistant', requireProjectsRead, (req, res) => {
    try {
      res.json(quoteAssistantService.listMessages(db, req.params.id));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.post('/quotes/:id/assistant', requireProjectsRead, async (req, res) => {
    try {
      res.json(await quoteAssistantService.submitMessage(db, req.params.id, req.body || {}, req.user, {
        diagnostics: req.app?.locals?.diagnostics || null,
        requestId: req.get('x-request-id') || null,
      }));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.delete('/quotes/:id/assistant', requireProjectsModify, (req, res) => {
    try {
      res.json(quoteAssistantService.clearHistory(db, req.params.id));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.post('/quotes/:id/assistant/clear', requireProjectsModify, (req, res) => {
    try {
      res.json(quoteAssistantService.clearHistory(db, req.params.id));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  return router;
};
