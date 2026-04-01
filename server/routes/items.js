const express = require('express');
const itemService = require('../services/itemService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/items/categories — must come before /:id
  router.get('/categories', (req, res) => {
    try {
      res.json(itemService.listCategories(db));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/items/categories/popular — categories by quote usage (for quote builder filter)
  router.get('/categories/popular', (req, res) => {
    try {
      res.json(itemService.listPopularCategories(db, req.query.limit));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/items
  router.get('/', (req, res) => {
    try {
      res.json(itemService.listCatalog(db, req.query || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/items/bulk-upsert — accepts { items: [...] }, used by extension JSON export
  router.post('/bulk-upsert', (req, res) => {
    try {
      res.json(itemService.bulkUpsertItems(db, req.body.items));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/items/upsert — must come BEFORE /:id route
  router.post('/upsert', (req, res) => {
    try {
      const result = itemService.upsertItem(db, req.body || {});
      res.status(result.created ? 201 : 200).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/items/:id
  router.get('/:id', (req, res) => {
    try {
      res.json(itemService.getItemDetail(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/items
  router.post('/', (req, res) => {
    try {
      res.status(201).json(itemService.createItem(db, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/items/:id
  router.put('/:id', (req, res) => {
    try {
      res.json(itemService.updateItem(db, req.params.id, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/items/:id
  router.delete('/:id', (req, res) => {
    try {
      res.json(itemService.deleteItem(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/items/:id/associations
  // GET /api/items/:id/accessories — permanent accessories for a product
  router.get('/:id/accessories', (req, res) => {
    try {
      res.json(itemService.listAccessories(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/items/:id/accessories
  router.post('/:id/accessories', (req, res) => {
    try {
      res.json(itemService.addAccessory(db, req.params.id, req.body && req.body.accessory_id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/items/:id/accessories/:accessory_id
  router.delete('/:id/accessories/:accessory_id', (req, res) => {
    try {
      res.json(itemService.deleteAccessory(db, req.params.id, req.params.accessory_id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/:id/associations', (req, res) => {
    try {
      res.json(itemService.listAssociations(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/items/:id/associations
  router.post('/:id/associations', (req, res) => {
    try {
      res.json(itemService.addAssociation(db, req.params.id, req.body && req.body.child_id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/items/:id/associations/:child_id
  router.delete('/:id/associations/:child_id', (req, res) => {
    try {
      res.json(itemService.deleteAssociation(db, req.params.id, req.params.child_id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
