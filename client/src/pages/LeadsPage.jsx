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
  const [selectedLead, setSelectedLead] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
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

  useEffect(() => {
    if (!selectedLead) { setEvents([]); return; }
    setEventsLoading(true);
    api.getLeadEvents(selectedLead.id)
      .then(d => { setEvents(d.events || []); })
      .catch(() => { setEvents([]); })
      .finally(() => setEventsLoading(false));
  }, [selectedLead]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteLead(confirmDelete.id);
      if (selectedLead?.id === confirmDelete.id) setSelectedLead(null);
      toast.info('Lead deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const pages = Math.ceil(total / limit);

  const eventLabel = (type) => {
    const labels = { lead_created: 'Lead created', quote_linked: 'Quote linked', email_sent: 'Email sent', reply_received: 'Reply received' };
    return labels[type] || type;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.sub}>{total} leads in database</p>
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
          <p>No leads yet. Import a sheet on the Import page or use the extension to capture contacts.</p>
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
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map(l => (
                  <tr
                    key={l.id}
                    className={selectedLead?.id === l.id ? styles.rowSelected : ''}
                    onClick={() => setSelectedLead(s => (s?.id === l.id ? null : l))}
                  >
                    <td>{l.name || '—'}</td>
                    <td>
                      {l.email
                        ? <a href={`mailto:${l.email}`} className={styles.emailLink} onClick={e => e.stopPropagation()}>{l.email}</a>
                        : '—'}
                    </td>
                    <td>{l.phone || '—'}</td>
                    <td>{l.event_date || '—'}</td>
                    <td>{l.event_type || '—'}</td>
                    <td>
                      {l.source_url
                        ? <a href={l.source_url} target="_blank" rel="noopener noreferrer" className={styles.emailLink} title={l.source_url} onClick={e => e.stopPropagation()}>view</a>
                        : '—'}
                    </td>
                    <td>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
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

      {selectedLead && (
        <div className={`card ${styles.timelineCard}`}>
          <div className={styles.timelineHeader}>
            <h3 className={styles.timelineTitle}>Activity — {selectedLead.name || selectedLead.email || 'Lead #' + selectedLead.id}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedLead(null)}>Close</button>
          </div>
          {eventsLoading ? (
            <div className={styles.timelineBody}><div className="spinner" /></div>
          ) : events.length === 0 ? (
            <p className={styles.timelineEmpty}>No activity yet.</p>
          ) : (
            <ul className={styles.timeline}>
              {events.map(ev => (
                <li key={ev.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineType}>{eventLabel(ev.event_type)}</span>
                    {ev.note && <span className={styles.timelineNote}> — {ev.note}</span>}
                    <div className={styles.timelineDate}>{ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
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
