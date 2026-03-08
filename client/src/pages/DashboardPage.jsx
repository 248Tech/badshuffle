import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import styles from './DashboardPage.module.css';

const STATUS_COLORS = {
  draft: '#818cf8',
  sent: '#fbbf24',
  approved: '#34d399'
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
                background: (colorMap && colorMap[d.label]) || 'var(--color-primary)'
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

  useEffect(() => {
    api.getQuotesSummary()
      .then(data => setSummary(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (!summary) return <p className={styles.error}>Failed to load dashboard data.</p>;

  const { total, byStatus = {}, revenueByStatus = {}, upcoming = [], byMonth = [] } = summary;

  const statusBars = [
    { label: 'draft',    value: byStatus.draft    || 0 },
    { label: 'sent',     value: byStatus.sent     || 0 },
    { label: 'approved', value: byStatus.approved || 0 }
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
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Quotes</span>
          <span className={styles.statValue}>{total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Signed (Approved)</span>
          <span className={styles.statValue} style={{ color: '#34d399' }}>{byStatus.approved || 0}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Sent to Client</span>
          <span className={styles.statValue} style={{ color: '#fbbf24' }}>{byStatus.sent || 0}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Approved Revenue</span>
          <span className={styles.statValue}>${(revenueByStatus.approved || 0).toFixed(0)}</span>
        </div>
      </div>

      <div className={styles.charts}>
        {/* Status breakdown */}
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>Quotes by Status</h3>
          <BarChart data={statusBars} colorMap={STATUS_COLORS} />
          <div className={styles.revenueTable}>
            {statusBars.map(s => (
              <div key={s.label} className={styles.revenueRow}>
                <span className={styles.revenueLabel} style={{ color: STATUS_COLORS[s.label] }}>{s.label}</span>
                <span>${(revenueByStatus[s.label] || 0).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend */}
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>Quotes Created (last 6 months)</h3>
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
          <p className={styles.empty}>No events scheduled in the next 90 days.</p>
        ) : (
          <div className={styles.eventList}>
            {upcoming.map(q => {
              const d = new Date(q.event_date + 'T00:00:00');
              const daysOut = Math.round((d - today) / 864e5);
              const status = q.status || 'draft';
              const showUnsigned = status === 'approved' && q.has_unsigned_changes;
              const displayStatus = showUnsigned ? 'Unsigned Changes' : status;
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
    </div>
  );
}

function formatMonth(ym) {
  if (!ym) return ym;
  const [, m] = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m, 10) - 1] || ym;
}
