import React from 'react';
import ItemCard from './ItemCard.jsx';
import styles from './ItemGrid.module.css';

export default function ItemGrid({ items, loading, onEdit, onDelete, onAddToQuote, showHidden }) {
  const visible = showHidden ? (items || []) : (items || []).filter(i => !i.hidden);

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.count}>{visible.length} items</span>
      </div>

      {loading && (
        <div className="empty-state">
          <div className="spinner" />
          Loading inventory…
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 3l4 4-4 4M8 3L4 7l4 4"/>
          </svg>
          <p>No items found</p>
        </div>
      )}

      <div className={styles.grid}>
        {visible.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddToQuote={onAddToQuote}
          />
        ))}
      </div>
    </div>
  );
}
