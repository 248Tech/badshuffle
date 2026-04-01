const quoteRepository = require('../db/repositories/quoteRepository');
const { getSettingValue } = require('../db/queries/settings');

const QUOTE_STATUS_FILTERS = new Set(['draft', 'sent', 'approved', 'confirmed', 'closed']);
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function listQuotes(db, query = {}, deps) {
  const { summarizeQuotesForList } = deps;
  const defaultTaxRate = quoteRepository.getDefaultTaxRate(db);
  const search = (query.search || '').trim();
  const status = (query.status || '').trim();
  const event_from = (query.event_from || '').trim();
  const event_to = (query.event_to || '').trim();
  const has_balance = query.has_balance === '1' || query.has_balance === 'true';
  const venue = (query.venue || '').trim();
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 24));
  const sortBy = String(query.sort_by || 'created').trim();
  const sortDir = String(query.sort_dir || 'desc').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const conditions = [];
  const params = [];
  conditions.push('org_id = ?');
  params.push(ORG_ID);
  if (search) {
    const term = `%${search}%`;
    conditions.push('(name LIKE ? OR client_first_name LIKE ? OR client_last_name LIKE ? OR client_email LIKE ? OR venue_name LIKE ? OR venue_address LIKE ?)');
    params.push(term, term, term, term, term, term);
  }
  if (status) {
    if (!QUOTE_STATUS_FILTERS.has(status)) throw createError(400, 'Invalid status filter');
    conditions.push('status = ?');
    params.push(status);
  }
  if (event_from) {
    conditions.push('event_date >= ?');
    params.push(event_from);
  }
  if (event_to) {
    conditions.push('event_date <= ?');
    params.push(event_to);
  }
  if (venue) {
    const vTerm = `%${venue}%`;
    conditions.push('(venue_name LIKE ? OR venue_address LIKE ?)');
    params.push(vTerm, vTerm);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const baseParams = params.slice();
  const dbTotal = quoteRepository.countQuotesByWhere(db, where, baseParams);

  const sortColumnMap = {
    created: 'created_at',
    name: 'name',
    event: 'event_date',
  };
  const canPaginateInSql = !has_balance && sortBy !== 'total';

  let quotes;
  let total;

  if (canPaginateInSql) {
    const orderColumn = sortColumnMap[sortBy] || 'created_at';
    const orderSql = ` ORDER BY ${orderColumn} ${sortDir}, id ${sortDir}`;
    const offset = (page - 1) * limit;
    quotes = quoteRepository.listQuotesByWhere(db, where, baseParams, orderSql, limit, offset);
    quotes = summarizeQuotesForList(db, quotes, defaultTaxRate);
    total = dbTotal;
  } else {
    quotes = quoteRepository.listQuotesByWhere(db, where, baseParams);
    quotes = summarizeQuotesForList(db, quotes, defaultTaxRate);

    if (has_balance) {
      quotes = quotes.filter((q) => {
        const signedBalance = q.has_unsigned_changes && q.signed_remaining_balance != null
          ? q.signed_remaining_balance
          : q.remaining_balance;
        const eligible = q.signed_at || ['approved', 'confirmed', 'closed'].includes(q.status || 'draft');
        return eligible && signedBalance > 0;
      });
    }

    quotes.sort((a, b) => {
      switch (sortBy) {
        case 'name': {
          const cmp = String(a.name || '').localeCompare(String(b.name || ''));
          return sortDir === 'ASC' ? cmp : -cmp;
        }
        case 'event': {
          const cmp = String(a.event_date || '').localeCompare(String(b.event_date || ''));
          return sortDir === 'ASC' ? cmp : -cmp;
        }
        case 'total': {
          const cmp = Number(a.total || 0) - Number(b.total || 0);
          return sortDir === 'ASC' ? cmp : -cmp;
        }
        case 'created':
        default: {
          const cmp = String(a.created_at || '').localeCompare(String(b.created_at || '')) || (Number(a.id) - Number(b.id));
          return sortDir === 'ASC' ? cmp : -cmp;
        }
      }
    });

    total = quotes.length;
    const offset = (page - 1) * limit;
    quotes = quotes.slice(offset, offset + limit);
  }

  const pages = total > 0 ? Math.ceil(total / limit) : 1;
  return { quotes, total, page, limit, pages };
}

function buildQuoteSummary(db) {
  const allQuotes = quoteRepository.listSummaryQuotes(db, ORG_ID);

  const byStatus = { draft: 0, sent: 0, approved: 0, confirmed: 0, closed: 0 };
  allQuotes.forEach((q) => {
    const s = q.status || 'draft';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });

  const revRows = db.prepare(`
    SELECT COALESCE(q.status, 'draft') AS status,
           COALESCE(SUM(qi.quantity * COALESCE(qi.unit_price_override, i.unit_price)), 0) AS revenue
    FROM quotes q
    LEFT JOIN quote_items qi ON qi.quote_id = q.id
    LEFT JOIN items i ON i.id = qi.item_id
    WHERE q.org_id = ?
    GROUP BY COALESCE(q.status, 'draft')
  `).all(ORG_ID);
  const revenueByStatus = {};
  revRows.forEach((r) => { revenueByStatus[r.status] = r.revenue; });

  const today = new Date().toISOString().split('T')[0];
  const in90 = new Date(Date.now() + 90 * 864e5).toISOString().split('T')[0];

  function toISODate(str) {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  }

  const upcoming = allQuotes
    .map((q) => ({ ...q, _isoDate: toISODate(q.event_date) }))
    .filter((q) => q._isoDate && q._isoDate >= today && q._isoDate <= in90)
    .sort((a, b) => a._isoDate.localeCompare(b._isoDate))
    .map(({ _isoDate, ...q }) => q);

  const monthMap = {};
  allQuotes.forEach((q) => {
    const m = (q.created_at || '').slice(0, 7);
    if (m) monthMap[m] = (monthMap[m] || 0) + 1;
  });
  const byMonth = Object.keys(monthMap).sort().slice(-6).map((m) => ({ month: m, count: monthMap[m] }));

  return { total: allQuotes.length, byStatus, revenueByStatus, upcoming, byMonth };
}

module.exports = {
  listQuotes,
  buildQuoteSummary,
};
