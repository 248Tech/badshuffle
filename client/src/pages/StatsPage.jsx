import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import StatsBar from '../components/StatsBar.jsx';

const RANGE_OPTIONS = [
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'past_year', label: 'Past Year' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'next_30_days', label: 'Next 30 Days' },
  { value: 'next_6_months', label: 'Next 6 Months' },
  { value: 'next_year', label: 'Next Year' },
];

export default function StatsPage() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('sales_total');
  const [sortDirection, setSortDirection] = useState('desc');
  const [range, setRange] = useState('lifetime');

  useEffect(() => {
    setLoading(true);
    api.getStats({ range }).then(d => setStats(d.stats || [])).finally(() => setLoading(false));
  }, [range]);

  const sorted = [...stats].sort((a, b) => {
    const diff = Number(b?.[sortBy] || 0) - Number(a?.[sortBy] || 0);
    if (diff !== 0) return sortDirection === 'asc' ? -diff : diff;
    const titleCmp = String(a?.title || '').localeCompare(String(b?.title || ''));
    return sortDirection === 'asc' ? titleCmp : -titleCmp;
  });
  const maxQuoted = Math.max(...stats.map(s => s.times_quoted), 1);
  const maxProb = Math.max(...stats.map(s => s.probability_pct || 0), 1);
  const maxSales = Math.max(...stats.map(s => s.sales_total || 0), 1);
  const topSalesItem = [...stats].sort((a, b) => Number(b?.sales_total || 0) - Number(a?.sales_total || 0))[0] || null;

  const maxVal = sortBy === 'sales_total' ? maxSales
    : sortBy === 'times_quoted' ? maxQuoted
    : maxProb;

  const sortBtnBase = 'btn btn-ghost btn-sm';
  const sortBtnActive = 'btn btn-sm bg-primary border-primary text-white hover:bg-primary';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage Statistics</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Per-product usage and sales across quote event windows</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <span>Window:</span>
            <select
              className="px-2.5 py-1.5 border border-border rounded-md bg-bg text-text text-[13px]"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <span className="text-[13px] text-text-muted">Sort by:</span>
          {[
            { value: 'sales_total', label: 'Sales Total' },
            { value: 'times_quoted', label: 'Times in project' },
            { value: 'probability_pct', label: 'Probability %' }
          ].map(opt => (
            <button
              key={opt.value}
              className={sortBy === opt.value ? sortBtnActive : sortBtnBase}
              onClick={() => setSortBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <span>Order:</span>
            <select
              className="px-2.5 py-1.5 border border-border rounded-md bg-bg text-text text-[13px]"
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
            >
              <option value="desc">Highest First</option>
              <option value="asc">Lowest First</option>
            </select>
          </label>
        </div>
      </div>

      {loading && (
        <div className="card p-5" aria-busy="true" aria-label="Loading statistics">
          <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-border" aria-hidden="true">
            <div className="skeleton h-3 w-[180px] shrink-0" />
            <div className="skeleton h-3 flex-1" />
            <div className="skeleton h-3 w-9 shrink-0" />
          </div>
          <div aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5">
                <div className="skeleton h-3 shrink-0 w-[180px]" style={{ maxWidth: `${55 + (i % 3) * 15}%` }} />
                <div className="flex-1 h-2 bg-border rounded overflow-hidden">
                  <div className="skeleton h-full" style={{ width: `${30 + ((i * 17) % 55)}%` }} />
                </div>
                <div className="skeleton h-3 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && stats.length === 0 && (
        <div className="empty-state">
          <p>No stats yet. Add items to quotes to start tracking usage.</p>
        </div>
      )}

      {!loading && stats.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-border text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <span className="w-[180px] shrink-0">Item</span>
            <span className="flex-1">Usage</span>
            <span className="min-w-[92px] text-right shrink-0">
              {sortBy === 'sales_total' ? 'Sales'
                : sortBy === 'times_quoted' ? 'Projects'
                : '%'}
            </span>
          </div>
          <div>
            {sorted.map(s => (
              <StatsBar
                key={s.id}
                label={s.title}
                value={s[sortBy] || 0}
                max={maxVal}
                count={
                  sortBy === 'sales_total'
                    ? `$${Number(s.sales_total || 0).toFixed(2)}`
                    : sortBy === 'probability_pct'
                    ? `${s.probability_pct || 0}%`
                    : s[sortBy] || 0
                }
              />
            ))}
          </div>
        </div>
      )}

      {!loading && stats.length > 0 && (
        <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-[24px] font-bold text-primary">{stats.length}</span>
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Items tracked</span>
          </div>
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-[24px] font-bold text-primary">
              ${stats.reduce((a, s) => a + Number(s.sales_total || 0), 0).toFixed(2)}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Total product sales</span>
          </div>
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-[24px] font-bold text-primary">
              {stats.reduce((a, s) => a + (s.times_quoted || 0), 0)}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Total quote appearances</span>
          </div>
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-[24px] font-bold text-primary truncate">
              {topSalesItem?.title.slice(0, 20) || '—'}
              {(topSalesItem?.title?.length || 0) > 20 ? '…' : ''}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Top selling item</span>
          </div>
        </div>
      )}
    </div>
  );
}
