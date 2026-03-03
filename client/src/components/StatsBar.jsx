import React from 'react';
import styles from './StatsBar.module.css';

export default function StatsBar({ label, value, max, count }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className={styles.row}>
      <span className={styles.label} title={label}>{label}</span>
      <div className={styles.barWrapper}>
        <div className={styles.bar} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.value}>{count !== undefined ? count : value}</span>
    </div>
  );
}
