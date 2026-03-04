import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import styles from './ItemCard.module.css';

export default function ItemCard({ item, onEdit, onDelete, onAddToQuote }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const sourceLabel = item.source || 'manual';
  const hasPrice = item.unit_price > 0;
  const stockInfo = item.quantity_in_stock != null && item.quantity_in_stock > 0
    ? `${item.quantity_in_stock} in stock${item.quantity_going_out > 0 ? ` / ${item.quantity_going_out} out` : ''}`
    : null;

  return (
    <div className={`card ${styles.card} ${item.hidden ? styles.hidden : ''}`}>
      <div
        className={styles.imgWrapper}
        onClick={() => navigate(`/inventory/${item.id}`)}
        style={{ cursor: 'pointer' }}
      >
        {item.photo_url && !imgError ? (
          <img
            src={api.proxyImageUrl(item.photo_url)}
            alt={item.title}
            className={styles.img}
            onError={() => setImgError(true)}
          />
        ) : (
          <img
            src="/placeholder.png"
            alt=""
            className={styles.img}
            aria-hidden
          />
        )}
        <span className={`badge badge-${sourceLabel} ${styles.sourceBadge}`}>
          {sourceLabel}
        </span>
        {item.category && (
          <span className={styles.categoryBadge}>{item.category}</span>
        )}
      </div>

      <div className={styles.body}>
        <h3
          className={styles.title}
          title={item.title}
          onClick={() => navigate(`/inventory/${item.id}`)}
          style={{ cursor: 'pointer' }}
        >
          {item.title}
        </h3>

        {item.description && (
          <p className={styles.desc}>
            {item.description.slice(0, 80)}{item.description.length > 80 ? '…' : ''}
          </p>
        )}

        <div className={styles.meta}>
          {hasPrice && <span className={styles.price}>${item.unit_price.toFixed(2)}</span>}
          {stockInfo && <span className={styles.stock}>{stockInfo}</span>}
        </div>

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
