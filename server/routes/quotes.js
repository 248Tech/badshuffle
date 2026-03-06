const express = require('express');
const crypto = require('crypto');

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/quotes
  router.get('/', (req, res) => {
    const quotes = db.prepare('SELECT * FROM quotes ORDER BY created_at DESC').all();
    res.json({ quotes });
  });

  // GET /api/quotes/summary — dashboard aggregates (must be before /:id)
  router.get('/summary', (req, res) => {
    const allQuotes = db.prepare('SELECT id, name, status, event_date, guest_count, created_at FROM quotes').all();

    const byStatus = { draft: 0, sent: 0, approved: 0 };
    allQuotes.forEach(q => {
      const s = q.status || 'draft';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });

    const revRows = db.prepare(`
      SELECT COALESCE(q.status, 'draft') AS status,
             COALESCE(SUM(qi.quantity * i.unit_price), 0) AS revenue
      FROM quotes q
      LEFT JOIN quote_items qi ON qi.quote_id = q.id
      LEFT JOIN items i ON i.id = qi.item_id
      GROUP BY COALESCE(q.status, 'draft')
    `).all();
    const revenueByStatus = {};
    revRows.forEach(r => { revenueByStatus[r.status] = r.revenue; });

    const today = new Date().toISOString().split('T')[0];
    const in90 = new Date(Date.now() + 90 * 864e5).toISOString().split('T')[0];
    const upcoming = allQuotes
      .filter(q => q.event_date && q.event_date >= today && q.event_date <= in90)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    const monthMap = {};
    allQuotes.forEach(q => {
      const m = (q.created_at || '').slice(0, 7);
      if (m) monthMap[m] = (monthMap[m] || 0) + 1;
    });
    const byMonth = Object.keys(monthMap).sort().slice(-6).map(m => ({ month: m, count: monthMap[m] }));

    res.json({ total: allQuotes.length, byStatus, revenueByStatus, upcoming, byMonth });
  });

  // GET /api/quotes/:id
  router.get('/:id', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    const items = db.prepare(`
      SELECT qi.id as qitem_id, qi.quantity, qi.label, qi.sort_order,
             i.id, i.title, i.photo_url, i.source, i.hidden,
             i.unit_price, i.taxable, i.category
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id = ?
      ORDER BY qi.sort_order ASC, qi.id ASC
    `).all(req.params.id);

    res.json({ ...quote, items });
  });

  // POST /api/quotes
  router.post('/', (req, res) => {
    const body = req.body || {};
    const { name, guest_count = 0, event_date, notes, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate } = body;
    const { client_first_name, client_last_name, client_email, client_phone, client_address } = body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const result = db.prepare(
      `INSERT INTO quotes (name, guest_count, event_date, notes, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate, client_first_name, client_last_name, client_email, client_phone, client_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      name, guest_count, event_date || null, notes || null,
      venue_name || null, venue_email || null, venue_phone || null, venue_address || null, venue_contact || null, venue_notes || null, quote_notes || null,
      tax_rate != null ? Number(tax_rate) : null,
      client_first_name || null, client_last_name || null, client_email || null, client_phone || null, client_address || null
    );

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ quote });
  });

  // PUT /api/quotes/:id
  router.put('/:id', (req, res) => {
    const body = req.body || {};
    const { name, guest_count, event_date, notes, lead_id, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate } = body;
    const { client_first_name, client_last_name, client_email, client_phone, client_address } = body;
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    db.prepare(`
      UPDATE quotes SET
        name         = COALESCE(?, name),
        guest_count  = COALESCE(?, guest_count),
        event_date   = COALESCE(?, event_date),
        notes        = COALESCE(?, notes),
        lead_id      = COALESCE(?, lead_id),
        venue_name   = COALESCE(?, venue_name),
        venue_email  = COALESCE(?, venue_email),
        venue_phone  = COALESCE(?, venue_phone),
        venue_address= COALESCE(?, venue_address),
        venue_contact= COALESCE(?, venue_contact),
        venue_notes  = COALESCE(?, venue_notes),
        quote_notes  = COALESCE(?, quote_notes),
        tax_rate     = ?,
        client_first_name = COALESCE(?, client_first_name),
        client_last_name  = COALESCE(?, client_last_name),
        client_email      = COALESCE(?, client_email),
        client_phone      = COALESCE(?, client_phone),
        client_address    = COALESCE(?, client_address),
        updated_at   = datetime('now')
      WHERE id = ?
    `).run(
      name ?? null,
      guest_count !== undefined ? guest_count : null,
      event_date ?? null,
      notes !== undefined ? notes : null,
      lead_id !== undefined ? lead_id : null,
      venue_name ?? null,
      venue_email ?? null,
      venue_phone ?? null,
      venue_address ?? null,
      venue_contact ?? null,
      venue_notes ?? null,
      quote_notes !== undefined ? quote_notes : null,
      tax_rate !== undefined ? (tax_rate === null ? null : Number(tax_rate)) : quote.tax_rate,
      client_first_name !== undefined ? client_first_name : null,
      client_last_name !== undefined ? client_last_name : null,
      client_email !== undefined ? client_email : null,
      client_phone !== undefined ? client_phone : null,
      client_address !== undefined ? client_address : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    res.json({ quote: updated });
  });

  // POST /api/quotes/:id/send — optional email; set status to 'sent', generate public_token
  router.post('/:id/send', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    const { templateId, subject, bodyHtml, bodyText, toEmail } = req.body || {};
    // Stub: if SMTP configured we could send here; for now just record and return preview
    const emailPreview = toEmail ? { to: toEmail, subject: subject || '(No subject)', body: bodyText || bodyHtml || '' } : null;

    const token = quote.public_token || crypto.randomBytes(24).toString('hex');
    db.prepare("UPDATE quotes SET status = 'sent', public_token = ?, updated_at = datetime('now') WHERE id = ?")
      .run(token, req.params.id);

    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    res.json({ quote: updated, emailPreview });
  });

  // POST /api/quotes/:id/approve — set status to 'approved'
  router.post('/:id/approve', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    db.prepare("UPDATE quotes SET status = 'approved', updated_at = datetime('now') WHERE id = ?")
      .run(req.params.id);

    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    res.json({ quote: updated });
  });

  // POST /api/quotes/:id/revert — revert approved/sent back to draft
  router.post('/:id/revert', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    db.prepare("UPDATE quotes SET status = 'draft', updated_at = datetime('now') WHERE id = ?")
      .run(req.params.id);

    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    res.json({ quote: updated });
  });

  // DELETE /api/quotes/:id
  router.delete('/:id', (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });

    db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  // POST /api/quotes/:id/items
  router.post('/:id/items', (req, res) => {
    const { item_id, quantity = 1, label, sort_order = 0 } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id required' });

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const result = db.prepare(
      'INSERT INTO quote_items (quote_id, item_id, quantity, label, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, item_id, quantity, label || null, sort_order);

    // Upsert item_stats
    const guestCount = quote.guest_count || 0;
    const existing = db.prepare('SELECT id, times_quoted, total_guests FROM item_stats WHERE item_id = ?').get(item_id);
    if (existing) {
      db.prepare(`
        UPDATE item_stats SET
          times_quoted = times_quoted + 1,
          total_guests = total_guests + ?,
          last_used_at = datetime('now')
        WHERE item_id = ?
      `).run(guestCount, item_id);
    } else {
      db.prepare(
        "INSERT INTO item_stats (item_id, times_quoted, total_guests, last_used_at) VALUES (?, 1, ?, datetime('now'))"
      ).run(item_id, guestCount);
    }

    // Update usage_brackets
    if (guestCount > 0) {
      const bMin = Math.floor(guestCount / 25) * 25;
      const bMax = bMin + 24;
      const existingBracket = db.prepare(
        'SELECT id FROM usage_brackets WHERE item_id = ? AND bracket_min = ?'
      ).get(item_id, bMin);

      if (existingBracket) {
        db.prepare('UPDATE usage_brackets SET times_used = times_used + 1 WHERE id = ?')
          .run(existingBracket.id);
      } else {
        db.prepare(
          'INSERT INTO usage_brackets (item_id, bracket_min, bracket_max, times_used) VALUES (?, ?, ?, 1)'
        ).run(item_id, bMin, bMax);
      }
    }

    const qitem = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ qitem });
  });

  // PUT /api/quotes/:id/items/:qitem_id
  router.put('/:id/items/:qitem_id', (req, res) => {
    const { quantity, label, sort_order } = req.body;

    db.prepare(`
      UPDATE quote_items SET
        quantity   = COALESCE(?, quantity),
        label      = COALESCE(?, label),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ? AND quote_id = ?
    `).run(
      quantity !== undefined ? quantity : null,
      label !== undefined ? label : null,
      sort_order !== undefined ? sort_order : null,
      req.params.qitem_id,
      req.params.id
    );

    const qitem = db.prepare('SELECT * FROM quote_items WHERE id = ?').get(req.params.qitem_id);
    res.json({ qitem });
  });

  // DELETE /api/quotes/:id/items/:qitem_id
  router.delete('/:id/items/:qitem_id', (req, res) => {
    db.prepare('DELETE FROM quote_items WHERE id = ? AND quote_id = ?')
      .run(req.params.qitem_id, req.params.id);
    res.json({ deleted: true });
  });

  return router;
};
