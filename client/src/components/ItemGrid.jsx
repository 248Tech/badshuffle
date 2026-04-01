import React, { useEffect, useMemo, useState } from 'react';
import ItemCard from './ItemCard.jsx';
import VirtualGrid from './virtualization/VirtualGrid.jsx';
import styles from './ItemGrid.module.css';

export default function ItemGrid({ items, loading, onEdit, onDelete, onAddToQuote, showHidden, showSource, searchQuery, onClearSearch }) {
  const [page, setPage] = useState(1);
  const pageSize = 60;
  const visible = showHidden ? (items || []) : (items || []).filter(i => !i.hidden);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [page, visible]);
  const shouldVirtualize = visible.length > 120;

  useEffect(() => {
    setPage(1);
  }, [searchQuery, showHidden]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {visible.length === 0
            ? '0 items'
            : `Showing ${((page - 1) * pageSize) + 1}-${Math.min(page * pageSize, visible.length)} of ${visible.length} items`}
        </span>
      </div>

      {loading && (
        <div className={styles.grid}>
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
            />
          )}
        />
      ) : (
        <div className={styles.grid}>
          {pagedItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddToQuote={onAddToQuote}
              showSource={showSource}
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
