import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import styles from './QuoteAssistantPanel.module.css';

const STARTER_PROMPTS = [
  'Summarize this quote and call out operational risks.',
  'What inventory pressure or shortage issues should I watch?',
  'Show me similar past quotes and what they usually included.',
  'Recommend a few items that would strengthen this quote.',
  'Draft a concise follow-up email for the client.',
];

function formatMoney(value) {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
}

function buildVisibleItems(quote) {
  return (quote?.items || []).filter((item) => Number(item.hidden_from_quote || 0) !== 1);
}

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

function normalizePreview(preview) {
  return Array.isArray(preview) ? preview.filter((item) => item && item.label && item.summary) : [];
}

function normalizeEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return null;
  return {
    similar_quotes: Array.isArray(evidence.similar_quotes) ? evidence.similar_quotes : [],
    pattern_suggestions: Array.isArray(evidence.pattern_suggestions) ? evidence.pattern_suggestions : [],
    recommendation_suggestions: Array.isArray(evidence.recommendation_suggestions) ? evidence.recommendation_suggestions : [],
    pressure_items: Array.isArray(evidence.pressure_items) ? evidence.pressure_items : [],
    visible_items: Array.isArray(evidence.visible_items) ? evidence.visible_items : [],
  };
}

export default function QuoteAssistantPanel({ quoteId, quote }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const endRef = useRef(null);
  const visibleItems = buildVisibleItems(quote);
  const totalQuantity = visibleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const topItems = visibleItems.slice(0, 6);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getQuoteAssistantMessages(quoteId)
      .then((data) => {
        if (!active) return;
        setMessages(data.messages || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load assistant history');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [quoteId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    try {
      const data = await api.sendQuoteAssistantMessage(quoteId, { message });
      setMessages((prev) => [...prev, data.user_message, data.assistant_message]);
      setInput('');
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!messages.length || clearing || sending) return;
    if (!window.confirm('Clear the assistant history for this quote?')) return;
    setClearing(true);
    setError('');
    try {
      await api.clearQuoteAssistantMessages(quoteId);
      setMessages([]);
    } catch (err) {
      setError(err.message || 'Failed to clear assistant history');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className={`card ${styles.panel}`}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Internal Assistant</div>
          <h3 className={styles.title}>Quote Copilot</h3>
          <p className={styles.subtitle}>
            Read-only help for planning, follow-up drafting, financial review, and quote-aware inventory suggestions.
          </p>
        </div>
        <div className={styles.metaBlock}>
          <span className={styles.metaChip}>{quote?.status || 'draft'}</span>
          {quote?.event_date ? <span className={styles.metaChip}>{quote.event_date}</span> : null}
          {messages.length > 0 ? (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClearHistory}
              disabled={clearing || sending}
            >
              {clearing ? 'Clearing…' : 'Clear History'}
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.snapshotGrid}>
        <div className={styles.snapshotCard}>
          <span className={styles.snapshotLabel}>Guest Count</span>
          <strong className={styles.snapshotValue}>{Number(quote?.guest_count || 0) || 'Not set'}</strong>
        </div>
        <div className={styles.snapshotCard}>
          <span className={styles.snapshotLabel}>Line Items</span>
          <strong className={styles.snapshotValue}>{visibleItems.length}</strong>
        </div>
        <div className={styles.snapshotCard}>
          <span className={styles.snapshotLabel}>Quoted Qty</span>
          <strong className={styles.snapshotValue}>{totalQuantity}</strong>
        </div>
        <div className={styles.snapshotCard}>
          <span className={styles.snapshotLabel}>Balance</span>
          <strong className={styles.snapshotValue}>{formatMoney((quote?.total || 0) - (quote?.amount_paid || 0))}</strong>
        </div>
      </div>

      {topItems.length > 0 && (
        <div className={styles.contextBlock}>
          <div className={styles.contextHeader}>
            <strong>Quote Context</strong>
            <span className={styles.contextNote}>What the assistant can now see</span>
          </div>
          <div className={styles.itemChips}>
            {topItems.map((item) => (
              <span key={item.qitem_id || `${item.id}-${item.title}`} className={styles.itemChip}>
                {item.label || item.title} x{Number(item.quantity || 0)}
              </span>
            ))}
            {visibleItems.length > topItems.length ? (
              <span className={styles.itemChipMuted}>+{visibleItems.length - topItems.length} more</span>
            ) : null}
          </div>
        </div>
      )}

      {!messages.length && !loading && (
        <div className={styles.starters}>
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className={styles.starter}
              onClick={() => setInput(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className={styles.thread} aria-live="polite">
        {loading && (
          <div className={styles.state}>
            <span className="spinner" aria-hidden="true" />
            Loading assistant history…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className={styles.state}>
            Ask about risk, balance, follow-up language, or recommended items for this quote.
          </div>
        )}

        {messages.map((message) => {
          const preview = normalizePreview(message.metadata?.tool_preview);
          const evidence = normalizeEvidence(message.metadata?.evidence);
          return (
          <div
            key={message.id}
            className={`${styles.message} ${message.role === 'assistant' ? styles.assistant : styles.user}`}
          >
            <div className={styles.messageMeta}>
              <strong>{message.role === 'assistant' ? 'Assistant' : (message.user_email || 'You')}</strong>
              <span>{formatTimestamp(message.created_at)}</span>
            </div>
            <div className={styles.messageBody}>{message.content}</div>
            {message.role === 'assistant' && Array.isArray(message.metadata?.tools) && message.metadata.tools.length > 0 && (
              <div className={styles.tools}>
                {message.metadata.tools.map((toolName) => (
                  <span key={`${message.id}-${toolName}`} className={styles.toolChip}>{toolName}</span>
                ))}
              </div>
            )}
            {message.role === 'assistant' && preview.length > 0 && (
              <div className={styles.previewGrid}>
                {preview.map((item) => (
                  <div key={`${message.id}-${item.name}`} className={styles.previewCard}>
                    <strong className={styles.previewLabel}>{item.label}</strong>
                    <span className={styles.previewSummary}>{item.summary}</span>
                  </div>
                ))}
              </div>
            )}
            {message.role === 'assistant' && evidence && (
              <div className={styles.evidenceStack}>
                {evidence.similar_quotes.length > 0 && (
                  <div className={styles.evidenceCard}>
                    <strong className={styles.previewLabel}>Similar Quotes</strong>
                    <div className={styles.evidenceList}>
                      {evidence.similar_quotes.map((item) => (
                        <div key={`${message.id}-similar-${item.quote_id}`} className={styles.evidenceRow}>
                          <span className={styles.evidencePrimary}>{item.quote_name || `Quote ${item.quote_id}`}</span>
                          <span className={styles.evidenceMeta}>score {item.score}{item.event_date ? ` · ${item.event_date}` : ''}</span>
                          {Array.isArray(item.reasons) && item.reasons.length > 0 ? (
                            <span className={styles.evidenceReason}>{item.reasons.join(' · ')}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {evidence.pattern_suggestions.length > 0 && (
                  <div className={styles.evidenceCard}>
                    <strong className={styles.previewLabel}>Learned Bundles</strong>
                    <div className={styles.evidenceList}>
                      {evidence.pattern_suggestions.map((item) => (
                        <div key={`${message.id}-pattern-${item.id}`} className={styles.evidenceRow}>
                          <span className={styles.evidencePrimary}>{item.title}</span>
                          <span className={styles.evidenceReason}>{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {evidence.pressure_items.length > 0 && (
                  <div className={styles.evidenceCard}>
                    <strong className={styles.previewLabel}>Shortage Flags</strong>
                    <div className={styles.evidenceList}>
                      {evidence.pressure_items.map((item) => (
                        <div key={`${message.id}-pressure-${item.item_id}`} className={styles.evidenceRow}>
                          <span className={styles.evidencePrimary}>{item.title}</span>
                          <span className={styles.evidenceReason}>requested {item.requested} · in stock {item.in_stock} · shortage {item.shortage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}

        {sending && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageMeta}>
              <strong>Assistant</strong>
            </div>
            <div className={styles.messageBody}>Thinking through the quote…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.input}
          rows={3}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Ask about ${quote?.name || 'this quote'}…`}
        />
        <div className={styles.footer}>
          <span className={styles.note}>
            Read-only. It summarizes data and drafts content, but does not send messages or edit the quote.
          </span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !input.trim()}>
            {sending ? 'Working…' : 'Ask Assistant'}
          </button>
        </div>
      </form>
    </div>
  );
}
