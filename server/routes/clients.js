const express = require('express');
const directoryContactsService = require('../services/directoryContactsService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      res.json(directoryContactsService.listClients(db, req.query || {}));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.post('/', (req, res) => {
    try {
      const client = directoryContactsService.createClient(db, req.body || {});
      res.status(201).json({ client });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  router.put('/:id', (req, res) => {
    try {
      const client = directoryContactsService.updateClient(db, req.params.id, req.body || {});
      res.json({ client });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  return router;
};
