function listMessages(db, { orgId, quoteId = null, direction = '', limit = 200, offset = 0 }) {
  let sql = 'SELECT * FROM messages WHERE 1=1';
  const params = [];

  if (quoteId) {
    sql += ' AND quote_id = ?';
    params.push(quoteId);
  }

  sql += ' AND org_id = ?';
  params.push(orgId);

  if (direction) {
    sql += ' AND direction = ?';
    params.push(direction);
  }

  sql += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

function getMessageById(db, messageId) {
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) || null;
}

function listMessagesForQuote(db, quoteId, direction = 'ASC') {
  return db.prepare(
    `SELECT * FROM messages WHERE quote_id = ? ORDER BY sent_at ${direction === 'DESC' ? 'DESC' : 'ASC'}`
  ).all(quoteId);
}

function insertOutboundMessage(db, params) {
  const {
    orgId,
    quoteId,
    fromEmail,
    toEmail,
    subject,
    bodyText,
    quoteName,
    replyToId,
    attachmentsJson,
    linksJson,
    messageType,
    richPayloadJson,
  } = params;

  return db.prepare(`
    INSERT INTO messages (
      org_id, quote_id, direction, from_email, to_email, subject, body_text, status, sent_at, quote_name,
      reply_to_id, attachments_json, links_json, message_type, rich_payload_json
    )
    VALUES (?, ?, 'outbound', ?, ?, ?, ?, 'sent', datetime('now'), ?, ?, ?, ?, ?, ?)
  `).run(
    orgId,
    quoteId,
    fromEmail,
    toEmail,
    subject,
    bodyText,
    quoteName,
    replyToId,
    attachmentsJson,
    linksJson,
    messageType,
    richPayloadJson
  );
}

function getUnreadMessageCount(db, orgId) {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM messages WHERE org_id = ? AND status = 'unread'"
  ).get(orgId);
  return row ? row.count : 0;
}

function markMessageRead(db, messageId, orgId) {
  return db.prepare("UPDATE messages SET status = 'read' WHERE id = ? AND org_id = ?").run(messageId, orgId);
}

function deleteMessage(db, messageId, orgId) {
  return db.prepare('DELETE FROM messages WHERE id = ? AND org_id = ?').run(messageId, orgId);
}

module.exports = {
  listMessages,
  getMessageById,
  listMessagesForQuote,
  insertOutboundMessage,
  getUnreadMessageCount,
  markMessageRead,
  deleteMessage,
};
