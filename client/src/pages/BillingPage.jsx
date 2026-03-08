import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import styles from './BillingPage.module.css';

const EVENT_LABELS = {
  payment_received: 'Payment received',
  payment_removed: 'Payment removed',
  refunded: 'Refunded'
};

export default function BillingPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getQuotes()
      .then(d => setQuotes((d.quotes || []).filter(q => q.overpaid)))
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    api.getBillingHistory()
      .then(d => setHistory(d.history || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Billing</h1>
          <p className={styles.sub}>
            Overpaid quotes — customer needs refund. Billing history logs payments received, removed, and refunded.
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
                  <th>Remaining balance</th>
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
                      <td>${Number(q.contract_total ?? q.total).toFixed(2)}</td>
                      <td>${Number(q.amount_paid || 0).toFixed(2)}</td>
                      <td className={q.overpaid ? styles.remainingOverpaid : styles.remainingBalance}>
                        {q.overpaid ? `Overpaid $${Math.abs(q.remaining_balance || 0).toFixed(2)}` : `$${Number(q.remaining_balance != null ? q.remaining_balance : (q.contract_total ?? q.total)).toFixed(2)}`}
                      </td>
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

      <div className={`card ${styles.card}`}>
        <h2 className={styles.sectionTitle}>Billing history</h2>
        <p className={styles.sectionSub}>Payments received, removed, and refunded across all quotes.</p>
        {historyLoading ? (
          <div className={styles.historyLoading}><span className="spinner" /> Loading…</div>
        ) : history.length === 0 ? (
          <p className={styles.emptyHistory}>No billing events yet. When you record payments or refunds on quotes, they will appear here.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Quote</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Note</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id}>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.quoteLink}
                        onClick={() => navigate(`/quotes/${row.quote_id}`)}
                      >
                        {row.quote_name || `Quote #${row.quote_id}`}
                      </button>
                    </td>
                    <td>
                      <span className={row.event_type === 'refunded' ? styles.eventRefunded : row.event_type === 'payment_removed' ? styles.eventRemoved : styles.eventReceived}>
                        {EVENT_LABELS[row.event_type] || row.event_type}
                      </span>
                    </td>
                    <td>{row.event_type === 'refunded' ? `-$${Number(row.amount).toFixed(2)}` : `$${Number(row.amount).toFixed(2)}`}</td>
                    <td>{row.note || '—'}</td>
                    <td className={styles.userCell}>{row.user_email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
