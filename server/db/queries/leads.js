const DEFAULT_ORG_ID = 1;

function listLeads(db, { search, page = 1, limit = 25 } = {}, orgId = DEFAULT_ORG_ID) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * limitNum;

  let where = 'org_id = ?';
  const params = [orgId];
  if (search) {
    where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${where}`).get(...params).n;
  const leads = db.prepare(
    `SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  return { leads, total, page: pageNum, limit: limitNum };
}

function getLeadById(db, leadId, orgId = DEFAULT_ORG_ID) {
  return db.prepare('SELECT * FROM leads WHERE id = ? AND org_id = ?').get(leadId, orgId) || null;
}

function getLeadIdRow(db, leadId, orgId = DEFAULT_ORG_ID) {
  return db.prepare('SELECT id FROM leads WHERE id = ? AND org_id = ?').get(leadId, orgId) || null;
}

function listLeadEvents(db, leadId, orgId = DEFAULT_ORG_ID) {
  return db.prepare(
    'SELECT * FROM lead_events WHERE lead_id = ? AND lead_id IN (SELECT id FROM leads WHERE id = ? AND org_id = ?) ORDER BY created_at DESC'
  ).all(leadId, leadId, orgId);
}

function insertLeadEvent(db, leadId, eventType, note = null) {
  db.prepare('INSERT INTO lead_events (lead_id, event_type, note) VALUES (?, ?, ?)').run(leadId, eventType, note);
}

module.exports = {
  listLeads,
  getLeadById,
  getLeadIdRow,
  listLeadEvents,
  insertLeadEvent,
};
