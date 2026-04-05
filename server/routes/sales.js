const express = require('express');
const salesAnalyticsService = require('../services/salesAnalyticsService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/analytics', async (req, res) => {
    try {
      res.json(await salesAnalyticsService.buildAnalytics(db, req.query || {}, {
        diagnostics: req.app?.locals?.diagnostics || null,
        requestId: req.get('x-request-id') || null,
      }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
