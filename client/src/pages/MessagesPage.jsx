import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './MessagesPage.module.css';

const DIRECTIONS = [
  { label: 'All',      value: '' },
  { label: 'Inbound',  value: 'inbound' },
  { label: 'Outbound', value: 'outbound' },
];

function groupByQuote(messages) {
  const map = {};
  for (const m of messages) {
    const key = m.quote_id ? String(m.quote_id) : '__none__';
    if (!map[key]) map[key] = { quote_id: m.quote_id, quote_name: m.quote_name || '(No quote)', messages: [] };
    map[key].messages.push(m);
  }
  // Sort threads by most recent message
  return Object.values(map).sort((a, b) => {
    const aLast = a.messages[0] ? a.messages[0].sent_at : '';
    const bLast = b.messages[0] ? b.messages[0].sent_at : '';
    return bLast.localeCompare(aLast);
  });
}

// Auto-link URLs and emails in plain text
function autoLink(text) {
  if (!text) return '';
  const parts = text.split(/(https?:\/\/[^\s<>"]+|[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
    if (/^[a-zA-Z0-9._%+\-]+@/.test(part)) return <a key={i} href={`mailto:${part}`}>{part}</a>;
    return part;
  });
}

function MessageBody({ msg }) {
  const [expanded, setExpanded] = useState(false);

  if (msg.body_html) {
    const iframeSrc = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;font-size:14px;color:#1f2937;margin:12px;word-break:break-word;}a{color:#1a8fc1;}img{max-width:100%;}</style></head><body>${msg.body_html}</body></html>`;
    return (
      <div className={styles.msgBodyHtml}>
        <iframe
          srcDoc={iframeSrc}
          sandbox="allow-same-origin"
          className={styles.htmlFrame}
          onLoad={e => { e.target.style.height = e.target.contentDocument.documentElement.scrollHeight + 'px'; }}
          title="Message content"
        />
      </div>
    );
  }

  const text = msg.body_text || '(No body)';
  const PREVIEW_CHARS = 400;
  const isLong = text.length > PREVIEW_CHARS;
  const displayText = isLong && !expanded ? text.slice(0, PREVIEW_CHARS) + '…' : text;
  return (
    <div className={styles.msgBody}>
      <pre className={styles.msgPre}>{autoLink(displayText)}</pre>
      {isLong && (
        <button type="button" className={styles.expandBtn} onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function snippet(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').slice(0, 80);
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return d.toLocaleDateString();
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteIdParam = searchParams.get('quote');
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (direction) params.direction = direction;
    api.getMessages(params)
      .then(d => setMessages(d.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [direction]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const threads = groupByQuote(messages);

  // Auto-select thread when arriving from a project link
  useEffect(() => {
    if (!quoteIdParam || threads.length === 0 || selectedThread) return;
    const found = threads.find(t => String(t.quote_id) === String(quoteIdParam));
    if (found) setSelectedThread(found);
  }, [quoteIdParam, threads.length]);

  function handleSelectThread(thread) {
    setSelectedThread(thread);
    // Mark unread messages as read
    for (const m of thread.messages) {
      if (m.status === 'unread') {
        api.markMessageRead(m.id).catch(() => {});
      }
    }
    // Update local state
    setMessages(prev => prev.map(m =>
      thread.messages.find(tm => tm.id === m.id) ? { ...m, status: m.status === 'unread' ? 'read' : m.status } : m
    ));
  }

  async function handleDelete(msg) {
    try {
      await api.deleteMessage(msg.id);
      toast.info('Message deleted');
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      if (selectedThread) {
        const remaining = selectedThread.messages.filter(m => m.id !== msg.id);
        if (remaining.length === 0) {
          setSelectedThread(null);
        } else {
          setSelectedThread({ ...selectedThread, messages: remaining });
        }
      }
    } catch (e) {
      toast.error(e.message);
    }
  }

  // Update selectedThread when messages change
  useEffect(() => {
    if (!selectedThread) return;
    const key = selectedThread.quote_id ? String(selectedThread.quote_id) : '__none__';
    const updated = threads.find(t => (t.quote_id ? String(t.quote_id) : '__none__') === key);
    if (updated) setSelectedThread(updated);
  }, [messages]); // eslint-disable-line

  const hasUnread = (thread) => thread.messages.some(m => m.status === 'unread');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Messages</h1>
        <div className={styles.tabs}>
          {DIRECTIONS.map(d => (
            <button
              key={d.value}
              className={`${styles.tab} ${direction === d.value ? styles.tabActive : ''}`}
              onClick={() => { setDirection(d.value); setSelectedThread(null); }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.panes}>
        <div className={styles.listPane}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : threads.length === 0 ? (
            <div className={styles.empty}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>No messages yet</span>
              <span style={{ fontSize: 12 }}>Messages from sent quotes will appear here.</span>
            </div>
          ) : (
            threads.map(thread => {
              const lastMsg = thread.messages[0];
              const isSelected = selectedThread && (
                selectedThread.quote_id === thread.quote_id ||
                (selectedThread.quote_id == null && thread.quote_id == null)
              );
              return (
                <div
                  key={thread.quote_id || '__none__'}
                  className={`${styles.threadRow} ${isSelected ? styles.threadSelected : ''}`}
                  onClick={() => handleSelectThread(thread)}
                >
                  <div className={styles.threadTop}>
                    <span className={styles.threadName}>{thread.quote_name}</span>
                    {hasUnread(thread) && <span className={styles.unreadDot} />}
                    <span className={styles.threadTime}>{relativeTime(lastMsg ? lastMsg.sent_at : '')}</span>
                  </div>
                  <div className={styles.threadSnippet}>
                    {lastMsg ? snippet(lastMsg.body_text || lastMsg.subject || '') : ''}
                  </div>
                  <div className={styles.threadCount}>{thread.messages.length} message{thread.messages.length !== 1 ? 's' : ''}</div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.detailPane}>
          {!selectedThread ? (
            <div className={styles.empty}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Select a thread to view messages</span>
            </div>
          ) : (
            <div className={styles.threadDetail}>
              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>{selectedThread.quote_name}</h2>
                {selectedThread.quote_id && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/quotes/${selectedThread.quote_id}`)}
                  >
                    View Quote →
                  </button>
                )}
              </div>
              <div className={styles.messageList}>
                {[...selectedThread.messages].reverse().map(msg => (
                  <div key={msg.id} className={`${styles.message} ${styles['msg_' + msg.direction]}`}>
                    <div className={styles.msgMeta}>
                      <span className={`${styles.dirBadge} ${styles['dir_' + msg.direction]}`}>
                        {msg.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      </span>
                      {msg.direction === 'inbound'
                        ? <span className={styles.msgAddr}>From: {msg.from_email}</span>
                        : <span className={styles.msgAddr}>To: {msg.to_email}</span>
                      }
                      <span className={styles.msgTime}>{relativeTime(msg.sent_at)}</span>
                      <button className={styles.msgDelete} onClick={() => handleDelete(msg)} title="Delete">✕</button>
                    </div>
                    {msg.subject && <div className={styles.msgSubject}>{msg.subject}</div>}
                    <MessageBody msg={msg} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
