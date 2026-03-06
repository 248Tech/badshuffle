import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import styles from './BillingPage.module.css';

export default function BillingPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getQuotes()
      .then(d => setQuotes((d.quotes || []).filter(q => q.overpaid)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Billing</h1>
          <p className={styles.sub}>
            Overpaid quotes — customer needs refund
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : quotes.length === 0 ? (
        <div className="empty-state">
          <p>No overpaid quotes. When a customer pays more than the contract total, those quotes will appear here for refund processing.</p>
        </div>
      ) : (
        <div className={`card ${styles.card}`}>
          <div className={styles.alertBanner}>
            <span className={styles.alertIcon}>⚠️</span>
            <span><strong>{quotes.length}</strong> quote{quotes.length !== 1 ? 's' : ''} overpaid — refund due to customer.</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Client</th>
                  <th>Contract total</th>
                  <th>Amount paid</th>
                  <th>Refund due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => {
                  const refundDue = Math.abs(q.remaining_balance || 0);
                  const clientName = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ') || q.name;
                  return (
                    <tr key={q.id}>
                      <td>
                        <button
                          type="button"
                          className={styles.quoteLink}
                          onClick={() => navigate(`/quotes/${q.id}`)}
                        >
                          {q.name}
                        </button>
                      </td>
                      <td>{clientName}</td>
                      <td>${Number(q.contract_total).toFixed(2)}</td>
                      <td>${Number(q.amount_paid || 0).toFixed(2)}</td>
                      <td className={styles.refundDue}>${refundDue.toFixed(2)}</td>
                      <td>
                        <span className={styles.overpaidBadge}>Overpaid</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
