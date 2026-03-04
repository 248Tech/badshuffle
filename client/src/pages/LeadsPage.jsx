import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import styles from './LeadsPage.module.css';

export default function LeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const limit = 25;

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit };
    if (search) params.search = search;
    api.getLeads(params)
      .then(d => { setLeads(d.leads || []); setTotal(d.total || 0); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteLead(confirmDelete.id);
      toast.info('Lead deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.sub}>{total} leads captured from Goodshuffle</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search name, email, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : leads.length === 0 ? (
        <div className="empty-state">
          <p>No leads yet. Browse Goodshuffle quote pages with the extension to capture contacts.</p>
        </div>
      ) : (
        <div className={`card ${styles.tableCard}`}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Event Date</th>
                  <th>Event Type</th>
                  <th>Source</th>
                  <th>Captured</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id}>
                    <td>{l.name || '—'}</td>
                    <td>
                      {l.email
                        ? <a href={`mailto:${l.email}`} className={styles.emailLink}>{l.email}</a>
                        : '—'}
                    </td>
                    <td>{l.phone || '—'}</td>
                    <td>{l.event_date || '—'}</td>
                    <td>{l.event_type || '—'}</td>
                    <td>
                      {l.source_url
                        ? <a href={l.source_url} target="_blank" rel="noopener noreferrer" className={styles.emailLink} title={l.source_url}>view</a>
                        : '—'}
                    </td>
                    <td>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => setConfirmDelete(l)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ← Prev
              </button>
              <span className={styles.pageInfo}>Page {page} of {pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete lead "${confirmDelete.name || confirmDelete.email || 'this lead'}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
