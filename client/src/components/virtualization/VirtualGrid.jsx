import React, { useEffect, useMemo, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function VirtualGrid({
  items = [],
  renderItem,
  itemHeight = 260,
  minColumnWidth = 180,
  gap = 16,
  overscanRows = 2,
  maxHeight = '70vh',
  className = '',
  empty = null,
}) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      setWidth(node.clientWidth);
      setHeight(node.clientHeight);
    };

    updateSize();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const metrics = useMemo(() => {
    const columns = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
    const itemWidth = columns > 0 ? (width - gap * (columns - 1)) / columns : width;
    const rowCount = Math.ceil(items.length / columns);
    const visibleRows = Math.max(1, Math.ceil(height / itemHeight));
    const startRow = clamp(Math.floor(scrollTop / itemHeight) - overscanRows, 0, Math.max(0, rowCount - 1));
    const endRow = clamp(startRow + visibleRows + overscanRows * 2, 0, rowCount);
    return { columns, itemWidth, rowCount, startRow, endRow };
  }, [width, gap, minColumnWidth, items.length, height, itemHeight, overscanRows, scrollTop]);

  const visibleItems = useMemo(() => {
    const startIndex = metrics.startRow * metrics.columns;
    const endIndex = Math.min(items.length, metrics.endRow * metrics.columns);
    return items.slice(startIndex, endIndex).map((item, relativeIndex) => {
      const index = startIndex + relativeIndex;
      const row = Math.floor(index / metrics.columns);
      const column = index % metrics.columns;
      return {
        item,
        index,
        style: {
          position: 'absolute',
          top: row * itemHeight,
          left: column * (metrics.itemWidth + gap),
          width: metrics.itemWidth,
          height: itemHeight,
        },
      };
    });
  }, [items, metrics, itemHeight, gap]);

  if (items.length === 0) return empty;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: 'auto', maxHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div
        style={{
          position: 'relative',
          height: metrics.rowCount * itemHeight,
          minHeight: height || itemHeight,
        }}
      >
        {visibleItems.map(({ item, index, style }) => (
          <div key={item.id ?? item.qitem_id ?? index} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
