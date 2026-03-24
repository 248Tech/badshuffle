import React from 'react';
import styles from './QuoteHeader.module.css';

export default function QuoteHeader({
  quote,
  duplicating,
  onBack,
  onSend,
  onViewQuote,
  onEdit,
  onCopyLink,
  onAISuggest,
  onDuplicate,
  onDelete,
  showTopRow = true,
}) {
  const status = quote.status || 'draft';
  const showUnsignedChanges = (status === 'approved' || status === 'confirmed') && quote.has_unsigned_changes;
  const rawDisplay = status === 'approved' ? 'Signed' : status;
  const displayStatus = showUnsignedChanges ? 'Unsigned Changes' : rawDisplay;
  const badgeClass = showUnsignedChanges ? styles.badge_unsigned_changes : styles['badge_' + status];
  const date = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
    : null;
  const itemCount = (quote.items || []).length;

  return (
    <header className={styles.header}>
      {showTopRow && (
        <div className={styles.topRow}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Projects
          </button>
          <div className={styles.actions + ' ' + styles.actionsTint}>
            <button type="button" className="btn btn-primary btn-sm" onClick={onSend} title="Email project link to client">
              Send to Client
            </button>
            {typeof onViewQuote === 'function' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onViewQuote} title="Open client-viewable project in new tab">
                View Project
              </button>
            )}
            {quote.public_token && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onCopyLink}>
                Copy Client Link
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={onAISuggest}>
              ✨ AI Suggest
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={duplicating}
              onClick={onDuplicate}
              title="Duplicate this project (same details and line items)"
            >
              {duplicating ? '…' : 'Duplicate'}
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${styles.btnDanger}`}
              onClick={onDelete}
              title="Delete this project"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className={styles.mainRow}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.titleButton}
            onClick={onEdit}
            title="Edit project details"
          >
            {quote.name}
          </button>
          <span
            className={`${styles.badge} ${badgeClass}`}
            aria-label={`Status: ${displayStatus}`}
          >
            {displayStatus}
          </span>
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
