import React from 'react';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', confirmClass = 'btn-danger' }) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        {title && <h3 className={styles.title}>{title}</h3>}
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn ${confirmClass} btn-sm`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
