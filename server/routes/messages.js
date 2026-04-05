const express = require('express');
const notificationService = require('../services/notificationService');
const teamChatService = require('../services/teamChatService');
const {
  listMessages,
  getMessageById,
  listMessagesForQuote,
  insertOutboundMessage,
  getUnreadMessageCount,
  markMessageRead,
  deleteMessage,
} = require('../db/queries/messages');

module.exports = function makeRouter(db) {
  const router = express.Router();
  const ORG_ID = 1;

  function parsePositiveInt(value) {
    if (value == null) return null;
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (!Number.isFinite(n) || Number.isNaN(n) || n < 1) return null;
    return Math.trunc(n);
  }

  function clampInt(value, min, max, fallback) {
    const n = parseInt(String(value), 10);
    if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  // GET /api/messages?quote_id=N&direction=inbound
  router.get('/', (req, res) => {
    const quoteId = parsePositiveInt(req.query.quote_id);

    if (quoteId) {
    } else {
      // Listing all messages is sensitive; restrict to operator/admin.
      const userId = req.user?.sub ?? req.user?.id;
      const row = userId != null ? db.prepare('SELECT role FROM users WHERE id = ?').get(userId) : null;
      const role = row?.role || '';
      if (role !== 'admin' && role !== 'operator') {
        return res.status(400).json({ error: 'quote_id required' });
      }
    }

    const direction = req.query.direction != null ? String(req.query.direction).trim() : '';
    if (direction) {
      if (direction !== 'inbound' && direction !== 'outbound') {
        return res.status(400).json({ error: 'Invalid direction' });
      }
      sql += ' AND direction = ?';
      params.push(direction);
    }

    const limit = clampInt(req.query.limit, 1, 500, 200);
    const offset = clampInt(req.query.offset, 0, 1_000_000, 0);
    const messages = listMessages(db, { orgId: ORG_ID, quoteId, direction, limit, offset });
    res.json({ messages });
  });

  // POST /api/messages — internal team sends a message on a quote thread
  router.post('/', (req, res) => {
    const body = req.body || {};
    const {
      quote_id,
      body_text,
      subject,
      reply_to_id,
      attachments,
      links,
      message_type,
      rich_payload,
    } = body;

    const quoteId = parsePositiveInt(quote_id);
    if (!quoteId) {
      return res.status(400).json({ error: 'quote_id required' });
    }

    const quote = db.prepare('SELECT id, name, client_email FROM quotes WHERE id = ? AND org_id = ?').get(quoteId, ORG_ID);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    if (reply_to_id != null && reply_to_id !== '') {
      const replyId = parsePositiveInt(reply_to_id);
      if (!replyId) return res.status(400).json({ error: 'Invalid reply_to_id' });
      const parent = db.prepare('SELECT id, quote_id FROM messages WHERE id = ?').get(replyId);
      if (!parent || parent.quote_id !== quote.id) {
        return res.status(400).json({ error: 'Invalid reply_to_id' });
      }
    }

    const userEmail = req.user?.email || null;

    let finalBody = body_text != null ? String(body_text).trim() : '';
    if (finalBody.length > 50_000) return res.status(400).json({ error: 'body_text too long' });
    const linkArr = Array.isArray(links)
      ? links.map((l) => String(l).trim()).filter(Boolean).slice(0, 50)
      : [];
    for (const l of linkArr) {
      if (l.length > 2000) return res.status(400).json({ error: 'link too long' });
    }
    if (linkArr.length) {
      finalBody = finalBody ? `${finalBody}\n\n${linkArr.join('\n')}` : linkArr.join('\n');
    }

    const attArr = Array.isArray(attachments) ? attachments.slice(0, 50) : [];
    const normalizedAtt = [];
    for (const a of attArr) {
      if (!a || typeof a !== 'object') return res.status(400).json({ error: 'Invalid attachment' });
      const fileId = parsePositiveInt(a.file_id);
      if (!fileId) return res.status(400).json({ error: 'Invalid attachment file_id' });
      const name = a.name != null ? String(a.name).trim() : (a.original_name != null ? String(a.original_name).trim() : '');
      if (name.length > 500) return res.status(400).json({ error: 'attachment name too long' });
      normalizedAtt.push({ file_id: fileId, name: name || null });
    }

    const hasRich = message_type === 'rich' && rich_payload != null && typeof rich_payload === 'object';

    if (!finalBody && !hasRich && attArr.length === 0) {
      return res.status(400).json({ error: 'body_text, links, attachments, or rich payload required' });
    }

    if (!finalBody && normalizedAtt.length && !hasRich) {
      finalBody =
        normalizedAtt.map((a) => a.name || (a.file_id != null ? `File #${a.file_id}` : 'Attachment')).join(', ') ||
        'Attachment';
    }

    const attJson =
      normalizedAtt.length > 0
        ? JSON.stringify(normalizedAtt)
        : null;
    const linkJson = linkArr.length > 0 ? JSON.stringify(linkArr) : null;
    const richJson = hasRich ? JSON.stringify(rich_payload) : null;
    if (richJson && richJson.length > 200_000) return res.status(400).json({ error: 'rich_payload too large' });
    const msgType = hasRich ? 'rich' : 'text';
    const replyId = reply_to_id != null && reply_to_id !== '' ? parsePositiveInt(reply_to_id) : null;

    try {
      const subj = subject != null ? String(subject).trim() : '';
      if (subj.length > 500) return res.status(400).json({ error: 'subject too long' });

      insertOutboundMessage(db, {
        orgId: ORG_ID,
        quoteId: quote.id,
        fromEmail: userEmail,
        toEmail: quote.client_email || null,
        subject: subj || 'Message regarding your quote',
        bodyText: finalBody,
        quoteName: quote.name || '',
        replyToId: replyId,
        attachmentsJson: attJson,
        linksJson: linkJson,
        messageType: msgType,
        richPayloadJson: richJson,
      });
      notificationService.createNotification(db, {
        type: 'message_sent',
        title: 'Message sent',
        body: `${quote.name || 'Untitled project'}${quote.client_email ? ` · ${quote.client_email}` : ''}`,
        href: `/messages`,
        entityType: 'quote',
        entityId: quote.id,
        actorUserId: req.user?.sub || req.user?.id || null,
        actorLabel: notificationService.buildActorLabel(req.user),
      });
      const messages = listMessagesForQuote(db, quote.id, 'ASC');
      res.json({ ok: true, messages });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/quotes/:quoteId/ai', async (req, res) => {
    try {
      const result = await teamChatService.listQuoteAiMessages(db, req.params.quoteId, req.user);
      res.json(result);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message });
    }
  });

  router.post('/quotes/:quoteId/ai', async (req, res) => {
    try {
      const result = await teamChatService.sendQuoteAiMessage(db, req.params.quoteId, req.body || {}, req.user);
      res.json(result);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message });
    }
  });

  // GET /api/messages/unread-count
  router.get('/unread-count', (req, res) => {
    res.json({ count: getUnreadMessageCount(db, ORG_ID) });
  });

  // PUT /api/messages/:id/read
  router.put('/:id/read', (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const info = markMessageRead(db, id, ORG_ID);
    if (!info || info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  // DELETE /api/messages/:id
  router.delete('/:id', (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const info = deleteMessage(db, id, ORG_ID);
    if (!info || info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  });

  return router;
};
