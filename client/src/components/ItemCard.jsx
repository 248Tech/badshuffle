import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import styles from './ItemCard.module.css';

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const PuzzleIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
    <path d="M20.5 11H19V7a2 2 0 00-2-2h-4V3.5a2.5 2.5 0 00-5 0V5H4a2 2 0 00-2 2v3.8h1.5a2.5 2.5 0 010 5H2V20a2 2 0 002 2h3.8v-1.5a2.5 2.5 0 015 0V22H17a2 2 0 002-2v-4h1.5a2.5 2.5 0 000-5z"/>
  </svg>
);

export default function ItemCard({ item, onEdit, onDelete, onAddToQuote }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const sourceLabel = item.source || 'manual';
  const isExtension = sourceLabel === 'extension';
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
        {isExtension && (
          <span className={`badge badge-extension ${styles.sourceBadge}`} title="Imported via Chrome Extension">
            <PuzzleIcon />
          </span>
        )}
        {item.category && (
          <span className={styles.categoryBadge}>{item.category}</span>
        )}
        {/* Hover overlay with icon action tray */}
        <div className={styles.overlay} onClick={e => e.stopPropagation()}>
          <div className={styles.overlayLeft}>
            {onAddToQuote && (
              <button
                className={styles.overlayBtn}
                title="Add to project"
                onClick={() => onAddToQuote(item)}
              >
                +
              </button>
            )}
            {onEdit && (
              <button className={styles.overlayBtn} title="Edit item" onClick={() => onEdit(item)}>
                <EditIcon />
              </button>
            )}
          </div>
          {onDelete && (
            <button
              className={`${styles.overlayBtn} ${styles.overlayBtnDanger}`}
              title="Delete item"
              onClick={() => onDelete(item)}
            >
              <TrashIcon />
            </button>
          )}
        </div>
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

      </div>
    </div>
  );
}
