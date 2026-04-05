const express = require('express');
const teamService = require('../services/teamService');
const { hasAccess, ACCESS_MODIFY } = require('../lib/permissions');

module.exports = function makeRouter(db) {
  const router = express.Router();

  function requireDirectoryModify(req, res) {
    if (!hasAccess(req.permissions?.directory, ACCESS_MODIFY)) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  }

  router.get('/groups', (req, res) => {
    try {
      res.json(teamService.buildTeamGroupsPayload(db));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/groups', (req, res) => {
    try {
      if (!requireDirectoryModify(req, res)) return;
      res.status(201).json(teamService.createGroup(db, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/groups/:id/members', (req, res) => {
    try {
      if (!requireDirectoryModify(req, res)) return;
      res.json(teamService.replaceGroupMembers(db, req.params.id, req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.delete('/groups/:id/members/:userId', (req, res) => {
    try {
      if (!requireDirectoryModify(req, res)) return;
      res.json(teamService.removeGroupMember(db, req.params.id, req.params.userId));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.delete('/groups/:id', (req, res) => {
    try {
      if (!requireDirectoryModify(req, res)) return;
      res.json(teamService.deleteGroup(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/', async (req, res) => {
    try {
      res.json(await teamService.buildTeamOverview(db, {
        diagnostics: req.app?.locals?.diagnostics || null,
        requestId: req.get('x-request-id') || null,
      }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
