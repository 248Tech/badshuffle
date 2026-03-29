import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

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
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
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

  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      api.getLeads({ search: search.trim(), limit: 6 })
        .then(d => setSuggestions(d.leads || []))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

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

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedLeads = [...leads].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="ml-1 text-[11px] opacity-70" aria-hidden="true">↕</span>;
    return <span className="ml-1 text-[11px] opacity-70" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const eventLabel = (type) => {
    const labels = { lead_created: 'Lead created', quote_linked: 'Quote linked', email_sent: 'Email sent', reply_received: 'Reply received' };
    return labels[type] || type;
  };

  const thClass = 'px-3 py-2.5 text-left font-semibold text-text-muted text-[13px] border-b border-border bg-bg-elevated whitespace-nowrap';
  const sortThClass = `${thClass} cursor-pointer select-none hover:text-primary transition-colors`;
  const tdClass = 'px-3 py-2.5 border-b border-border text-[14px]';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <p className="text-[13px] text-text-muted mt-0.5">{total} lead{total !== 1 ? 's' : ''} in database</p>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative flex items-center flex-1 max-w-sm">
        <svg className="absolute left-2.5 text-text-muted pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-[14px] bg-bg text-text focus:outline-none focus:border-primary shadow-sm"
          placeholder="Search name, email, phone…"
          aria-label="Search leads by name, email, or phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute top-full left-0 right-0 z-[100] bg-bg border border-border rounded shadow-lg mt-0.5 max-h-[220px] overflow-y-auto list-none p-1">
            {suggestions.map(s => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 cursor-pointer hover:bg-surface rounded text-[13px]"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setSearch(s.name || s.email || '');
                    setShowSuggestions(false);
                  }}
                >
                  <span className="font-medium">{s.name || '—'}</span>
                  {s.email && <span className="text-[11px] text-text-muted ml-2">{s.email}</span>}
                  {s.event_date && <span className="text-[11px] text-text-muted ml-2">{s.event_date}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-[1fr_300px] gap-5 items-start max-[900px]:grid-cols-1">
        {/* Leads list */}
        <div>
          {loading ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className={tdClass}>
                            <div className="skeleton h-[13px]" style={{ width: j === 0 ? 120 : j === 1 ? 160 : 80 }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : leads.length === 0 ? (
            <div className="empty-state">
              {search.trim() ? (
                <>
                  <p>No leads match <strong>"{search}"</strong>.</p>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>Clear search</button>
                </>
              ) : (
                <p>No leads yet. Import a sheet on the Import page or use the extension to capture contacts.</p>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr>
                      <th className={sortThClass} tabIndex={0} onClick={() => handleSort('name')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('name')} aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Name <SortIcon col="name" /></th>
                      <th className={sortThClass} tabIndex={0} onClick={() => handleSort('email')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('email')} aria-sort={sortKey === 'email' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Email <SortIcon col="email" /></th>
                      <th className={thClass}>Phone</th>
                      <th className={sortThClass} tabIndex={0} onClick={() => handleSort('event_date')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('event_date')} aria-sort={sortKey === 'event_date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Event Date <SortIcon col="event_date" /></th>
                      <th className={sortThClass} tabIndex={0} onClick={() => handleSort('event_type')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('event_type')} aria-sort={sortKey === 'event_type' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Event Type <SortIcon col="event_type" /></th>
                      <th className={thClass}>Source</th>
                      <th className={sortThClass} tabIndex={0} onClick={() => handleSort('created_at')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('created_at')} aria-sort={sortKey === 'created_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Added <SortIcon col="created_at" /></th>
                      <th className={thClass}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeads.map(l => (
                      <tr
                        key={l.id}
                        className={`hover:bg-hover transition-colors cursor-pointer ${selectedLead?.id === l.id ? 'bg-primary/10' : ''}`}
                        tabIndex={0}
                        onClick={() => setSelectedLead(s => (s?.id === l.id ? null : l))}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedLead(s => (s?.id === l.id ? null : l))}
                      >
                        <td className={tdClass}>{l.name || '—'}</td>
                        <td className={tdClass}>
                          {l.email
                            ? <a href={`mailto:${l.email}`} className="text-primary hover:underline" onClick={e => e.stopPropagation()}>{l.email}</a>
                            : '—'}
                        </td>
                        <td className={tdClass}>{l.phone || '—'}</td>
                        <td className={tdClass}>{l.event_date || '—'}</td>
                        <td className={tdClass}>{l.event_type || '—'}</td>
                        <td className={tdClass}>
                          {l.source_url
                            ? <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title={l.source_url} onClick={e => e.stopPropagation()}>view</a>
                            : '—'}
                        </td>
                        <td className={tdClass}>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                        <td className={`${tdClass} whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm mr-1"
                            disabled={creatingQuoteForId === l.id}
                            onClick={e => handleCreateQuote(l, e)}
                            title="Create a new project from this lead"
                          >
                            {creatingQuoteForId === l.id ? '…' : 'Create project'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => setConfirmDelete(l)}
                            aria-label={`Delete lead ${l.name || l.email || ''}`}
                          >
                            <span aria-hidden="true">✕</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <span aria-hidden="true">←</span> Prev
                  </button>
                  <span className="text-[13px] text-text-muted">Page {page} of {pages}</span>
                  <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                    Next <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail / timeline */}
        <div aria-live="polite">
          {selectedLead ? (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold truncate">{selectedLead.name || selectedLead.email || 'Lead #' + selectedLead.id}</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedLead(null)}>Close</button>
              </div>
              {eventsLoading ? (
                <ul className="list-none p-0 m-0 flex flex-col gap-0" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="flex gap-3 pb-4 relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-border shrink-0 mt-0.5 relative z-[1]" />
                      <div className="flex-1">
                        <div className="skeleton h-[13px] mb-1.5 rounded" style={{ width: `${50 + (i % 3) * 20}%` }} />
                        <div className="skeleton h-[11px] w-20 rounded" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : events.length === 0 ? (
                <p className="text-[13px] text-text-muted">No activity yet.</p>
              ) : (
                <ul className="list-none p-0 m-0 relative before:absolute before:left-[4px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {events.map(ev => (
                    <li key={ev.id} className="flex gap-3 pb-4 last:pb-0 relative">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-0.5 relative z-[1]" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-semibold">{eventLabel(ev.event_type)}</span>
                        {ev.note && <span className="text-[13px] text-text-muted"> — {ev.note}</span>}
                        <div className="text-[11px] text-text-muted mt-0.5">{ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-muted text-[14px] opacity-60">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="8" cy="6" r="3"/><path d="M2 18c0-3.314 2.686-5 6-5"/>
                <circle cx="16" cy="6" r="3"/><path d="M10 18c0-3.314 2.686-5 6-5s6 1.686 6 5"/>
              </svg>
              <span>Select a lead to view activity</span>
            </div>
          )}
        </div>
      </div>

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
