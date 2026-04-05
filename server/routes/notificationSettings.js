const express = require('express');
const notificationService = require('../services/notificationService');

module.exports = function makeNotificationSettingsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      res.json(notificationService.listNotificationSettings(db));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/', (req, res) => {
    try {
      res.json(notificationService.updateNotificationSettings(db, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
