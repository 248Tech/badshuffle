import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import styles from './BillingPage.module.css';

const EVENT_LABELS = {
  payment_received: 'Payment received',
  payment_removed: 'Payment removed',
  refunded: 'Refunded'
};

function exportCsv(history) {
  const header = ['Date', 'Project', 'Event', 'Amount', 'Note', 'By'];
  const rows = history.map(row => [
    row.created_at ? new Date(row.created_at).toLocaleString() : '',
    row.quote_name || `Project #${row.quote_id}`,
    EVENT_LABELS[row.event_type] || row.event_type,
    row.event_type === 'refunded' ? `-${Number(row.amount).toFixed(2)}` : Number(row.amount).toFixed(2),
    row.note || '',
    row.user_email || ''
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `billing-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BillingPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const [outstanding, setOutstanding] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    api.getQuotes()
      .then(d => {
        const all = d.quotes || [];
        setQuotes(all.filter(q => q.overpaid));
        setOutstanding(all.filter(q => !q.overpaid && q.remaining_balance > 0 && ['approved','confirmed'].includes(q.status)));
      })
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

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className={styles.sortIcon}>↕</span>;
    return <span className={styles.sortIcon}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const filteredHistory = history
    .filter(row => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (row.quote_name || '').toLowerCase().includes(s) ||
             (row.note || '').toLowerCase().includes(s) ||
             (row.user_email || '').toLowerCase().includes(s);
    })
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'amount') { av = Number(av); bv = Number(bv); }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Billing</h1>
          <p className={styles.sub}>
            Track outstanding balances, overpayments, and billing history across all projects.
          </p>
        </div>
      </div>

      {!loading && outstanding.length > 0 && (
        <div className={`card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Outstanding balances</h2>
          <p className={styles.sectionSub}>Signed or confirmed projects with remaining balance due.</p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Event Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map(q => {
                  const clientName = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ') || q.name;
                  return (
                    <tr key={q.id}>
                      <td>
                        <button type="button" className={styles.quoteLink} onClick={() => navigate(`/quotes/${q.id}`)}>
                          {q.name}
                        </button>
                      </td>
                      <td>{clientName}</td>
                      <td>{q.event_date || '—'}</td>
                      <td>${Number(q.contract_total ?? q.total).toFixed(2)}</td>
                      <td>${Number(q.amount_paid || 0).toFixed(2)}</td>
                      <td className={styles.remainingBalance}>${Number(q.remaining_balance || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : quotes.length === 0 ? (
        <div className="empty-state">
          <p>No overpaid projects. When a customer pays more than the project total, those projects will appear here for refund processing.</p>
        </div>
      ) : (
        <div className={`card ${styles.card}`}>
          <div className={styles.alertBanner}>
            <span className={styles.alertIcon}>⚠️</span>
            <span><strong>{quotes.length}</strong> project{quotes.length !== 1 ? 's' : ''} overpaid — refund due to customer.</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Project</th>
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
                  const showBalance = q.has_unsigned_changes || q.status === 'approved' || q.status === 'confirmed' || q.status === 'closed';
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
                        {showBalance
                          ? (q.overpaid ? `Overpaid $${Math.abs(q.remaining_balance || 0).toFixed(2)}` : `$${Number(q.remaining_balance != null ? q.remaining_balance : (q.contract_total ?? q.total)).toFixed(2)}`)
                          : '—'}
                      </td>
                      <td className={styles.refundDue}>{showBalance ? `$${refundDue.toFixed(2)}` : '—'}</td>
                      <td>
                        {showBalance && <span className={styles.overpaidBadge}>Overpaid</span>}
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
        <div className={styles.historyHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Billing history</h2>
            <p className={styles.sectionSub}>Payments received, removed, and refunded across all projects.</p>
          </div>
          <div className={styles.historyActions}>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className={styles.search}
                placeholder="Search project or note…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportCsv(filteredHistory)}
              disabled={filteredHistory.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>
        {historyLoading ? (
          <div className={styles.historyLoading}><span className="spinner" /> Loading…</div>
        ) : filteredHistory.length === 0 ? (
          <p className={styles.emptyHistory}>
            {history.length === 0
              ? 'No billing events yet. When you record payments or refunds on projects, they will appear here.'
              : 'No results match your search.'}
          </p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.sortable} onClick={() => handleSort('created_at')}>
                    Date <SortIcon col="created_at" />
                  </th>
                  <th className={styles.sortable} onClick={() => handleSort('quote_name')}>
                    Project <SortIcon col="quote_name" />
                  </th>
                  <th>Event</th>
                  <th className={styles.sortable} onClick={() => handleSort('amount')}>
                    Amount <SortIcon col="amount" />
                  </th>
                  <th>Note</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(row => (
                  <tr key={row.id}>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.quoteLink}
                        onClick={() => navigate(`/quotes/${row.quote_id}`)}
                      >
                        {row.quote_name || `Project #${row.quote_id}`}
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
