const express = require('express');
const notificationService = require('../services/notificationService');

module.exports = function makeNotificationRouter(db) {
  const router = express.Router();

  function currentUserId(req) {
    return Number(req.user?.sub || req.user?.id || 0);
  }

  router.get('/', (req, res) => {
    try {
      res.json(notificationService.listNotificationsForUser(db, currentUserId(req), req.query || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/unread-count', (req, res) => {
    try {
      res.json(notificationService.getUnreadCount(db, currentUserId(req)));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/feed', (req, res) => {
    try {
      res.json(notificationService.getFeedForUser(db, currentUserId(req), req.query.after_id, req.query.limit));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/presented', (req, res) => {
    try {
      res.json(notificationService.markPresented(db, currentUserId(req), req.body?.ids));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/read-all', (req, res) => {
    try {
      res.json(notificationService.markAllRead(db, currentUserId(req)));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/:id/read', (req, res) => {
    try {
      res.json(notificationService.markRead(db, currentUserId(req), req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/:id/dismiss', (req, res) => {
    try {
      res.json(notificationService.dismissNotification(db, currentUserId(req), req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/dismiss-by-type/:type', (req, res) => {
    try {
      res.json(notificationService.dismissNotificationsByType(db, currentUserId(req), req.params.type));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
