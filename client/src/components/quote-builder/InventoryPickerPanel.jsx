import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../Toast.jsx';
import styles from '../QuoteBuilder.module.css';

function ListIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
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
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100, 250, 500];

export default function InventoryPickerPanel({
  quoteId,
  items = [],
  sectionId = null,
  onItemsChange,
  onAddCustomItem,
  settings = {},
}) {
  const toast = useToast();
  const [inventory, setInventory] = useState([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [pickerView, setPickerView] = useState('tile');
  const [pickerPage, setPickerPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pickerAvailability, setPickerAvailability] = useState({});
  const [pickerQty, setPickerQty] = useState({});
  const [newlyAddedItemId, setNewlyAddedItemId] = useState(null);
  const newlyAddedTimeoutRef = useRef(null);

  const filterMode = settings.quote_inventory_filter_mode || 'popular';
  const maxCategories = Math.max(1, Math.min(15, parseInt(settings.quote_inventory_max_categories, 10) || 10));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPickerPage(1);
  }, [debouncedSearch, selectedCategory]);

  useEffect(() => {
    setSelectedCategory(null);
    setPickerPage(1);
  }, [filterMode, maxCategories]);

  useEffect(() => {
    let cancelled = false;
    if (filterMode === 'manual') {
      const manual = (settings.quote_inventory_manual_categories || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const list = manual.slice(0, maxCategories);
      setCategoryList(list);
      setSelectedCategory((prev) => (prev && list.includes(prev) ? prev : null));
      return () => {
        cancelled = true;
      };
    }

    api
      .getPopularCategories(maxCategories)
      .then((d) => {
        if (cancelled) return;
        const list = d.categories || [];
        if (list.length > 0) {
          setCategoryList(list);
          setSelectedCategory((prev) => (prev && list.includes(prev) ? prev : null));
          return;
        }
        return api.getCategories().then((all) => {
          if (cancelled) return;
          const fallback = (all.categories || []).slice(0, maxCategories);
          setCategoryList(fallback);
          setSelectedCategory((prev) => (prev && fallback.includes(prev) ? prev : null));
        });
      })
      .catch(() => {
        if (cancelled) return;
        api.getCategories().then((all) => {
          if (cancelled) return;
          const fallback = (all.categories || []).slice(0, maxCategories);
          setCategoryList(fallback);
          setSelectedCategory((prev) => (prev && fallback.includes(prev) ? prev : null));
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    filterMode,
    maxCategories,
    settings.quote_inventory_manual_categories,
    settings.quote_inventory_filter_mode,
  ]);

  useEffect(() => {
    let cancelled = false;
    const params = {
      hidden: '0',
      limit: pageSize,
      offset: (pickerPage - 1) * pageSize,
    };
    if (quoteId != null && quoteId !== '') params.exclude_quote_id = String(quoteId);
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    const cat = selectedCategory && String(selectedCategory).trim();
    if (cat) params.category = cat;

    api
      .getItems(params)
      .then((d) => {
        if (cancelled) return;
        setInventory(d.items || []);
        setInventoryTotal(d.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setInventory([]);
        setInventoryTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId, pickerPage, pageSize, debouncedSearch, selectedCategory, items?.length]);

  const totalPages = inventoryTotal > 0 ? Math.max(1, Math.ceil(inventoryTotal / pageSize)) : 1;

  const [optimisticInQuote, setOptimisticInQuote] = useState(() => new Set());
  useEffect(() => {
    if (!items?.length) return;
    const inQuote = new Set((items || []).map((i) => i.id ?? i.item_id).filter(Boolean));
    setOptimisticInQuote((prev) => {
      const next = new Set(prev);
      inQuote.forEach((id) => next.delete(id));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const addItem = async (item, qty) => {
    try {
      setOptimisticInQuote((prev) => new Set(prev).add(item.id));
      const quantity = Math.max(1, parseInt(qty, 10) || 1);
      await api.addQuoteItem(quoteId, { item_id: item.id, quantity, section_id: sectionId });
      setPickerQty((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setNewlyAddedItemId(item.id);
      if (newlyAddedTimeoutRef.current) clearTimeout(newlyAddedTimeoutRef.current);
      newlyAddedTimeoutRef.current = setTimeout(() => setNewlyAddedItemId(null), 600);
      onItemsChange();
      toast.success(`Added ${item.title}`);
    } catch (err) {
      setOptimisticInQuote((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      toast.error(err.message);
    }
  };

  useEffect(() => {
    return () => {
      if (newlyAddedTimeoutRef.current) clearTimeout(newlyAddedTimeoutRef.current);
    };
  }, []);

  const visibleInventory = inventory.filter((item) => !optimisticInQuote.has(item.id));
  const pickerItemIdsKey = visibleInventory.length
    ? visibleInventory
        .map((i) => i.id)
        .filter(Boolean)
        .sort((a, b) => a - b)
        .join(',')
    : '';

  useEffect(() => {
    if (!quoteId || !pickerItemIdsKey) {
      setPickerAvailability({});
      return;
    }
    const ids = pickerItemIdsKey
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));
    api
      .getQuoteAvailabilityItems(quoteId, ids, sectionId)
      .then((data) => setPickerAvailability(data || {}))
      .catch(() => setPickerAvailability({}));
  }, [quoteId, pickerItemIdsKey, sectionId]);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Add from Inventory</h3>

      {categoryList.length > 0 && (
        <div className={styles.categoryRowWrap}><div className={styles.categoryRow}>
          <button
            type="button"
            className={`${styles.categoryBtn} ${!selectedCategory ? styles.categoryBtnActive : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categoryList.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div></div>
      )}

      <div className={styles.pickerToolbar}>
        <input
          type="search"
          placeholder="Search inventory…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPickerPage(1);
            }}
            title="Items per page"
            aria-label="Items per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {typeof onAddCustomItem === 'function' && (
            <button
              type="button"
              className={styles.addCustomBtn}
              onClick={onAddCustomItem}
              title="Add custom item"
            >
              +
            </button>
          )}
        </div>
      </div>

      <div className={pickerView === 'tile' ? styles.pickerGrid : styles.pickerList}>
        {visibleInventory.map((item) => {
          const pickerAvail = pickerAvailability[item.id];
          const showPickerStock = pickerAvail && pickerAvail.stock != null;
          const hasConflict = pickerAvail && (pickerAvail.reserved_qty > 0 || pickerAvail.potential_qty > 0);
          const rawQty = pickerQty[item.id];
          const displayQty = rawQty === '' ? '' : rawQty ?? 1;
          const qtyForAdd =
            rawQty === '' || rawQty === undefined
              ? 1
              : Math.max(1, parseInt(String(rawQty), 10) || 1);
          const qtyInputProps = {
            type: 'number',
            min: 1,
            step: 1,
            value: displayQty,
            'aria-label': 'Quantity',
            onClick: (e) => e.stopPropagation(),
            onFocus: () => {
              const v = pickerQty[item.id];
              if (v === undefined || v === 1) {
                setPickerQty((prev) => ({ ...prev, [item.id]: '' }));
              }
            },
            onBlur: () => {
              setPickerQty((prev) => {
                const v = prev[item.id];
                if (v === '' || v === undefined) {
                  const next = { ...prev };
                  delete next[item.id];
                  return next;
                }
                return prev;
              });
            },
            onChange: (e) => {
              const val = e.target.value;
              if (val === '') {
                setPickerQty((prev) => ({ ...prev, [item.id]: '' }));
                return;
              }
              const n = parseInt(val, 10);
              if (!Number.isNaN(n)) {
                setPickerQty((prev) => ({ ...prev, [item.id]: Math.max(1, n) }));
              }
            },
            onKeyDown: (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                addItem(item, qtyForAdd);
              }
            },
          };
          return (
            <div
              key={item.id}
              className={pickerView === 'tile' ? styles.pickerTile : styles.pickerItem}
              onClick={() => addItem(item, qtyForAdd)}
            >
              {pickerView === 'tile' ? (
                <>
                  <div className={styles.tileThumbWrap}>
                    {item.photo_url ? (
                      <img
                        src={api.proxyImageUrl(item.photo_url)}
                        alt={item.title}
                        className={styles.tileThumb}
                        onError={(e) => {
                          e.target.src = '/placeholder.png';
                        }}
                      />
                    ) : (
                      <img src="/placeholder.png" alt="" className={styles.tileThumb} aria-hidden="true" />
                    )}
                    {showPickerStock && (
                      <span
                        className={hasConflict ? styles.tileStockBadgeConflict : styles.tileStockBadgeOk}
                        title={
                          hasConflict
                            ? `${pickerAvail.stock} in stock, ${pickerAvail.reserved_qty} already booked on this date`
                            : `${pickerAvail.stock} in stock`
                        }
                      >
                        {pickerAvail.stock}
                      </span>
                    )}
                    <span className={styles.tileAddHint}>+</span>
                  </div>
                  <span className={styles.tileTitle}>{item.title}</span>
                  <input {...qtyInputProps} className={styles.pickerQtyInput} />
                </>
              ) : (
                <>
                  {item.photo_url ? (
                    <img
                      src={api.proxyImageUrl(item.photo_url)}
                      alt={item.title}
                      className={styles.thumb}
                      onError={(e) => {
                        e.target.src = '/placeholder.png';
                      }}
                    />
                  ) : (
                    <img src="/placeholder.png" alt="" className={styles.thumb} aria-hidden="true" />
                  )}
                  <span className={styles.itemTitle}>{item.title}</span>
                  <input {...qtyInputProps} className={styles.pickerQtyInputList} />
                  {showPickerStock && (
                    <span className={hasConflict ? styles.pickerStockBadgeList : styles.pickerStockBadgeListOk}>
                      {hasConflict
                        ? `Only ${pickerAvail.stock} avail, ${pickerAvail.reserved_qty} booked`
                        : `${pickerAvail.stock} in stock`}
                    </span>
                  )}
                  <span className={styles.addHint}>+ Add</span>
                </>
              )}
            </div>
          );
        })}
        {visibleInventory.length === 0 && (
          <p className={styles.empty}>{debouncedSearch || selectedCategory ? 'No matches.' : 'No inventory items.'}</p>
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
              onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
              title="Previous page"
              aria-label="Previous page"
            >
              ‹
            </button>
            <div className={styles.pageNumbers}>
              {(() => {
                const pages = [];
                const show = 2;
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
                    <span key={`ellipsis-${i}`} className={styles.pageEllipsis} aria-hidden="true">
                      …
                    </span>
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
              onClick={() => setPickerPage((p) => Math.min(totalPages, p + 1))}
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
            onChange={(e) => setPickerPage(Number(e.target.value))}
            title="Jump to page"
            aria-label="Jump to page"
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                Page {p}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
