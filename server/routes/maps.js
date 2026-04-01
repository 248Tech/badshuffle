const express = require('express');
const mapService = require('../services/mapService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/quotes', async (req, res) => {
    try {
      res.json(await mapService.buildQuotePins(db));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
