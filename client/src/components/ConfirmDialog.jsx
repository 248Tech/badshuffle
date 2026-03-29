import React from 'react';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', confirmClass = 'btn-danger' }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onCancel}
      onKeyDown={e => e.key === 'Escape' && onCancel()}
    >
      <div
        className="bg-bg border border-border rounded-md p-6 max-w-sm w-full shadow-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || message}
      >
        {title && <h3 className="text-[15px] font-semibold text-text-base mb-2 leading-snug">{title}</h3>}
        <p className="text-[13.5px] text-text-muted leading-relaxed mb-5">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className={`btn ${confirmClass} btn-sm`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
