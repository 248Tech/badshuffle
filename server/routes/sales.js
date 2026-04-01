const express = require('express');
const salesAnalyticsService = require('../services/salesAnalyticsService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/analytics', (req, res) => {
    try {
      res.json(salesAnalyticsService.buildAnalytics(db, req.query || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
