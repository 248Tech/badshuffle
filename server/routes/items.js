const express = require('express');
const itemService = require('../services/itemService');
const itemSetAsideService = require('../services/itemSetAsideService');
const notificationService = require('../services/notificationService');
const { hasAccess, ACCESS_MODIFY } = require('../lib/permissions');

module.exports = function makeRouter(db) {
  const router = express.Router();

  function requireInventoryModify(req, res) {
    if (!hasAccess(req.permissions?.inventory, ACCESS_MODIFY)) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  }

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

  // POST /api/items/generate-description-preview
  router.post('/generate-description-preview', async (req, res) => {
    try {
      res.json(await itemService.generateDescriptionPreview(db, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/set-aside', (req, res) => {
    try {
      res.json(itemSetAsideService.listSetAsides(db, { includeResolved: String(req.query.include_resolved || '') === '1' }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/:id/set-aside', (req, res) => {
    try {
      if (!requireInventoryModify(req, res)) return;
      res.status(201).json(itemSetAsideService.createSetAside(db, req.params.id, req.body || {}, req.user));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/set-aside/:id', (req, res) => {
    try {
      if (!requireInventoryModify(req, res)) return;
      res.json(itemSetAsideService.updateSetAside(db, req.params.id, req.body || {}, req.user));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/set-aside/:id/resolve', (req, res) => {
    try {
      if (!requireInventoryModify(req, res)) return;
      res.json(itemSetAsideService.resolveSetAside(db, req.params.id, req.body || {}, req.user));
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
      if (!requireInventoryModify(req, res)) return;
      const result = itemService.createItem(db, req.body || {});
      notificationService.createNotification(db, {
        type: 'item_created',
        title: 'Product created',
        body: `${result.item?.title || 'Inventory item'} was created`,
        href: `/inventory/${result.item?.id}`,
        entityType: 'item',
        entityId: result.item?.id,
        actorUserId: req.user?.sub || req.user?.id || null,
        actorLabel: notificationService.buildActorLabel(req.user),
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PUT /api/items/:id
  router.put('/:id', (req, res) => {
    try {
      if (!requireInventoryModify(req, res)) return;
      const before = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
      const result = itemService.updateItem(db, req.params.id, req.body || {});
      const after = result.item;
      const changes = [];
      if (before && after) {
        if (String(before.title || '') !== String(after.title || '')) {
          changes.push({ property: 'Title', from: before.title || 'Empty', to: after.title || 'Empty' });
        }
        if (String(before.category || '') !== String(after.category || '')) {
          changes.push({ property: 'Category', from: before.category || 'Empty', to: after.category || 'Empty' });
        }
        if (String(before.description || '') !== String(after.description || '')) {
          changes.push({ property: 'Description', from: before.description || 'Empty', to: after.description || 'Empty' });
        }
        if (String(before.serial_number || '') !== String(after.serial_number || '')) {
          changes.push({ property: 'Serial Number', from: before.serial_number || 'Empty', to: after.serial_number || 'Empty' });
        }
        if (Number(before.unit_price || 0) !== Number(after.unit_price || 0)) {
          changes.push({
            property: 'Price',
            from: `$${Number(before.unit_price || 0).toFixed(2)}`,
            to: `$${Number(after.unit_price || 0).toFixed(2)}`,
          });
        }
        if (Number(before.quantity_in_stock || 0) !== Number(after.quantity_in_stock || 0)) {
          changes.push({
            property: 'Stock',
            from: String(Number(before.quantity_in_stock || 0)),
            to: String(Number(after.quantity_in_stock || 0)),
          });
        }
        if (Number(before.hidden || 0) !== Number(after.hidden || 0)) {
          changes.push({
            property: 'Visibility',
            from: Number(before.hidden || 0) === 1 ? 'Hidden' : 'Visible',
            to: Number(after.hidden || 0) === 1 ? 'Hidden' : 'Visible',
          });
        }
      }
      changes.forEach((change) => {
        notificationService.createNotification(db, {
          type: 'item_property_updated',
          title: 'Product updated',
          body: `${notificationService.buildActorLabel(req.user) || 'A team member'} edited ${after?.title || before?.title || 'inventory item'} - ${change.property} - ${change.from} to ${change.to}`,
          href: `/inventory/${after?.id || req.params.id}`,
          entityType: 'item',
          entityId: after?.id || Number(req.params.id),
          actorUserId: req.user?.sub || req.user?.id || null,
          actorLabel: notificationService.buildActorLabel(req.user),
          metadata: change,
        });
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/items/:id
  router.delete('/:id', (req, res) => {
    try {
      if (!requireInventoryModify(req, res)) return;
      const existing = db.prepare('SELECT id, title FROM items WHERE id = ?').get(req.params.id);
      const result = itemService.deleteItem(db, req.params.id);
      if (existing) {
        notificationService.createNotification(db, {
          type: 'item_deleted',
          title: 'Product deleted',
          body: `${existing.title || 'Inventory item'} was deleted`,
          href: '/inventory',
          entityType: 'item',
          entityId: Number(existing.id),
          actorUserId: req.user?.sub || req.user?.id || null,
          actorLabel: notificationService.buildActorLabel(req.user),
        });
      }
      res.json(result);
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
