import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './QuoteCard.module.css';

export default function QuoteCard({ quote, onDelete, onDuplicate, total, selectable, selected, onToggleSelect }) {
  const navigate = useNavigate();

  const date = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
    : null;

  const handleOpen = (e) => {
    e?.stopPropagation?.();
    navigate(`/quotes/${quote.id}`);
  };

  const handleCardClick = () => {
    if (selectable && onToggleSelect) onToggleSelect(quote.id);
  };

  return (
    <div
      className={`card ${styles.card} ${selectable ? styles.selectable : ''} ${selectable && selected ? styles.selected : ''}`}
      onClick={selectable ? handleCardClick : undefined}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? (e) => e.key === 'Enter' && handleCardClick() : undefined}
    >
      {selectable && (
        <div className={styles.checkboxWrap} onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(quote.id)}
            aria-label={`Select ${quote.name}`}
          />
        </div>
      )}
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
      {total != null && total > 0 && (
        <div className={styles.total}>Contract total: ${Number(total).toFixed(2)}</div>
      )}
      {quote.notes && <p className={styles.notes}>{quote.notes}</p>}
      <div className={styles.actions} onClick={e => e.stopPropagation()}>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleOpen}>
          Open →
        </button>
        {onDuplicate && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDuplicate(quote); }}>
            Duplicate
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--color-danger)' }}
          onClick={(e) => { e.stopPropagation(); onDelete(quote); }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
