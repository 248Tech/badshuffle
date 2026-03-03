import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import styles from './QuoteBuilder.module.css';

export default function QuoteBuilder({ quoteId, items, onItemsChange }) {
  const toast = useToast();
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    api.getItems({ hidden: '0' }).then(d => setInventory(d.items || []));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    const existing = new Set((items || []).map(i => i.id));
    setFiltered(
      inventory
        .filter(i => !existing.has(i.id))
        .filter(i => !q || i.title.toLowerCase().includes(q))
        .slice(0, 20)
    );
  }, [search, inventory, items]);

  const addItem = async (item) => {
    try {
      await api.addQuoteItem(quoteId, { item_id: item.id });
      onItemsChange();
      toast.success(`Added ${item.title}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeItem = async (qitemId, title) => {
    try {
      await api.removeQuoteItem(quoteId, qitemId);
      onItemsChange();
      toast.info(`Removed ${title}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateQty = async (qitemId, quantity) => {
    if (quantity < 1) return;
    try {
      await api.updateQuoteItem(quoteId, qitemId, { quantity });
      onItemsChange();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className={styles.builder}>
      {/* Current items */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Quote Items ({items?.length || 0})</h3>
        {(!items || items.length === 0) && (
          <p className={styles.empty}>No items yet. Add from inventory below.</p>
        )}
        <div className={styles.quoteList}>
          {(items || []).map(item => (
            <div key={item.qitem_id} className={styles.quoteItem}>
              {item.photo_url ? (
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(item.photo_url)}`}
                  alt={item.title}
                  className={styles.thumb}
                  onError={e => { e.target.style.display='none'; }}
                />
              ) : (
                <div className={styles.thumbPlaceholder}>📦</div>
              )}
              <span className={styles.itemTitle}>{item.title}</span>
              <div className={styles.qtyControl}>
                <button onClick={() => updateQty(item.qitem_id, item.quantity - 1)}>−</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQty(item.qitem_id, item.quantity + 1)}>+</button>
              </div>
              <button
                className={styles.removeBtn}
                onClick={() => removeItem(item.qitem_id, item.title)}
                title="Remove"
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Inventory picker */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Add from Inventory</h3>
        <input
          type="search"
          placeholder="Search inventory…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.pickerList}>
          {filtered.map(item => (
            <div key={item.id} className={styles.pickerItem} onClick={() => addItem(item)}>
              {item.photo_url ? (
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(item.photo_url)}`}
                  alt={item.title}
                  className={styles.thumb}
                  onError={e => { e.target.style.display='none'; }}
                />
              ) : (
                <div className={styles.thumbPlaceholder}>📦</div>
              )}
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.addHint}>+ Add</span>
            </div>
          ))}
          {filtered.length === 0 && search && (
            <p className={styles.empty}>No matches. All results may already be in the quote.</p>
          )}
        </div>
      </div>
    </div>
  );
}
