'use strict';
const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router = express.Router();

// GET /api/extension/download  — serve the extension as a zip
router.get('/download', (req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="badshuffle-extension.zip"');

  if (typeof process.pkg !== 'undefined') {
    // Packaged: serve pre-built zip that sits next to the exe
    const zipPath = path.join(path.dirname(process.execPath), 'badshuffle-extension.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: 'badshuffle-extension.zip not found next to exe' });
    }
    fs.createReadStream(zipPath).pipe(res);
  } else {
    // Dev mode: zip the extension folder on the fly
    const archiver    = require('archiver');
    const extensionDir = path.resolve(__dirname, '../../extension');
    if (!fs.existsSync(extensionDir)) {
      return res.status(404).json({ error: 'extension/ directory not found' });
    }
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('archiver error:', err);
      res.end();
    });
    archive.pipe(res);
    archive.directory(extensionDir, 'badshuffle-extension');
    archive.finalize();
  }
});

module.exports = router;
