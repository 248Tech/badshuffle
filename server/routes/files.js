const express = require('express');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const fileService = require('../services/fileService');

module.exports = function makeRouter(db, uploadsDir) {
  const router = express.Router();
  const ORG_ID = 1;

  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

  // GET /api/files
  router.get('/', (req, res) => {
    try {
      res.json(fileService.listAllFiles(db, ORG_ID));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/files/upload
  router.post('/upload', upload.array('files', 20), async (req, res) => {
    try {
      const result = await fileService.uploadFiles(db, ORG_ID, req.files || [], req.user, uploadsDir);
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/files/serve-links — authenticated; returns time-limited signed serve paths (no JWT in query strings)
  router.post('/serve-links', (req, res) => {
    try {
      res.json(fileService.buildServeLinks(db, ORG_ID, req.body && req.body.ids, req.baseUrl || '/api/files'));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/files/:id/serve-link — authenticated; signed path for <img src> / clipboard (replaces ?token= JWT)
  router.get('/:id/serve-link', (req, res) => {
    try {
      res.json(fileService.buildServeLink(db, ORG_ID, req.params.id, req.baseUrl || '/api/files'));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/files/:id/quotes — list quotes this file is attached to
  router.get('/:id/quotes', (req, res) => {
    try {
      res.json(fileService.listAttachedQuotes(db, req.params.id));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // PATCH /api/files/:id — rename (update original_name)
  router.patch('/:id', (req, res) => {
    try {
      res.json(fileService.renameFile(db, ORG_ID, req.params.id, req.body && req.body.original_name));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/files/:id/compress — re-compress image variants
  router.post('/:id/compress', async (req, res) => {
    try {
      res.json(await fileService.compressFile(db, ORG_ID, req.params.id, uploadsDir));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/files/:id
  router.delete('/:id', (req, res) => {
    try {
      res.json(fileService.deleteFile(db, ORG_ID, req.params.id, uploadsDir));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  return router;
};
