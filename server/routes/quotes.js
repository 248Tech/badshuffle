const express = require('express');
const crypto = require('crypto');
const {
  logActivity,
  markUnsignedChangesIfApproved,
  buildQuoteItemSnapshot,
  buildCustomItemSnapshot,
} = require('../lib/quoteActivity');
const { upsertItemStats } = require('../services/itemStatsService');
const quoteService = require('../services/quoteService');

module.exports = function makeRouter(db, uploadsDir) {
  const router = express.Router();

  // GET /api/quotes — include computed total, amount_paid, remaining_balance, overpaid; optional filters
  // Query params: search (name/client), status, event_from, event_to, has_balance, venue
  router.get('/', (req, res) => {
    const defaultTaxRow = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
    const defaultTaxRate = defaultTaxRow ? parseFloat(defaultTaxRow.value) : 0;
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();
    const event_from = (req.query.event_from || '').trim();
    const event_to = (req.query.event_to || '').trim();
    const has_balance = req.query.has_balance === '1' || req.query.has_balance === 'true';
    const venue = (req.query.venue || '').trim();

    const conditions = [];
    const params = [];
    if (search) {
      const term = `%${search}%`;
      conditions.push('(name LIKE ? OR client_first_name LIKE ? OR client_last_name LIKE ? OR client_email LIKE ?)');
      params.push(term, term, term, term);
    }
    if (status) {
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
    const sql = `SELECT * FROM quotes ${where} ORDER BY created_at DESC`;
    const quotes = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();

    let amountPaidByQuote = {};
    try {
      const rows = db.prepare('SELECT quote_id, COALESCE(SUM(amount), 0) AS amount_paid FROM quote_payments GROUP BY quote_id').all();
      rows.forEach(r => { amountPaidByQuote[r.quote_id] = r.amount_paid; });
    } catch (e) {}
    let quotesWithTotal = quotes.map(q => {
      let subtotal = 0;
      let taxableAmount = 0;
      try {
        const rows = db.prepare(`
          SELECT qi.quantity, qi.hidden_from_quote, qi.unit_price_override,
                 i.unit_price, i.taxable, i.category
          FROM quote_items qi
          JOIN items i ON i.id = qi.item_id
          WHERE qi.quote_id = ?
        `).all(q.id);
        rows.forEach(r => {
          if (r.hidden_from_quote) return;
          const effectivePrice = r.unit_price_override != null ? r.unit_price_override : (r.unit_price || 0);
          const line = (r.quantity || 1) * effectivePrice;
          subtotal += line;
          if (r.taxable) taxableAmount += line;
        });
        const customRows = db.prepare('SELECT quantity, unit_price, taxable FROM quote_custom_items WHERE quote_id = ?').all(q.id);
        customRows.forEach(r => {
          const line = (r.quantity || 1) * (r.unit_price || 0);
          subtotal += line;
          if (r.taxable) taxableAmount += line;
        });
      } catch (e) {}
      const rate = q.tax_rate != null ? parseFloat(q.tax_rate) : defaultTaxRate;
      const tax = (isNaN(rate) ? 0 : rate) * taxableAmount / 100;
      const total = subtotal + tax;
      const amount_paid = amountPaidByQuote[q.id] != null ? Number(amountPaidByQuote[q.id]) : 0;
      const remaining_balance = total - amount_paid;
      const overpaid = remaining_balance < 0;
      const todayStr = new Date().toISOString().slice(0, 10);
      const is_expired = !!(q.expires_at && q.expires_at < todayStr);
      return { ...q, total, contract_total: total, amount_paid, remaining_balance, overpaid, is_expired };
    });
    if (has_balance) {
      quotesWithTotal = quotesWithTotal.filter(q => q.remaining_balance > 0);
    }
    res.json({ quotes: quotesWithTotal });
  });

  // GET /api/quotes/summary — dashboard aggregates (must be before /:id)
  router.get('/summary', (req, res) => {
    const allQuotes = db.prepare('SELECT id, name, status, event_date, guest_count, created_at, has_unsigned_changes FROM quotes').all();

    const byStatus = { draft: 0, sent: 0, approved: 0, confirmed: 0, closed: 0 };
    allQuotes.forEach(q => {
      const s = q.status || 'draft';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });

    const revRows = db.prepare(`
      SELECT COALESCE(q.status, 'draft') AS status,
             COALESCE(SUM(qi.quantity * COALESCE(qi.unit_price_override, i.unit_price)), 0) AS revenue
      FROM quotes q
      LEFT JOIN quote_items qi ON qi.quote_id = q.id
      LEFT JOIN items i ON i.id = qi.item_id
      GROUP BY COALESCE(q.status, 'draft')
    `).all();
    const revenueByStatus = {};
    revRows.forEach(r => { revenueByStatus[r.status] = r.revenue; });

    const today = new Date().toISOString().split('T')[0];
    const in90 = new Date(Date.now() + 90 * 864e5).toISOString().split('T')[0];
    // Normalize event_date to YYYY-MM-DD for reliable comparison (handles MM/DD/YYYY and natural language dates)
    function toISODate(str) {
      if (!str) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const d = new Date(str);
      if (!isNaN(d)) return d.toISOString().split('T')[0];
      return null;
    }
    const upcoming = allQuotes
      .map(q => ({ ...q, _isoDate: toISODate(q.event_date) }))
      .filter(q => q._isoDate && q._isoDate >= today && q._isoDate <= in90)
      .sort((a, b) => a._isoDate.localeCompare(b._isoDate))
      .map(({ _isoDate, ...q }) => q);

    const monthMap = {};
    allQuotes.forEach(q => {
      const m = (q.created_at || '').slice(0, 7);
      if (m) monthMap[m] = (monthMap[m] || 0) + 1;
    });
    const byMonth = Object.keys(monthMap).sort().slice(-6).map(m => ({ month: m, count: monthMap[m] }));

    res.json({ total: allQuotes.length, byStatus, revenueByStatus, upcoming, byMonth });
  });

  // GET /api/quotes/:id/contract
  router.get('/:id/contract', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    let contract = null;
    try {
      contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(req.params.id);
    } catch (e) { /* table may not exist */ }
    res.json({ contract: contract || null });
  });

  // PUT /api/quotes/:id/contract — create or update contract body (staff only)
  router.put('/:id/contract', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const { body_html } = req.body || {};
    const existing = db.prepare('SELECT id, body_html FROM contracts WHERE quote_id = ?').get(req.params.id);
    const oldBody = existing ? (existing.body_html || null) : null;
    const newBody = body_html !== undefined ? (body_html || null) : oldBody;

    if (existing) {
      db.prepare('UPDATE contracts SET body_html = ?, updated_at = datetime(\'now\') WHERE quote_id = ?').run(newBody, req.params.id);
    } else {
      db.prepare('INSERT INTO contracts (quote_id, body_html) VALUES (?, ?)').run(req.params.id, newBody);
    }

    const userId = req.user && req.user.sub;
    const userEmail = (req.user && req.user.email) || (userId ? db.prepare('SELECT email FROM users WHERE id = ?').get(userId)?.email : null) || null;
    try {
      db.prepare('INSERT INTO contract_logs (quote_id, user_id, user_email, old_body, new_body) VALUES (?, ?, ?, ?, ?)')
        .run(req.params.id, userId || null, userEmail, oldBody, newBody);
    } catch (e) {}

    const contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(req.params.id);
    res.json({ contract });
  });

  // GET /api/quotes/:id/contract/logs
  router.get('/:id/contract/logs', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    let logs = [];
    try {
      logs = db.prepare('SELECT id, quote_id, changed_at, user_id, user_email, old_body, new_body FROM contract_logs WHERE quote_id = ? ORDER BY changed_at DESC').all(req.params.id);
    } catch (e) {}
    res.json({ logs });
  });

  // GET /api/quotes/:id/files — list files attached to this quote
  router.get('/:id/files', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    let list = [];
    try {
      list = db.prepare(`
        SELECT qa.id as attachment_id, qa.created_at, f.id as file_id, f.original_name, f.mime_type, f.size
        FROM quote_attachments qa
        JOIN files f ON f.id = qa.file_id
        WHERE qa.quote_id = ?
        ORDER BY qa.created_at DESC
      `).all(req.params.id);
    } catch (e) {}
    res.json({ files: list });
  });

  // POST /api/quotes/:id/files — attach a file (body: { file_id })
  router.post('/:id/files', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const { file_id } = req.body || {};
    if (!file_id) return res.status(400).json({ error: 'file_id required' });
    const file = db.prepare('SELECT id, original_name FROM files WHERE id = ?').get(file_id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    try {
      db.prepare('INSERT OR IGNORE INTO quote_attachments (quote_id, file_id) VALUES (?, ?)').run(req.params.id, file_id);
      logActivity(db, req.params.id, 'file_attached', 'Attached file: ' + (file.original_name || file_id), null, null, req);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    const list = db.prepare(`
      SELECT qa.id as attachment_id, qa.created_at, f.id as file_id, f.original_name, f.mime_type, f.size
      FROM quote_attachments qa
      JOIN files f ON f.id = qa.file_id
      WHERE qa.quote_id = ?
      ORDER BY qa.created_at DESC
    `).all(req.params.id);
    res.json({ files: list });
  });

  // DELETE /api/quotes/:id/files/:fid
  router.delete('/:id/files/:fid', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    try {
      db.prepare('DELETE FROM quote_attachments WHERE quote_id = ? AND file_id = ?').run(req.params.id, req.params.fid);
    } catch (e) {}
    res.json({ ok: true });
  });

  // GET /api/quotes/:id/payments
  router.get('/:id/payments', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    let list = [];
    try {
      list = db.prepare('SELECT * FROM quote_payments WHERE quote_id = ? ORDER BY paid_at DESC, created_at DESC').all(req.params.id);
    } catch (e) {}
    res.json({ payments: list });
  });

  // POST /api/quotes/:id/payments — record a payment (body: amount, method, reference, note, paid_at)
  router.post('/:id/payments', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const { amount, method, reference, note, paid_at } = req.body || {};
    if (amount == null || amount === '') return res.status(400).json({ error: 'amount required' });
    const amt = parseFloat(amount);
    if (isNaN(amt)) return res.status(400).json({ error: 'amount must be a number' });
    const userId = req.user && req.user.sub;
    const userEmail = (req.user && req.user.email) || (userId ? db.prepare('SELECT email FROM users WHERE id = ?').get(userId)?.email : null) || null;
    try {
      db.prepare(
        'INSERT INTO quote_payments (quote_id, amount, method, status, reference, paid_at, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(req.params.id, amt, method || null, 'charged', reference || null, paid_at || null, note || null, userId || null);
      logActivity(db, req.params.id, 'payment_applied', `Recorded payment: $${amt.toFixed(2)} (${method || 'offline'})`, null, null, req);
      try {
        db.prepare(
          'INSERT INTO billing_history (quote_id, event_type, amount, note, user_email) VALUES (?, ?, ?, ?, ?)'
        ).run(req.params.id, 'payment_received', amt, note || null, userEmail);
      } catch (e) {}
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    const list = db.prepare('SELECT * FROM quote_payments WHERE quote_id = ? ORDER BY paid_at DESC, created_at DESC').all(req.params.id);
    res.json({ payments: list });
  });

  // DELETE /api/quotes/:id/payments/:pid — remove a payment
  router.delete('/:id/payments/:pid', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const payment = db.prepare('SELECT * FROM quote_payments WHERE id = ? AND quote_id = ?').get(req.params.pid, req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const userEmail = (req.user && req.user.email) || (req.user && req.user.sub ? db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.sub)?.email : null) || null;
    try {
      db.prepare(
        'INSERT INTO billing_history (quote_id, event_type, amount, note, user_email) VALUES (?, ?, ?, ?, ?)'
      ).run(req.params.id, 'payment_removed', payment.amount, payment.note || null, userEmail);
    } catch (e) {}
    db.prepare('DELETE FROM quote_payments WHERE id = ?').run(req.params.pid);
    const list = db.prepare('SELECT * FROM quote_payments WHERE quote_id = ? ORDER BY paid_at DESC, created_at DESC').all(req.params.id);
    res.json({ payments: list });
  });

  // POST /api/quotes/:id/refund — record a refund (body: amount, note); adds negative payment and billing_history
  router.post('/:id/refund', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const { amount, note } = req.body || {};
    if (amount == null || amount === '') return res.status(400).json({ error: 'amount required' });
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'refund amount must be a positive number' });
    const userId = req.user && req.user.sub;
    const userEmail = (req.user && req.user.email) || (userId ? db.prepare('SELECT email FROM users WHERE id = ?').get(userId)?.email : null) || null;
    const refundAmount = -amt;
    try {
      db.prepare(
        'INSERT INTO quote_payments (quote_id, amount, method, status, note, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(req.params.id, refundAmount, 'refund', 'refunded', note || null, userId || null);
      try {
        db.prepare(
          'INSERT INTO billing_history (quote_id, event_type, amount, note, user_email) VALUES (?, ?, ?, ?, ?)'
        ).run(req.params.id, 'refunded', amt, note || null, userEmail);
      } catch (e) {}
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    const list = db.prepare('SELECT * FROM quote_payments WHERE quote_id = ? ORDER BY paid_at DESC, created_at DESC').all(req.params.id);
    res.json({ payments: list });
  });

  // GET /api/quotes/:id/activity — unified activity log (contract, payments, files, items)
  router.get('/:id/activity', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const entries = [];
    try {
      const contractLogs = db.prepare('SELECT id, changed_at as created_at, user_email, old_body, new_body FROM contract_logs WHERE quote_id = ?').all(req.params.id);
      contractLogs.forEach(r => {
        const oldLen = (r.old_body || '').length;
        const newLen = (r.new_body || '').length;
        let desc = 'Contract updated';
        if (oldLen === 0 && newLen > 0) desc = 'Contract body created';
        else if (newLen === 0) desc = 'Contract body cleared';
        else desc = `Contract body updated (${oldLen} → ${newLen} characters)`;
        entries.push({
          id: 'c-' + r.id,
          created_at: r.created_at,
          user_email: r.user_email,
          event_type: 'contract_updated',
          description: desc,
          old_value: oldLen ? `${oldLen} characters` : null,
          new_value: newLen ? `${newLen} characters` : null
        });
      });
      const activityLogs = db.prepare('SELECT id, created_at, user_email, event_type, description, old_value, new_value FROM quote_activity_log WHERE quote_id = ?').all(req.params.id);
      activityLogs.forEach(r => entries.push({
        id: 'a-' + r.id,
        created_at: r.created_at,
        user_email: r.user_email,
        event_type: r.event_type,
        description: r.description,
        old_value: r.old_value,
        new_value: r.new_value
      }));
      entries.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } catch (e) {}
    res.json({ activity: entries });
  });

  // GET /api/quotes/:id
  router.get('/:id', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    const items = db.prepare(`
      SELECT qi.id as qitem_id, qi.quantity, qi.label, qi.sort_order, qi.hidden_from_quote,
             qi.unit_price_override, qi.discount_type, qi.discount_amount,
             qi.description as qi_description, qi.notes as qi_notes,
             i.id, i.title, i.photo_url, i.source, i.hidden,
             i.unit_price, i.taxable, i.category, i.labor_hours, i.is_subrental
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id = ?
      ORDER BY qi.sort_order ASC, qi.id ASC
    `).all(req.params.id);

    const customItems = db.prepare(
      'SELECT * FROM quote_custom_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(req.params.id);

    let adjustments = [];
    try {
      adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    } catch (e) {}

    const today = new Date().toISOString().slice(0, 10);
    const is_expired = !!(quote.expires_at && quote.expires_at < today);
    res.json({ ...quote, items, customItems, adjustments, is_expired });
  });

  // POST /api/quotes
  router.post('/', (req, res) => {
    const body = req.body || {};
    const { name, guest_count = 0, event_date, notes, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate } = body;
    const { client_first_name, client_last_name, client_email, client_phone, client_address } = body;
    const { rental_start, rental_end, delivery_date, pickup_date } = body;
    if (!name) return res.status(400).json({ error: 'name required' });

    try {
      const result = db.prepare(
        `INSERT INTO quotes (name, guest_count, event_date, notes, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate, client_first_name, client_last_name, client_email, client_phone, client_address, rental_start, rental_end, delivery_date, pickup_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        name, guest_count, event_date || null, notes || null,
        venue_name || null, venue_email || null, venue_phone || null, venue_address || null, venue_contact || null, venue_notes || null, quote_notes || null,
        tax_rate != null ? Number(tax_rate) : null,
        client_first_name || null, client_last_name || null, client_email || null, client_phone || null, client_address || null,
        rental_start || null, rental_end || null, delivery_date || null, pickup_date || null
      );

      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ quote });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/quotes/:id
  router.put('/:id', (req, res) => {
    const body = req.body || {};
    const { name, guest_count, event_date, notes, lead_id, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate } = body;
    const { client_first_name, client_last_name, client_email, client_phone, client_address } = body;
    const { rental_start, rental_end, delivery_date, pickup_date } = body;
    const { expires_at, expiration_message, payment_policy_id, rental_terms_id } = body;
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    db.prepare(`
      UPDATE quotes SET
        name          = COALESCE(?, name),
        guest_count   = COALESCE(?, guest_count),
        event_date    = COALESCE(?, event_date),
        notes         = COALESCE(?, notes),
        lead_id       = COALESCE(?, lead_id),
        venue_name    = COALESCE(?, venue_name),
        venue_email   = COALESCE(?, venue_email),
        venue_phone   = COALESCE(?, venue_phone),
        venue_address = COALESCE(?, venue_address),
        venue_contact = COALESCE(?, venue_contact),
        venue_notes   = COALESCE(?, venue_notes),
        quote_notes   = COALESCE(?, quote_notes),
        tax_rate      = ?,
        client_first_name = COALESCE(?, client_first_name),
        client_last_name  = COALESCE(?, client_last_name),
        client_email      = COALESCE(?, client_email),
        client_phone      = COALESCE(?, client_phone),
        client_address    = COALESCE(?, client_address),
        rental_start  = COALESCE(?, rental_start),
        rental_end    = COALESCE(?, rental_end),
        delivery_date = COALESCE(?, delivery_date),
        pickup_date   = COALESCE(?, pickup_date),
        expires_at         = ?,
        expiration_message = ?,
        payment_policy_id  = ?,
        rental_terms_id    = ?,
        updated_at    = datetime('now')
      WHERE id = ?
    `).run(
      name !== undefined ? name : null,
      guest_count !== undefined ? guest_count : null,
      event_date !== undefined ? event_date : null,
      notes !== undefined ? notes : null,
      lead_id !== undefined ? lead_id : null,
      venue_name !== undefined ? venue_name : null,
      venue_email !== undefined ? venue_email : null,
      venue_phone !== undefined ? venue_phone : null,
      venue_address !== undefined ? venue_address : null,
      venue_contact !== undefined ? venue_contact : null,
      venue_notes !== undefined ? venue_notes : null,
      quote_notes !== undefined ? quote_notes : null,
      tax_rate !== undefined ? (tax_rate === null ? null : Number(tax_rate)) : quote.tax_rate,
      client_first_name !== undefined ? client_first_name : null,
      client_last_name !== undefined ? client_last_name : null,
      client_email !== undefined ? client_email : null,
      client_phone !== undefined ? client_phone : null,
      client_address !== undefined ? client_address : null,
      rental_start !== undefined ? (rental_start || null) : null,
      rental_end !== undefined ? (rental_end || null) : null,
      delivery_date !== undefined ? (delivery_date || null) : null,
      pickup_date !== undefined ? (pickup_date || null) : null,
      expires_at !== undefined ? (expires_at || null) : quote.expires_at,
      expiration_message !== undefined ? (expiration_message || null) : quote.expiration_message,
      payment_policy_id !== undefined ? (payment_policy_id || null) : quote.payment_policy_id,
      rental_terms_id !== undefined ? (rental_terms_id || null) : quote.rental_terms_id,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    logActivity(db, req.params.id, 'quote_updated', 'Project details updated', null, null, req);
    res.json({ quote: updated });
  });

  // POST /api/quotes/:id/ensure-public-token — set public_token if missing (for View Quote)
  router.post('/:id/ensure-public-token', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    if (!quote.public_token) {
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare('UPDATE quotes SET public_token = ?, updated_at = datetime(\'now\') WHERE id = ?').run(token, req.params.id);
    }
    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    res.json({ quote: updated });
  });

  // POST /api/quotes/:id/send — email; set status to 'sent', generate public_token
  router.post('/:id/send', async (req, res) => {
    try {
      const result = await quoteService.sendQuote({
        db,
        uploadsDir,
        quoteId: req.params.id,
        actor: req.user,
        input: req.body || {},
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id/unsigned-changes — dismiss "unsigned changes" banner without re-sending
  router.delete('/:id/unsigned-changes', (req, res) => {
    const quote = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    db.prepare("UPDATE quotes SET has_unsigned_changes = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    logActivity(db, req.params.id, 'status_change', 'Unsigned-changes flag cleared (dismissed by staff)', null, null, req);
    res.json({ ok: true });
  });

  // POST /api/quotes/:id/confirm — transition approved → confirmed (hard inventory reservation)
  router.post('/:id/confirm', (req, res) => {
    try {
      const result = quoteService.transitionQuoteStatus({
        db,
        quoteId: req.params.id,
        fromStatuses: 'approved',
        toStatus: 'confirmed',
        actor: req.user,
        clearUnsignedChanges: true,
        description: 'Quote confirmed — inventory reserved',
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/close — transition confirmed → closed (post-event, releases inventory)
  router.post('/:id/close', (req, res) => {
    try {
      const result = quoteService.transitionQuoteStatus({
        db,
        quoteId: req.params.id,
        fromStatuses: 'confirmed',
        toStatus: 'closed',
        actor: req.user,
        description: 'Quote closed — inventory released, damage charges enabled',
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // GET /api/quotes/:id/damage-charges
  router.get('/:id/damage-charges', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    let charges = [];
    try {
      charges = db.prepare('SELECT * FROM quote_damage_charges WHERE quote_id = ? ORDER BY created_at DESC').all(req.params.id);
    } catch (e) {}
    res.json({ charges });
  });

  // POST /api/quotes/:id/damage-charges — add a damage charge (closed quotes only)
  router.post('/:id/damage-charges', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    if ((quote.status || 'draft') !== 'closed') {
      return res.status(400).json({ error: 'Damage charges can only be added to closed quotes' });
    }
    const { title, amount, note } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
    const userId = req.user && req.user.sub;
    try {
      db.prepare(
        'INSERT INTO quote_damage_charges (quote_id, title, amount, note, created_by) VALUES (?, ?, ?, ?, ?)'
      ).run(req.params.id, title, amt, note || null, userId || null);
      logActivity(db, req.params.id, 'damage_charge_added', `Damage charge added: ${title} ($${amt.toFixed(2)})`, null, amt.toFixed(2), req);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    const charges = db.prepare('SELECT * FROM quote_damage_charges WHERE quote_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.status(201).json({ charges });
  });

  // DELETE /api/quotes/:id/damage-charges/:cid
  router.delete('/:id/damage-charges/:cid', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const charge = db.prepare('SELECT * FROM quote_damage_charges WHERE id = ? AND quote_id = ?').get(req.params.cid, req.params.id);
    if (!charge) return res.status(404).json({ error: 'Charge not found' });
    db.prepare('DELETE FROM quote_damage_charges WHERE id = ?').run(req.params.cid);
    logActivity(db, req.params.id, 'damage_charge_removed', `Damage charge removed: ${charge.title} ($${Number(charge.amount).toFixed(2)})`, Number(charge.amount).toFixed(2), null, req);
    const charges = db.prepare('SELECT * FROM quote_damage_charges WHERE quote_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json({ deleted: true, charges });
  });

  // GET /api/quotes/:id/adjustments
  router.get('/:id/adjustments', (req, res) => {
    const quote = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    let adjustments = [];
    try {
      adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    } catch (e) {}
    res.json({ adjustments });
  });

  // POST /api/quotes/:id/adjustments
  router.post('/:id/adjustments', (req, res) => {
    const quote = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const { label, type, value_type, amount, sort_order } = req.body || {};
    if (!label) return res.status(400).json({ error: 'label required' });
    if (!['discount', 'surcharge'].includes(type)) return res.status(400).json({ error: 'type must be discount or surcharge' });
    if (!['percent', 'fixed'].includes(value_type)) return res.status(400).json({ error: 'value_type must be percent or fixed' });
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });
    if (value_type === 'percent' && amt > 100) return res.status(400).json({ error: 'percent amount cannot exceed 100' });
    try {
      db.prepare(
        'INSERT INTO quote_adjustments (quote_id, label, type, value_type, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(req.params.id, label, type, value_type, amt, sort_order != null ? sort_order : 0);
      logActivity(db, req.params.id, 'adjustment_added', `${type === 'discount' ? 'Discount' : 'Surcharge'} added: ${label} (${value_type === 'percent' ? amt + '%' : '$' + amt.toFixed(2)})`, null, null, req);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    const adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    markUnsignedChangesIfApproved(db, req.params.id);
    res.status(201).json({ adjustments });
  });

  // PUT /api/quotes/:id/adjustments/:aid
  router.put('/:id/adjustments/:aid', (req, res) => {
    const adj = db.prepare('SELECT * FROM quote_adjustments WHERE id = ? AND quote_id = ?').get(req.params.aid, req.params.id);
    if (!adj) return res.status(404).json({ error: 'Adjustment not found' });
    const { label, type, value_type, amount, sort_order } = req.body || {};
    const newLabel = label !== undefined ? label : adj.label;
    const newType = type !== undefined ? type : adj.type;
    const newValueType = value_type !== undefined ? value_type : adj.value_type;
    const newAmt = amount !== undefined ? parseFloat(amount) : adj.amount;
    const newSort = sort_order !== undefined ? sort_order : adj.sort_order;
    if (!['discount', 'surcharge'].includes(newType)) return res.status(400).json({ error: 'type must be discount or surcharge' });
    if (!['percent', 'fixed'].includes(newValueType)) return res.status(400).json({ error: 'value_type must be percent or fixed' });
    if (isNaN(newAmt) || newAmt < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });
    db.prepare(
      'UPDATE quote_adjustments SET label=?, type=?, value_type=?, amount=?, sort_order=? WHERE id=?'
    ).run(newLabel, newType, newValueType, newAmt, newSort, req.params.aid);
    markUnsignedChangesIfApproved(db, req.params.id);
    const adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    res.json({ adjustments });
  });

  // DELETE /api/quotes/:id/adjustments/:aid
  router.delete('/:id/adjustments/:aid', (req, res) => {
    const adj = db.prepare('SELECT * FROM quote_adjustments WHERE id = ? AND quote_id = ?').get(req.params.aid, req.params.id);
    if (!adj) return res.status(404).json({ error: 'Adjustment not found' });
    db.prepare('DELETE FROM quote_adjustments WHERE id = ?').run(req.params.aid);
    logActivity(db, req.params.id, 'adjustment_removed', `Adjustment removed: ${adj.label}`, null, null, req);
    markUnsignedChangesIfApproved(db, req.params.id);
    const adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    res.json({ deleted: true, adjustments });
  });

  // POST /api/quotes/:id/approve — set status to 'approved'
  router.post('/:id/approve', (req, res) => {
    try {
      const result = quoteService.transitionQuoteStatus({
        db,
        quoteId: req.params.id,
        fromStatuses: ['draft', 'sent', 'approved', 'confirmed', 'closed'],
        toStatus: 'approved',
        actor: req.user,
        clearUnsignedChanges: true,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/revert — revert approved/sent back to draft
  router.post('/:id/revert', (req, res) => {
    try {
      const result = quoteService.transitionQuoteStatus({
        db,
        quoteId: req.params.id,
        fromStatuses: ['draft', 'sent', 'approved', 'confirmed', 'closed'],
        toStatus: 'draft',
        actor: req.user,
        clearUnsignedChanges: true,
      });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // DELETE /api/quotes/:id
  router.delete('/:id', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  // POST /api/quotes/:id/duplicate — create a copy (same details, items, custom items); no lead_id
  router.post('/:id/duplicate', (req, res) => {
    try {
      const result = quoteService.duplicateQuote({ db, sourceQuoteId: req.params.id });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  // POST /api/quotes/:id/items
  router.post('/:id/items', (req, res) => {
    const { item_id, quantity = 1, label, sort_order = 0, hidden_from_quote } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id required' });

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const hidden = hidden_from_quote ? 1 : 0;
    const result = db.prepare(
      'INSERT INTO quote_items (quote_id, item_id, quantity, label, sort_order, hidden_from_quote) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.params.id, item_id, quantity, label || null, sort_order, hidden);

    upsertItemStats(db, item_id, quote.guest_count || 0);

    const qitem = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(result.lastInsertRowid);
    const title = (label || item.title || '').trim() || item.title || 'Item';
    const newVal = buildQuoteItemSnapshot({ label: title, item_title: item.title, unit_price: item.unit_price, quantity: quantity || 1 });
    logActivity(db, req.params.id, 'item_added', 'Added line item: ' + title, null, newVal, req);
    markUnsignedChangesIfApproved(db, req.params.id);
    res.status(201).json({ qitem });
  });

  // PUT /api/quotes/:id/items/:qitem_id — zero quantity removes the item
  router.put('/:id/items/:qitem_id', (req, res) => {
    const { quantity, label, sort_order, hidden_from_quote, unit_price_override, discount_type, discount_amount, description, notes } = req.body;
    const oldRow = db.prepare(`
      SELECT qi.quantity, qi.label, qi.unit_price_override, i.title as item_title, i.unit_price
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.id = ? AND qi.quote_id = ?
    `).get(req.params.qitem_id, req.params.id);
    if (!oldRow) return res.status(404).json({ error: 'Not found' });

    const qtyNum = quantity !== undefined && quantity !== null ? Number(quantity) : null;
    if (qtyNum === 0) {
      const oldVal = buildQuoteItemSnapshot(oldRow);
      db.prepare('DELETE FROM quote_items WHERE id = ? AND quote_id = ?')
        .run(req.params.qitem_id, req.params.id);
      logActivity(db, req.params.id, 'item_removed', 'Removed line item (zero quantity)', oldVal, null, req);
      markUnsignedChangesIfApproved(db, req.params.id);
      return res.json({ deleted: true });
    }

    // unit_price_override: explicit null clears it, a number sets it, undefined leaves unchanged
    let newOverride = oldRow.unit_price_override;
    if (unit_price_override !== undefined) {
      newOverride = unit_price_override === null ? null : parseFloat(unit_price_override);
    }

    db.prepare(`
      UPDATE quote_items SET
        quantity            = COALESCE(?, quantity),
        label               = COALESCE(?, label),
        sort_order          = COALESCE(?, sort_order),
        hidden_from_quote   = COALESCE(?, hidden_from_quote),
        unit_price_override = ?,
        discount_type       = COALESCE(?, discount_type),
        discount_amount     = COALESCE(?, discount_amount),
        description         = COALESCE(?, description),
        notes               = COALESCE(?, notes)
      WHERE id = ? AND quote_id = ?
    `).run(
      quantity !== undefined ? quantity : null,
      label !== undefined ? label : null,
      sort_order !== undefined ? sort_order : null,
      hidden_from_quote !== undefined ? (hidden_from_quote ? 1 : 0) : null,
      newOverride !== undefined ? newOverride : null,
      discount_type !== undefined ? discount_type : null,
      discount_amount !== undefined ? parseFloat(discount_amount) : null,
      description !== undefined ? description : null,
      notes !== undefined ? notes : null,
      req.params.qitem_id,
      req.params.id
    );

    const qitem = db.prepare(`
      SELECT qi.quantity, qi.label, i.title as item_title, i.unit_price
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.id = ? AND qi.quote_id = ?
    `).get(req.params.qitem_id, req.params.id);
    const newTitle = (qitem.label || qitem.item_title || '').trim() || qitem.item_title || 'Item';
    const oldVal = buildQuoteItemSnapshot(oldRow);
    const newVal = buildQuoteItemSnapshot(qitem);
    if (oldVal !== newVal) {
      logActivity(db, req.params.id, 'item_updated', 'Updated line item: ' + newTitle, oldVal, newVal, req);
    }
    const qitemFull = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(req.params.qitem_id);
    res.json({ qitem: qitemFull });
  });

  // DELETE /api/quotes/:id/items/:qitem_id
  router.delete('/:id/items/:qitem_id', (req, res) => {
    const oldRow = db.prepare(`
      SELECT qi.quantity, qi.label, i.title as item_title, i.unit_price
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.id = ? AND qi.quote_id = ?
    `).get(req.params.qitem_id, req.params.id);
    const oldVal = buildQuoteItemSnapshot(oldRow);
    db.prepare('DELETE FROM quote_items WHERE id = ? AND quote_id = ?')
      .run(req.params.qitem_id, req.params.id);
    if (oldVal) logActivity(db, req.params.id, 'item_removed', 'Removed line item', oldVal, null, req);
    markUnsignedChangesIfApproved(db, req.params.id);
    res.json({ deleted: true });
  });

  // POST /api/quotes/:id/custom-items
  router.post('/:id/custom-items', (req, res) => {
    const quote = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    const { title, unit_price = 0, quantity = 1, photo_url, taxable = 1, sort_order = 0 } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });

    const result = db.prepare(
      'INSERT INTO quote_custom_items (quote_id, title, unit_price, quantity, photo_url, taxable, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.params.id, title, unit_price, quantity, photo_url || null, taxable ? 1 : 0, sort_order);

    const item = db.prepare('SELECT * FROM quote_custom_items WHERE id = ?').get(result.lastInsertRowid);
    const newVal = buildCustomItemSnapshot({ title, unit_price, quantity: quantity || 1 });
    logActivity(db, req.params.id, 'custom_item_added', 'Added custom item: ' + title, null, newVal, req);
    markUnsignedChangesIfApproved(db, req.params.id);
    res.status(201).json({ item });
  });

  // PUT /api/quotes/:id/items/reorder — update sort_order for all items in bulk
  router.put('/:id/items/reorder', (req, res) => {
    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) return res.status(400).json({ error: 'Invalid id' });
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    const update = db.prepare('UPDATE quote_items SET sort_order = ? WHERE id = ? AND quote_id = ?');
    const tx = db.transaction(() => {
      order.forEach((qitemId, idx) => {
        update.run(idx, qitemId, quoteId);
      });
    });
    tx();
    res.json({ ok: true });
  });

  // PUT /api/quotes/:id/custom-items/:cid — zero quantity removes the item
  router.put('/:id/custom-items/:cid', (req, res) => {
    const { title, unit_price, quantity, photo_url, taxable, sort_order } = req.body || {};
    const oldRow = db.prepare('SELECT title, unit_price, quantity FROM quote_custom_items WHERE id = ? AND quote_id = ?').get(req.params.cid, req.params.id);
    if (!oldRow) return res.status(404).json({ error: 'Not found' });

    const qtyNum = quantity !== undefined && quantity !== null ? Number(quantity) : null;
    if (qtyNum === 0) {
      const oldVal = buildCustomItemSnapshot(oldRow);
      db.prepare('DELETE FROM quote_custom_items WHERE id = ? AND quote_id = ?')
        .run(req.params.cid, req.params.id);
      logActivity(db, req.params.id, 'custom_item_removed', 'Removed custom item (zero quantity)', oldVal, null, req);
      markUnsignedChangesIfApproved(db, req.params.id);
      return res.json({ deleted: true });
    }

    db.prepare(`
      UPDATE quote_custom_items SET
        title      = COALESCE(?, title),
        unit_price = COALESCE(?, unit_price),
        quantity   = COALESCE(?, quantity),
        photo_url  = COALESCE(?, photo_url),
        taxable    = COALESCE(?, taxable),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ? AND quote_id = ?
    `).run(
      title !== undefined ? title : null,
      unit_price !== undefined ? unit_price : null,
      quantity !== undefined ? quantity : null,
      photo_url !== undefined ? photo_url : null,
      taxable !== undefined ? (taxable ? 1 : 0) : null,
      sort_order !== undefined ? sort_order : null,
      req.params.cid,
      req.params.id
    );

    const newRow = db.prepare('SELECT title, unit_price, quantity FROM quote_custom_items WHERE id = ? AND quote_id = ?').get(req.params.cid, req.params.id);
    const oldVal = buildCustomItemSnapshot(oldRow);
    const newVal = buildCustomItemSnapshot(newRow);
    if (oldVal !== newVal) {
      logActivity(db, req.params.id, 'custom_item_updated', 'Updated custom item: ' + (newRow.title || ''), oldVal, newVal, req);
    }
    markUnsignedChangesIfApproved(db, req.params.id);
    const item = db.prepare('SELECT * FROM quote_custom_items WHERE id = ?').get(req.params.cid);
    res.json({ item });
  });

  // DELETE /api/quotes/:id/custom-items/:cid
  router.delete('/:id/custom-items/:cid', (req, res) => {
    const oldRow = db.prepare('SELECT title, unit_price, quantity FROM quote_custom_items WHERE id = ? AND quote_id = ?').get(req.params.cid, req.params.id);
    const oldVal = buildCustomItemSnapshot(oldRow);
    db.prepare('DELETE FROM quote_custom_items WHERE id = ? AND quote_id = ?')
      .run(req.params.cid, req.params.id);
    if (oldVal) logActivity(db, req.params.id, 'custom_item_removed', 'Removed custom item', oldVal, null, req);
    markUnsignedChangesIfApproved(db, req.params.id);
    res.json({ deleted: true });
  });

  return router;
};
