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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>AI Suggestions</h2>
          <span className={styles.source}>{source === 'ai' ? '✨ GPT-4o-mini' : '📊 By popularity'}</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {loading && (
          <div className="empty-state">
            <div className="spinner" />
            Thinking…
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

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
                <img src="/placeholder.png" alt="" className={styles.thumb} aria-hidden />
              )}
              <div className={styles.info}>
                <span className={styles.name}>{s.title}</span>
                <span className={styles.reason}>{s.reason}</span>
              </div>
              <button
                className="btn btn-accent btn-sm"
                onClick={() => onAdd({ id: s.id, title: s.title, photo_url: s.photo_url })}
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
