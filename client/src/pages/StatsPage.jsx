import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import StatsBar from '../components/StatsBar.jsx';
import styles from './StatsPage.module.css';

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usage Statistics</h1>
          <p className={styles.sub}>How often each item appears in quotes</p>
        </div>
        <div className={styles.sortRow}>
          <span className={styles.sortLabel}>Sort by:</span>
          {[
            { value: 'times_quoted', label: 'Times in project' },
            { value: 'total_guests', label: 'Total guests' },
            { value: 'probability_pct', label: 'Probability %' }
          ].map(opt => (
            <button
              key={opt.value}
              className={`btn btn-ghost btn-sm ${sortBy === opt.value ? styles.sortActive : ''}`}
              onClick={() => setSortBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="empty-state"><div className="spinner" /></div>}

      {!loading && stats.length === 0 && (
        <div className="empty-state">
          <p>No stats yet. Add items to quotes to start tracking usage.</p>
        </div>
      )}

      {!loading && stats.length > 0 && (
        <div className={`card ${styles.statsCard}`}>
          <div className={styles.statsHeader}>
            <span className={styles.colItem}>Item</span>
            <span className={styles.colBar}>Usage</span>
            <span className={styles.colVal}>
              {sortBy === 'times_quoted' ? 'Projects' : sortBy === 'total_guests' ? 'Guests' : '%'}
            </span>
          </div>
          <div className={styles.statsList}>
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
        <div className={styles.summaryRow}>
          <div className={`card ${styles.summaryCard}`}>
            <span className={styles.summaryVal}>{stats.length}</span>
            <span className={styles.summaryLabel}>Items tracked</span>
          </div>
          <div className={`card ${styles.summaryCard}`}>
            <span className={styles.summaryVal}>
              {stats.reduce((a, s) => a + (s.times_quoted || 0), 0)}
            </span>
            <span className={styles.summaryLabel}>Total quote appearances</span>
          </div>
          <div className={`card ${styles.summaryCard}`}>
            <span className={styles.summaryVal}>
              {sorted[0]?.title.slice(0, 20) || '—'}
              {(sorted[0]?.title?.length || 0) > 20 ? '…' : ''}
            </span>
            <span className={styles.summaryLabel}>Most popular item</span>
          </div>
        </div>
      )}
    </div>
  );
}
