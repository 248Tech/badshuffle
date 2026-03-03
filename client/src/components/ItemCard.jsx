import React, { useState } from 'react';
import styles from './ItemCard.module.css';

export default function ItemCard({ item, onEdit, onDelete, onAddToQuote }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const sourceLabel = item.source || 'manual';

  return (
    <div className={`card ${styles.card} ${item.hidden ? styles.hidden : ''}`}>
      <div className={styles.imgWrapper}>
        {item.photo_url && !imgError ? (
          <img
            src={`/api/proxy-image?url=${encodeURIComponent(item.photo_url)}`}
            alt={item.title}
            className={styles.img}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.imgPlaceholder}>
            <span>📦</span>
          </div>
        )}
        <span className={`badge badge-${sourceLabel} ${styles.sourceBadge}`}>
          {sourceLabel}
        </span>
      </div>

      <div className={styles.body}>
        <h3 className={styles.title} title={item.title}>{item.title}</h3>

        <div className={styles.actions}>
          {onAddToQuote && (
            <button
              className="btn btn-accent btn-sm"
              onClick={() => onAddToQuote(item)}
              title="Add to quote"
            >
              + Quote
            </button>
          )}
          {onEdit && (
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>
              Edit
            </button>
          )}
          {onDelete && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}
              onClick={() => onDelete(item)}>
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
