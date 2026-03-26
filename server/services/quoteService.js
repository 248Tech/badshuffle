const path = require('path');
const crypto = require('crypto');
const { logActivity } = require('../lib/quoteActivity');

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getQuoteOrThrow(db, quoteId) {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
  if (!quote) throw createHttpError(404, 'Not found');
  return quote;
}

async function sendQuote({ db, uploadsDir, quoteId, actor, input = {} }) {
  const quote = getQuoteOrThrow(db, quoteId);
  const {
    templateId,
    subject,
    bodyHtml,
    bodyText,
    toEmail,
    attachmentIds = [],
  } = input;

  void templateId;

  const token = quote.public_token || crypto.randomBytes(24).toString('hex');
  db.prepare("UPDATE quotes SET status = 'sent', public_token = ?, updated_at = datetime('now') WHERE id = ?")
    .run(token, quoteId);

  const msgId = `<bs-q${quoteId}-${Date.now()}@badshuffle.local>`;
  let emailPreview = null;
  let fromAddr = null;

  if (toEmail) {
    const smtpRows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'").all();
    const smtp = {};
    smtpRows.forEach((row) => { smtp[row.key] = row.value; });
    fromAddr = smtp.smtp_from || smtp.smtp_user || null;

    if (smtp.smtp_host && smtp.smtp_user) {
      try {
        const nodemailer = require('nodemailer');
        const { decrypt } = require('../lib/crypto');
        const transporter = nodemailer.createTransport({
          host: smtp.smtp_host,
          port: parseInt(smtp.smtp_port || '587', 10),
          secure: smtp.smtp_secure === 'true',
          auth: { user: smtp.smtp_user, pass: smtp.smtp_pass_enc ? decrypt(smtp.smtp_pass_enc) : '' },
        });

        const mailOptions = {
          from: fromAddr,
          to: toEmail,
          subject: subject || '',
          text: bodyText || '',
          html: bodyHtml || undefined,
          messageId: msgId,
          attachments: [],
        };

        for (const fid of attachmentIds) {
          const file = db.prepare(`
            SELECT f.original_name, f.stored_name
            FROM files f
            JOIN quote_attachments qa ON qa.file_id = f.id
            WHERE f.id = ? AND qa.quote_id = ?
          `).get(fid, quoteId);
          if (file && uploadsDir) {
            mailOptions.attachments.push({
              filename: file.original_name,
              path: path.join(uploadsDir, file.stored_name),
            });
          }
        }

        await transporter.sendMail(mailOptions);

        if (quote.lead_id) {
          try {
            db.prepare('INSERT INTO lead_events (lead_id, event_type, note) VALUES (?, ?, ?)')
              .run(quote.lead_id, 'email_sent', subject || 'Quote sent');
          } catch (e) {}
        }
        logActivity(db, quoteId, 'quote_sent', `Quote sent to ${toEmail || 'client'}`, null, null, actor);

        emailPreview = { to: toEmail, subject: subject || '(No subject)', sent: true };
      } catch (err) {
        emailPreview = { to: toEmail, subject: subject || '(No subject)', error: err.message };
      }
    } else {
      emailPreview = { to: toEmail, subject: subject || '(No subject)', body: bodyText || bodyHtml || '' };
    }
  }

  try {
    db.prepare(`
      INSERT OR IGNORE INTO messages (quote_id, direction, from_email, to_email, subject, body_text, body_html, message_id, status, sent_at, quote_name)
      VALUES (?, 'outbound', ?, ?, ?, ?, ?, ?, 'sent', datetime('now'), ?)
    `).run(quoteId, fromAddr, toEmail || null, subject || '', bodyText || '', bodyHtml || null, msgId, quote.name || '');
  } catch (e) {}

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
  return { quote: updated, emailPreview };
}

function duplicateQuote({ db, sourceQuoteId }) {
  const quote = getQuoteOrThrow(db, sourceQuoteId);

  const result = db.prepare(`
    INSERT INTO quotes (name, guest_count, event_date, notes, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate, client_first_name, client_last_name, client_email, client_phone, client_address, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(
    `${quote.name || 'Quote'} (copy)`,
    quote.guest_count ?? 0,
    quote.event_date || null,
    quote.notes || null,
    quote.venue_name || null,
    quote.venue_email || null,
    quote.venue_phone || null,
    quote.venue_address || null,
    quote.venue_contact || null,
    quote.venue_notes || null,
    quote.quote_notes || null,
    quote.tax_rate != null ? quote.tax_rate : null,
    quote.client_first_name || null,
    quote.client_last_name || null,
    quote.client_email || null,
    quote.client_phone || null,
    quote.client_address || null
  );
  const newId = result.lastInsertRowid;

  const items = db.prepare(
    'SELECT item_id, quantity, label, sort_order, hidden_from_quote FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id'
  ).all(sourceQuoteId);
  const itemStmt = db.prepare(
    'INSERT INTO quote_items (quote_id, item_id, quantity, label, sort_order, hidden_from_quote) VALUES (?, ?, ?, ?, ?, ?)'
  );
  items.forEach((item) => {
    itemStmt.run(newId, item.item_id, item.quantity ?? 1, item.label, item.sort_order ?? 0, item.hidden_from_quote ?? 0);
  });

  const customItems = db.prepare(
    'SELECT title, unit_price, quantity, photo_url, taxable, sort_order FROM quote_custom_items WHERE quote_id = ? ORDER BY sort_order, id'
  ).all(sourceQuoteId);
  const customStmt = db.prepare(
    'INSERT INTO quote_custom_items (quote_id, title, unit_price, quantity, photo_url, taxable, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  customItems.forEach((item) => {
    customStmt.run(newId, item.title, item.unit_price ?? 0, item.quantity ?? 1, item.photo_url, item.taxable ?? 1, item.sort_order ?? 0);
  });

  db.prepare('UPDATE quotes SET public_token = NULL WHERE id = ?').run(newId);
  const newQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(newId);
  return { quote: newQuote };
}

function transitionQuoteStatus({ db, quoteId, fromStatuses, toStatus, actor, clearUnsignedChanges = false, description = null, eventType = 'status_changed' }) {
  const quote = getQuoteOrThrow(db, quoteId);
  const currentStatus = quote.status || 'draft';
  const allowedFrom = Array.isArray(fromStatuses) ? fromStatuses : [fromStatuses];

  if (!allowedFrom.includes(currentStatus)) {
    if (toStatus === 'confirmed') throw createHttpError(400, 'Quote must be in "approved" status to confirm');
    if (toStatus === 'closed') throw createHttpError(400, 'Quote must be in "confirmed" status to close');
    throw createHttpError(400, `Quote must be in ${allowedFrom.join(' or ')} status to transition`);
  }

  const setClauses = ['status = ?'];
  const params = [toStatus];
  if (clearUnsignedChanges) {
    setClauses.push('has_unsigned_changes = 0');
  }
  setClauses.push("updated_at = datetime('now')");
  params.push(quoteId);

  db.prepare(`UPDATE quotes SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

  if (description) {
    logActivity(db, quoteId, eventType, description, currentStatus, toStatus, actor);
  }

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
  return { quote: updated };
}

module.exports = {
  sendQuote,
  duplicateQuote,
  transitionQuoteStatus,
};
