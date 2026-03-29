import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const TYPE_CLASSES = {
  success: 'bg-success-subtle border-success-border text-success-strong',
  error:   'bg-danger-subtle border-danger-border text-danger-strong',
  info:    'bg-info-subtle border-info-border text-info-strong',
};

const TYPE_ICONS = {
  success: '✓ ',
  error:   '✕ ',
  info:    null,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const toast = {
    success: msg => addToast(msg, 'success'),
    error:   msg => addToast(msg, 'error'),
    info:    msg => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-xs w-full px-4 py-3 rounded border text-sm font-medium shadow-md animate-[toastIn_0.2s_ease] ${TYPE_CLASSES[t.type] || TYPE_CLASSES.info}`}
          >
            {TYPE_ICONS[t.type] && <span aria-hidden="true">{TYPE_ICONS[t.type]}</span>}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
