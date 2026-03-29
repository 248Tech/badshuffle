const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Allowed MIME types and their magic-byte signatures
const ALLOWED = [
  { mime: 'image/jpeg',       sig: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',        sig: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif',        sig: [0x47, 0x49, 0x46] },
  { mime: 'image/webp',       sig: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'application/pdf',  sig: [0x25, 0x50, 0x44, 0x46] },
];
const ALLOWED_MIMES = new Set(ALLOWED.map(a => a.mime));
const DEFAULT_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
]);

function normalizeTypeToken(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('/')) return raw;
  if (raw.startsWith('.')) return raw;
  return `.${raw}`;
}

function getConfiguredAllowedTypes(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'allowed_file_types'").get();
  const configured = new Set();
  for (const token of String(row?.value || '').split(/[\s,]+/)) {
    const normalized = normalizeTypeToken(token);
    if (normalized) configured.add(normalized);
  }
  return configured;
}

function getFileExtension(filename) {
  return normalizeTypeToken(path.extname(String(filename || '')));
}

function isAllowedFileType(file, detectedMime, configuredAllowedTypes) {
  const extension = getFileExtension(file.originalname);
  const declaredMime = normalizeTypeToken(file.mimetype);
  if (detectedMime && (ALLOWED_MIMES.has(detectedMime) || configuredAllowedTypes.has(detectedMime) || DEFAULT_ALLOWED_TYPES.has(detectedMime))) {
    return true;
  }
  if (declaredMime && (configuredAllowedTypes.has(declaredMime) || DEFAULT_ALLOWED_TYPES.has(declaredMime))) {
    return true;
  }
  if (extension && (configuredAllowedTypes.has(extension) || DEFAULT_ALLOWED_TYPES.has(extension))) {
    return true;
  }
  return false;
}

function resolveStoredMime(file, detectedMime) {
  return detectedMime || file.mimetype || 'application/octet-stream';
}

function detectMime(filePath) {
  const buf = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  for (const { mime, sig } of ALLOWED) {
    if (sig.every((b, i) => buf[i] === b)) return mime;
  }
  return null;
}

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
    const configuredAllowedTypes = getConfiguredAllowedTypes(db);
    const inserted = [];
    for (const f of req.files) {
      const detectedMime = detectMime(f.path);
      if (!isAllowedFileType(f, detectedMime, configuredAllowedTypes)) {
        fs.unlinkSync(f.path);
        return res.status(400).json({ error: `Unsupported file type: ${f.originalname}` });
      }
      const storedMime = resolveStoredMime(f, detectedMime);
      const result = db.prepare(
        'INSERT INTO files (original_name, stored_name, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?)'
      ).run(f.originalname, f.filename, storedMime, f.size, userId);
      inserted.push(db.prepare('SELECT id, original_name, mime_type, size, created_at FROM files WHERE id = ?').get(result.lastInsertRowid));
    }
    res.status(201).json({ files: inserted });
  });

  // GET /api/files/:id/quotes — list quotes this file is attached to
  router.get('/:id/quotes', (req, res) => {
    const rows = db.prepare(
      `SELECT q.id, q.name, q.status, q.event_date, q.client_first_name, q.client_last_name
       FROM quote_attachments qa
       JOIN quotes q ON q.id = qa.quote_id
       WHERE qa.file_id = ?
       ORDER BY q.created_at DESC`
    ).all(req.params.id);
    res.json({ quotes: rows });
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
