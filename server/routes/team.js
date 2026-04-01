const express = require('express');
const teamService = require('../services/teamService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      res.json(teamService.buildTeamOverview(db));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
