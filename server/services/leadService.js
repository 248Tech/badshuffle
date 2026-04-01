const Papa = require('papaparse');
const XLSX = require('xlsx');
const { fetchCsv } = require('../lib/sheetsParser');
const { suggestMapping, rowToLeadWithMapping } = require('../lib/leadImportMap');
const { listLeads, getLeadById, getLeadIdRow, listLeadEvents, insertLeadEvent } = require('../db/queries/leads');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

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
    const found = Object.keys(row).find((kk) => lower(kk) === lower(k));
    return found != null ? (row[found] != null ? String(row[found]).trim() : null) : null;
  };
  return {
    name: key('name') || null,
    email: key('email') || null,
    phone: key('phone') || null,
    event_date: key('event_date') || key('event date') || null,
    event_type: key('event_type') || key('event type') || null,
    source_url: key('source_url') || key('source url') || null,
    notes: key('notes') || null,
  };
}

async function loadRows(body) {
  if (body.url) {
    const result = await fetchCsv(body.url);
    return result.data || [];
  }
  const rows = parseRowsFromBody(body);
  if (rows === null) throw createError(400, 'Provide url or filename+data');
  return rows;
}

function listAllLeads(db, query) {
  return listLeads(db, query || {}, ORG_ID);
}

function listEvents(db, leadId) {
  const lead = getLeadById(db, leadId, ORG_ID);
  if (!lead) throw createError(404, 'Not found');
  return { events: listLeadEvents(db, leadId, ORG_ID) };
}

function createLead(db, body) {
  const { name, email, phone, event_date, event_type, source_url, notes, quote_id } = body || {};
  if (quote_id != null && quote_id !== '') {
    const q = db.prepare('SELECT id FROM quotes WHERE id = ? AND org_id = ?').get(quote_id, ORG_ID);
    if (!q) throw createError(400, 'Invalid quote_id');
  }
  const result = db.prepare(`
    INSERT INTO leads (org_id, name, email, phone, event_date, event_type, source_url, notes, quote_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ORG_ID,
    name || null, email || null, phone || null,
    event_date || null, event_type || null,
    source_url || null, notes || null,
    quote_id !== undefined ? quote_id : null
  );
  const leadId = result.lastInsertRowid;
  const lead = getLeadById(db, leadId, ORG_ID);
  try { insertLeadEvent(db, leadId, 'lead_created', null); } catch (e) {}
  return { lead };
}

function updateLead(db, leadId, body) {
  const { quote_id } = body || {};
  const lead = getLeadById(db, leadId, ORG_ID);
  if (!lead) throw createError(404, 'Not found');
  if (quote_id != null && quote_id !== '') {
    const q = db.prepare('SELECT id FROM quotes WHERE id = ? AND org_id = ?').get(quote_id, ORG_ID);
    if (!q) throw createError(400, 'Invalid quote_id');
  }
  const prevQuoteId = lead.quote_id;
  db.prepare('UPDATE leads SET quote_id = ? WHERE id = ? AND org_id = ?').run(
    quote_id !== undefined ? quote_id : lead.quote_id,
    leadId,
    ORG_ID
  );
  const updated = getLeadById(db, leadId, ORG_ID);
  if (quote_id !== undefined && quote_id !== prevQuoteId && quote_id) {
    try {
      const q = db.prepare('SELECT name FROM quotes WHERE id = ? AND org_id = ?').get(quote_id, ORG_ID);
      insertLeadEvent(db, leadId, 'quote_linked', q ? q.name : null);
    } catch (e) {}
  }
  return { lead: updated };
}

async function previewImport(body) {
  const rows = await loadRows(body || {});
  if (rows.length === 0) throw createError(400, 'No rows found');
  const columns = Object.keys(rows[0]);
  return {
    columns,
    suggestedMapping: suggestMapping(columns),
    preview: rows.slice(0, 10),
    totalRows: rows.length,
  };
}

async function importLeads(db, body) {
  const rows = await loadRows(body || {});
  if (rows.length === 0) throw createError(400, 'No rows to import');
  const columnMapping = body.columnMapping || null;
  const insert = db.prepare(`
    INSERT INTO leads (org_id, name, email, phone, event_date, event_type, source_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let imported = 0;
  for (const row of rows) {
    const lead = columnMapping ? rowToLeadWithMapping(row, columnMapping) : rowToLeadFallback(row);
    if (lead.name || lead.email || lead.phone) {
      insert.run(ORG_ID, lead.name, lead.email, lead.phone, lead.event_date, lead.event_type, lead.source_url, lead.notes);
      imported += 1;
    }
  }
  const totalRow = db.prepare('SELECT COUNT(*) AS n FROM leads WHERE org_id = ?').get(ORG_ID);
  return { imported, total: totalRow.n };
}

function deleteLead(db, leadId) {
  const lead = getLeadIdRow(db, leadId, ORG_ID);
  if (!lead) throw createError(404, 'Not found');
  db.prepare('DELETE FROM leads WHERE id = ? AND org_id = ?').run(leadId, ORG_ID);
  return { deleted: true };
}

module.exports = {
  listAllLeads,
  listEvents,
  createLead,
  updateLead,
  previewImport,
  importLeads,
  deleteLead,
};
