import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import styles from './QuoteBuilder.module.css';

const DEBOUNCE_MS = 400;

export default function QuoteBuilder({ quoteId, items, onItemsChange }) {
  const toast = useToast();
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [localQty, setLocalQty] = useState({}); // qitem_id -> input value (string for controlled input)
  const debounceRef = useRef(null);

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

  const updateQty = useCallback(async (qitemId, quantity) => {
    const n = Math.max(0, Math.floor(Number(quantity)));
    try {
      await api.updateQuoteItem(quoteId, qitemId, { quantity: n });
      onItemsChange();
      setLocalQty(prev => { const next = { ...prev }; delete next[qitemId]; return next; });
    } catch (e) {
      toast.error(e.message);
    }
  }, [quoteId, onItemsChange]);

  const handleQtyChange = (qitemId, value) => {
    const str = String(value).replace(/[^0-9]/g, '') || '0';
    setLocalQty(prev => ({ ...prev, [qitemId]: str }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const n = Math.max(0, parseInt(str, 10) || 0);
      updateQty(qitemId, n);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  const displayQty = (item) => {
    if (localQty[item.qitem_id] !== undefined) return localQty[item.qitem_id];
    return String(item.quantity ?? 1);
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
          {(items || []).map(item => {
            const qty = item.quantity ?? 1;
            const unitPrice = item.unit_price ?? 0;
            const lineTotal = unitPrice * qty;
            const isTaxable = item.taxable !== 0;
            return (
              <div key={item.qitem_id} className={styles.quoteItem}>
                {item.photo_url ? (
                  <img
                    src={api.proxyImageUrl(item.photo_url)}
                    alt={item.title}
                    className={styles.thumb}
                    onError={e => { e.target.src = '/placeholder.png'; }}
                  />
                ) : (
                  <img src="/placeholder.png" alt="" className={styles.thumb} aria-hidden />
                )}
                <span className={styles.itemTitle}>{item.label || item.title}</span>
                <span className={styles.unitPrice}>${unitPrice.toFixed(2)}</span>
                <div className={styles.qtyControl}>
                  <button type="button" onClick={() => updateQty(item.qitem_id, qty - 1)} aria-label="Decrease">−</button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={displayQty(item)}
                    onChange={e => handleQtyChange(item.qitem_id, e.target.value)}
                    className={styles.qtyInput}
                    aria-label="Quantity"
                  />
                  <button type="button" onClick={() => updateQty(item.qitem_id, qty + 1)} aria-label="Increase">+</button>
                </div>
                <span className={styles.lineTotal}>${lineTotal.toFixed(2)}</span>
                {isTaxable && <span className={styles.taxDot} title="Taxable">T</span>}
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeItem(item.qitem_id, item.title)}
                  title="Remove"
                >✕</button>
              </div>
            );
          })}
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
                  src={api.proxyImageUrl(item.photo_url)}
                  alt={item.title}
                  className={styles.thumb}
                  onError={e => { e.target.src = '/placeholder.png'; }}
                />
              ) : (
                <img src="/placeholder.png" alt="" className={styles.thumb} aria-hidden />
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
