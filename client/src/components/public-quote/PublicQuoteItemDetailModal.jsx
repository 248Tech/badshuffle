import React from 'react';
import { effectivePrice } from '../../lib/quoteTotals.js';
import s from '../../pages/PublicQuotePage.module.css';

function ImgPlaceholder({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function fmt(n) {
  return '$' + (n || 0).toFixed(2);
}

export default function PublicQuoteItemDetailModal({ item, resolveImageUrl, onClose, isDark }) {
  const closeRef = React.useRef(null);
  const cardRef = React.useRef(null);

  React.useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !cardRef.current) return;
    const focusable = Array.from(cardRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter((el) => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!item) return null;
  const name = item.label || item.title;
  const unitPrice = effectivePrice(item);
  const originalUnitPrice = item.unit_price_override != null ? item.unit_price_override : (item.unit_price || 0);
  const showDiscount = unitPrice !== originalUnitPrice;
  const qty = item.quantity ?? 1;
  const lineTotal = unitPrice * qty;
  const imgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
  const description = item.description || null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={s.detailOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Item details" onKeyDown={handleKeyDown}>
        <div
          ref={cardRef}
          className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          style={{ animation: 'detailSlideIn 0.22s ease' }}
        >
          <button
            ref={closeRef}
            type="button"
            className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-black/20 dark:hover:bg-white/20 transition-colors text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >&times;</button>

          {imgUrl ? (
            <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden">
              <img src={imgUrl} alt="" className="w-full h-full object-contain p-6" onError={e => { e.target.style.display = 'none'; }} />
            </div>
          ) : (
            <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <ImgPlaceholder size={56} />
            </div>
          )}

          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 leading-tight">{name}</h2>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">{fmt(unitPrice)}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">per unit</span>
              {showDiscount && <span className="text-sm text-slate-400 dark:text-slate-500 line-through">{fmt(originalUnitPrice)}</span>}
            </div>
            {qty > 1 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {qty} × {fmt(unitPrice)} = <strong className="text-slate-700 dark:text-slate-200">{fmt(lineTotal)}</strong>
              </p>
            )}
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 mt-4 pt-4">{description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
