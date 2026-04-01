import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  onDismissUnsignedChanges,
  showTopRow = true,
  canModify = true,
  canSeeMessages = true,
}) {
  const navigate = useNavigate();
  const status = quote.status || 'draft';
  const showUnsignedChanges = (status === 'approved' || status === 'confirmed') && quote.has_unsigned_changes;
  const rawDisplay = status === 'approved' ? 'Signed' : status;
  const displayStatus = showUnsignedChanges ? 'Unsigned Changes' : rawDisplay;
  const badgeClass = showUnsignedChanges ? styles.badge_unsigned_changes : styles['badge_' + status];
  const date = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
    : null;
  const itemCount = (quote.items || []).length;
  const isExpired = quote.is_expired;
  const expiresAt = quote.expires_at
    ? new Date(quote.expires_at + 'T00:00:00').toLocaleDateString()
    : null;
  const daysUntilExpiry = quote.expires_at
    ? Math.ceil((new Date(quote.expires_at + 'T00:00:00') - new Date()) / 86400000)
    : null;
  const expiringSoon = !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;

  return (
    <header className={styles.header}>
      {showTopRow && (
        <div className={styles.topRow}>
          <button type="button" className={`btn btn-ghost btn-sm ${styles.backButton}`} onClick={onBack}>
            <span aria-hidden="true">←</span> Projects
          </button>
          <div className={styles.actions + ' ' + styles.actionsTint}>
            {canModify && <button type="button" className="btn btn-primary btn-sm" onClick={onSend} title="Email project link to client">
              Send to Client
            </button>}
            {typeof onViewQuote === 'function' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onViewQuote} title="Open client-viewable project in new tab">
                View Project
              </button>
            )}
            {quote.public_token && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCopyLink}>
                Copy Client Link
              </button>
            )}
            {canModify && <button type="button" className="btn btn-ghost btn-sm" onClick={onAISuggest}>
              <span aria-hidden="true">✨</span> AI Suggest
            </button>}
            {canModify && <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={duplicating}
              onClick={onDuplicate}
              title="Duplicate this project (same details and line items)"
            >
              {duplicating ? '…' : 'Duplicate'}
            </button>}
            {canModify && <button
              type="button"
              className={`btn btn-ghost btn-sm ${styles.btnDanger}`}
              onClick={onDelete}
              title="Delete this project"
            >
              Delete
            </button>}
          </div>
        </div>
      )}

      <div className={styles.mainRow}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.titleButton}
            onClick={canModify ? onEdit : undefined}
            title={canModify ? 'Edit project details' : quote.name}
            disabled={!canModify}
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
            <span aria-hidden="true">📅</span> {date}
          </span>
        )}
        {quote.guest_count > 0 && (
          <span className={styles.metaTag} aria-label={`${quote.guest_count} guests`}>
            <span aria-hidden="true">👥</span> {quote.guest_count} guests
          </span>
        )}
        {quote.event_type && (
          <span className={styles.metaTag} aria-label={`Event type: ${quote.event_type}`}>
            {quote.event_type}
          </span>
        )}
        <span className={styles.metaTag} aria-label={`${itemCount} items`}>
          {itemCount} items
        </span>
        {canSeeMessages && <button
          type="button"
          className={`${styles.metaTag} ${styles.metaTagLink}`}
          onClick={() => navigate(`/messages?quote=${quote.id}`)}
          title="View messages for this project"
          aria-label="View client messages"
        >
          <span aria-hidden="true">✉</span> Messages
        </button>}
        {expiresAt && (
          <span
            className={`${styles.metaTag} ${isExpired ? styles.metaTagExpired : expiringSoon ? styles.metaTagExpiringSoon : ''}`}
            aria-label={isExpired ? `Expired ${expiresAt}` : `Expires ${expiresAt}`}
          >
            <span aria-hidden="true">⏱</span> {isExpired ? 'Expired' : 'Expires'} {expiresAt}
          </span>
        )}
      </div>

      {quote.notes && <p className={styles.notes}>{quote.notes}</p>}

      {isExpired && (
        <div className={styles.expiredBanner} role="alert">
          <span className={styles.unsignedIcon} aria-hidden="true">🚫</span>
          <span className={styles.expiredText}>
            This project expired on {expiresAt}. The client can no longer view or approve it.
          </span>
          <div className={styles.unsignedActions}>
            {canModify && <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
              Update expiration
            </button>}
          </div>
        </div>
      )}

      {showUnsignedChanges && (
        <div className={styles.unsignedBanner} role="alert">
          <span className={styles.unsignedIcon} aria-hidden="true">⚠️</span>
          <span className={styles.unsignedText}>
            Changes were made after this project was signed. Send the updated contract to the client for re-approval.
          </span>
          <div className={styles.unsignedActions}>
            {canModify && <button type="button" className="btn btn-primary btn-sm" onClick={onSend}>
              Send for re-approval
            </button>}
            {typeof onDismissUnsignedChanges === 'function' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissUnsignedChanges}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
