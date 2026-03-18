import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './QuoteCard.module.css';

function showRemainingBalance(quote) {
  if (quote.has_unsigned_changes) return true;
  const s = quote.status || 'draft';
  return s === 'approved' || s === 'confirmed' || s === 'closed';
}

function ConflictStopSignIcon({ className }) {
  return (
    <span className={className} role="img" title="Inventory conflict" aria-label="Inventory conflict">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#c00" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
        <line x1="12" y1="8" x2="12" y2="13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="16.5" r="1.1" fill="#fff" stroke="none" />
      </svg>
    </span>
  );
}

export default function QuoteCard({ quote, onDelete, onDuplicate, total, selectable, selected, onToggleSelect, hasConflict }) {
  const navigate = useNavigate();
  const contractTotal = total != null ? total : (quote.contract_total ?? quote.total);
  const hasTotal = contractTotal != null && contractTotal > 0;
  const remaining = quote.remaining_balance != null ? quote.remaining_balance : (hasTotal ? contractTotal - (quote.amount_paid || 0) : null);
  const overpaid = !!quote.overpaid;
  const showBalance = showRemainingBalance(quote);

  function getBorderClass() {
    if (hasConflict || quote.has_unsigned_changes) return styles.borderConflict;
    const s = quote.status || 'draft';
    if (s === 'approved' || s === 'confirmed' || s === 'closed') return styles.borderSigned;
    if (s === 'sent') return styles.borderSent;
    return styles.borderDraft;
  }

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
      className={`card ${styles.card} ${getBorderClass()} ${selectable ? styles.selectable : ''} ${selectable && selected ? styles.selected : ''}`}
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
        {hasConflict && <ConflictStopSignIcon className={styles.conflictStopSign} />}
        <h3 className={styles.name}>{quote.name}</h3>
        <span className={`${styles.statusBadge} ${styles['status_' + (quote.status || 'draft')]}`}>
          {(quote.status || 'draft').toUpperCase()}
        </span>
        {date && <span className={styles.date}>{date}</span>}
      </div>
      <div className={styles.meta}>
        {quote.guest_count > 0 && (
          <span className={styles.tag}>👥 {quote.guest_count} guests</span>
        )}
        <span className={styles.tag}>
          🕒 {new Date(quote.created_at).toLocaleDateString()}
        </span>
        {showBalance && overpaid && <span className={styles.overpaidBadge}>Overpaid</span>}
      </div>
      {hasTotal && (
        <div className={styles.totals}>
          <div className={styles.contractTotal}>Quote total: ${Number(contractTotal).toFixed(2)}</div>
          {showBalance && (
            <div className={overpaid ? styles.remainingOverpaid : styles.remainingBalance}>
              {overpaid
                ? <>Overpaid: <strong>${Math.abs(remaining).toFixed(2)}</strong> (refund due)</>
                : <>Remaining balance: <strong>${Number(remaining).toFixed(2)}</strong></>
              }
            </div>
          )}
        </div>
      )}
      <div className={styles.actions} onClick={e => e.stopPropagation()}>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleOpen}>
          Open →
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/quotes/${quote.id}`, { state: { autoEdit: true } }); }}>
          Edit
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
