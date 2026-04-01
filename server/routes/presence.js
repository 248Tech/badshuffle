const teamService = require('../services/teamService');

module.exports = function makePresenceRouter(db) {
  const express = require('express');
  const router = express.Router();

  router.put('/', (req, res) => {
    try {
      res.json(teamService.updateUserPresence(db, req.user, req.body && req.body.path));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/', (req, res) => {
    try {
      res.json(teamService.listOnlinePresence(db));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
