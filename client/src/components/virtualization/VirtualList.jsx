import React, { useEffect, useMemo, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function VirtualList({
  items = [],
  renderItem,
  rowHeight = 52,
  overscan = 4,
  maxHeight = '70vh',
  className = '',
  empty = null,
}) {
  const containerRef = useRef(null);
  const [height, setHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateSize = () => setHeight(node.clientHeight);
    updateSize();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const { startIndex, endIndex } = useMemo(() => {
    const visibleRows = Math.max(1, Math.ceil(height / rowHeight));
    const start = clamp(Math.floor(scrollTop / rowHeight) - overscan, 0, Math.max(0, items.length - 1));
    const end = clamp(start + visibleRows + overscan * 2, 0, items.length);
    return { startIndex: start, endIndex: end };
  }, [height, rowHeight, scrollTop, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, offset) => {
      const index = startIndex + offset;
      return {
        item,
        index,
        style: {
          position: 'absolute',
          top: index * rowHeight,
          left: 0,
          right: 0,
          height: rowHeight,
        },
      };
    });
  }, [items, startIndex, endIndex, rowHeight]);

  if (items.length === 0) return empty;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: 'auto', maxHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ position: 'relative', height: items.length * rowHeight, minHeight: height || rowHeight }}>
        {visibleItems.map(({ item, index, style }) => (
          <div key={item.id ?? index} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
