const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logActivity } = require('../lib/quoteActivity');
const notificationService = require('./notificationService');
const { computeTotalsFromRows, computeQuoteTotalsLegacy } = require('./quotePricingCore');
const quotePricingEngineService = require('./quotePricingEngineService');
const directoryContactsService = require('./directoryContactsService');
const quotePatternMemoryService = require('./quotePatternMemoryService');
const ORG_ID = 1;

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getQuoteOrThrow(db, quoteId) {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
  if (!quote) throw createHttpError(404, 'Not found');
  return quote;
}

function computeQuoteTotals(db, quoteId, explicitTaxRate = null) {
  return computeQuoteTotalsLegacy(db, quoteId, explicitTaxRate, {
    loadQuote: (database, requestedQuoteId) => getQuoteOrThrow(database, requestedQuoteId),
  });
}

async function summarizeQuotesForList(db, quotes, defaultTaxRate = 0, options = {}) {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];

  const ids = quotes.map((quote) => quote.id);
  const placeholders = ids.map(() => '?').join(', ');
  const itemsByQuote = new Map(ids.map((id) => [id, []]));
  const customItemsByQuote = new Map(ids.map((id) => [id, []]));
  const adjustmentsByQuote = new Map(ids.map((id) => [id, []]));
  const amountPaidByQuote = new Map(ids.map((id) => [id, 0]));
  const contractByQuote = new Map(ids.map((id) => [id, null]));

  db.prepare(`
    SELECT qi.quote_id, qi.quantity, qi.hidden_from_quote, qi.unit_price_override, qi.discount_type, qi.discount_amount,
           i.unit_price, i.taxable, i.category
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.quote_id IN (${placeholders})
  `).all(...ids).forEach((row) => {
    itemsByQuote.get(row.quote_id)?.push(row);
  });

  db.prepare(`
    SELECT quote_id, quantity, unit_price, taxable
    FROM quote_custom_items
    WHERE quote_id IN (${placeholders})
  `).all(...ids).forEach((row) => {
    customItemsByQuote.get(row.quote_id)?.push(row);
  });

  db.prepare(`
    SELECT quote_id, type, value_type, amount
    FROM quote_adjustments
    WHERE quote_id IN (${placeholders})
  `).all(...ids).forEach((row) => {
    adjustmentsByQuote.get(row.quote_id)?.push(row);
  });

  db.prepare(`
    SELECT quote_id, COALESCE(SUM(amount), 0) AS amount_paid
    FROM quote_payments
    WHERE quote_id IN (${placeholders})
    GROUP BY quote_id
  `).all(...ids).forEach((row) => {
    amountPaidByQuote.set(row.quote_id, Number(row.amount_paid || 0));
  });

  db.prepare(`
    SELECT quote_id, signed_at, signed_quote_total
    FROM contracts
    WHERE quote_id IN (${placeholders})
  `).all(...ids).forEach((row) => {
    contractByQuote.set(row.quote_id, row);
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  return Promise.all(quotes.map(async (quote) => {
    const fallbackTotals = computeTotalsFromRows(
      quote,
      itemsByQuote.get(quote.id) || [],
      customItemsByQuote.get(quote.id) || [],
      adjustmentsByQuote.get(quote.id) || [],
      quote.tax_rate != null ? quote.tax_rate : defaultTaxRate
    );
    const totals = await quotePricingEngineService.computeQuoteTotals(db, quote, quote.tax_rate != null ? quote.tax_rate : defaultTaxRate, {
      diagnostics: options.diagnostics,
      requestId: options.requestId,
      route: options.route || 'quote-summary-list',
      loadQuote: () => quote,
    }) || fallbackTotals;
    const total = totals.total;
    const amount_paid = amountPaidByQuote.get(quote.id) || 0;
    const remaining_balance = total - amount_paid;
    const contract = contractByQuote.get(quote.id) || {};
    const signed_quote_total = contract.signed_quote_total != null ? Number(contract.signed_quote_total) : null;
    const signed_remaining_balance = signed_quote_total != null ? signed_quote_total - amount_paid : null;
    const overpaid = remaining_balance < 0;
    const is_expired = !!(quote.expires_at && quote.expires_at < todayStr);
    return {
      ...quote,
      total,
      contract_total: total,
      amount_paid,
      remaining_balance,
      signed_quote_total,
      signed_remaining_balance,
      signed_at: contract.signed_at || null,
      overpaid,
      is_expired,
    };
  }));
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .trim();
}

function escapeXml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapePdfText(input) {
  return String(input || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ');
}

function buildSignatureSvg({ signerName, signedAt, signerIp }) {
  const safeName = escapeXml(signerName || 'Client');
  const safeDate = escapeXml(signedAt || '');
  const safeIp = escapeXml(signerIp || '');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="150" viewBox="0 0 560 150">',
    '<rect x="1" y="1" width="558" height="148" rx="10" fill="#fffdf8" stroke="#d9d2c3"/>',
    '<text x="28" y="82" font-size="42" font-family="Brush Script MT, Segoe Script, Snell Roundhand, cursive" fill="#172554" transform="rotate(-4 28 82)">',
    safeName,
    '</text>',
    '<line x1="28" y1="96" x2="300" y2="96" stroke="#94a3b8" stroke-width="1.5"/>',
    '<text x="28" y="118" font-size="13" font-family="Helvetica, Arial, sans-serif" fill="#475569">Electronically signed</text>',
    `<text x="28" y="136" font-size="12" font-family="Helvetica, Arial, sans-serif" fill="#64748b">${safeDate}  ${safeIp ? `• IP ${safeIp}` : ''}</text>`,
    '</svg>',
  ].join('');
}

function buildSimplePdfBuffer({ title, lines }) {
  const pageHeight = 792;
  const marginTop = 740;
  const lineHeight = 16;
  const perPage = 40;
  const chunks = [];
  for (let i = 0; i < lines.length; i += perPage) chunks.push(lines.slice(i, i + perPage));
  const objects = [];
  const pushObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = pushObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  const contentIds = [];
  const pagesId = pushObject('');

  chunks.forEach((chunk, index) => {
    const textOps = [
      'BT',
      '/F1 12 Tf',
      `${marginTop} TL`,
      `50 ${pageHeight - 50} Td`,
      `( ${escapePdfText(title)} ) Tj`,
      'T*',
    ];
    chunk.forEach((line) => {
      textOps.push(`(${escapePdfText(line)}) Tj`);
      textOps.push('T*');
    });
    textOps.push('ET');
    const content = textOps.join('\n');
    const contentId = pushObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
    contentIds.push(contentId);
    const pageId = pushObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
    void index;
  });

  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  const catalogId = pushObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function effectiveItemPrice(item) {
  const base = item.unit_price_override != null ? Number(item.unit_price_override || 0) : Number(item.unit_price || 0);
  if (item.discount_type === 'percent' && Number(item.discount_amount || 0) > 0) {
    return base * (1 - Number(item.discount_amount || 0) / 100);
  }
  if (item.discount_type === 'fixed' && Number(item.discount_amount || 0) > 0) {
    return Math.max(0, base - Number(item.discount_amount || 0));
  }
  return base;
}

function formatDateRangeLabel(start, end) {
  if (!start && !end) return null;
  const formatOne = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  if (start && end) return `${formatOne(start)} - ${formatOne(end)}`;
  return formatOne(start || end);
}

function buildQuoteSectionPresentationData(db, quote) {
  const sections = db.prepare(`
    SELECT *
    FROM quote_item_sections
    WHERE quote_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(quote.id);
  const normalizedSections = sections.length > 0
    ? sections
    : [{
        id: 'default',
        title: 'Quote Items',
        rental_start: quote.rental_start || null,
        rental_end: quote.rental_end || null,
      }];
  const fallbackSectionId = normalizedSections[0].id;

  const items = db.prepare(`
    SELECT qi.id, qi.item_id, qi.section_id, qi.quantity, qi.label, qi.hidden_from_quote,
           qi.unit_price_override, qi.discount_type, qi.discount_amount, qi.description AS qi_description,
           i.title, i.unit_price, i.category, i.description
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.quote_id = ?
    ORDER BY qi.sort_order ASC, qi.id ASC
  `).all(quote.id).filter((item) => !item.hidden_from_quote);

  const customItems = db.prepare(`
    SELECT *
    FROM quote_custom_items
    WHERE quote_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(quote.id);

  return normalizedSections
    .map((section, index) => {
      const sectionItems = items.filter((item) => String(item.section_id || fallbackSectionId) === String(section.id));
      const sectionCustomItems = customItems.filter((item) => String(item.section_id || fallbackSectionId) === String(section.id));
      const subtotal = sectionItems.reduce((sum, item) => sum + (effectiveItemPrice(item) * Number(item.quantity || 1)), 0)
        + sectionCustomItems.reduce((sum, item) => sum + (Number(item.unit_price || 0) * Number(item.quantity || 1)), 0);

      return {
        ...section,
        title: section.title || `Quote Items ${index + 1}`,
        date_range_label: formatDateRangeLabel(section.rental_start || null, section.rental_end || null),
        subtotal,
        items: sectionItems.map((item) => ({
          title: item.label || item.title,
          quantity: Number(item.quantity || 1),
          description: item.qi_description || item.description || null,
          line_total: effectiveItemPrice(item) * Number(item.quantity || 1),
        })),
        customItems: sectionCustomItems.map((item) => ({
          title: item.title,
          quantity: Number(item.quantity || 1),
          description: item.description || null,
          line_total: Number(item.unit_price || 0) * Number(item.quantity || 1),
        })),
      };
    })
    .filter((section) => section.items.length > 0 || section.customItems.length > 0);
}

function normalizeAuditField(value, maxLength = 255) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function buildQuoteSnapshotHash({ db, quote, contractBody, signedAt, signerName, totals = null }) {
  const resolvedTotals = totals || computeQuoteTotals(db, quote);
  const adjustments = db.prepare(`
    SELECT label, type, value_type, amount
    FROM quote_adjustments
    WHERE quote_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(quote.id);
  const payload = {
    quote_id: quote.id,
    quote_name: quote.name || null,
    quote_status: quote.status || null,
    event_date: quote.event_date || null,
    signed_at: signedAt || null,
    signer_name: signerName || null,
    contract_body: stripHtml(contractBody || ''),
    totals: resolvedTotals,
    adjustments,
    sections: buildQuoteSectionPresentationData(db, quote),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function createSignedContractArtifact({ db, uploadsDir, quote, contractBody, signerName, signerIp, signedAt, signedTotal, totals = null }) {
  if (!uploadsDir) return null;
  const textBody = stripHtml(contractBody || '');
  const sections = buildQuoteSectionPresentationData(db, quote);
  const resolvedTotals = totals || computeQuoteTotals(db, quote);
  const sectionLines = sections.flatMap((section) => {
    const lines = [
      '',
      section.title || 'Quote Items',
      section.date_range_label ? `Rental period: ${section.date_range_label}` : null,
    ].filter(Boolean);

    section.items.forEach((item) => {
      lines.push(`${item.title} x${item.quantity}  $${item.line_total.toFixed(2)}`);
      if (item.description) lines.push(`  ${stripHtml(item.description)}`);
    });
    section.customItems.forEach((item) => {
      lines.push(`${item.title} x${item.quantity}  $${item.line_total.toFixed(2)}`);
      if (item.description) lines.push(`  ${stripHtml(item.description)}`);
    });
    lines.push(`Section subtotal: $${Number(section.subtotal || 0).toFixed(2)}`);
    return lines;
  });
  const lines = [
    `Project: ${quote.name || 'Quote'}`,
    quote.event_date ? `Event date: ${quote.event_date}` : null,
    '',
    'Contract',
    ...(textBody ? textBody.split('\n') : ['No contract body saved.']),
    ...sectionLines,
    '',
    'Quote Totals',
    `Equipment subtotal: $${Number(resolvedTotals.subtotal || 0).toFixed(2)}`,
    `Delivery subtotal: $${Number(resolvedTotals.deliveryTotal || 0).toFixed(2)}`,
    `Custom items subtotal: $${Number(resolvedTotals.customSubtotal || 0).toFixed(2)}`,
    resolvedTotals.adjTotal !== 0 ? `Adjustments: $${Number(resolvedTotals.adjTotal || 0).toFixed(2)}` : null,
    resolvedTotals.rate > 0 ? `Tax (${Number(resolvedTotals.rate || 0).toFixed(2)}%): $${Number(resolvedTotals.tax || 0).toFixed(2)}` : null,
    '',
    'Signature',
    `Signed by: ${signerName || 'Client'}`,
    `Signed at: ${signedAt}`,
    signerIp ? `IP address: ${signerIp}` : null,
    `Signed contract total: $${Number(signedTotal || 0).toFixed(2)}`,
  ].filter(Boolean);
  const pdf = buildSimplePdfBuffer({
    title: `${quote.name || 'Quote'} Contract Signature`,
    lines,
  });
  const safeBase = String(quote.name || 'quote').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'quote';
  const stamp = String(signedAt || '').replace(/[^0-9]/g, '').slice(0, 14) || Date.now().toString();
  const originalName = `${safeBase}_signed_contract_${stamp}.pdf`;
  const storedName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
  fs.writeFileSync(path.join(uploadsDir, storedName), pdf);
  const fileRes = db.prepare(
    'INSERT INTO files (original_name, stored_name, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?)'
  ).run(originalName, storedName, 'application/pdf', pdf.length, null);
  const fileId = fileRes.lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO quote_attachments (quote_id, file_id) VALUES (?, ?)').run(quote.id, fileId);
  return fileId;
}

function getRangeFromDates(source = {}) {
  const dates = [];
  if (source.delivery_date) dates.push(source.delivery_date);
  if (source.rental_start) dates.push(source.rental_start);
  if (source.rental_end) dates.push(source.rental_end);
  if (source.pickup_date) dates.push(source.pickup_date);
  if (dates.length === 0 && source.event_date) dates.push(source.event_date);
  if (dates.length === 0) return { start: null, end: null };
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

function snapshotSignedQuoteItems({ db, quoteId, signatureEventId }) {
  const quote = db.prepare(`
    SELECT id, event_date, delivery_date, rental_start, rental_end, pickup_date
    FROM quotes
    WHERE id = ?
  `).get(quoteId) || {};
  const sections = db.prepare(`
    SELECT id, delivery_date, rental_start, rental_end, pickup_date
    FROM quote_item_sections
    WHERE quote_id = ?
  `).all(quoteId);
  const sectionMap = new Map(sections.map((section) => [Number(section.id), section]));
  const items = db.prepare(`
    SELECT id, item_id, section_id, quantity
    FROM quote_items
    WHERE quote_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(quoteId);

  const insertItem = db.prepare(`
    INSERT INTO contract_signature_items (signature_event_id, quote_id, qitem_id, item_id, section_id, quantity, range_start, range_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  items.forEach((item) => {
    const section = item.section_id != null ? sectionMap.get(Number(item.section_id)) : null;
    const range = getRangeFromDates(section || quote);
    insertItem.run(
      signatureEventId,
      quoteId,
      item.id || null,
      item.item_id,
      item.section_id || null,
      item.quantity || 1,
      range.start,
      range.end
    );
  });
}

async function signPublicContract({ db, uploadsDir, token, signerName, signerIp, signerUserAgent, diagnostics = null, requestId = null }) {
  if (!token) throw createHttpError(400, 'token required');
  const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(token);
  if (!quote) throw createHttpError(404, 'Not found');
  const normalizedSignerName = normalizeAuditField(signerName, 200);
  if (!normalizedSignerName) throw createHttpError(400, 'signer_name required');
  const normalizedSignerIp = normalizeAuditField(signerIp, 255);
  const normalizedSignerUserAgent = normalizeAuditField(signerUserAgent, 1000);
  const today = new Date().toISOString().slice(0, 10);
  if (quote.expires_at && quote.expires_at < today) {
    throw createHttpError(400, 'This quote has expired and can no longer be signed');
  }
  const status = quote.status || 'draft';
  if (!['sent', 'approved', 'confirmed'].includes(status)) {
    throw createHttpError(409, 'Quote is not in a signable state');
  }
  const contract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quote.id);
  const signedAt = new Date().toISOString();
  const totals = await quotePricingEngineService.computeQuoteTotals(db, quote, quote.tax_rate, {
    diagnostics,
    requestId,
    route: 'public-contract-sign',
    loadQuote: (database, requestedQuoteId) => getQuoteOrThrow(database, requestedQuoteId),
  });
  const signatureSvg = buildSignatureSvg({ signerName: normalizedSignerName, signedAt, signerIp: normalizedSignerIp });
  const signaturePayload = JSON.stringify({
    type: 'generated',
    typed_name: normalizedSignerName,
    signer_ip: normalizedSignerIp,
    signed_at: signedAt,
    svg: signatureSvg,
  });

  if (!contract) {
    db.prepare(`
      INSERT INTO contracts (quote_id, body_html, signed_at, signature_data, signer_name, signer_ip, signed_quote_total, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(quote.id, null, signedAt, signaturePayload, normalizedSignerName, normalizedSignerIp, totals.total);
  } else {
    db.prepare(`
      UPDATE contracts SET
        signed_at = ?,
        signature_data = ?,
        signer_name = ?,
        signer_ip = ?,
        signed_quote_total = ?,
        updated_at = datetime('now')
      WHERE quote_id = ?
    `).run(signedAt, signaturePayload, normalizedSignerName, normalizedSignerIp, totals.total, quote.id);
  }

  const nextStatus = quote.status === 'confirmed' ? 'confirmed' : 'approved';
  db.prepare("UPDATE quotes SET status = ?, has_unsigned_changes = 0, updated_at = datetime('now') WHERE id = ?").run(nextStatus, quote.id);
  const savedContract = db.prepare('SELECT * FROM contracts WHERE quote_id = ?').get(quote.id);
  const freshQuote = db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quote.id, ORG_ID);
  const quoteSnapshotHash = buildQuoteSnapshotHash({
    db,
    quote: freshQuote,
    contractBody: savedContract.body_html || '',
    signedAt,
    signerName: normalizedSignerName,
    totals,
  });
  const fileId = createSignedContractArtifact({
    db,
    uploadsDir,
    quote: freshQuote,
    contractBody: savedContract.body_html || '',
    signerName: normalizedSignerName,
    signerIp: normalizedSignerIp,
    signedAt,
    signedTotal: totals.total,
    totals,
  });
  const signatureEvent = db.prepare(
    'INSERT INTO contract_signature_events (quote_id, contract_id, signer_name, signer_ip, signer_user_agent, signed_at, signed_quote_total, quote_snapshot_hash, file_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    quote.id,
    savedContract.id,
    normalizedSignerName,
    normalizedSignerIp,
    normalizedSignerUserAgent,
    signedAt,
    totals.total,
    quoteSnapshotHash,
    fileId || null
  );
  snapshotSignedQuoteItems({ db, quoteId: quote.id, signatureEventId: signatureEvent.lastInsertRowid });
  logActivity(db, quote.id, 'contract_signed', `Contract signed by ${normalizedSignerName}`, null, `$${totals.total.toFixed(2)}`, null);
  quotePatternMemoryService.upsertMemoryRecord(db, freshQuote.id, 'quote_signed');
  notificationService.createNotification(db, {
    type: 'quote_signed',
    title: 'Project signed',
    body: `${freshQuote.name || 'Untitled project'} was signed by ${normalizedSignerName}`,
    href: `/quotes/${freshQuote.id}`,
    entityType: 'quote',
    entityId: freshQuote.id,
  });
  return {
    contract: savedContract,
    quote: freshQuote,
    file_id: fileId || null,
  };
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

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
  quotePatternMemoryService.upsertMemoryRecord(db, updated.id, 'quote_sent');
  notificationService.createNotification(db, {
    type: 'quote_sent',
    title: 'Project sent',
    body: `${updated.name || 'Untitled project'} was sent${toEmail ? ` to ${toEmail}` : ''}`,
    href: `/quotes/${updated.id}`,
    entityType: 'quote',
    entityId: updated.id,
    actorUserId: actor?.sub || actor?.id || null,
    actorLabel: notificationService.buildActorLabel(actor),
  });
  return { quote: updated, emailPreview };
}

function duplicateQuote({ db, sourceQuoteId }) {
  const quote = getQuoteOrThrow(db, sourceQuoteId);

  const result = db.prepare(`
    INSERT INTO quotes (name, guest_count, event_date, event_type, notes, venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes, quote_notes, tax_rate, client_first_name, client_last_name, client_email, client_phone, client_address, rental_start, rental_end, delivery_date, pickup_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(
    `${quote.name || 'Quote'} (copy)`,
    quote.guest_count ?? 0,
    quote.event_date || null,
    quote.event_type || null,
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
    quote.client_address || null,
    quote.rental_start || null,
    quote.rental_end || null,
    quote.delivery_date || null,
    quote.pickup_date || null
  );
  const newId = result.lastInsertRowid;
  directoryContactsService.syncQuoteDirectoryLinks(db, newId);

  const oldSections = db.prepare(
    'SELECT * FROM quote_item_sections WHERE quote_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(sourceQuoteId);
  const sectionIdMap = new Map();
  const insertSection = db.prepare(
    'INSERT INTO quote_item_sections (quote_id, title, delivery_date, rental_start, rental_end, pickup_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  oldSections.forEach((section, index) => {
    const res = insertSection.run(
      newId,
      section.title || 'Quote Items',
      section.delivery_date || null,
      section.rental_start || null,
      section.rental_end || null,
      section.pickup_date || null,
      section.sort_order ?? index
    );
    sectionIdMap.set(section.id, res.lastInsertRowid);
  });

  const items = db.prepare(
    'SELECT item_id, quantity, label, sort_order, hidden_from_quote, section_id FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id'
  ).all(sourceQuoteId);
  const itemStmt = db.prepare(
    'INSERT INTO quote_items (quote_id, item_id, quantity, label, sort_order, hidden_from_quote, section_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  items.forEach((item) => {
    itemStmt.run(
      newId,
      item.item_id,
      item.quantity ?? 1,
      item.label,
      item.sort_order ?? 0,
      item.hidden_from_quote ?? 0,
      item.section_id != null ? (sectionIdMap.get(item.section_id) || null) : null
    );
  });

  const customItems = db.prepare(
    'SELECT title, unit_price, quantity, photo_url, taxable, sort_order, section_id FROM quote_custom_items WHERE quote_id = ? ORDER BY sort_order, id'
  ).all(sourceQuoteId);
  const customStmt = db.prepare(
    'INSERT INTO quote_custom_items (quote_id, title, unit_price, quantity, photo_url, taxable, sort_order, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  customItems.forEach((item) => {
    customStmt.run(
      newId,
      item.title,
      item.unit_price ?? 0,
      item.quantity ?? 1,
      item.photo_url,
      item.taxable ?? 1,
      item.sort_order ?? 0,
      item.section_id != null ? (sectionIdMap.get(item.section_id) || null) : null
    );
  });

  db.prepare('UPDATE quotes SET public_token = NULL WHERE id = ?').run(newId);
  const newQuote = db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(newId, ORG_ID);
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

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
  quotePatternMemoryService.upsertMemoryRecord(db, quoteId, `status:${toStatus}`);
  return { quote: updated };
}

module.exports = {
  computeQuoteTotals,
  summarizeQuotesForList,
  sendQuote,
  signPublicContract,
  duplicateQuote,
  transitionQuoteStatus,
};
