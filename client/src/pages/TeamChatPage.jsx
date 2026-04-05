import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TeamChatPage() {
  const toast = useToast();
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatError, setChatError] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [input, setInput] = useState('');

  const selectedThread = useMemo(
    () => threads.find((thread) => String(thread.id) === String(selectedThreadId)) || null,
    [threads, selectedThreadId],
  );

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const data = await api.getTeamChatThreads();
      const nextThreads = data.threads || [];
      setThreads(nextThreads);
      setChatError('');
      if (!selectedThreadId && nextThreads.length) {
        setSelectedThreadId(String(nextThreads[0].id));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load team chat');
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedThreadId, toast]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }
    let active = true;
    setLoadingMessages(true);
    api.getTeamChatMessages(selectedThreadId)
      .then((data) => {
        if (!active) return;
        setMessages(data.messages || []);
        setChatError('');
      })
      .catch((error) => {
        if (!active) return;
        setChatError(error.message || 'Failed to load team chat thread');
        toast.error(error.message || 'Failed to load team chat thread');
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });
    return () => {
      active = false;
    };
  }, [selectedThreadId, toast]);

  async function handleCreateThread(event) {
    event.preventDefault();
    const title = threadTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const data = await api.createTeamChatThread({ title });
      const thread = data.thread;
      setThreads((prev) => [thread, ...prev]);
      setSelectedThreadId(String(thread.id));
      setThreadTitle('');
      toast.success('Team thread created');
    } catch (error) {
      toast.error(error.message || 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    const message = input.trim();
    if (!selectedThreadId || !message || sending) return;
    setSending(true);
    try {
      const data = await api.sendTeamChatMessage(selectedThreadId, { message });
      setMessages((prev) => [...prev, data.user_message, data.assistant_message]);
      setChatError('');
      setThreads((prev) => prev.map((thread) => (
        String(thread.id) === String(selectedThreadId)
          ? {
              ...thread,
              last_message_text: data.assistant_message.body_text,
              last_message_at: data.assistant_message.created_at,
            }
          : thread
      )));
      setInput('');
    } catch (error) {
      setChatError(error.message || 'Failed to send message');
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 min-h-0 min-w-0 h-[calc(100svh-80px)] max-sm:h-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Chat</h1>
          <p className="text-sm text-text-muted mt-1">Internal workspace chat powered by Onyx with BadShuffle-curated context.</p>
        </div>
        <form className="flex gap-2 flex-wrap" onSubmit={handleCreateThread}>
          <input
            className="border border-border rounded px-3 py-2 min-w-[220px] bg-bg"
            value={threadTitle}
            onChange={(event) => setThreadTitle(event.target.value)}
            placeholder="New thread title"
          />
          <button type="submit" className="btn btn-primary" disabled={creating || !threadTitle.trim()}>
            {creating ? 'Creating…' : 'New Thread'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-4 flex-1 min-h-0 max-lg:grid-cols-1">
        <div className="border border-border rounded bg-bg overflow-y-auto min-h-[240px]">
          {loadingThreads ? (
            <div className="p-4 text-sm text-text-muted">Loading threads…</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-text-muted">No team threads yet.</div>
          ) : threads.map((thread) => {
            const selected = String(thread.id) === String(selectedThreadId);
            return (
              <button
                key={thread.id}
                type="button"
                className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${selected ? 'bg-surface' : 'hover:bg-surface'}`}
                onClick={() => setSelectedThreadId(String(thread.id))}
              >
                <div className="font-semibold text-sm">{thread.title}</div>
                <div className="text-xs text-text-muted mt-1">{thread.last_message_text || 'No messages yet'}</div>
                <div className="text-[11px] text-text-muted mt-1">{formatTimestamp(thread.last_message_at || thread.created_at)}</div>
              </button>
            );
          })}
        </div>

        <div className="border border-border rounded bg-bg flex flex-col min-h-[320px]">
          {!selectedThread ? (
            <div className="p-5 text-sm text-text-muted">Choose a thread to start chatting.</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border">
                <div className="font-semibold">{selectedThread.title}</div>
                <div className="text-xs text-text-muted mt-1">Onyx-backed internal chat</div>
              </div>
              {!!chatError && (
                <div className="mx-4 mt-3 rounded-lg border border-border px-3 py-2 text-sm text-danger bg-surface">
                  {chatError}
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                {loadingMessages ? (
                  <div className="text-sm text-text-muted">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-text-muted">Send the first message to start this thread.</div>
                ) : messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl border border-border px-4 py-3 ${message.role === 'assistant' ? 'bg-surface' : 'bg-bg'}`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-text-muted mb-2">
                      <span className="font-semibold text-text">{message.role === 'assistant' ? 'Onyx' : (message.created_by_email || 'You')}</span>
                      <span>{formatTimestamp(message.created_at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-6">{message.body_text}</div>
                    {Array.isArray(message.metadata?.top_documents) && message.metadata.top_documents.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.metadata.top_documents.slice(0, 4).map((doc, index) => (
                          <span key={`${message.id}-doc-${index}`} className="text-[11px] px-2 py-1 rounded-full border border-border bg-bg text-text-muted">
                            {doc.semantic_identifier || doc.document_id || 'Context doc'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="rounded-xl border border-border px-4 py-3 bg-surface text-sm text-text-muted">Onyx is drafting a response…</div>
                )}
              </div>
              <form onSubmit={handleSendMessage} className="border-t border-border px-4 py-3 flex flex-col gap-3">
                <textarea
                  className="border border-border rounded px-3 py-2 bg-bg min-h-[90px]"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask the team chat about a project, client, venue, or item. Example: compare quote 12 and item 44"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-text-muted">Mention records like “quote 12”, “client 4”, “venue 7”, or “item 18” to send curated BadShuffle context.</span>
                  <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
