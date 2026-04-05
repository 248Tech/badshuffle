const express = require('express');
const teamChatService = require('../services/teamChatService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/threads', (req, res) => {
    try {
      res.json({ threads: teamChatService.listTeamThreads(db) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
  });

  router.post('/threads', (req, res) => {
    try {
      res.json({ thread: teamChatService.createTeamThread(db, req.body || {}, req.user) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
  });

  router.get('/threads/:id/messages', (req, res) => {
    try {
      res.json({ messages: teamChatService.listThreadMessages(db, req.params.id) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
  });

  router.post('/threads/:id/messages', async (req, res) => {
    try {
      res.json(await teamChatService.sendTeamChatMessage(db, req.params.id, req.body || {}, req.user));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
  });

  return router;
};
