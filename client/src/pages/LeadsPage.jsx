import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import styles from './LeadsPage.module.css';

/** Build quote payload from lead; only include fields that match expected format. */
function quoteFromLead(lead) {
  const name = (lead.name && String(lead.name).trim()) || (lead.email && String(lead.email).trim()) || 'Project from lead';
  const body = { name };

  if (lead.guest_count != null && Number.isInteger(Number(lead.guest_count)) && Number(lead.guest_count) >= 0) {
    body.guest_count = Number(lead.guest_count);
  }

  const eventDate = lead.event_date != null ? String(lead.event_date).trim() : '';
  if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) body.event_date = eventDate;

  if (lead.notes != null && typeof lead.notes === 'string') body.notes = lead.notes;

  if (lead.name && typeof lead.name === 'string') {
    const parts = lead.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      body.client_first_name = parts[0];
      body.client_last_name = parts.slice(1).join(' ');
    } else if (parts.length === 1 && parts[0]) {
      body.client_first_name = parts[0];
    }
  }

  const email = lead.email != null ? String(lead.email).trim() : '';
  if (email && email.includes('@')) body.client_email = email;

  if (lead.phone != null && typeof lead.phone === 'string' && lead.phone.trim()) body.client_phone = lead.phone.trim();

  return body;
}

export default function LeadsPage() {
  const navigate = useNavigate();
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
  const [creatingQuoteForId, setCreatingQuoteForId] = useState(null);
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

  const handleCreateQuote = async (lead, e) => {
    if (e) e.stopPropagation();
    setCreatingQuoteForId(lead.id);
    try {
      const body = quoteFromLead(lead);
      const { quote } = await api.createQuote(body);
      await api.updateQuote(quote.id, { lead_id: lead.id });
      await api.updateLead(lead.id, { quote_id: quote.id });
      toast.success('Quote created and linked to lead');
      navigate(`/quotes/${quote.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreatingQuoteForId(null);
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
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.search}
            placeholder="Search name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
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
                    <td onClick={e => e.stopPropagation()} className={styles.actionsCell}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={creatingQuoteForId === l.id}
                        onClick={e => handleCreateQuote(l, e)}
                        title="Create a new project from this lead"
                      >
                        {creatingQuoteForId === l.id ? '…' : 'Create project'}
                      </button>
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
