import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import MessageBody, { getMessageSnippet } from '../components/messages/MessageBody.jsx';

const DIRECTIONS = [
  { label: 'All', value: '' },
  { label: 'Inbound', value: 'inbound' },
  { label: 'Outbound', value: 'outbound' },
];

function groupByQuote(messages) {
  const map = {};
  for (const m of messages) {
    const key = m.quote_id ? String(m.quote_id) : '__none__';
    if (!map[key]) map[key] = { quote_id: m.quote_id, quote_name: m.quote_name || '(No quote)', messages: [] };
    map[key].messages.push(m);
  }
  return Object.values(map).sort((a, b) => {
    const aLast = a.messages[0] ? a.messages[0].sent_at : '';
    const bLast = b.messages[0] ? b.messages[0].sent_at : '';
    return bLast.localeCompare(aLast);
  });
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
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
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

  const [composeText, setComposeText] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [richMode, setRichMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSending, setAiSending] = useState(false);
  const [aiError, setAiError] = useState('');
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    const params = {};
    if (direction) params.direction = direction;
    api
      .getMessages(params)
      .then((d) => setMessages(d.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [direction]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const threads = groupByQuote(messages);

  useEffect(() => {
    if (!quoteIdParam || threads.length === 0 || selectedThread) return;
    const found = threads.find((t) => String(t.quote_id) === String(quoteIdParam));
    if (found) setSelectedThread(found);
  }, [quoteIdParam, threads.length]);

  function handleSelectThread(thread) {
    setSelectedThread(thread);
    setComposeText('');
    setLinkInput('');
    setReplyTo(null);
    setPendingAttachments([]);
    setRichMode(false);
    for (const m of thread.messages) {
      if (m.status === 'unread') {
        api.markMessageRead(m.id).catch(() => {});
      }
    }
    setMessages((prev) =>
      prev.map((m) =>
        thread.messages.find((tm) => tm.id === m.id) ? { ...m, status: m.status === 'unread' ? 'read' : m.status } : m
      )
    );
  }

  async function handleDelete(msg) {
    try {
      await api.deleteMessage(msg.id);
      toast.info('Message deleted');
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      if (selectedThread) {
        const remaining = selectedThread.messages.filter((m) => m.id !== msg.id);
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

  useEffect(() => {
    if (!selectedThread) return;
    const key = selectedThread.quote_id ? String(selectedThread.quote_id) : '__none__';
    const updated = threads.find((t) => (t.quote_id ? String(t.quote_id) : '__none__') === key);
    if (updated) setSelectedThread(updated);
  }, [messages]); // eslint-disable-line

  useEffect(() => {
    if (!selectedThread?.quote_id) {
      setAiMessages([]);
      return;
    }
    let active = true;
    setAiLoading(true);
    api.getQuoteAiMessages(selectedThread.quote_id)
      .then((data) => {
        if (!active) return;
        setAiMessages(data.messages || []);
        setAiError('');
      })
      .catch((error) => {
        if (!active) return;
        setAiMessages([]);
        setAiError(error.message || 'Quote AI is currently unavailable.');
      })
      .finally(() => {
        if (active) setAiLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedThread?.quote_id]);

  const hasUnread = (thread) => thread.messages.some((m) => m.status === 'unread');

  const parseLinks = () =>
    linkInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));

  async function handleAttachFiles(e) {
    const files = e.target.files;
    if (!files?.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      const d = await api.uploadFiles(formData);
      const list = d.files || [];
      setPendingAttachments((prev) => [
        ...prev,
        ...list.map((f) => ({ file_id: f.id, name: f.original_name })),
      ]);
      toast.success(`Uploaded ${list.length} file(s)`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
    e.target.value = '';
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!selectedThread?.quote_id) {
      toast.error('Choose a quote thread to reply');
      return;
    }

    const links = parseLinks();
    const text = composeText.trim();

    if (!richMode && !text && pendingAttachments.length === 0 && links.length === 0) {
      toast.error('Add a message, link, attachment, or rich content');
      return;
    }

    let rich_payload;
    if (richMode) {
      rich_payload = {
        kind: 'product_card',
        title: 'Quote highlight',
        subtitle: selectedThread.quote_name || 'Your project',
        priceLabel: '',
        quoteId: selectedThread.quote_id,
        ctaLabel: 'Add to Quote',
      };
    }

    setSending(true);
    try {
      await api.sendQuoteMessage(selectedThread.quote_id, {
        body_text: text || undefined,
        reply_to_id: replyTo?.id,
        links: links.length ? links : undefined,
        attachments: pendingAttachments.length ? pendingAttachments : undefined,
        message_type: richMode ? 'rich' : 'text',
        rich_payload: richMode ? rich_payload : undefined,
      });
      setComposeText('');
      setLinkInput('');
      setReplyTo(null);
      setPendingAttachments([]);
      setRichMode(false);
      load();
      toast.success('Message sent');
    } catch (err) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function handleSendAi(event) {
    event.preventDefault();
    const message = aiInput.trim();
    if (!selectedThread?.quote_id || !message || aiSending) return;
    setAiSending(true);
    try {
      const data = await api.sendQuoteAiMessage(selectedThread.quote_id, { message });
      setAiMessages((prev) => [...prev, data.user_message, data.assistant_message]);
      setAiInput('');
      setAiError('');
    } catch (error) {
      setAiError(error.message || 'Failed to send AI message');
      toast.error(error.message || 'Failed to send AI message');
    } finally {
      setAiSending(false);
    }
  }

  const tabBase = 'px-3.5 py-1 rounded-full border border-border bg-bg text-text-muted text-[13px] cursor-pointer hover:border-primary hover:text-primary transition-colors';
  const tabActive = 'px-3.5 py-1 rounded-full border bg-primary border-primary text-white text-[13px] cursor-pointer';

  return (
    <div className="flex flex-col gap-4 min-h-0 min-w-0 h-[calc(100svh-80px)] max-sm:h-auto">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <div className="flex gap-1 flex-wrap">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              className={direction === d.value ? tabActive : tabBase}
              onClick={() => {
                setDirection(d.value);
                setSelectedThread(null);
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Split panes */}
      <div className="grid grid-cols-[300px_1fr] xl:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0 max-sm:flex max-sm:flex-col max-sm:min-h-[calc(100svh-180px)]">
        {/* List pane */}
        <div className={`border border-border rounded overflow-y-auto bg-bg max-sm:min-h-[300px] ${selectedThread ? 'max-sm:hidden' : ''}`}>
          {loading ? (
            <div aria-busy="true" aria-label="Loading messages">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="px-3.5 py-3 min-h-[56px] border-b border-border flex flex-col gap-1" aria-hidden="true">
                  <div className="flex items-center gap-1.5">
                    <div className="skeleton h-[13px] rounded flex-1" style={{ maxWidth: `${45 + (i % 4) * 12}%` }} />
                    <div className="skeleton h-[11px] w-9 rounded shrink-0" />
                  </div>
                  <div className="skeleton h-3 rounded" style={{ width: `${60 + (i % 3) * 10}%` }} />
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center text-text-muted text-[14px]">
              <svg width="36" height="36" className="opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>No messages yet</span>
              <span className="text-[12px]">Messages from sent quotes will appear here.</span>
            </div>
          ) : (
            threads.map((thread) => {
              const lastMsg = thread.messages[0];
              const isSelected =
                selectedThread &&
                (selectedThread.quote_id === thread.quote_id ||
                  (selectedThread.quote_id == null && thread.quote_id == null));
              return (
                <div
                  key={thread.quote_id || '__none__'}
                  className={`px-3.5 py-3 min-h-[56px] border-b border-border cursor-pointer transition-colors flex flex-col justify-center ${isSelected ? 'bg-surface border-l-[3px] border-l-primary' : 'hover:bg-surface'}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectThread(thread)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectThread(thread)}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[13px] font-semibold flex-1 truncate">{thread.quote_name}</span>
                    {hasUnread(thread) && <span className="w-2 h-2 rounded-full bg-warning shrink-0" aria-label="Unread messages" role="status" />}
                    <span className="text-[11px] text-text-muted shrink-0">{relativeTime(lastMsg ? lastMsg.sent_at : '')}</span>
                  </div>
                  <div className="text-[12px] text-text-muted truncate mb-0.5">
                    {lastMsg ? snippet(getMessageSnippet(lastMsg)) : ''}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {thread.messages.length} message{thread.messages.length !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail pane */}
        <div className={`border border-border rounded overflow-y-auto bg-bg max-sm:min-h-[400px] ${!selectedThread ? 'max-sm:hidden' : ''}`}>
          {!selectedThread ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center text-text-muted text-[14px]">
              <svg width="36" height="36" className="opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Select a thread to view messages</span>
            </div>
          ) : (
            <div className="flex flex-col h-full min-h-0">
              {/* Detail header */}
              <div className="px-4 py-3.5 border-b border-border shrink-0 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="hidden max-sm:flex items-center gap-1 text-primary text-[13px] font-semibold cursor-pointer shrink-0 bg-transparent border-none p-0"
                  onClick={() => setSelectedThread(null)}
                >
                  <span aria-hidden="true">←</span> Back
                </button>
                <h2 className="text-[16px] font-bold flex-1 min-w-0 truncate">{selectedThread.quote_name}</h2>
                {selectedThread.quote_id && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/quotes/${selectedThread.quote_id}`)}>
                      View Quote →
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/quotes/${selectedThread.quote_id}?tab=assistant`)}>
                      Open Copilot
                    </button>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex flex-col gap-3 p-4 flex-1 min-h-0 overflow-y-auto">
                {[...selectedThread.messages].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={`border border-border rounded p-3 bg-surface ${msg.direction === 'inbound' ? 'border-l-[3px] border-l-primary' : 'border-l-[3px] border-l-accent'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={msg.direction === 'inbound'
                          ? { background: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))', color: 'var(--color-primary)' }
                          : { background: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))', color: 'var(--color-accent)' }
                        }
                      >
                        {msg.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      </span>
                      <span className="text-[12px] text-text-muted flex-1">
                        {msg.direction === 'inbound' ? `From: ${msg.from_email}` : `To: ${msg.to_email}`}
                      </span>
                      <span className="text-[11px] text-text-muted">{relativeTime(msg.sent_at)}</span>
                      {selectedThread.quote_id && (
                        <button
                          type="button"
                          className="text-primary text-[12px] font-semibold bg-none border-none cursor-pointer px-1.5 py-0.5 rounded hover:underline"
                          onClick={() => setReplyTo({ id: msg.id, preview: getMessageSnippet(msg).slice(0, 120) })}
                        >
                          Reply
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-text-muted text-[12px] bg-none border-none cursor-pointer px-1.5 py-0.5 rounded hover:text-danger hover:bg-danger-subtle transition-colors"
                        onClick={() => handleDelete(msg)}
                        aria-label="Delete message"
                        title="Delete"
                      >
                        <span aria-hidden="true">✕</span>
                      </button>
                    </div>
                    {msg.subject && <div className="text-[13px] font-semibold mb-1.5">{msg.subject}</div>}
                    <MessageBody msg={msg} />
                  </div>
                ))}
              </div>

              {selectedThread.quote_id && (
                <div className="border-t border-border px-4 pt-3 pb-4 bg-surface/40 shrink-0">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="text-[13px] font-semibold">Quote AI Assist</div>
                      <div className="text-[12px] text-text-muted">Onyx uses curated quote, message, and pattern context for this thread.</div>
                    </div>
                  </div>
                  {!!aiError && (
                    <div className="rounded-lg border border-border px-3 py-2 mb-3 text-[12px] text-danger bg-bg">
                      {aiError}
                    </div>
                  )}
                  <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 mb-3">
                    {aiLoading ? (
                      <div className="text-[12px] text-text-muted">Loading AI thread…</div>
                    ) : aiMessages.length === 0 ? (
                      <div className="text-[12px] text-text-muted">Ask AI to summarize this quote, draft a reply, or compare it to similar projects.</div>
                    ) : aiMessages.map((msg) => (
                      <div key={`ai-${msg.id}`} className={`rounded-lg border border-border px-3 py-2 ${msg.role === 'assistant' ? 'bg-surface' : 'bg-bg'}`}>
                        <div className="flex items-center justify-between gap-3 text-[11px] text-text-muted mb-1">
                          <span className="font-semibold text-text">{msg.role === 'assistant' ? 'Onyx' : (msg.created_by_email || 'You')}</span>
                          <span>{relativeTime(msg.created_at)}</span>
                        </div>
                        <div className="whitespace-pre-wrap text-[13px] leading-5">{msg.body_text}</div>
                      </div>
                    ))}
                    {aiSending && (
                      <div className="rounded-lg border border-border px-3 py-2 bg-surface text-[12px] text-text-muted">Onyx is drafting a response…</div>
                    )}
                  </div>
                  <form className="flex flex-col gap-2" onSubmit={handleSendAi}>
                    <textarea
                      className="w-full box-border px-3 py-2 rounded border border-border font-inherit text-[13px] resize-y min-h-[68px] bg-bg text-text focus:outline-none focus:border-primary"
                      rows={2}
                      placeholder="Ask AI about this quote thread…"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="btn btn-secondary btn-sm" disabled={aiSending || !aiInput.trim()}>
                        {aiSending ? 'Working…' : 'Ask AI'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Composer */}
              {selectedThread.quote_id && (
                <form className="border-t border-border px-4 pt-3 pb-4 shrink-0 bg-bg" onSubmit={handleSend}>
                  {replyTo && (
                    <div className="flex items-start justify-between gap-2 text-[12px] text-text-muted bg-surface px-2.5 py-2 rounded border border-border mb-2">
                      <span>
                        Replying to #{replyTo.id}
                        {replyTo.preview ? ` — ${replyTo.preview}` : ''}
                      </span>
                      <button type="button" className="text-primary text-[12px] cursor-pointer shrink-0 bg-none border-none" onClick={() => setReplyTo(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="absolute w-0 h-0 opacity-0 pointer-events-none" onChange={handleAttachFiles} aria-hidden="true" />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                      Attach
                    </button>
                    <label className="inline-flex items-center gap-1.5 text-[13px] text-text-muted cursor-pointer">
                      <input type="checkbox" checked={richMode} onChange={(e) => setRichMode(e.target.checked)} />
                      Rich message
                    </label>
                  </div>
                  {pendingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {pendingAttachments.map((a, i) => (
                        <span key={`${a.file_id}-${i}`} className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full bg-surface border border-border">
                          {a.name || `File ${a.file_id}`}
                          <button
                            type="button"
                            className="text-text-muted text-[14px] leading-none px-0.5 hover:text-danger cursor-pointer bg-none border-none"
                            onClick={() => setPendingAttachments((prev) => prev.filter((_, j) => j !== i))}
                            aria-label="Remove attachment"
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="url"
                    className="w-full box-border px-2.5 py-2 mb-2 rounded border border-border text-[13px] bg-bg text-text focus:outline-none focus:border-primary"
                    placeholder="https://… (links, space or comma separated)"
                    aria-label="Link URLs (space or comma separated)"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                  />
                  <textarea
                    className="w-full box-border px-3 py-2.5 mb-2.5 rounded border border-border font-inherit text-[14px] resize-y min-h-[72px] bg-bg text-text focus:outline-none focus:border-primary"
                    rows={3}
                    placeholder={richMode ? 'Optional note with rich card…' : 'Write a message…'}
                    aria-label="Message"
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={sending}>
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </form>
              )}

              {!selectedThread.quote_id && (
                <p className="px-4 pb-4 text-[13px] text-text-muted m-0">This thread is not tied to a quote; open a quote-linked thread to reply.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
