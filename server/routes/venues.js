const express = require('express');
const directoryContactsService = require('../services/directoryContactsService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      res.json(directoryContactsService.listVenues(db, req.query || {}));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.post('/', (req, res) => {
    try {
      const venue = directoryContactsService.createVenue(db, req.body || {});
      res.status(201).json({ venue });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.put('/:id', (req, res) => {
    try {
      const venue = directoryContactsService.updateVenue(db, req.params.id, req.body || {});
      res.json({ venue });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  return router;
};
