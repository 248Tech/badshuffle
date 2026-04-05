const express = require('express');
const { resolveScanCode } = require('../services/scanCodeService');

module.exports = function makeRouter(db) {
  const router = express.Router();

  router.get('/:code', (req, res) => {
    try {
      const result = resolveScanCode(db, req.params.code);
      if (!result) return res.status(404).json({ error: 'Scan code not found' });
      res.json(result);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  return router;
};
