import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

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
    if (sortKey !== col) return <span className="ml-1 text-[11px] opacity-70" aria-hidden="true">↕</span>;
    return <span className="ml-1 text-[11px] opacity-70" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>;
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

  const thClass = 'px-4 py-3 text-left font-bold text-text-muted text-[11px] uppercase tracking-wider bg-bg border-b border-border sticky top-0 z-[1]';
  const sortThClass = `${thClass} cursor-pointer select-none whitespace-nowrap hover:text-primary transition-colors`;
  const tdClass = 'px-4 py-3.5 text-left border-b border-border';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-[13px] text-text-muted mt-0.5">
          Track outstanding balances, overpayments, and billing history across all projects.
        </p>
      </div>

      {/* Outstanding balances */}
      {!loading && outstanding.length > 0 && (
        <div className="card p-5">
          <h2 className="text-[16px] font-bold mb-1">Outstanding balances</h2>
          <p className="text-[13px] text-text-muted mb-3.5">Signed or confirmed projects with remaining balance due.</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className={thClass}>Project</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>Event Date</th>
                  <th className={thClass}>Total</th>
                  <th className={thClass}>Paid</th>
                  <th className={thClass}>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map(q => {
                  const clientName = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ') || q.name;
                  return (
                    <tr key={q.id} className="hover:bg-surface transition-colors">
                      <td className={tdClass}>
                        <button type="button" className="link" onClick={() => navigate(`/quotes/${q.id}`)}>
                          {q.name}
                        </button>
                      </td>
                      <td className={tdClass}>{clientName}</td>
                      <td className={tdClass}>{q.event_date || '—'}</td>
                      <td className={tdClass}>${Number(q.contract_total ?? q.total).toFixed(2)}</td>
                      <td className={tdClass}>${Number(q.amount_paid || 0).toFixed(2)}</td>
                      <td className={`${tdClass} text-danger font-medium`}>${Number(q.remaining_balance || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overpaid projects */}
      {loading ? (
        <div className="card p-5" aria-busy="true" aria-label="Loading billing data">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <tbody aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className={tdClass}><div className="skeleton h-[13px]" style={{ width: 130 + (i % 3) * 30 }} /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-24" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-20" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-16" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-16" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-16" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : quotes.length === 0 ? (
        <div className="empty-state">
          <p>No overpaid projects. When a customer pays more than the project total, those projects will appear here for refund processing.</p>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-warning-subtle border border-warning-border rounded text-[14px] text-warning-strong mb-4">
            <span className="text-[18px]" aria-hidden="true">⚠️</span>
            <span><strong>{quotes.length}</strong> project{quotes.length !== 1 ? 's' : ''} overpaid — refund due to customer.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className={thClass}>Project</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>Contract total</th>
                  <th className={thClass}>Amount paid</th>
                  <th className={thClass}>Remaining balance</th>
                  <th className={thClass}>Refund due</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => {
                  const showBalance = q.has_unsigned_changes || q.status === 'approved' || q.status === 'confirmed' || q.status === 'closed';
                  const refundDue = Math.abs(q.remaining_balance || 0);
                  const clientName = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ') || q.name;
                  return (
                    <tr key={q.id} className="hover:bg-surface transition-colors">
                      <td className={tdClass}>
                        <button type="button" className="link" onClick={() => navigate(`/quotes/${q.id}`)}>
                          {q.name}
                        </button>
                      </td>
                      <td className={tdClass}>{clientName}</td>
                      <td className={tdClass}>${Number(q.contract_total ?? q.total).toFixed(2)}</td>
                      <td className={tdClass}>${Number(q.amount_paid || 0).toFixed(2)}</td>
                      <td className={`${tdClass} ${q.overpaid ? 'text-warning font-medium' : 'text-danger font-medium'}`}>
                        {showBalance
                          ? (q.overpaid ? `Overpaid $${Math.abs(q.remaining_balance || 0).toFixed(2)}` : `$${Number(q.remaining_balance != null ? q.remaining_balance : (q.contract_total ?? q.total)).toFixed(2)}`)
                          : '—'}
                      </td>
                      <td className={`${tdClass} font-semibold text-warning`}>{showBalance ? `$${refundDue.toFixed(2)}` : '—'}</td>
                      <td className={tdClass}>
                        {showBalance && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 bg-warning-subtle text-warning-strong border border-warning-border rounded-full">
                            Overpaid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Billing history */}
      <div className="card p-5">
        <div className="flex justify-between items-start gap-3 flex-wrap mb-4">
          <div>
            <h2 className="text-[16px] font-bold mb-1">Billing history</h2>
            <p className="text-[13px] text-text-muted">Payments received, removed, and refunded across all projects.</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex items-center">
              <svg className="absolute left-2.5 text-text-muted pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="pl-8 pr-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-bg text-text focus:outline-none focus:border-primary transition-colors w-[min(220px,100%)]"
                aria-label="Search billing history"
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
          <div className="overflow-x-auto" aria-busy="true" aria-label="Loading history">
            <table className="w-full border-collapse text-[14px]">
              <tbody aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className={tdClass}><div className="skeleton h-[13px] w-28" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px]" style={{ width: 120 + (i % 3) * 20 }} /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-[70px]" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-14" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-20" /></td>
                    <td className={tdClass}><div className="skeleton h-[13px] w-24" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredHistory.length === 0 ? (
          <p className="px-4 py-4 text-text-muted text-[14px]">
            {history.length === 0
              ? 'No billing events yet. When you record payments or refunds on projects, they will appear here.'
              : 'No results match your search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  <th
                    className={sortThClass}
                    onClick={() => handleSort('created_at')}
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('created_at')}
                    aria-sort={sortKey === 'created_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Date <SortIcon col="created_at" />
                  </th>
                  <th
                    className={sortThClass}
                    onClick={() => handleSort('quote_name')}
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('quote_name')}
                    aria-sort={sortKey === 'quote_name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Project <SortIcon col="quote_name" />
                  </th>
                  <th className={thClass}>Event</th>
                  <th
                    className={sortThClass}
                    onClick={() => handleSort('amount')}
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('amount')}
                    aria-sort={sortKey === 'amount' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Amount <SortIcon col="amount" />
                  </th>
                  <th className={thClass}>Note</th>
                  <th className={thClass}>By</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(row => (
                  <tr key={row.id} className="hover:bg-surface transition-colors">
                    <td className={tdClass}>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    <td className={tdClass}>
                      <button type="button" className="link" onClick={() => navigate(`/quotes/${row.quote_id}`)}>
                        {row.quote_name || `Project #${row.quote_id}`}
                      </button>
                    </td>
                    <td className={tdClass}>
                      <span className={
                        row.event_type === 'refunded'
                          ? 'text-warning font-medium'
                          : row.event_type === 'payment_removed'
                            ? 'text-text-muted'
                            : 'text-success font-medium'
                      }>
                        {EVENT_LABELS[row.event_type] || row.event_type}
                      </span>
                    </td>
                    <td className={tdClass}>{row.event_type === 'refunded' ? `-$${Number(row.amount).toFixed(2)}` : `$${Number(row.amount).toFixed(2)}`}</td>
                    <td className={tdClass}>{row.note || '—'}</td>
                    <td className={`${tdClass} text-[12px] text-text-muted`}>{row.user_email || '—'}</td>
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
