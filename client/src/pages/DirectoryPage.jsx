import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DirectoryPage.module.css';

export default function DirectoryPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Directory</h1>
      <p className={styles.subtitle}>Manage your contacts and business relationships.</p>
      <div className={styles.grid}>
        <button className={`card ${styles.card}`} onClick={() => navigate('/leads')}>
          <div className={styles.cardIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.582-6 8-6s8 2 8 6"/>
            </svg>
          </div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>Leads</h2>
            <p className={styles.cardDesc}>Track potential clients and event inquiries.</p>
          </div>
          <span className={styles.cardArrow}>→</span>
        </button>
        <button className={`card ${styles.card}`} onClick={() => navigate('/vendors')}>
          <div className={styles.cardIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6h20L19 17H5L2 6z"/>
              <path d="M2 6L3.5 2h17L22 6"/>
              <circle cx="7.5" cy="21" r="1.5"/>
              <circle cx="16.5" cy="21" r="1.5"/>
            </svg>
          </div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>Vendors</h2>
            <p className={styles.cardDesc}>Manage subrental suppliers and vendor contacts.</p>
          </div>
          <span className={styles.cardArrow}>→</span>
        </button>
      </div>
    </div>
  );
}
