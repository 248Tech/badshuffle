import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './QuoteCard.module.css';

export default function QuoteCard({ quote, onDelete }) {
  const navigate = useNavigate();

  const date = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
    : null;

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.header}>
        <h3 className={styles.name}>{quote.name}</h3>
        {date && <span className={styles.date}>{date}</span>}
      </div>
      <div className={styles.meta}>
        {quote.guest_count > 0 && (
          <span className={styles.tag}>👥 {quote.guest_count} guests</span>
        )}
        <span className={styles.tag}>
          🕒 {new Date(quote.created_at).toLocaleDateString()}
        </span>
      </div>
      {quote.notes && <p className={styles.notes}>{quote.notes}</p>}
      <div className={styles.actions}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate(`/quotes/${quote.id}`)}
        >
          Open →
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--color-danger)' }}
          onClick={() => onDelete(quote)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
