import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ItemCard from './ItemCard.jsx';
import VirtualGrid from './virtualization/VirtualGrid.jsx';
import styles from './ItemGrid.module.css';

export default function ItemGrid({
  items,
  loading,
  onEdit,
  onDelete,
  onAddToQuote,
  showHidden,
  showSource,
  searchQuery,
  onClearSearch,
  multiSelectEnabled = false,
  selectedIds = [],
  onToggleSelect,
  onClearSelection,
  enableVirtualization = true,
  defaultPageSize = 60,
  preferenceKey = 'item-grid',
}) {
  const [page, setPage] = useState(1);
  const storedPageSizeRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window === 'undefined') return defaultPageSize;
    const raw = window.localStorage.getItem(`${preferenceKey}:pageSize`);
    storedPageSizeRef.current = raw;
    const parsed = parseInt(raw || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPageSize;
  });
  const [rowQty, setRowQty] = useState(() => {
    if (typeof window === 'undefined') return 5;
    const raw = window.localStorage.getItem(`${preferenceKey}:rowQty`);
    const parsed = parseInt(raw || '', 10);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 7 ? parsed : 5;
  });
  const visible = showHidden ? (items || []) : (items || []).filter(i => !i.hidden);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIdSet = useMemo(() => new Set(visible.map((item) => item.id)), [visible]);
  const rowQtyOptions = useMemo(() => {
    if (viewportWidth < 480) return [1, 2, 3];
    if (viewportWidth < 768) return [1, 2, 3, 4];
    return [3, 4, 5, 6, 7];
  }, [viewportWidth]);
  const isSingleColumnMobile = viewportWidth < 768 && rowQty === 1;
  const selectedVisibleCount = useMemo(
    () => selectedIds.filter((id) => visibleIdSet.has(id)).length,
    [selectedIds, visibleIdSet]
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [page, pageSize, visible]);
  const shouldVirtualize = enableVirtualization && visible.length > 120;
  const selectionScopeItems = shouldVirtualize ? visible : pagedItems;

  const handleItemToggleSelect = useCallback((item, options = {}) => {
    onToggleSelect?.(item, {
      ...options,
      visibleItems: selectionScopeItems,
    });
  }, [onToggleSelect, selectionScopeItems]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, showHidden, pageSize]);

  useEffect(() => {
    if (storedPageSizeRef.current != null) return;
    setPageSize(defaultPageSize);
  }, [defaultPageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const key = `${preferenceKey}:pageSize`;
    window.localStorage.setItem(key, String(pageSize));
  }, [pageSize, preferenceKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const key = `${preferenceKey}:rowQty`;
    window.localStorage.setItem(key, String(rowQty));
  }, [rowQty, preferenceKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (rowQtyOptions.includes(rowQty)) return;
    setRowQty(rowQtyOptions[rowQtyOptions.length - 1]);
  }, [rowQty, rowQtyOptions]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const gridStyle = useMemo(() => {
    return { gridTemplateColumns: `repeat(${rowQty}, minmax(0, 1fr))` };
  }, [rowQty]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarMeta}>
          <span className={styles.count}>
            {visible.length === 0
              ? '0 items'
              : `Showing ${((page - 1) * pageSize) + 1}-${Math.min(page * pageSize, visible.length)} of ${visible.length} items`}
          </span>
          {!shouldVirtualize && (
            <div className={styles.controls}>
              <label className={styles.control}>
                <span className={styles.controlLabel}>Rows</span>
                <select value={rowQty} onChange={(e) => setRowQty(parseInt(e.target.value, 10) || rowQtyOptions[0])}>
                  {rowQtyOptions.map((qty) => (
                    <option key={qty} value={qty}>{qty}</option>
                  ))}
                </select>
              </label>
              <label className={styles.control}>
                <span className={styles.controlLabel}>Per page</span>
                <select value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value, 10) || defaultPageSize)}>
                  {[24, 48, 60, 96, 120, 200].map((qty) => (
                    <option key={qty} value={qty}>{qty}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        {multiSelectEnabled && (
          <div className={styles.selectionSummary}>
            <span className={styles.count}>
              {selectedVisibleCount > 0
                ? `${selectedVisibleCount} selected`
                : 'Tap item checkmarks to select multiple items'}
            </span>
            {selectedVisibleCount > 0 && onClearSelection && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClearSelection}>
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className={`${styles.grid} ${isSingleColumnMobile ? styles.singleColumnGrid : ''}`} style={gridStyle}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={`skeleton ${styles.skeletonImg}`} />
              <div className={styles.skeletonBody}>
                <div className={`skeleton ${styles.skeletonLine}`} />
                <div className={`skeleton ${styles.skeletonLineShort}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 3l4 4-4 4M8 3L4 7l4 4"/>
          </svg>
          {searchQuery?.trim() ? (
            <>
              <p>No items match <strong>"{searchQuery}"</strong>.</p>
              {onClearSearch && <button type="button" className="btn btn-ghost btn-sm" onClick={onClearSearch}>Clear search</button>}
            </>
          ) : (
            <p>No items found</p>
          )}
        </div>
      )}

      {shouldVirtualize ? (
        <VirtualGrid
          items={visible}
          itemHeight={window.innerWidth <= 480 ? 175 : 272}
          minColumnWidth={window.innerWidth <= 480 ? 110 : 180}
          gap={window.innerWidth <= 480 ? 8 : 16}
          maxHeight="min(72vh, 1100px)"
          className={styles.virtualViewport}
          renderItem={(item) => (
            <ItemCard
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddToQuote={onAddToQuote}
              showSource={showSource}
              selectable={multiSelectEnabled}
              selected={selectedIdSet.has(item.id)}
              onToggleSelect={handleItemToggleSelect}
            />
          )}
        />
      ) : (
        <div className={`${styles.grid} ${isSingleColumnMobile ? styles.singleColumnGrid : ''}`} style={gridStyle}>
          {pagedItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddToQuote={onAddToQuote}
              showSource={showSource}
              selectable={multiSelectEnabled}
              selected={selectedIdSet.has(item.id)}
              onToggleSelect={handleItemToggleSelect}
            />
          ))}
        </div>
      )}

      {!loading && !shouldVirtualize && totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationSummary}>Page {page} of {totalPages}</span>
          <div className={styles.paginationControls}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage(1)} disabled={page === 1}>First</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last</button>
          </div>
        </div>
      )}

      {!loading && shouldVirtualize && (
        <div className={styles.paginationSummary}>Virtualized {visible.length} items</div>
      )}
    </div>
  );
}
