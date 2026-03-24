import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import QuoteCard from '../components/QuoteCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuotePage.module.css';

export default function QuotePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '', guest_count: '', event_date: '', notes: '',
    client_first_name: '', client_last_name: '', client_phone: '', client_email: '', client_address: ''
  });
  const [saving, setSaving] = useState(false);
  const [googlePlacesKey, setGooglePlacesKey] = useState('');
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState('tiles'); // 'tiles' | 'list'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActioning, setBatchActioning] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    event_from: '',
    event_to: '',
    has_balance: false,
    venue: ''
  });
  const [quoteIdsWithConflict, setQuoteIdsWithConflict] = useState(new Set());
  const [sortBy, setSortBy] = useState('created_desc');

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      ...(filters.search && { search: filters.search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.event_from && { event_from: filters.event_from }),
      ...(filters.event_to && { event_to: filters.event_to }),
      ...(filters.has_balance && { has_balance: '1' }),
      ...(filters.venue && { venue: filters.venue })
    };
    api.getQuotes(params).then(d => setQuotes(d.quotes || [])).finally(() => setLoading(false));
  }, [filters.search, filters.status, filters.event_from, filters.event_to, filters.has_balance, filters.venue]);

  const loadConflicts = useCallback(() => {
    api.getConflicts()
      .then(d => setQuoteIdsWithConflict(new Set((d.conflicts || []).map(c => c.quote_id))))
      .catch(() => {});
  }, []);

  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  useEffect(() => {
    let cancelled = false;
    const params = {
      ...(filters.search && { search: filters.search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.event_from && { event_from: filters.event_from }),
      ...(filters.event_to && { event_to: filters.event_to }),
      ...(filters.has_balance && { has_balance: '1' }),
      ...(filters.venue && { venue: filters.venue })
    };
    const run = () => {
      setLoading(true);
      api.getQuotes(params)
        .then(d => { if (!cancelled) setQuotes(d.quotes || []); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    const delay = filters.search || filters.venue ? 400 : 0;
    const id = delay ? setTimeout(run, delay) : null;
    if (!delay) run();
    return () => { cancelled = true; if (id) clearTimeout(id); };
  }, [filters.search, filters.status, filters.event_from, filters.event_to, filters.has_balance, filters.venue]);

  const hasActiveFilters = filters.search || filters.status || filters.event_from || filters.event_to || filters.has_balance || filters.venue;
  const clearFilters = () => setFilters({ search: '', status: '', event_from: '', event_to: '', has_balance: false, venue: '' });

  // Load Google Places API key from settings
  useEffect(() => {
    api.getSettings().then(s => {
      if (s.google_places_api_key) setGooglePlacesKey(s.google_places_api_key);
    }).catch(() => {});
  }, []);

  // Dynamically load Google Maps script once key is available
  useEffect(() => {
    if (!googlePlacesKey) return;
    if (window.google?.maps?.places) { setGoogleScriptLoaded(true); return; }
    const existing = document.getElementById('gplaces-script');
    if (existing) {
      existing.addEventListener('load', () => setGoogleScriptLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gplaces-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googlePlacesKey}&libraries=places`;
    script.async = true;
    script.onload = () => setGoogleScriptLoaded(true);
    document.head.appendChild(script);
  }, [googlePlacesKey]);

  // Initialize autocomplete when new form is shown and script is ready
  useEffect(() => {
    if (!showNew || !googleScriptLoaded || !addressInputRef.current) return;
    if (autocompleteRef.current) return; // already initialized
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, { types: ['address'] });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place?.formatted_address) {
        setForm(f => ({ ...f, client_address: place.formatted_address }));
      }
    });
    autocompleteRef.current = ac;
    return () => {
      autocompleteRef.current = null;
    };
  }, [showNew, googleScriptLoaded]);

  const resetNewForm = () => {
    setShowNew(false);
    setForm({ name: '', guest_count: '', event_date: '', notes: '', client_first_name: '', client_last_name: '', client_phone: '', client_email: '', client_address: '' });
    autocompleteRef.current = null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { quote } = await api.createQuote({
        name: form.name,
        guest_count: Number(form.guest_count) || 0,
        event_date: form.event_date || null,
        notes: form.notes || null,
        client_first_name: form.client_first_name || null,
        client_last_name: form.client_last_name || null,
        client_phone: form.client_phone || null,
        client_email: form.client_email || null,
        client_address: form.client_address || null
      });
      resetNewForm();
      navigate(`/quotes/${quote.id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteQuote(confirmDelete.id);
      toast.info(`Deleted project "${confirmDelete.name}"`);
      setSelectedIds(s => { const n = new Set(s); n.delete(confirmDelete.id); return n; });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === quotes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(quotes.map(q => q.id)));
  };

  const handleDuplicateOne = async (quote) => {
    try {
      const { quote: newQuote } = await api.duplicateQuote(quote.id);
      toast.success('Project duplicated');
      load();
      navigate(`/quotes/${newQuote.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleBatchDuplicate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBatchActioning(true);
    try {
      const newIds = [];
      for (const id of ids) {
        const { quote } = await api.duplicateQuote(id);
        newIds.push(quote.id);
      }
      toast.success(`${ids.length} project(s) duplicated`);
      setSelectedIds(new Set());
      load();
      if (newIds.length === 1) navigate(`/quotes/${newIds[0]}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBatchActioning(false);
    }
  };

  const handleBatchDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const first = quotes.find(q => q.id === ids[0]);
    setConfirmDelete(ids.length === 1 ? first : { id: 'batch', name: `${ids.length} selected projects`, _batchIds: ids });
  };

  const handleDeleteConfirmBatch = async () => {
    const batch = confirmDelete?._batchIds;
    if (!batch?.length) return handleDeleteConfirm();
    try {
      for (const id of batch) {
        await api.deleteQuote(id);
      }
      toast.info(`Deleted ${batch.length} project(s)`);
      setSelectedIds(new Set());
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const selectedCount = selectedIds.size;

  const sortedQuotes = [...quotes].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc': return (a.name || '').localeCompare(b.name || '');
      case 'name_desc': return (b.name || '').localeCompare(a.name || '');
      case 'event_asc': return (a.event_date || '').localeCompare(b.event_date || '');
      case 'event_desc': return (b.event_date || '').localeCompare(a.event_date || '');
      case 'total_desc': return (b.total || 0) - (a.total || 0);
      case 'total_asc': return (a.total || 0) - (b.total || 0);
      case 'created_asc': return a.id - b.id;
      case 'created_desc':
      default: return b.id - a.id;
    }
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.sub}>
            {quotes.length} {hasActiveFilters ? 'matching' : 'saved'} projects
          </p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.viewSelect}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="Sort order"
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="event_asc">Event date ↑</option>
            <option value="event_desc">Event date ↓</option>
            <option value="name_asc">Name A→Z</option>
            <option value="name_desc">Name Z→A</option>
            <option value="total_desc">Total high→low</option>
            <option value="total_asc">Total low→high</option>
          </select>
          <select
            className={styles.viewSelect}
            value={viewMode}
            onChange={e => setViewMode(e.target.value)}
            aria-label="View mode"
          >
            <option value="tiles">Tile View</option>
            <option value="list">List View</option>
          </select>
          <button className="btn btn-primary" onClick={() => showNew ? resetNewForm() : setShowNew(true)}>
            {showNew ? 'Cancel' : '+ New Project'}
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <svg className={styles.filterSearchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className={styles.filterInputSearch}
            placeholder="Search name or client…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            aria-label="Search by quote or client name"
          />
        </div>
        <div className={styles.filterSearchWrap}>
          <svg className={styles.filterSearchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className={styles.filterInputSearch}
            placeholder="Venue name or address"
            value={filters.venue}
            onChange={e => setFilters(f => ({ ...f, venue: e.target.value }))}
            aria-label="Filter by venue"
          />
        </div>
        <select
          className={styles.filterSelect}
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Signed</option>
          <option value="confirmed">Confirmed</option>
          <option value="closed">Closed</option>
        </select>
        <DateRangePicker
          from={filters.event_from}
          to={filters.event_to}
          onChange={({ from: event_from, to: event_to }) => setFilters(f => ({ ...f, event_from, event_to }))}
          placeholder="Event date range"
        />
        <label className={styles.filterCheck}>
          <input
            type="checkbox"
            checked={filters.has_balance}
            onChange={e => setFilters(f => ({ ...f, has_balance: e.target.checked }))}
          />
          <span>Outstanding balance</span>
        </label>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {selectedCount > 0 && (
        <div className={styles.batchBar}>
          <span>{selectedCount} selected</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={batchActioning}
            onClick={handleBatchDuplicate}
          >
            Duplicate ({selectedCount})
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-danger)' }}
            onClick={handleBatchDelete}
          >
            Delete ({selectedCount})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {showNew && (
        <div className={`card ${styles.formCard}`}>
          <h3 className={styles.formTitle}>New Project</h3>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.formSectionLabel}>Event Details</div>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Event name *</label>
                <input
                  required
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Smith Wedding — June 2026"
                />
              </div>
              <div className="form-group">
                <label>Guest count</label>
                <input
                  type="number"
                  min="0"
                  value={form.guest_count}
                  onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))}
                  placeholder="150"
                />
              </div>
              <div className="form-group">
                <label>Event date</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any relevant details…"
              />
            </div>
            <div className={styles.formSectionLabel}>Client Info</div>
            <div className={styles.formRow}>
              <div className="form-group">
                <label>First name</label>
                <input
                  value={form.client_first_name}
                  onChange={e => setForm(f => ({ ...f, client_first_name: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div className="form-group">
                <label>Last name</label>
                <input
                  value={form.client_last_name}
                  onChange={e => setForm(f => ({ ...f, client_last_name: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={form.client_phone}
                  onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                  placeholder="555-555-5555"
                />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Email</label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                ref={addressInputRef}
                value={form.client_address}
                onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))}
                placeholder="123 Main St, City, State"
                autoComplete="off"
              />
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetNewForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Creating…' : 'Create & Open Project →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <div className="spinner" />
          Loading projects…
        </div>
      )}

      {!loading && quotes.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>No projects yet. Create one to get started.</p>
        </div>
      )}

      {!loading && quotes.length > 0 && viewMode === 'tiles' && (
        <div className={styles.grid}>
          {sortedQuotes.map(q => (
            <QuoteCard
              key={q.id}
              quote={q}
              total={q.total}
              hasConflict={quoteIdsWithConflict.has(q.id)}
              onDelete={setConfirmDelete}
              onDuplicate={handleDuplicateOne}
              selectable
              selected={selectedIds.has(q.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {!loading && quotes.length > 0 && viewMode === 'list' && (
        <div className={styles.listWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colCheck}>
                  <input
                    type="checkbox"
                    checked={sortedQuotes.length > 0 && selectedIds.size === sortedQuotes.length}
                    onChange={selectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className={styles.colName}>Name</th>
                <th>Client</th>
                <th>Status</th>
                <th>Event date</th>
                <th>Guests</th>
                <th>Project total</th>
                <th>Remaining balance</th>
                <th className={styles.colActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedQuotes.map(q => {
                const eventDate = q.event_date
                  ? new Date(q.event_date + 'T00:00:00').toLocaleDateString()
                  : '—';
                const clientName = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ');
                return (
                  <tr key={q.id} className={selectedIds.has(q.id) ? styles.rowSelected : ''}>
                    <td className={styles.colCheck}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(q.id)}
                        onChange={() => toggleSelect(q.id)}
                        aria-label={`Select ${q.name}`}
                      />
                    </td>
                    <td className={styles.colName}>
                      {quoteIdsWithConflict.has(q.id) && (
                        <span className={styles.conflictStopSignList} title="Inventory conflict">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#c00" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
                            <line x1="12" y1="8" x2="12" y2="13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                            <circle cx="12" cy="16.5" r="1.1" fill="#fff" stroke="none" />
                          </svg>
                        </span>
                      )}
                      <button
                        type="button"
                        className="link"
                        onClick={() => navigate(`/quotes/${q.id}`)}
                      >
                        {q.name}
                      </button>
                    </td>
                    <td className={styles.colClient}>{clientName || <span className={styles.muted}>—</span>}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles['status_' + (q.status || 'draft')]}`}>
                        {q.status === 'approved' ? 'SIGNED' : (q.status || 'draft').toUpperCase()}
                      </span>
                    </td>
                    <td>{eventDate}</td>
                    <td>{q.guest_count > 0 ? q.guest_count : '—'}</td>
                    <td>{q.total != null && q.total > 0 ? `$${Number(q.total).toFixed(2)}` : '—'}</td>
                    <td>
                      {(q.has_unsigned_changes || q.status === 'approved' || q.status === 'confirmed' || q.status === 'closed') && q.total != null && q.total > 0 ? (
                        q.overpaid ? (
                          <span className={styles.overpaidCell}>Overpaid ${Math.abs(q.remaining_balance || 0).toFixed(2)}</span>
                        ) : (
                          <span className={styles.remainingCell}>${Number(q.remaining_balance != null ? q.remaining_balance : q.total).toFixed(2)}</span>
                        )
                      ) : '—'}
                      {(q.has_unsigned_changes || q.status === 'approved' || q.status === 'confirmed' || q.status === 'closed') && q.overpaid && <span className={styles.overpaidBadge}>Overpaid</span>}
                    </td>
                    <td className={styles.colActions}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/quotes/${q.id}`)}>
                        Open
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/quotes/${q.id}`, { state: { autoEdit: true } })}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDuplicateOne(q)}>
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => setConfirmDelete(q)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete._batchIds ? 'Delete selected projects?' : 'Delete project?'}
          message={
            confirmDelete._batchIds
              ? `Delete ${confirmDelete._batchIds.length} project(s)? All items in those projects will be removed.`
              : `Delete project "${confirmDelete.name}"? All items in this project will also be removed.`
          }
          onConfirm={confirmDelete._batchIds ? handleDeleteConfirmBatch : handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
