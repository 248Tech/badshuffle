import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';

function ConflictIcon() {
  return (
    <span role="img" title="Inventory conflict" aria-label="Inventory conflict" className="shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#c00" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
        <line x1="12" y1="8" x2="12" y2="13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <circle cx="12" cy="16.5" r="1.1" fill="#fff" stroke="none"/>
      </svg>
    </span>
  );
}

function statusDisplay(status) {
  if (status === 'approved') return 'SIGNED';
  return (status || 'draft').toUpperCase();
}

const STATUS_STYLES = {
  draft:     'bg-surface text-text-muted',
  sent:      'bg-primary-subtle text-primary',
  approved:  'bg-success-subtle text-success-strong',
  confirmed: 'bg-success-subtle text-success-strong',
  closed:    'bg-surface text-text-muted',
};

const BORDER_STYLES = {
  conflict: 'border-l-danger',
  signed:   'border-l-success',
  sent:     'border-l-primary',
  draft:    'border-l-border',
};

function QuoteCard({ quote, onDelete, onDuplicate, total, selectable, selected, onToggleSelect, hasConflict, selectOnCardClick = false }) {
  const navigate = useNavigate();
  const contractTotal = total != null ? total : (quote.contract_total ?? quote.total);
  const hasTotal = contractTotal != null && contractTotal > 0;
  const displayTotal = quote.has_unsigned_changes && quote.signed_quote_total != null ? quote.signed_quote_total : contractTotal;
  const remaining = quote.has_unsigned_changes && quote.signed_remaining_balance != null
    ? quote.signed_remaining_balance
    : (quote.remaining_balance != null ? quote.remaining_balance : (hasTotal ? contractTotal - (quote.amount_paid || 0) : null));
  const normalizedDisplayTotal = Number(displayTotal ?? 0);
  const normalizedRemaining = Number(remaining ?? 0);
  const overpaid = normalizedRemaining < 0;

  function getBorderKey() {
    if (hasConflict || quote.has_unsigned_changes) return 'conflict';
    const s = quote.status || 'draft';
    if (s === 'approved' || s === 'confirmed' || s === 'closed') return 'signed';
    if (s === 'sent') return 'sent';
    return 'draft';
  }

  const date = quote.event_date ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString() : null;
  const clientName = [quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ');
  const isExpired = quote.is_expired;
  const expiresAt = quote.expires_at ? new Date(quote.expires_at + 'T00:00:00').toLocaleDateString() : null;
  const daysUntilExpiry = quote.expires_at ? Math.ceil((new Date(quote.expires_at + 'T00:00:00') - new Date()) / 86400000) : null;
  const expiringSoon = !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;

  const statusKey = quote.status || 'draft';
  const statusClass = STATUS_STYLES[statusKey] || STATUS_STYLES.draft;
  const borderClass = BORDER_STYLES[getBorderKey()];

  const handleOpen = (e) => { e?.stopPropagation?.(); navigate(`/quotes/${quote.id}`); };
  const handleCardClick = () => {
    if (selectable && selectOnCardClick && onToggleSelect) {
      onToggleSelect(quote.id);
      return;
    }
    navigate(`/quotes/${quote.id}`);
  };

  return (
    <div
      className={`bg-bg border border-border border-l-4 ${borderClass} rounded overflow-hidden transition-shadow duration-200 hover:shadow-md relative h-full flex flex-col ${selectable ? 'cursor-pointer select-none' : ''} ${selectable && selected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleCardClick()}
    >
      <div className="flex flex-col flex-1">
        <div className="px-4 pt-3.5 pb-2">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              {(hasConflict || quote.has_unsigned_changes) && <ConflictIcon />}
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${statusClass}`}>
                {statusDisplay(quote.status)}
              </span>
            </div>
            {selectable && (
              <div className="shrink-0" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!selected}
                  onChange={() => onToggleSelect?.(quote.id)}
                  aria-label={`Select ${quote.name}`}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <h3 className="text-[14px] font-semibold text-text-base leading-snug whitespace-normal break-words [overflow-wrap:anywhere]">
              {quote.name}
            </h3>
            {date && <span className="text-[12px] text-text-muted">{date}</span>}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center content-start gap-1.5 px-4 pb-3">
          {clientName && <span className="text-[12.5px] font-medium text-text-base mr-1 break-words [overflow-wrap:anywhere]">{clientName}</span>}
          {quote.guest_count > 0 && (
            <span className="text-[11px] text-text-muted bg-surface px-1.5 py-0.5 rounded-full">
              <span aria-hidden="true">👥</span> {quote.guest_count}
            </span>
          )}
          <span className="text-[11px] text-text-muted bg-surface px-1.5 py-0.5 rounded-full">
            <span aria-hidden="true">🕒</span> {new Date(quote.created_at).toLocaleDateString()}
          </span>
          {expiresAt && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
              isExpired ? 'bg-danger-subtle text-danger-strong' : expiringSoon ? 'bg-warning-subtle text-warning-strong' : 'bg-surface text-text-muted'
            }`}>
              <span aria-hidden="true">⏱</span> {isExpired ? 'Expired' : 'Expires'} {expiresAt}
            </span>
          )}
          {overpaid && (
            <span className="text-[11px] bg-success-subtle text-success-strong px-1.5 py-0.5 rounded-full font-semibold">Overpaid</span>
          )}
        </div>

        {/* Totals */}
        <div className="px-4 py-2.5 bg-surface/60 border-t border-border text-[12.5px]">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">{quote.has_unsigned_changes && quote.signed_quote_total != null ? 'Signed total' : 'Project total'}</span>
            <span className="font-semibold text-text-base">${normalizedDisplayTotal.toFixed(2)}</span>
          </div>
          <div className={`flex items-center justify-between mt-0.5 ${overpaid ? 'text-success-strong' : 'text-text-muted'}`}>
            <span>{overpaid ? 'Overpaid' : 'Remaining balance'}</span>
            <strong>${Math.abs(normalizedRemaining).toFixed(2)}{overpaid ? ' (refund due)' : ''}</strong>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className={`grid gap-1.5 px-3 py-2.5 border-t border-border mt-auto ${onDuplicate ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="btn btn-primary btn-sm min-h-[44px] justify-center w-full" onClick={handleOpen}>Open</button>
        <button type="button" className="btn btn-ghost btn-sm min-h-[44px] justify-center w-full" onClick={e => { e.stopPropagation(); navigate(`/quotes/${quote.id}`, { state: { autoEdit: true } }); }}>Edit</button>
        {onDuplicate && (
          <button type="button" className="btn btn-ghost btn-sm min-h-[44px] justify-center w-full" onClick={e => { e.stopPropagation(); onDuplicate(quote); }}>Duplicate</button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm min-h-[44px] justify-center w-full"
          style={{ color: 'var(--color-danger)' }}
          onClick={e => { e.stopPropagation(); onDelete(quote); }}
        >Delete</button>
      </div>
    </div>
  );
}

export default memo(QuoteCard);
