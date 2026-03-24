import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import styles from './DashboardPage.module.css';

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

function BarChart({ data, colorMap }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className={styles.barChart}>
      {data.map(d => (
        <div key={d.label} className={styles.barRow}>
          <span className={styles.barLabel}>{d.label}</span>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{
                width: `${(d.value / max) * 100}%`,
                background: (colorMap && colorMap[d.label]) || '#1a8fc1'
              }}
            />
          </div>
          <span className={styles.barValue}>{d.value}</span>
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

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (!summary) return <p className={styles.error}>Failed to load dashboard data.</p>;

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

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard</h1>

      {/* Stat cards */}
      <div className={styles.statGrid}>
        <div className={styles.statCard} style={{ borderLeftColor: '#1a8fc1' }}>
          <span className={styles.statLabel}>Total Projects</span>
          <span className={styles.statValue}>{total}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeftColor: '#34d399' }}>
          <span className={styles.statLabel}>Signed</span>
          <span className={styles.statValue} style={{ color: '#34d399' }}>{byStatus.approved || 0}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeftColor: '#8b5cf6' }}>
          <span className={styles.statLabel}>Confirmed</span>
          <span className={styles.statValue} style={{ color: '#8b5cf6' }}>{byStatus.confirmed || 0}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeftColor: '#f59e0b' }}>
          <span className={styles.statLabel}>Sent to Client</span>
          <span className={styles.statValue} style={{ color: '#f59e0b' }}>{byStatus.sent || 0}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeftColor: '#16b2a5' }}>
          <span className={styles.statLabel}>Signed Revenue</span>
          <span className={styles.statValue} style={{ color: '#16b2a5' }}>${(revenueByStatus.approved || 0).toFixed(0)}</span>
        </div>
      </div>

      <div className={styles.charts}>
        {/* Status breakdown */}
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>Projects by Status</h3>
          <BarChart data={statusBars} colorMap={STATUS_COLORS} />
          <div className={styles.revenueTable}>
            {statusBars.map(s => (
              <div key={s.label} className={styles.revenueRow}>
                <span className={styles.revenueLabel} style={{ color: STATUS_COLORS[s.label] }}>
                  {s.label === 'approved' ? 'signed' : s.label}
                </span>
                <span>${(revenueByStatus[s.label] || 0).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend */}
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>Projects Created (last 6 months)</h3>
          {byMonth.length === 0 ? (
            <p className={styles.empty}>No data yet.</p>
          ) : (
            <BarChart data={monthBars} />
          )}
        </div>
      </div>

      {/* Delivery date visualizer */}
      <div className={`card ${styles.deliveryCard}`}>
        <h3 className={styles.chartTitle}>Upcoming Events — next 90 days</h3>
        {upcoming.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>No events in the next 90 days</span>
            <span style={{ fontSize: 12 }}>Create a project with an event date to see it here.</span>
          </div>
        ) : (
          <div className={styles.eventList}>
            {upcoming.map(q => {
              const d = new Date(q.event_date + 'T00:00:00');
              const daysOut = Math.round((d - today) / 864e5);
              const status = q.status || 'draft';
              const showUnsigned = (status === 'approved' || status === 'confirmed') && q.has_unsigned_changes;
              const rawStatus = status === 'approved' ? 'signed' : status;
              const displayStatus = showUnsigned ? 'Unsigned Changes' : rawStatus;
              const statusClass = showUnsigned ? styles.status_unsigned_changes : styles['status_' + status];
              return (
                <div
                  key={q.id}
                  className={styles.eventRow}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/quotes/${q.id}`)}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/quotes/${q.id}`)}
                >
                  <div className={styles.eventDateBlock}>
                    <span className={styles.eventDay}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className={styles.eventDaysOut}>{daysOut === 0 ? 'Today' : `${daysOut}d`}</span>
                  </div>
                  <div className={styles.eventName}>{q.name}</div>
                  {q.guest_count > 0 && (
                    <span className={styles.eventGuests}>👥 {q.guest_count}</span>
                  )}
                  <span className={`${styles.eventStatus} ${statusClass}`}>
                    {displayStatus}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inventory Conflicts */}
      <div className={`card ${styles.conflictsCard}`}>
        <h3 className={styles.chartTitle}>Inventory Conflicts</h3>
        {conflicts.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>No conflicts detected</span>
            <span style={{ fontSize: 12 }}>All your inventory looks good.</span>
          </div>
        ) : (
          <div className={styles.conflictList}>
            {conflicts.map(q => (
              <div
                key={q.quote_id}
                className={styles.conflictRow}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/quotes/${q.quote_id}`)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/quotes/${q.quote_id}`)}
              >
                <div className={styles.conflictQuoteInfo}>
                  <span className={styles.conflictQuoteName}>{q.quote_name}</span>
                  {q.event_date && (
                    <span className={styles.conflictDate}>{fmtDate(q.event_date)}</span>
                  )}
                </div>
                <div className={styles.conflictItems}>
                  {(q.items || []).map(item => (
                    <span
                      key={item.item_id}
                      className={item.status === 'reserved' ? styles.conflictBadgeRed : styles.conflictBadgeYellow}
                      title={item.status === 'reserved' ? 'Confirmed oversold' : 'Potential oversold'}
                    >
                      {item.status === 'reserved' ? '✕' : '!'} {item.title} ({item.quantity_needed}/{item.stock})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subrentals */}
      <div className={`card ${styles.subrentalsCard}`}>
        <h3 className={styles.chartTitle}>Subrentals — next 90 days</h3>
        {subrentals.length === 0 ? (
          <p className={styles.empty}>No subrental items on upcoming quotes.</p>
        ) : (
          <div className={styles.subrentalList}>
            <div className={styles.subrentalHeader}>
              <span>Item</span>
              <span>Vendor</span>
              <span>Qty</span>
              <span>Event Date</span>
              <span>Project</span>
            </div>
            {subrentals.map((s, i) => (
              <div
                key={i}
                className={styles.subrentalRow}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/quotes/${s.quote_id}`)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/quotes/${s.quote_id}`)}
              >
                <span className={styles.subrentalItem}>{s.title}</span>
                <span className={styles.subrentalVendor}>{s.vendor_name || <em className={styles.noVendor}>No vendor</em>}</span>
                <span className={styles.subrentalQty}>{s.quantity}</span>
                <span className={styles.subrentalDate}>{fmtDate(s.event_date)}</span>
                <span className={styles.subrentalQuote}>{s.quote_name}</span>
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
