const express = require('express');
const Papa = require('papaparse');
const multer = require('multer');
const { fetchCsv } = require('../lib/sheetsParser');

/** Returns true if a string is a bare number (integer or float) with no alpha characters.
 *  Used to reject Excel date serials / numeric IDs that get mapped as item titles. */
function isNumericOnly(str) {
  return /^\d+(\.\d+)?$/.test(str.trim());
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = function makeRouter(db) {
  const router = express.Router();

  // POST /api/sheets/upload  — parse CSV or Excel, return columns + preview + rows
  router.post('/upload', (req, res) => {
    const { filename, data } = req.body;
    if (!filename || data == null) {
      return res.status(400).json({ error: 'filename and data required' });
    }

    try {
      let rows;
      const ext = filename.split('.').pop().toLowerCase();

      if (ext === 'csv') {
        const result = Papa.parse(data, { header: true, skipEmptyLines: true });
        rows = result.data;
      } else {
        // xlsx / xls — cellDates:true converts date cells to JS Date objects;
        // raw:false then formats them as locale strings instead of raw serial floats.
        const XLSX = require('xlsx');
        const buf = Buffer.from(data, 'base64');
        const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      }

      if (!rows || rows.length === 0) {
        return res.status(400).json({ error: 'No rows found in file' });
      }

      const columns = Object.keys(rows[0]);
      res.json({ columns, preview: rows.slice(0, 10), total: rows.length, rows });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/sheets/import-data  — upsert pre-parsed rows
  router.post('/import-data', (req, res) => {
    const { rows, title_column, photo_column } = req.body;
    if (!rows || !title_column) {
      return res.status(400).json({ error: 'rows and title_column required' });
    }

    try {
      let imported = 0;
      let updated  = 0;
      let skipped  = 0;

      const upsertMany = db.transaction((rows) => {
        for (const row of rows) {
          const title = row[title_column] ? String(row[title_column]).trim() : '';
          if (!title || isNumericOnly(title)) { skipped++; continue; }

          const photo_url = photo_column ? (row[photo_column] ? String(row[photo_column]).trim() : null) : null;
          const existing  = db.prepare('SELECT id FROM items WHERE title = ? COLLATE NOCASE').get(title);

          if (existing) {
            db.prepare(`
              UPDATE items SET
                photo_url  = COALESCE(?, photo_url),
                source     = 'sheet',
                updated_at = datetime('now')
              WHERE id = ?
            `).run(photo_url || null, existing.id);
            updated++;
          } else {
            db.prepare(
              "INSERT INTO items (title, photo_url, source, hidden) VALUES (?, ?, 'sheet', 0)"
            ).run(title, photo_url || null);
            imported++;
          }
        }
      });

      upsertMany(rows);
      res.json({ imported, updated, skipped, total: rows.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/sheets/preview
  router.post('/preview', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
      const result = await fetchCsv(url);
      const columns = result.meta.fields || [];
      const preview = result.data.slice(0, 10);
      res.json({ columns, preview, total: result.data.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/sheets/import
  router.post('/import', async (req, res) => {
    const { url, title_column, photo_column } = req.body;
    if (!url || !title_column) {
      return res.status(400).json({ error: 'url and title_column required' });
    }

    try {
      const result = await fetchCsv(url);
      const rows = result.data;

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      const upsertMany = db.transaction((rows) => {
        for (const row of rows) {
          const title = row[title_column] ? String(row[title_column]).trim() : '';
          if (!title || isNumericOnly(title)) { skipped++; continue; }

          const photo_url = photo_column ? (row[photo_column] ? String(row[photo_column]).trim() : null) : null;
          const existing = db.prepare('SELECT id FROM items WHERE title = ? COLLATE NOCASE').get(title);

          if (existing) {
            db.prepare(`
              UPDATE items SET
                photo_url  = COALESCE(?, photo_url),
                source     = 'sheet',
                updated_at = datetime('now')
              WHERE id = ?
            `).run(photo_url || null, existing.id);
            updated++;
          } else {
            db.prepare(
              "INSERT INTO items (title, photo_url, source, hidden) VALUES (?, ?, 'sheet', 0)"
            ).run(title, photo_url || null);
            imported++;
          }
        }
      });

      upsertMany(rows);

      res.json({ imported, updated, skipped, total: rows.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/sheets/upload-pdf — multipart file upload, returns extracted text
  router.post('/upload-pdf', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      res.json({ text: data.text });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/sheets/import-pdf-quote — parse text into quote line items
  router.post('/import-pdf-quote', (req, res) => {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text required' });

    const items = [];
    const lines = text.split('\n');
    // Match patterns like: "2  Folding Chair  $3.50"  or "2 x Chair $3.50"
    const lineRe = /^\s*(\d+)\s*[xX]?\s+(.+?)\s+\$?([\d,]+\.?\d*)\s*$/;
    // Also try simpler: qty then name (no price)
    const simpleRe = /^\s*(\d+)\s+([A-Za-z].{2,80})\s*$/;

    for (const line of lines) {
      const m = lineRe.exec(line);
      if (m) {
        const quantity = parseInt(m[1], 10);
        const name = m[2].trim();
        const unit_price = parseFloat(m[3].replace(/,/g, ''));
        if (name && quantity > 0) items.push({ name, quantity, unit_price });
        continue;
      }
      const ms = simpleRe.exec(line);
      if (ms) {
        const quantity = parseInt(ms[1], 10);
        const name = ms[2].trim();
        if (name && quantity > 0) items.push({ name, quantity, unit_price: 0 });
      }
    }

    res.json({ items });
  });

  return router;
};
