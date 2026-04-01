import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import styles from './AISuggestModal.module.css';

export default function AISuggestModal({ quoteId, guestCount, currentItems, onAdd, onClose }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.aiSuggest({
      guest_count: guestCount,
      event_type: 'event',
      current_items: currentItems.map(i => i.id)
    })
      .then(data => {
        setSuggestions(data.suggestions || []);
        setSource(data.source);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!suggestions.length) return;
    const ids = suggestions
      .map((s) => s.photo_url)
      .filter((p) => p != null && /^\d+$/.test(String(p).trim()))
      .map((p) => String(p).trim());
    if (!ids.length) return;
    api.prefetchFileServeUrls(ids).catch(() => {});
  }, [suggestions]);

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-modal-title"
      >
        <div className={styles.header}>
          <h2 id="ai-modal-title">AI Suggestions</h2>
          <span className={styles.source}>
            {source === 'ai' ? (
              <><span aria-hidden="true">✨</span> GPT-4o-mini</>
            ) : (
              <><span aria-hidden="true">📊</span> By popularity</>
            )}
          </span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close"><span aria-hidden="true">✕</span></button>
        </div>

        {loading && (
          <div className="empty-state">
            <div className="spinner" />
            Thinking…
          </div>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}

        {!loading && !error && suggestions.length === 0 && (
          <div className="empty-state">No suggestions available</div>
        )}

        <div className={styles.list}>
          {suggestions.map(s => (
            <div key={s.id} className={styles.item}>
              {s.photo_url ? (
                <img
                  src={api.proxyImageUrl(s.photo_url)}
                  alt={s.title}
                  className={styles.thumb}
                  onError={e => { e.target.src = '/placeholder.png'; }}
                />
              ) : (
                <img src="/placeholder.png" alt="" className={styles.thumb} aria-hidden="true" />
              )}
              <div className={styles.info}>
                <span className={styles.name}>{s.title}</span>
                <span className={styles.reason}>{s.reason}</span>
              </div>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => onAdd({ id: s.id, title: s.title, photo_url: s.photo_url })}
                aria-label={`Add ${s.title}`}
              >
                Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
