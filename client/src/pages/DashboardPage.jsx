import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS = {
  draft:     '#818cf8',
  sent:      '#fbbf24',
  approved:  '#34d399',
  confirmed: '#8b5cf6',
  closed:    '#6b7280'
};

const STATUS_BADGE_STYLE = {
  draft:            { background: 'color-mix(in srgb, var(--color-discount) 12%, var(--color-bg))', color: 'var(--color-discount)' },
  sent:             { background: 'var(--color-warning-subtle)', color: 'var(--color-warning-strong)' },
  approved:         { background: 'var(--color-success-subtle)', color: 'var(--color-success-strong)' },
  confirmed:        { background: 'color-mix(in srgb, var(--color-discount) 12%, var(--color-bg))', color: 'var(--color-discount)' },
  closed:           { background: 'var(--color-surface)', color: 'var(--color-text-muted)' },
  unsigned_changes: { background: 'var(--color-danger-subtle)', color: 'var(--color-danger-strong)' },
};

function BarChart({ data, colorMap }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2.5">
          <span className="w-[74px] shrink-0 text-[12px] capitalize text-text-muted truncate">{d.label}</span>
          <div className="flex-1 bg-border rounded h-[22px] overflow-hidden">
            <div
              className="h-full rounded transition-[width] duration-[400ms]"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: (colorMap && colorMap[d.label]) || 'var(--color-primary)',
                minWidth: d.value > 0 ? 4 : 0
              }}
            />
          </div>
          <span className="min-w-[24px] text-right text-[13px] font-semibold shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [subrentals, setSubrentals] = useState([]);

  useEffect(() => {
    api.getQuotesSummary()
      .then(data => setSummary(data))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.getConflicts().then(d => setConflicts(d.conflicts || [])).catch(() => {});
    api.getSubrentals().then(d => setSubrentals(d.subrentals || [])).catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex flex-col gap-6">
      <div className="skeleton h-7 w-40" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-4 flex flex-col gap-2">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-8 w-2/5 mt-1" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-5 flex flex-col gap-3">
            <div className="skeleton h-3 w-2/5" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="skeleton h-6" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  if (!summary) return <p className="text-sm" style={{ color: 'var(--color-danger)' }}>Failed to load dashboard data.</p>;

  const { total, byStatus = {}, revenueByStatus = {}, upcoming = [], byMonth = [] } = summary;

  const statusBars = [
    { label: 'draft',     value: byStatus.draft     || 0 },
    { label: 'sent',      value: byStatus.sent      || 0 },
    { label: 'approved',  value: byStatus.approved  || 0 },
    { label: 'confirmed', value: byStatus.confirmed || 0 },
    { label: 'closed',    value: byStatus.closed    || 0 }
  ];

  const monthBars = byMonth.map(m => ({
    label: formatMonth(m.month),
    value: m.count
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const STAT_CARDS = [
    { label: 'Total Projects', value: total,                                           color: 'var(--color-primary)' },
    { label: 'Signed',         value: byStatus.approved  || 0,                         color: '#34d399' },
    { label: 'Confirmed',      value: byStatus.confirmed || 0,                         color: '#8b5cf6' },
    { label: 'Sent to Client', value: byStatus.sent      || 0,                         color: '#f59e0b' },
    { label: 'Signed Revenue', value: `$${(revenueByStatus.approved || 0).toFixed(0)}`, color: 'var(--color-accent)' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 max-[480px]:grid-cols-2">
        {STAT_CARDS.map(card => (
          <div
            key={card.label}
            className="bg-bg border border-border rounded-md p-4 flex flex-col gap-1 shadow hover:shadow-md transition-shadow"
            style={{ borderLeftWidth: 4, borderLeftColor: card.color }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{card.label}</span>
            <span className="text-[28px] font-bold leading-tight" style={{ color: card.color }}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1">
        <div className="card p-5">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted mb-4">Projects by Status</h3>
          <BarChart data={statusBars} colorMap={STATUS_COLORS} />
          <div className="mt-4 flex flex-col">
            {statusBars.map(s => (
              <div key={s.label} className="flex justify-between text-[13px] py-1.5 border-t border-border">
                <span className="font-semibold capitalize" style={{ color: STATUS_COLORS[s.label] }}>
                  {s.label === 'approved' ? 'signed' : s.label}
                </span>
                <span>${(revenueByStatus[s.label] || 0).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted mb-4">Projects Created (last 6 months)</h3>
          {byMonth.length === 0 ? (
            <p className="text-[13px] text-text-muted italic">No data yet.</p>
          ) : (
            <BarChart data={monthBars} />
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="card p-5">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted mb-4">Upcoming Events — next 90 days</h3>
        {upcoming.length === 0 ? (
          <div className="empty-state py-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>No events in the next 90 days</span>
            <span className="text-[12px]">Create a project with an event date to see it here.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {upcoming.map(q => {
              const d = new Date(q.event_date + 'T00:00:00');
              const daysOut = Math.round((d - today) / 864e5);
              const status = q.status || 'draft';
              const showUnsigned = (status === 'approved' || status === 'confirmed') && q.has_unsigned_changes;
              const rawStatus = status === 'approved' ? 'signed' : status;
              const displayStatus = showUnsigned ? 'Unsigned Changes' : rawStatus;
              const badgeStyle = STATUS_BADGE_STYLE[showUnsigned ? 'unsigned_changes' : status] || STATUS_BADGE_STYLE.draft;
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-4 px-3.5 py-2.5 rounded border border-border bg-surface cursor-pointer hover:border-primary transition-colors max-[768px]:flex-wrap max-[768px]:gap-2.5"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/quotes/${q.id}`)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/quotes/${q.id}`)}
                >
                  <div className="flex flex-col items-center min-w-[58px]">
                    <span className="text-[13px] font-bold">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="text-[11px] text-text-muted">{daysOut === 0 ? 'Today' : `${daysOut}d`}</span>
                  </div>
                  <div className="flex-1 text-[14px] font-medium min-w-0 truncate">{q.name}</div>
                  {q.guest_count > 0 && (
                    <span className="text-[12px] text-text-muted whitespace-nowrap" aria-label={`${q.guest_count} guests`}>
                      <span aria-hidden="true">👥</span> {q.guest_count}
                    </span>
                  )}
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap capitalize"
                    style={badgeStyle}
                  >
                    {displayStatus}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inventory Conflicts */}
      <div className="card p-5">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted mb-4">Inventory Conflicts</h3>
        {conflicts.length === 0 ? (
          <div className="empty-state py-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>No conflicts detected</span>
            <span className="text-[12px]">All your inventory looks good.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conflicts.map(q => (
              <div
                key={q.quote_id}
                className="flex items-start gap-4 flex-wrap px-3.5 py-2.5 rounded border border-border bg-surface cursor-pointer hover:border-danger transition-colors"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/quotes/${q.quote_id}`)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/quotes/${q.quote_id}`)}
              >
                <div className="flex flex-col gap-0.5 min-w-[140px]">
                  <span className="text-[14px] font-semibold">{q.quote_name}</span>
                  {q.event_date && (
                    <span className="text-[12px] text-text-muted">{fmtDate(q.event_date)}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 flex-1 items-center">
                  {(q.items || []).map(item => (
                    <span
                      key={item.item_id}
                      className={`text-[12px] px-2 py-0.5 rounded-full whitespace-nowrap ${item.status === 'reserved' ? 'bg-danger-subtle text-danger-strong' : 'bg-warning-subtle text-warning-strong'}`}
                      title={item.status === 'reserved' ? 'Confirmed oversold' : 'Potential oversold'}
                    >
                      <span aria-hidden="true">{item.status === 'reserved' ? '✕' : '!'}</span> {item.title} ({item.quantity_needed}/{item.stock})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subrentals */}
      <div className="card p-5">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted mb-4">Subrentals — next 90 days</h3>
        {subrentals.length === 0 ? (
          <p className="text-[13px] text-text-muted italic">No subrental items on upcoming quotes.</p>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-[2fr_1.5fr_60px_100px_2fr] max-[700px]:grid-cols-2 gap-3 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted border-b border-border">
              <span>Item</span>
              <span>Vendor</span>
              <span className="max-[700px]:hidden">Qty</span>
              <span className="max-[700px]:hidden">Event Date</span>
              <span className="max-[700px]:hidden">Project</span>
            </div>
            {subrentals.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-[2fr_1.5fr_60px_100px_2fr] max-[700px]:grid-cols-2 gap-3 px-2.5 py-2 border-b border-border text-[13px] cursor-pointer hover:bg-hover transition-colors items-center"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/quotes/${s.quote_id}`)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/quotes/${s.quote_id}`)}
              >
                <span className="font-medium">{s.title}</span>
                <span className="text-text-muted">{s.vendor_name || <em className="text-text-muted not-italic opacity-60">No vendor</em>}</span>
                <span className="font-semibold max-[700px]:hidden">{s.quantity}</span>
                <span className="text-text-muted max-[700px]:hidden">{fmtDate(s.event_date)}</span>
                <span className="text-primary max-[700px]:hidden">{s.quote_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatMonth(ym) {
  if (!ym) return ym;
  const [, m] = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m, 10) - 1] || ym;
}
