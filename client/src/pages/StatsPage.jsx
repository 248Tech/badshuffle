import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import StatsBar from '../components/StatsBar.jsx';

export default function StatsPage() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('times_quoted');

  useEffect(() => {
    api.getStats().then(d => setStats(d.stats || [])).finally(() => setLoading(false));
  }, []);

  const sorted = [...stats].sort((a, b) => b[sortBy] - a[sortBy]);
  const maxQuoted = Math.max(...stats.map(s => s.times_quoted), 1);
  const maxGuests = Math.max(...stats.map(s => s.total_guests), 1);
  const maxProb = Math.max(...stats.map(s => s.probability_pct || 0), 1);

  const maxVal = sortBy === 'times_quoted' ? maxQuoted
    : sortBy === 'total_guests' ? maxGuests
    : maxProb;

  const sortBtnBase = 'btn btn-ghost btn-sm';
  const sortBtnActive = 'btn btn-sm bg-primary border-primary text-white hover:bg-primary';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage Statistics</h1>
          <p className="text-[13px] text-text-muted mt-0.5">How often each item appears in quotes</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] text-text-muted">Sort by:</span>
          {[
            { value: 'times_quoted', label: 'Times in project' },
            { value: 'total_guests', label: 'Total guests' },
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
                <div className="skeleton h-3 w-9 shrink-0" />
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
            <span className="min-w-[36px] text-right shrink-0">
              {sortBy === 'times_quoted' ? 'Projects' : sortBy === 'total_guests' ? 'Guests' : '%'}
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
                  sortBy === 'probability_pct'
                    ? `${s.probability_pct || 0}%`
                    : s[sortBy] || 0
                }
              />
            ))}
          </div>
        </div>
      )}

      {!loading && stats.length > 0 && (
        <div className="grid grid-cols-3 gap-4 max-[600px]:grid-cols-1">
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-[24px] font-bold text-primary">{stats.length}</span>
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Items tracked</span>
          </div>
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-[24px] font-bold text-primary">
              {stats.reduce((a, s) => a + (s.times_quoted || 0), 0)}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Total quote appearances</span>
          </div>
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-[24px] font-bold text-primary truncate">
              {sorted[0]?.title.slice(0, 20) || '—'}
              {(sorted[0]?.title?.length || 0) > 20 ? '…' : ''}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Most popular item</span>
          </div>
        </div>
      )}
    </div>
  );
}
