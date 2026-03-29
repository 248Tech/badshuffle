import React from 'react';

export default function StatsBar({ label, value, max, count }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="min-w-[100px] w-[180px] shrink text-[13px] whitespace-nowrap overflow-hidden text-ellipsis" title={label}>{label}</span>
      <div className="flex-1 h-2 bg-border rounded overflow-hidden">
        <div className="h-full rounded transition-[width] duration-300" style={{ width: `${pct}%`, background: 'var(--color-accent)' }} />
      </div>
      <span className="min-w-[36px] text-right text-[13px] font-semibold text-text-muted shrink-0">{count !== undefined ? count : value}</span>
    </div>
  );
}
