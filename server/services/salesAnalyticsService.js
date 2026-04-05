const quoteService = require('./quoteService');

const ORG_ID = 1;
const PIPELINE_STATUSES = ['quoteSent', 'contractSigned', 'lost'];

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseDateOnly(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function startOfYear(date = new Date()) {
  const year = date.getUTCFullYear();
  return `${year}-01-01`;
}

function endOfYear(date = new Date()) {
  const year = date.getUTCFullYear();
  return `${year}-12-31`;
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePipelineStatuses(value) {
  const statuses = parseCsvList(value);
  if (!statuses.length) return PIPELINE_STATUSES.slice();
  statuses.forEach((status) => {
    if (!PIPELINE_STATUSES.includes(status)) throw createError(400, `Invalid pipeline status: ${status}`);
  });
  return statuses;
}

function parseStaffIds(value) {
  return parseCsvList(value)
    .map((entry) => Number.parseInt(entry, 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

function toMonthKey(dateOnly) {
  return `${String(dateOnly || '').slice(0, 7)}-01`;
}

function classifyPipelineStatus(quote) {
  const status = String(quote.status || 'draft');
  const hasSignedContract = !!quote.signed_at || ['approved', 'confirmed'].includes(status) || (status === 'closed' && quote.signed_quote_total != null);
  if (hasSignedContract) return 'contractSigned';
  if (status === 'sent') return 'quoteSent';
  if (status === 'closed') return 'lost';
  return null;
}

function listAvailableStaff(db) {
  return db.prepare(`
    SELECT id, email, role
    FROM users
    WHERE approved = 1
      AND COALESCE(org_id, 1) = ?
      AND role IN ('admin', 'operator')
    ORDER BY email COLLATE NOCASE ASC
  `).all(ORG_ID).map((row) => ({
    id: row.id,
    label: row.email,
    role: row.role,
  }));
}

async function buildAnalytics(db, query = {}, options = {}) {
  const today = new Date();
  const startDate = parseDateOnly(query.start_date) || startOfYear(today);
  const endDate = parseDateOnly(query.end_date) || endOfYear(today);
  if (startDate > endDate) throw createError(400, 'start_date must be before end_date');

  const pipelineStatuses = parsePipelineStatuses(query.statuses);
  const staffIds = parseStaffIds(query.staff_ids);
  const availableStaff = listAvailableStaff(db);

  const where = ['q.org_id = ?'];
  const params = [ORG_ID];
  const dateExpr = "COALESCE(NULLIF(q.event_date, ''), substr(q.created_at, 1, 10))";
  where.push(`${dateExpr} >= ?`);
  params.push(startDate);
  where.push(`${dateExpr} <= ?`);
  params.push(endDate);
  if (staffIds.length) {
    where.push(`q.created_by IN (${staffIds.map(() => '?').join(', ')})`);
    params.push(...staffIds);
  }

  const quotes = db.prepare(`
    SELECT q.*
    FROM quotes q
    WHERE ${where.join(' AND ')}
    ORDER BY ${dateExpr} ASC, q.id ASC
  `).all(...params);

  const defaultTaxRate = (() => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
    return row ? Number.parseFloat(row.value || '0') || 0 : 0;
  })();
  const summarizedQuotes = await quoteService.summarizeQuotesForList(db, quotes, defaultTaxRate, {
    diagnostics: options.diagnostics,
    requestId: options.requestId,
    route: 'sales-analytics',
  });
  const staffById = new Map(availableStaff.map((staff) => [staff.id, staff]));

  const entries = summarizedQuotes
    .map((quote) => {
      const pipelineStatus = classifyPipelineStatus(quote);
      if (!pipelineStatus || !pipelineStatuses.includes(pipelineStatus)) return null;
      const date = parseDateOnly(quote.event_date) || parseDateOnly(quote.created_at);
      if (!date) return null;
      return {
        id: quote.id,
        name: quote.name || 'Untitled project',
        date,
        month: toMonthKey(date),
        pipelineStatus,
        revenue: Number(quote.signed_quote_total != null ? quote.signed_quote_total : quote.total || 0),
        count: 1,
        status: quote.status || 'draft',
        staffId: quote.created_by || null,
        staffLabel: quote.created_by && staffById.has(quote.created_by) ? staffById.get(quote.created_by).label : null,
      };
    })
    .filter(Boolean);

  return {
    range: {
      startDate,
      endDate,
      today: today.toISOString().slice(0, 10),
    },
    filters: {
      statuses: PIPELINE_STATUSES.slice(),
      selectedStatuses: pipelineStatuses,
      selectedStaffIds: staffIds,
      staffOptions: availableStaff,
    },
    entries,
  };
}

module.exports = {
  buildAnalytics,
};
