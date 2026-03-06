const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

module.exports = function makeRouter(db, uploadsDir) {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

  // GET /api/files
  router.get('/', (req, res) => {
    const files = db.prepare(
      'SELECT id, original_name, mime_type, size, created_at FROM files ORDER BY created_at DESC'
    ).all();
    res.json({ files });
  });

  // POST /api/files/upload
  router.post('/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    const userId = req.user ? req.user.id : null;
    const inserted = [];
    for (const f of req.files) {
      const result = db.prepare(
        'INSERT INTO files (original_name, stored_name, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?)'
      ).run(f.originalname, f.filename, f.mimetype, f.size, userId);
      inserted.push(db.prepare('SELECT id, original_name, mime_type, size, created_at FROM files WHERE id = ?').get(result.lastInsertRowid));
    }
    res.status(201).json({ files: inserted });
  });

  // DELETE /api/files/:id
  router.delete('/:id', (req, res) => {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });

    const filePath = path.join(uploadsDir, file.stored_name);
    try { fs.unlinkSync(filePath); } catch (e) { /* already gone */ }
    db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  return router;
};
