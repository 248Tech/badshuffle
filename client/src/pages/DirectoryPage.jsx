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
        <button type="button" className={`card ${styles.card}`} onClick={() => navigate('/team')}>
          <div className={styles.cardIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>Team</h2>
            <p className={styles.cardDesc}>See who is online, what they are working on, and how the sales team is performing.</p>
          </div>
          <span className={styles.cardArrow} aria-hidden="true">→</span>
        </button>
        <button type="button" className={`card ${styles.card}`} onClick={() => navigate('/leads')}>
          <div className={styles.cardIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.582-6 8-6s8 2 8 6"/>
            </svg>
          </div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>Leads</h2>
            <p className={styles.cardDesc}>Track potential clients and event inquiries.</p>
          </div>
          <span className={styles.cardArrow} aria-hidden="true">→</span>
        </button>
        <button type="button" className={`card ${styles.card}`} onClick={() => navigate('/vendors')}>
          <div className={styles.cardIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
          <span className={styles.cardArrow} aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
