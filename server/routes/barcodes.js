const express = require('express');
const barcodeService = require('../services/barcodeService');

module.exports = function makeRouter() {
  const router = express.Router();

  router.get('/render', (req, res) => {
    try {
      const svg = barcodeService.renderSvg({
        format: req.query.format || 'qrcode',
        value: req.query.value || '',
        label: req.query.label || '',
      });
      if (String(req.query.inline || '') === '1') {
        return res.json({ svg });
      }
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(svg);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  return router;
};
