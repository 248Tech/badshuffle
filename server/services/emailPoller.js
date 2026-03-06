const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { decrypt } = require('../lib/crypto');

async function pollOnce(db) {
  const s = {};
  db.prepare("SELECT key, value FROM settings WHERE key LIKE 'imap_%'")
    .all().forEach(r => { s[r.key] = r.value; });

  if (!s.imap_host || !s.imap_user || s.imap_poll_enabled === '0') return 0;

  const pass = s.imap_pass_enc ? decrypt(s.imap_pass_enc) : '';
  const client = new ImapFlow({
    host: s.imap_host,
    port: parseInt(s.imap_port || '993'),
    secure: s.imap_secure !== 'false',
    auth: { user: s.imap_user, pass },
    logger: false
  });

  let ingested = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const msg of client.fetch('UNSEEN', { envelope: true, source: true })) {
        const parsed = await simpleParser(msg.source);
        const inReplyTo = parsed.inReplyTo;
        if (!inReplyTo) continue;

        const outbound = db.prepare("SELECT * FROM messages WHERE message_id = ?").get(inReplyTo);
        if (!outbound) continue;

        const existingMsg = db.prepare("SELECT id FROM messages WHERE message_id = ?").get(parsed.messageId);
        if (existingMsg) continue;

        db.prepare(`
          INSERT INTO messages (quote_id, direction, from_email, to_email, subject, body_text, body_html, message_id, in_reply_to, status, sent_at, quote_name)
          VALUES (?, 'inbound', ?, ?, ?, ?, ?, ?, ?, 'unread', datetime('now'), ?)
        `).run(
          outbound.quote_id,
          parsed.from ? parsed.from.text : '',
          parsed.to ? parsed.to.text : '',
          parsed.subject || '',
          parsed.text || '',
          parsed.html || null,
          parsed.messageId || null,
          inReplyTo,
          outbound.quote_name || ''
        );
        ingested++;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
  return ingested;
}

let _timer = null;

function startPolling(db, intervalMs) {
  if (_timer) return;
  _timer = setInterval(function() { pollOnce(db).catch(function() {}); }, intervalMs || 5 * 60 * 1000);
}

function stopPolling() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { pollOnce, startPolling, stopPolling };
