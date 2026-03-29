import React from 'react';
import styles from '../QuoteDetailPage.module.css';

export default function QuoteLogsPanel({ activity }) {
  return (
    <div className={`card ${styles.editCard}`}>
      <h3 className={styles.formSectionTitle}>Activity log</h3>
      <p className={styles.notes}>All changes to this quote: items, custom items, contract, payments, and files. Includes user, time, and original vs changed values.</p>
      {activity.length > 0 ? (
        <ul className={styles.activityLogList}>
          {activity.map(entry => (
            <li key={entry.id} className={styles.activityLogItem}>
              <div className={styles.activityLogMeta}>
                <span className={styles.contractLogWhen}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                <span className={styles.contractLogWho}>{entry.user_email || 'System'}</span>
              </div>
              <div className={styles.contractLogWhat}>{entry.description || entry.event_type}</div>
              {(entry.old_value || entry.new_value) && (
                <div className={styles.activityLogValues}>
                  {entry.old_value && <div className={styles.activityLogOld}><strong>Original:</strong> {entry.old_value}</div>}
                  {entry.new_value && <div className={styles.activityLogNew}><strong>Changed to:</strong> {entry.new_value}</div>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyHint}>No activity yet.</p>
      )}
    </div>
  );
}
