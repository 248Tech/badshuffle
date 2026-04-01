import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api } from '../api';

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  draft:     '#94a3b8',
  sent:      '#3b82f6',
  approved:  '#f59e0b',
  confirmed: '#22c55e',
  closed:    '#64748b',
};
const STATUS_LABEL = {
  draft: 'Draft', sent: 'Sent', approved: 'Approved', confirmed: 'Confirmed', closed: 'Closed',
};
const STATUS_ORDER = ['draft', 'sent', 'approved', 'confirmed', 'closed'];
const CONFLICT_BANNER_DISMISS_KEY = 'dashboard_conflict_banner_dismissal';

// ─── formatters ──────────────────────────────────────────────────────────────

function fmtCurrency(n) {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('default', { month: 'short' });
}

function fmtEventDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function normalizeConflictsResponse(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.conflicts)) return value.conflicts;
  return [];
}

function mergeConflictItems(items = []) {
  const byKey = new Map();
  items.forEach((item) => {
    const key = `${item.item_id}:${item.status || 'reserved'}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity_needed += Number(item.quantity_needed || 0);
      existing.reserved_qty = Math.max(existing.reserved_qty, Number(item.reserved_qty || 0));
      existing.potential_qty = Math.max(existing.potential_qty, Number(item.potential_qty || 0));
      existing.shortage += Number(item.shortage || 0);
    } else {
      byKey.set(key, {
        ...item,
        quantity_needed: Number(item.quantity_needed || 0),
        stock: Number(item.stock || 0),
        reserved_qty: Number(item.reserved_qty || 0),
        potential_qty: Number(item.potential_qty || 0),
        shortage: Number(item.shortage || 0),
      });
    }
  });
  return Array.from(byKey.values());
}

function mergeConflictsByQuote(conflicts = []) {
  const byQuote = new Map();
  conflicts.forEach((quote) => {
    const quoteId = Number(quote?.quote_id);
    if (!quoteId) return;
    const existing = byQuote.get(quoteId);
    if (existing) {
      existing.items = mergeConflictItems([...(existing.items || []), ...(quote.items || [])]);
      if (!existing.event_date && quote.event_date) existing.event_date = quote.event_date;
    } else {
      byQuote.set(quoteId, {
        ...quote,
        items: mergeConflictItems(quote.items || []),
      });
    }
  });
  return Array.from(byQuote.values());
}

function buildConflictFingerprint(conflicts = []) {
  return JSON.stringify(
    conflicts.map((quote) => ({
      quote_id: Number(quote.quote_id),
      items: (quote.items || [])
        .map((item) => ({
          item_id: Number(item.item_id),
          status: item.status || 'reserved',
          quantity_needed: Number(item.quantity_needed || 0),
          reserved_qty: Number(item.reserved_qty || 0),
          potential_qty: Number(item.potential_qty || 0),
          shortage: Number(item.shortage || 0),
          stock: Number(item.stock || 0),
        }))
        .sort((a, b) => a.item_id - b.item_id || a.status.localeCompare(b.status)),
    }))
      .sort((a, b) => a.quote_id - b.quote_id)
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="bg-bg border border-border rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</span>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: accent + '18', color: accent }}>
          {icon}
        </span>
      </div>
      <div className="text-[26px] font-bold tracking-tight leading-none" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[11px] text-text-muted truncate">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div className="bg-bg border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-[13px] font-semibold text-text-base">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#94a3b8';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: color + '1a', color }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// ─── custom tooltip for bar chart ────────────────────────────────────────────

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg border border-border rounded-lg px-3 py-2 shadow-lg text-[12px]">
      <div className="font-semibold text-text-base mb-1">{label}</div>
      <div className="text-text-muted">{payload[0].value} quote{payload[0].value !== 1 ? 's' : ''}</div>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-bg border border-border rounded-lg px-3 py-2 shadow-lg text-[12px]">
      <span className="font-semibold text-text-base">{STATUS_LABEL[name] || name}: </span>
      <span className="text-text-muted">{value}</span>
    </div>
  );
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [unread, setUnread] = useState(0);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hideConflictBanner, setHideConflictBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getQuotesSummary(),
      api.getUnreadCount().catch(() => ({ count: 0 })),
      api.getConflicts().catch(() => ({ conflicts: [] })),
    ]).then(([s, u, c]) => {
      if (cancelled) return;
      setSummary(s);
      setUnread(u.count || 0);
      setConflicts(normalizeConflictsResponse(c));
      setLoading(false);
    }).catch(e => {
      if (!cancelled) { setError(e.message); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  // derived data
  const pieData = useMemo(() => {
    if (!summary) return [];
    return STATUS_ORDER
      .map(s => ({ name: s, value: summary.byStatus[s] || 0 }))
      .filter(d => d.value > 0);
  }, [summary]);

  const barData = useMemo(() => {
    if (!summary?.byMonth) return [];
    return summary.byMonth.map(m => ({ month: fmtMonth(m.month), count: m.count }));
  }, [summary]);

  const pipelineRevenue = useMemo(() => {
    if (!summary?.revenueByStatus) return 0;
    return (summary.revenueByStatus.sent || 0)
      + (summary.revenueByStatus.approved || 0)
      + (summary.revenueByStatus.confirmed || 0);
  }, [summary]);

  const confirmedRevenue = useMemo(() => {
    if (!summary?.revenueByStatus) return 0;
    return (summary.revenueByStatus.confirmed || 0) + (summary.revenueByStatus.closed || 0);
  }, [summary]);

  const openCount = useMemo(() => {
    if (!summary?.byStatus) return 0;
    return (summary.byStatus.draft || 0) + (summary.byStatus.sent || 0) + (summary.byStatus.approved || 0);
  }, [summary]);

  const revenueRows = useMemo(() => {
    if (!summary?.revenueByStatus) return [];
    const maxRev = Math.max(...STATUS_ORDER.map(s => summary.revenueByStatus[s] || 0), 1);
    return STATUS_ORDER
      .map(s => ({ status: s, revenue: summary.revenueByStatus[s] || 0, pct: (summary.revenueByStatus[s] || 0) / maxRev * 100 }))
      .filter(r => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [summary]);

  const quoteConflicts = useMemo(() => mergeConflictsByQuote(conflicts), [conflicts]);
  const visibleConflicts = useMemo(() => quoteConflicts.slice(0, 6), [quoteConflicts]);
  const hiddenConflictCount = Math.max(0, quoteConflicts.length - visibleConflicts.length);
  const totalActiveConflicts = useMemo(
    () => quoteConflicts.reduce((count, quote) => count + (quote.items || []).length, 0),
    [quoteConflicts]
  );
  const conflictFingerprint = useMemo(() => buildConflictFingerprint(quoteConflicts), [quoteConflicts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (totalActiveConflicts === 0) {
      setHideConflictBanner(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(CONFLICT_BANNER_DISMISS_KEY);
      if (!raw) {
        setHideConflictBanner(false);
        return;
      }
      const parsed = JSON.parse(raw);
      const until = Number(parsed?.until || 0);
      const fingerprint = String(parsed?.fingerprint || '');
      const active = until > Date.now() && fingerprint === conflictFingerprint;
      setHideConflictBanner(active);
      if (!active) window.localStorage.removeItem(CONFLICT_BANNER_DISMISS_KEY);
    } catch {
      setHideConflictBanner(false);
    }
  }, [conflictFingerprint, totalActiveConflicts]);

  function dismissConflictBanner() {
    const payload = {
      fingerprint: conflictFingerprint,
      until: Date.now() + (24 * 60 * 60 * 1000),
    };
    try {
      window.localStorage.setItem(CONFLICT_BANNER_DISMISS_KEY, JSON.stringify(payload));
    } catch {
      /* ignore storage failures */
    }
    setHideConflictBanner(true);
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="card p-5 text-center">
      <p className="text-danger text-[14px] font-medium">Failed to load dashboard</p>
      <p className="text-text-muted text-[12px] mt-1">{error}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 min-w-0">

      {/* ── page header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Dashboard</h1>
          <p className="text-[12px] text-text-muted mt-0.5">{todayLabel()}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/quotes/new')}>
          + New Quote
        </button>
      </div>

      {/* ── conflicts banner (if any) ────────────────────────────── */}
      {totalActiveConflicts > 0 && !hideConflictBanner && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[#fca5a5] bg-[#fef2f2]">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#ef4444]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#b91c1c]">
              {totalActiveConflicts} inventory conflict{totalActiveConflicts !== 1 ? 's' : ''} detected
            </p>
            <div className="flex flex-col gap-0.5 mt-1">
              {visibleConflicts.slice(0, 3).map(q => (
                <button
                  key={q.quote_id}
                  type="button"
                  className="text-left text-[12px] text-[#dc2626] hover:underline bg-transparent border-none p-0 cursor-pointer"
                  onClick={() => navigate(`/quotes/${q.quote_id}`)}
                >
                  {q.quote_name}{q.event_date ? ` · ${fmtEventDate(q.event_date)}` : ''} — {(q.items || []).map(i => i.title).join(', ')}
                </button>
              ))}
              {hiddenConflictCount > 0 && (
                <span className="text-[11px] text-[#ef4444]">And {hiddenConflictCount} more...</span>
              )}
            </div>
            <button
              type="button"
              className="mt-2 text-[11px] font-medium text-[#b91c1c] underline underline-offset-2 bg-transparent border-none p-0 cursor-pointer"
              onClick={dismissConflictBanner}
            >
              Don&apos;t show me this message again today. Hide for 24 hours.
            </button>
          </div>
          <button
            type="button"
            className="shrink-0 bg-transparent border-none text-[#b91c1c] cursor-pointer p-0 text-[18px] leading-none"
            onClick={dismissConflictBanner}
            aria-label="Dismiss inventory conflicts message for 24 hours"
            title="Dismiss for 24 hours"
          >
            ×
          </button>
        </div>
      )}

      {/* ── stat cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Quotes"
          value={summary?.total ?? 0}
          sub={`${openCount} active`}
          accent="#3b82f6"
          icon={<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>}
        />
        <StatCard
          label="Pipeline Revenue"
          value={fmtCurrency(pipelineRevenue)}
          sub="Sent + approved + confirmed"
          accent="#22c55e"
          icon={<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/></svg>}
        />
        <StatCard
          label="Confirmed"
          value={summary?.byStatus?.confirmed ?? 0}
          sub={`${fmtCurrency(confirmedRevenue)} booked`}
          accent="#f59e0b"
          icon={<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>}
        />
        <StatCard
          label="Unread Messages"
          value={unread}
          sub={unread > 0 ? 'Needs attention' : 'All caught up'}
          accent={unread > 0 ? '#ef4444' : '#94a3b8'}
          icon={<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/></svg>}
        />
      </div>

      {/* ── charts row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* pipeline status donut */}
        <SectionCard title="Pipeline Status">
          <div className="p-4">
            {pieData.length === 0 ? (
              <p className="text-[13px] text-text-muted text-center py-8">No quotes yet</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="shrink-0" style={{ width: 140, height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={44}
                        outerRadius={64}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        strokeWidth={0}
                      >
                        {pieData.map(entry => (
                          <Cell key={entry.name} fill={STATUS_COLOR[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <ReTooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {pieData.map(entry => (
                    <button
                      key={entry.name}
                      type="button"
                      className="flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer group"
                      onClick={() => navigate(`/quotes?status=${entry.name}`)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[entry.name] }} />
                      <span className="text-[12px] text-text-muted group-hover:text-text-base transition-colors">{STATUS_LABEL[entry.name]}</span>
                      <span className="text-[12px] font-semibold text-text-base ml-auto">{entry.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* monthly quote volume */}
        <SectionCard title="Quotes by Month">
          <div className="p-4">
            {barData.length === 0 ? (
              <p className="text-[13px] text-text-muted text-center py-8">No data yet</p>
            ) : (
              <div style={{ height: 148 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <ReTooltip content={<BarTooltip />} cursor={{ fill: 'var(--color-surface)' }} />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </SectionCard>

      </div>

      {/* ── revenue by status ───────────────────────────────────── */}
      {revenueRows.length > 0 && (
        <SectionCard title="Revenue by Status">
          <div className="flex flex-col divide-y divide-border">
            {revenueRows.map(r => (
              <button
                key={r.status}
                type="button"
                className="flex items-center gap-3 px-4 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-surface transition-colors group"
                onClick={() => navigate(`/quotes?status=${r.status}`)}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[r.status] }} />
                <span className="text-[12px] text-text-muted w-20 shrink-0">{STATUS_LABEL[r.status]}</span>
                <div className="flex-1 min-w-0 h-2 rounded-full overflow-hidden bg-surface">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${r.pct}%`, background: STATUS_COLOR[r.status] + 'cc' }}
                  />
                </div>
                <span className="text-[13px] font-semibold text-text-base w-16 text-right shrink-0 group-hover:text-primary transition-colors">
                  {fmtCurrency(r.revenue)}
                </span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── bottom row: upcoming + recent ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* upcoming events */}
        <SectionCard
          title="Upcoming Events"
          action={
            <button type="button" className="text-[11px] text-primary hover:underline bg-transparent border-none cursor-pointer p-0" onClick={() => navigate('/quotes')}>
              View all
            </button>
          }
        >
          {(summary?.upcoming?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-text-muted text-center py-8">No events in the next 90 days</p>
          ) : (
            <ul className="divide-y divide-border">
              {(summary.upcoming || []).slice(0, 8).map(q => (
                <li key={q.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-surface transition-colors"
                    onClick={() => navigate(`/quotes/${q.id}`)}
                  >
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg shrink-0"
                      style={{ background: (STATUS_COLOR[q.status] || '#94a3b8') + '18' }}>
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: STATUS_COLOR[q.status] || '#94a3b8' }}>
                        {fmtEventDate(q.event_date).split(' ')[0]}
                      </span>
                      <span className="text-[15px] font-bold leading-none" style={{ color: STATUS_COLOR[q.status] || '#94a3b8' }}>
                        {fmtEventDate(q.event_date).split(' ')[1]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-base truncate">{q.name}</p>
                      {q.guest_count > 0 && (
                        <p className="text-[11px] text-text-muted">{q.guest_count} guests</p>
                      )}
                    </div>
                    <StatusBadge status={q.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* recent activity / conflicts detail */}
        <SectionCard
          title={totalActiveConflicts > 0 ? `Conflicts (${totalActiveConflicts})` : 'Inventory Conflicts'}
          action={
            totalActiveConflicts > 0
              ? <span className="text-[11px] text-danger font-semibold">Needs review</span>
              : null
          }
        >
          {totalActiveConflicts === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <svg className="w-8 h-8 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p className="text-[13px] text-text-muted">No conflicts detected</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visibleConflicts.map(q => (
                <li key={q.quote_id}>
                  <button
                    type="button"
                    className="w-full flex flex-col gap-1.5 px-4 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-surface transition-colors"
                    onClick={() => navigate(`/quotes/${q.quote_id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-text-base truncate">{q.quote_name}</span>
                      {q.event_date && <span className="text-[11px] text-text-muted shrink-0">{fmtEventDate(q.event_date)}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(q.items || []).map(item => (
                        <span
                          key={item.item_id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: item.status === 'reserved' ? '#fef2f2' : '#fffbeb',
                            color: item.status === 'reserved' ? '#dc2626' : '#d97706',
                          }}
                        >
                          {item.title} ({item.quantity_needed}/{item.stock})
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
              {hiddenConflictCount > 0 && (
                <li className="px-4 py-3 text-[12px] text-text-muted">
                  And {hiddenConflictCount} more...
                </li>
              )}
            </ul>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
