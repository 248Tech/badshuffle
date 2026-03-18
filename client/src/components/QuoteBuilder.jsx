import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import ItemEditModal from './ItemEditModal.jsx';
import styles from './QuoteBuilder.module.css';

const DEBOUNCE_MS = 400;

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function TileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function EyeIcon({ hidden, className }) {
  if (hidden) {
    return (
      <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ConflictStopSignIcon({ className, title }) {
  return (
    <span className={className} role="img" title={title} aria-label="Inventory conflict">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#c00" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
        <path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="1.2" fill="none" />
      </svg>
    </span>
  );
}

function AvailableCheckIcon({ className, title }) {
  return (
    <span className={className} role="img" title={title} aria-label="Available">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a7b0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100, 250, 500];

export default function QuoteBuilder({ quoteId, items, onItemsChange, onAddCustomItem, settings = {}, availability = {}, adjustments = [], onAdjustmentsChange }) {
  const toast = useToast();
  const [inventory, setInventory] = useState([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [editingItemId, setEditingItemId] = useState(null);
  const [search, setSearch] = useState('');
  const [pickerView, setPickerView] = useState('tile');
  const [pickerPage, setPickerPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [localQty, setLocalQty] = useState({});
  const debounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Per-item price override inline editing
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  // Adjustments form
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjForm, setAdjForm] = useState({ label: '', type: 'discount', value_type: 'percent', amount: '' });
  const [adjSaving, setAdjSaving] = useState(false);
  // Picker availability (stock / already booked) for current page of items
  const [pickerAvailability, setPickerAvailability] = useState({});

  const filterMode = settings.quote_inventory_filter_mode || 'popular';
  const maxCategories = Math.max(1, Math.min(15, parseInt(settings.quote_inventory_max_categories, 10) || 10));

  // Debounce search for API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when search or category changes
  useEffect(() => {
    setPickerPage(1);
  }, [debouncedSearch, selectedCategory]);

  // When filter settings change, reset category filter and page so inventory refetches correctly
  useEffect(() => {
    setSelectedCategory(null);
    setPickerPage(1);
  }, [filterMode, maxCategories]);

  // Load category list for filter buttons (popular or manual)
  useEffect(() => {
    let cancelled = false;
    if (filterMode === 'manual') {
      const manual = (settings.quote_inventory_manual_categories || '').split(',').map(s => s.trim()).filter(Boolean);
      const list = manual.slice(0, maxCategories);
      setCategoryList(list);
      setSelectedCategory(prev => (prev && list.includes(prev) ? prev : null));
      return () => { cancelled = true; };
    }
    // Popular mode: fetch by usage; fallback to all categories if empty (e.g. no stats yet)
    api.getPopularCategories(maxCategories)
      .then(d => {
        if (cancelled) return;
        const list = d.categories || [];
        if (list.length > 0) {
          setCategoryList(list);
          setSelectedCategory(prev => (prev && list.includes(prev) ? prev : null));
          return;
        }
        return api.getCategories().then(all => {
          if (cancelled) return;
          const fallback = (all.categories || []).slice(0, maxCategories);
          setCategoryList(fallback);
          setSelectedCategory(prev => (prev && fallback.includes(prev) ? prev : null));
        });
      })
      .catch(() => {
        if (cancelled) return;
        api.getCategories().then(all => {
          if (cancelled) return;
          const fallback = (all.categories || []).slice(0, maxCategories);
          setCategoryList(fallback);
          setSelectedCategory(prev => (prev && fallback.includes(prev) ? prev : null));
        });
      });
    return () => { cancelled = true; };
  }, [filterMode, maxCategories, settings.quote_inventory_manual_categories, settings.quote_inventory_filter_mode]);

  // Fetch inventory with pagination, search, and optional category.
  // When no filter is selected (selectedCategory is null), we omit category so the API returns all items.
  // exclude_quote_id: server excludes items already on this quote so each page shows a full page of addable items.
  useEffect(() => {
    let cancelled = false;
    const params = {
      hidden: '0',
      limit: pageSize,
      offset: (pickerPage - 1) * pageSize
    };
    if (quoteId != null && quoteId !== '') params.exclude_quote_id = String(quoteId);
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    const cat = selectedCategory && String(selectedCategory).trim();
    if (cat) params.category = cat;

    api.getItems(params)
      .then(d => {
        if (cancelled) return;
        setInventory(d.items || []);
        setInventoryTotal(d.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setInventory([]);
        setInventoryTotal(0);
      });
    return () => { cancelled = true; };
  }, [quoteId, pickerPage, pageSize, debouncedSearch, selectedCategory, items?.length]);

  const totalPages = inventoryTotal > 0 ? Math.max(1, Math.ceil(inventoryTotal / pageSize)) : 1;
  const [optimisticInQuote, setOptimisticInQuote] = useState(() => new Set());

  // Clear optimistic ids once they appear in the quote (after parent refetch)
  useEffect(() => {
    if (!items?.length) return;
    const inQuote = new Set((items || []).map(i => i.id ?? i.item_id).filter(Boolean));
    setOptimisticInQuote(prev => {
      const next = new Set(prev);
      inQuote.forEach(id => next.delete(id));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const addItem = async (item) => {
    try {
      setOptimisticInQuote(prev => new Set(prev).add(item.id));
      await api.addQuoteItem(quoteId, { item_id: item.id });
      onItemsChange();
      toast.success(`Added ${item.title}`);
    } catch (e) {
      setOptimisticInQuote(prev => { const next = new Set(prev); next.delete(item.id); return next; });
      toast.error(e.message);
    }
  };

  // Server already excludes items on this quote when exclude_quote_id is sent; only hide optimistically added until parent refetches
  const visibleInventory = inventory.filter(item => !optimisticInQuote.has(item.id));
  const pickerItemIdsKey = visibleInventory.length ? visibleInventory.map(i => i.id).filter(Boolean).sort((a, b) => a - b).join(',') : '';

  // Fetch stock / already-booked for current picker page so we can show "Only X available, Y already booked" on tiles
  useEffect(() => {
    if (!quoteId || !pickerItemIdsKey) {
      setPickerAvailability({});
      return;
    }
    const ids = pickerItemIdsKey.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    api.getQuoteAvailabilityItems(quoteId, ids)
      .then(data => setPickerAvailability(data || {}))
      .catch(() => setPickerAvailability({}));
  }, [quoteId, pickerItemIdsKey]);

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

  const toggleHidden = async (item) => {
    const next = item.hidden_from_quote ? 0 : 1;
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, { hidden_from_quote: next });
      onItemsChange();
      toast.info(next ? 'Hidden from customer quote' : 'Visible on customer quote');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const displayQty = (item) => {
    if (localQty[item.qitem_id] !== undefined) return localQty[item.qitem_id];
    return String(item.quantity ?? 1);
  };

  const startPriceEdit = (item) => {
    const current = item.unit_price_override != null ? item.unit_price_override : (item.unit_price ?? 0);
    setEditingPriceId(item.qitem_id);
    setPriceInput(String(current));
  };

  const commitPriceEdit = async (item) => {
    const raw = priceInput.trim();
    const val = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && (isNaN(val) || val < 0)) {
      toast.error('Invalid price');
      return;
    }
    setEditingPriceId(null);
    const isSameAsBase = val !== null && Math.abs(val - (item.unit_price ?? 0)) < 0.001;
    const override = (val === null || isSameAsBase) ? null : val;
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, { unit_price_override: override });
      onItemsChange();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const clearPriceOverride = async (item) => {
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, { unit_price_override: null });
      onItemsChange();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleAddAdjustment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(adjForm.amount);
    if (!adjForm.label || isNaN(amt) || amt < 0) return;
    setAdjSaving(true);
    try {
      const d = await api.addAdjustment(quoteId, {
        label: adjForm.label,
        type: adjForm.type,
        value_type: adjForm.value_type,
        amount: amt,
        sort_order: adjustments.length
      });
      if (onAdjustmentsChange) onAdjustmentsChange(d.adjustments || []);
      setAdjForm({ label: '', type: 'discount', value_type: 'percent', amount: '' });
      setShowAdjForm(false);
      toast.success('Adjustment added');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdjSaving(false);
    }
  };

  const handleRemoveAdjustment = async (adjId) => {
    try {
      const d = await api.removeAdjustment(quoteId, adjId);
      if (onAdjustmentsChange) onAdjustmentsChange(d.adjustments || []);
      toast.info('Adjustment removed');
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
          {(items || []).map(item => {
            const qty = item.quantity ?? 1;
            const basePrice = item.unit_price ?? 0;
            const hasOverride = item.unit_price_override != null;
            const unitPrice = hasOverride ? item.unit_price_override : basePrice;
            const lineTotal = unitPrice * qty;
            const lineLabor = (Number(item.labor_hours) || 0) * qty;
            const itemId = item.id ?? item.item_id;
            const avail = itemId != null ? availability[itemId] : null;
            const isEditingPrice = editingPriceId === item.qitem_id;
            const isOversold = avail && (avail.status === 'reserved' || avail.status === 'potential');
            const isSubrental = !!(item.is_subrental || item.is_subrental === 1);
            return (
              <div key={item.qitem_id} className={`${styles.quoteItem} ${item.hidden_from_quote ? styles.quoteItemHidden : ''} ${isOversold ? styles.quoteItemOversold : ''}`}>
                <div className={styles.thumbWrap}>
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
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={(e) => { e.stopPropagation(); toggleHidden(item); }}
                    title={item.hidden_from_quote ? 'Show on customer quote' : 'Hide from customer quote'}
                    aria-label={item.hidden_from_quote ? 'Show on customer quote' : 'Hide from customer quote'}
                  >
                    <EyeIcon hidden={!!item.hidden_from_quote} className={styles.eyeIcon} />
                  </button>
                </div>
                <span
                  className={styles.itemTitleLink}
                  onClick={() => itemId != null && setEditingItemId(itemId)}
                  title={itemId != null ? 'Edit product in inventory' : undefined}
                  role={itemId != null ? 'button' : undefined}
                >
                  {avail && (avail.status === 'reserved' || avail.status === 'potential') && (
                    <ConflictStopSignIcon
                      className={styles.conflictIcon}
                      title={avail.status === 'reserved' ? `Confirmed oversold (${avail.my_qty} needed / ${avail.stock} in stock)` : `Potential oversold (${avail.my_qty} needed / ${avail.stock} in stock)`}
                    />
                  )}
                  {avail && avail.status === 'ok' && (
                    <AvailableCheckIcon className={styles.availableIcon} title="Item available" />
                  )}
                  {isSubrental && <span className={styles.subrentalBadge} title="Subrental item">S</span>}
                  {item.label || item.title}
                  {avail && avail.stock != null && (avail.reserved_qty > 0 || avail.status !== 'ok') && (
                    <span className={styles.stockBadge} title={`${avail.stock} in stock, ${avail.reserved_qty} already booked on this date`}>
                      Only {avail.stock} available, {avail.reserved_qty} already booked
                    </span>
                  )}
                </span>
                {isEditingPrice ? (
                  <span className={styles.priceEditWrap} onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={styles.priceInput}
                      value={priceInput}
                      onChange={e => setPriceInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitPriceEdit(item);
                        if (e.key === 'Escape') setEditingPriceId(null);
                      }}
                      autoFocus
                    />
                    <button type="button" className={styles.priceEditSave} onClick={() => commitPriceEdit(item)} title="Save">✓</button>
                    <button type="button" className={styles.priceEditCancel} onClick={() => setEditingPriceId(null)} title="Cancel">✕</button>
                  </span>
                ) : (
                  <span
                    className={`${styles.unitPrice} ${hasOverride ? styles.unitPriceOverride : ''}`}
                    onClick={e => { e.stopPropagation(); startPriceEdit(item); }}
                    title={hasOverride ? `Override: $${unitPrice.toFixed(2)} (base: $${basePrice.toFixed(2)}). Click to edit.` : `$${basePrice.toFixed(2)} — click to override for this quote`}
                    role="button"
                  >
                    ${unitPrice.toFixed(2)}
                    {hasOverride && (
                      <button
                        type="button"
                        className={styles.clearOverrideBtn}
                        onClick={e => { e.stopPropagation(); clearPriceOverride(item); }}
                        title="Reset to base price"
                      >✕</button>
                    )}
                  </span>
                )}
                <span className={styles.laborHours} title="Labor hours (this line)">{lineLabor > 0 ? `${lineLabor.toFixed(1)} hrs` : '—'}</span>
                <div className={styles.qtyControl} onClick={e => e.stopPropagation()}>
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
                {item.hidden_from_quote && <span className={styles.hiddenBadge}>Hidden from quote</span>}
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={(e) => { e.stopPropagation(); removeItem(item.qitem_id, item.title); }}
                  title="Remove"
                >✕</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Adjustments */}
      <div className={styles.section}>
        <div className={styles.adjHeader}>
          <h3 className={styles.sectionTitle}>Discounts &amp; Surcharges</h3>
          <button type="button" className={styles.adjAddBtn} onClick={() => setShowAdjForm(v => !v)}>
            {showAdjForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showAdjForm && (
          <form onSubmit={handleAddAdjustment} className={styles.adjForm}>
            <input
              required
              placeholder="Label (e.g. Loyalty discount)"
              value={adjForm.label}
              onChange={e => setAdjForm(f => ({ ...f, label: e.target.value }))}
              className={styles.adjLabelInput}
            />
            <select value={adjForm.type} onChange={e => setAdjForm(f => ({ ...f, type: e.target.value }))} className={styles.adjSelect}>
              <option value="discount">Discount</option>
              <option value="surcharge">Surcharge</option>
            </select>
            <select value={adjForm.value_type} onChange={e => setAdjForm(f => ({ ...f, value_type: e.target.value }))} className={styles.adjSelect}>
              <option value="percent">%</option>
              <option value="fixed">$</option>
            </select>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              max={adjForm.value_type === 'percent' ? 100 : undefined}
              placeholder={adjForm.value_type === 'percent' ? '10' : '50.00'}
              value={adjForm.amount}
              onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
              className={styles.adjAmountInput}
            />
            <button type="submit" className={styles.adjSaveBtn} disabled={adjSaving}>
              {adjSaving ? '…' : 'Add'}
            </button>
          </form>
        )}
        {adjustments.length > 0 ? (
          <ul className={styles.adjList}>
            {adjustments.map(adj => {
              const typeBadge = adj.type === 'discount' ? styles.adjBadgeDiscount : styles.adjBadgeSurcharge;
              return (
                <li key={adj.id} className={styles.adjItem}>
                  <span className={`${styles.adjBadge} ${typeBadge}`}>{adj.type}</span>
                  <span className={styles.adjLabel}>{adj.label}</span>
                  <span className={styles.adjValue}>
                    {adj.value_type === 'percent' ? `${adj.amount}%` : `$${Number(adj.amount).toFixed(2)}`}
                  </span>
                  <button type="button" className={styles.adjRemoveBtn} onClick={() => handleRemoveAdjustment(adj.id)} title="Remove">✕</button>
                </li>
              );
            })}
          </ul>
        ) : (
          !showAdjForm && <p className={styles.empty}>No adjustments.</p>
        )}
      </div>

      {/* Inventory picker */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Add from Inventory</h3>

        {categoryList.length > 0 && (
          <div className={styles.categoryRow}>
            <button
              type="button"
              className={`${styles.categoryBtn} ${!selectedCategory ? styles.categoryBtnActive : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {categoryList.map(cat => (
              <button
                key={cat}
                type="button"
                className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className={styles.pickerToolbar}>
          <input
            type="search"
            placeholder="Search inventory…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.pickerToolbarActions}>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${pickerView === 'list' ? styles.viewToggleActive : ''}`}
              onClick={() => setPickerView('list')}
              title="List view"
              aria-label="List view"
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${pickerView === 'tile' ? styles.viewToggleActive : ''}`}
              onClick={() => setPickerView('tile')}
              title="Tile view"
              aria-label="Tile view"
            >
              <TileIcon />
            </button>
            <select
              className={styles.pageSizeSelect}
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPickerPage(1); }}
              title="Items per page"
              aria-label="Items per page"
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {typeof onAddCustomItem === 'function' && (
              <button type="button" className={styles.addCustomBtn} onClick={onAddCustomItem} title="Add custom item">+</button>
            )}
          </div>
        </div>

        <div className={pickerView === 'tile' ? styles.pickerGrid : styles.pickerList}>
          {visibleInventory.map(item => {
            const pickerAvail = pickerAvailability[item.id];
            const showPickerStock = pickerAvail && pickerAvail.stock != null && (pickerAvail.reserved_qty > 0 || pickerAvail.potential_qty > 0);
            return (
              <div
                key={item.id}
                className={pickerView === 'tile' ? styles.pickerTile : styles.pickerItem}
                onClick={() => addItem(item)}
              >
                {pickerView === 'tile' ? (
                  <>
                    <div className={styles.tileThumbWrap}>
                      {item.photo_url ? (
                        <img
                          src={api.proxyImageUrl(item.photo_url)}
                          alt={item.title}
                          className={styles.tileThumb}
                          onError={e => { e.target.src = '/placeholder.png'; }}
                        />
                      ) : (
                        <img src="/placeholder.png" alt="" className={styles.tileThumb} aria-hidden />
                      )}
                      <span className={styles.tileAddHint}>+ Add</span>
                    </div>
                    <span className={styles.tileTitle}>{item.title}</span>
                    {showPickerStock && (
                      <span className={styles.pickerStockBadge} title={`${pickerAvail.stock} in stock, ${pickerAvail.reserved_qty} already booked on this date`}>
                        Only {pickerAvail.stock} available, {pickerAvail.reserved_qty} already booked
                      </span>
                    )}
                  </>
                ) : (
                  <>
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
                    {showPickerStock && (
                      <span className={styles.pickerStockBadgeList}>
                        Only {pickerAvail.stock} available, {pickerAvail.reserved_qty} already booked
                      </span>
                    )}
                    <span className={styles.addHint}>+ Add</span>
                  </>
                )}
              </div>
            );
          })}
          {visibleInventory.length === 0 && (
            <p className={styles.empty}>
              {debouncedSearch || selectedCategory ? 'No matches.' : 'No inventory items.'}
            </p>
          )}
        </div>

        {inventoryTotal > 0 && (
          <div className={styles.pagination}>
            <div className={styles.paginationSummary}>
              {inventoryTotal.toLocaleString()} items · page {pickerPage} of {totalPages}
            </div>
            <div className={styles.paginationControls}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={pickerPage <= 1}
                onClick={() => setPickerPage(1)}
                title="First page"
                aria-label="First page"
              >
                ‹‹
              </button>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={pickerPage <= 1}
                onClick={() => setPickerPage(p => Math.max(1, p - 1))}
                title="Previous page"
                aria-label="Previous page"
              >
                ‹
              </button>
              <div className={styles.pageNumbers}>
                {(() => {
                  const pages = [];
                  const show = 2; // pages to show on each side of current
                  let from = Math.max(1, pickerPage - show);
                  let to = Math.min(totalPages, pickerPage + show);
                  if (from > 2) {
                    pages.push(1);
                    if (from > 3) pages.push('…');
                  }
                  for (let p = from; p <= to; p++) pages.push(p);
                  if (to < totalPages - 1) {
                    if (to < totalPages - 2) pages.push('…');
                    pages.push(totalPages);
                  }
                  return pages.map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className={styles.pageEllipsis} aria-hidden>…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`${styles.pageNumBtn} ${p === pickerPage ? styles.pageNumBtnActive : ''}`}
                        onClick={() => setPickerPage(p)}
                        aria-label={`Page ${p}`}
                        aria-current={p === pickerPage ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
              </div>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={pickerPage >= totalPages}
                onClick={() => setPickerPage(p => Math.min(totalPages, p + 1))}
                title="Next page"
                aria-label="Next page"
              >
                ›
              </button>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={pickerPage >= totalPages}
                onClick={() => setPickerPage(totalPages)}
                title="Last page"
                aria-label="Last page"
              >
                ››
              </button>
            </div>
            <select
              className={styles.pageJump}
              value={pickerPage}
              onChange={e => setPickerPage(Number(e.target.value))}
              title="Jump to page"
              aria-label="Jump to page"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>Page {p}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {editingItemId != null && (
        <ItemEditModal
          itemId={editingItemId}
          onClose={() => setEditingItemId(null)}
          onSaved={() => onItemsChange()}
        />
      )}
    </div>
  );
}
