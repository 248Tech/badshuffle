const express = require('express');
const Papa = require('papaparse');
const XLSX = require('xlsx');
const { fetchCsv } = require('../lib/sheetsParser');
const { suggestMapping, rowToLeadWithMapping, TARGET_FIELDS } = require('../lib/leadImportMap');

function parseRowsFromBody(body) {
  if (body.url) return null;
  if (body.filename && body.data != null) {
    const ext = (body.filename.split('.').pop() || '').toLowerCase();
    const buf = Buffer.from(body.data, 'base64');
    if (ext === 'csv') {
      const result = Papa.parse(buf.toString('utf8'), { header: true, skipEmptyLines: true });
      return result.data || [];
    }
    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }
  }
  return null;
}

function rowToLeadFallback(row) {
  const key = (k) => {
    const lower = (s) => (s || '').toLowerCase().trim();
    const found = Object.keys(row).find(kk => lower(kk) === lower(k));
    return found != null ? (row[found] != null ? String(row[found]).trim() : null) : null;
  };
  return {
    name: key('name') || null,
    email: key('email') || null,
    phone: key('phone') || null,
    event_date: key('event_date') || key('event date') || null,
    event_type: key('event_type') || key('event type') || null,
    source_url: key('source_url') || key('source url') || null,
    notes: key('notes') || null
  };
}

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/leads
  router.get('/', (req, res) => {
    const { search, page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${where}`).get(...params).n;
    const leads = db.prepare(
      `SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset);

    res.json({ leads, total, page: pageNum, limit: limitNum });
  });

  // POST /api/leads
  router.post('/', (req, res) => {
    const { name, email, phone, event_date, event_type, source_url, notes, quote_id } = req.body || {};
    const result = db.prepare(`
      INSERT INTO leads (name, email, phone, event_date, event_type, source_url, notes, quote_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name || null, email || null, phone || null,
      event_date || null, event_type || null,
      source_url || null, notes || null,
      quote_id !== undefined ? quote_id : null
    );
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ lead });
  });

  // PUT /api/leads/:id
  router.put('/:id', (req, res) => {
    const { quote_id } = req.body || {};
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE leads SET quote_id = ? WHERE id = ?').run(
      quote_id !== undefined ? quote_id : lead.quote_id,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    res.json({ lead: updated });
  });

  // POST /api/leads/preview — body: { url } or { filename, data }. Returns columns, suggestedMapping, preview rows.
  router.post('/preview', async (req, res) => {
    const body = req.body || {};
    let rows = [];
    try {
      if (body.url) {
        const result = await fetchCsv(body.url);
        rows = result.data || [];
      } else {
        rows = parseRowsFromBody(body);
        if (rows === null) return res.status(400).json({ error: 'Provide url or filename+data' });
      }
      if (rows.length === 0) return res.status(400).json({ error: 'No rows found' });
      const columns = Object.keys(rows[0]);
      const suggestedMapping = suggestMapping(columns);
      res.json({ columns, suggestedMapping, preview: rows.slice(0, 10), totalRows: rows.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/leads/import — body: { url } or { filename, data }, optional columnMapping: { name: 'Full Name', ... }
  router.post('/import', async (req, res) => {
    const body = req.body || {};
    let rows = [];
    try {
      if (body.url) {
        const result = await fetchCsv(body.url);
        rows = result.data || [];
      } else {
        rows = parseRowsFromBody(body);
        if (rows === null) return res.status(400).json({ error: 'Provide url or filename+data' });
      }
      if (rows.length === 0) return res.status(400).json({ error: 'No rows to import' });

      const columnMapping = body.columnMapping || null;
      const insert = db.prepare(`
        INSERT INTO leads (name, email, phone, event_date, event_type, source_url, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      let imported = 0;
      for (const row of rows) {
        const lead = columnMapping
          ? rowToLeadWithMapping(row, columnMapping)
          : rowToLeadFallback(row);
        if (lead.name || lead.email || lead.phone) {
          insert.run(lead.name, lead.email, lead.phone, lead.event_date, lead.event_type, lead.source_url, lead.notes);
          imported++;
        }
      }
      const totalRow = db.prepare('SELECT COUNT(*) AS n FROM leads').get();
      res.json({ imported, total: totalRow.n });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE /api/leads/:id
  router.delete('/:id', (req, res) => {
    const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  return router;
};
