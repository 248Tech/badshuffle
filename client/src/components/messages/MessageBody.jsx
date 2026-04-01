import React, { useState, useEffect } from 'react';
import { api } from '../../api.js';
import { sanitizeMessageBodyHtml } from '../../lib/sanitizeHtml.js';
import RichMessageRenderer from './RichMessageRenderer.jsx';
import styles from './MessageBody.module.css';
import pageStyles from '../../pages/MessagesPage.module.css';

// Auto-link URLs and emails in plain text
function autoLink(text) {
  if (!text) return '';
  const parts = text.split(/(https?:\/\/[^\s<>"]+|[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    if (/^[a-zA-Z0-9._%+\-]+@/.test(part)) {
      return (
        <a key={i} href={`mailto:${part}`}>
          {part}
        </a>
      );
    }
    return part;
  });
}

function parseJsonField(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function parseLinks(msg) {
  const raw = parseJsonField(msg.links_json);
  return Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : [];
}

function parseAttachments(msg) {
  const raw = parseJsonField(msg.attachments_json);
  return Array.isArray(raw) ? raw : [];
}

export function getMessageSnippet(msg) {
  if (!msg) return '';
  if (msg.message_type === 'rich') {
    const p = parseJsonField(msg.rich_payload_json);
    if (p && typeof p === 'object' && p.title) return String(p.title);
    return 'Rich message';
  }
  return msg.body_text || msg.subject || '';
}

export default function MessageBody({ msg }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const raw = parseAttachments(msg);
    const ids = raw.map((a) => a.file_id).filter((x) => x != null && /^\d+$/.test(String(x)));
    if (!ids.length) return;
    api.prefetchFileServeUrls(ids).catch(() => {});
  }, [msg.id, msg.attachments_json]);

  const richPayload = parseJsonField(msg.rich_payload_json);
  const showRich = msg.message_type === 'rich' && richPayload && typeof richPayload === 'object';

  const extraLinks = parseLinks(msg);
  const attachments = parseAttachments(msg);

  const attachmentBlock =
    attachments.length > 0 ? (
      <div className={styles.attachRow}>
        {attachments.map((a, i) => (
          <a
            key={i}
            href={api.fileServeUrl(a.file_id)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.attachChip}
          >
            {a.name || `Attachment ${a.file_id}`}
          </a>
        ))}
      </div>
    ) : null;

  const linksBlock =
    extraLinks.length > 0 ? (
      <ul className={styles.linkList}>
        {extraLinks.map((url, i) => (
          <li key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </a>
          </li>
        ))}
      </ul>
    ) : null;

  const replyHint =
    msg.reply_to_id != null ? (
      <div className={styles.replyHint}>Reply to message #{msg.reply_to_id}</div>
    ) : null;

  if (msg.body_html) {
    const safeBody = sanitizeMessageBodyHtml(msg.body_html);
    const iframeSrc = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;font-size:14px;color:#1f2937;margin:12px;word-break:break-word;}a{color:#1a8fc1;}img{max-width:100%;}</style></head><body>${safeBody}</body></html>`;
    return (
      <div className={pageStyles.msgBodyHtml}>
        <iframe
          srcDoc={iframeSrc}
          sandbox="allow-same-origin"
          className={pageStyles.htmlFrame}
          onLoad={(e) => {
            e.target.style.height = e.target.contentDocument.documentElement.scrollHeight + 'px';
          }}
          title="Message content"
        />
      </div>
    );
  }

  if (showRich) {
    return (
      <div className={pageStyles.msgBody}>
        {replyHint}
        {attachmentBlock}
        {linksBlock}
        <RichMessageRenderer payload={richPayload} />
        {msg.body_text && String(msg.body_text).trim() && (
          <pre className={pageStyles.msgPre}>{autoLink(msg.body_text)}</pre>
        )}
      </div>
    );
  }

  const text = msg.body_text || '(No body)';
  const PREVIEW_CHARS = 400;
  const isLong = text.length > PREVIEW_CHARS;
  const displayText = isLong && !expanded ? text.slice(0, PREVIEW_CHARS) + '…' : text;

  return (
    <div className={pageStyles.msgBody}>
      {replyHint}
      {attachmentBlock}
      {linksBlock}
      <pre className={pageStyles.msgPre}>{autoLink(displayText)}</pre>
      {isLong && (
        <button type="button" className={pageStyles.expandBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
