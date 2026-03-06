import React from 'react';
import styles from './QuoteHeader.module.css';

export default function QuoteHeader({
  quote,
  duplicating,
  onBack,
  onSend,
  onEdit,
  onCopyLink,
  onAISuggest,
  onDuplicate,
  onDelete,
}) {
  const status = quote.status || 'draft';
  const date = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
    : null;
  const itemCount = (quote.items || []).length;

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Quotes
        </button>
      </div>

      <div className={styles.mainRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{quote.name}</h1>
          <span
            className={`${styles.badge} ${styles['badge_' + status]}`}
            aria-label={`Status: ${status}`}
          >
            {status}
          </span>
        </div>
        <div className={styles.actions}>
          {status === 'draft' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onSend}>
              Send to Client
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
            Edit
          </button>
          {quote.public_token && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCopyLink}>
              Copy Client Link
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onAISuggest}>
            ✨ AI Suggest
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={duplicating}
            onClick={onDuplicate}
            title="Duplicate this quote (same details and line items)"
          >
            {duplicating ? '…' : 'Duplicate'}
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${styles.btnDanger}`}
            onClick={onDelete}
            title="Delete this quote"
          >
            Delete
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        {date && (
          <span className={styles.metaTag} aria-label={`Event date: ${date}`}>
            📅 {date}
          </span>
        )}
        {quote.guest_count > 0 && (
          <span className={styles.metaTag} aria-label={`${quote.guest_count} guests`}>
            👥 {quote.guest_count} guests
          </span>
        )}
        <span className={styles.metaTag} aria-label={`${itemCount} items`}>
          {itemCount} items
        </span>
      </div>

      {quote.notes && <p className={styles.notes}>{quote.notes}</p>}
    </header>
  );
}
