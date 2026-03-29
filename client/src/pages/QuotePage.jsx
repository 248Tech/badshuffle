import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import QuoteCard from '../components/QuoteCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import { useToast } from '../components/Toast.jsx';
import { syncQuoteNameWithCitySuffix } from '../lib/quoteTitle.js';

const STATUS_BADGE_STYLE = {
  draft:     { background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' },
  sent:      { background: 'var(--color-info-subtle)', color: 'var(--color-info-strong)' },
  approved:  { background: 'var(--color-success-subtle)', color: 'var(--color-success-strong)' },
  confirmed: { background: 'color-mix(in srgb, var(--color-discount) 12%, var(--color-bg))', color: 'var(--color-discount)' },
  closed:    { background: 'var(--color-surface)', color: 'var(--color-text-muted)' },
};

export default function QuotePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '', guest_count: '', event_date: '', event_type: '', notes: '',
    client_first_name: '', client_last_name: '', client_phone: '', client_email: '', client_address: ''
  });
  const [saving, setSaving] = useState(false);
  const [googlePlacesKey, setGooglePlacesKey] = useState('');
  const [eventTypes, setEventTypes] = useState([]);
  const [autoAppendCityTitle, setAutoAppendCityTitle] = useState(false);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState('tiles');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActioning, setBatchActioning] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    event_from: '',
    event_to: '',
    has_balance: false
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
      ...(filters.has_balance && { has_balance: '1' })
    };
    api.getQuotes(params).then(d => setQuotes(d.quotes || [])).finally(() => setLoading(false));
  }, [filters.search, filters.status, filters.event_from, filters.event_to, filters.has_balance]);

  const loadConflicts = useCallback(() => {
    api.getConflicts()
      .then(d => setQuoteIdsWithConflict(new Set((d.conflicts || []).map(c => c.quote_id))))
      .catch((err) => {
        console.error('[QuotePage] Failed to load conflicts; preserving previous conflict state:', err?.message || err);
      });
  }, []);

  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  useEffect(() => {
    let cancelled = false;
    const params = {
      ...(filters.search && { search: filters.search }),
      ...(filters.status && { status: filters.status }),
      ...(filters.event_from && { event_from: filters.event_from }),
      ...(filters.event_to && { event_to: filters.event_to }),
      ...(filters.has_balance && { has_balance: '1' })
    };
    const run = () => {
      setLoading(true);
      api.getQuotes(params)
        .then(d => { if (!cancelled) setQuotes(d.quotes || []); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    const delay = filters.search ? 400 : 0;
    const id = delay ? setTimeout(run, delay) : null;
    if (!delay) run();
    return () => { cancelled = true; if (id) clearTimeout(id); };
  }, [filters.search, filters.status, filters.event_from, filters.event_to, filters.has_balance]);

  const hasActiveFilters = filters.search || filters.status || filters.event_from || filters.event_to || filters.has_balance;
  const clearFilters = () => setFilters({ search: '', status: '', event_from: '', event_to: '', has_balance: false });

  useEffect(() => {
    api.getSettings().then(s => {
      if (s.google_places_api_key) setGooglePlacesKey(s.google_places_api_key);
      setAutoAppendCityTitle(s.quote_auto_append_city_title === '1');
      setEventTypes(
        String(s.quote_event_types || '')
          .split('\n')
          .map(v => v.trim())
          .filter(Boolean)
      );
    }).catch(() => {});
  }, []);

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

  useEffect(() => {
    if (!showNew || !googleScriptLoaded || !addressInputRef.current) return;
    if (autocompleteRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, { types: ['address'] });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place?.formatted_address) {
        setForm(f => ({ ...f, client_address: place.formatted_address }));
      }
    });
    autocompleteRef.current = ac;
    return () => { autocompleteRef.current = null; };
  }, [showNew, googleScriptLoaded]);

  const resetNewForm = () => {
    setShowNew(false);
    setForm({ name: '', guest_count: '', event_date: '', event_type: '', notes: '', client_first_name: '', client_last_name: '', client_phone: '', client_email: '', client_address: '' });
    autocompleteRef.current = null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { quote } = await api.createQuote({
        name: syncQuoteNameWithCitySuffix(
          form.name,
          form.venue_address || form.client_address,
          autoAppendCityTitle
        ),
        guest_count: Number(form.guest_count) || 0,
        event_date: form.event_date || null,
        event_type: form.event_type || null,
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

  const selectClass = 'px-2.5 py-1.5 text-[13px] border border-border rounded-md bg-bg text-text cursor-pointer focus:outline-none focus:border-primary';

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {quotes.length} {hasActiveFilters ? 'matching' : 'saved'} project{quotes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className={selectClass}
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
            className={selectClass}
            value={viewMode}
            onChange={e => setViewMode(e.target.value)}
            aria-label="View mode"
          >
            <option value="tiles">Tile View</option>
            <option value="list">List View</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => showNew ? resetNewForm() : setShowNew(true)}>
            {showNew ? 'Cancel' : '+ New Project'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 bg-bg-elevated rounded-lg">
        <div className="relative flex items-center">
          <svg className="absolute left-2.5 text-text-muted pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="w-44 pl-8 pr-2.5 py-1.5 text-[13px] border border-border rounded-md bg-bg text-text focus:outline-none focus:border-primary"
            placeholder="Search project, client, or venue…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            aria-label="Search by project, client, or venue"
          />
        </div>
        <select
          className={selectClass}
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
        <label className="flex items-center gap-1.5 text-[13px] text-text-muted cursor-pointer whitespace-nowrap">
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

      {/* Batch action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-bg-elevated rounded-lg">
          <span className="text-[13px] text-text-muted mr-1">{selectedCount} selected</span>
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
            className="btn btn-ghost btn-sm text-danger"
            onClick={handleBatchDelete}
          >
            Delete ({selectedCount})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* New project form */}
      {showNew && (
        <div className="card p-5">
          <h3 className="text-[15px] font-bold mb-3.5">New Project</h3>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mt-1 pb-1.5 border-b border-border">
              Event Details
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
                <label htmlFor="qp-name">Event name *</label>
                <input
                  id="qp-name"
                  required
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Smith Wedding — June 2026"
                />
              </div>
              <div className="form-group" style={{ minWidth: 100 }}>
                <label htmlFor="qp-guests">Guest count</label>
                <input
                  id="qp-guests"
                  type="number"
                  min="0"
                  value={form.guest_count}
                  onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))}
                  placeholder="150"
                />
              </div>
              <div className="form-group" style={{ minWidth: 120 }}>
                <label htmlFor="qp-date">Event date</label>
                <input
                  id="qp-date"
                  type="date"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ minWidth: 120 }}>
                <label htmlFor="qp-type">Event type</label>
                <select
                  id="qp-type"
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="qp-notes">Notes</label>
              <textarea
                id="qp-notes"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any relevant details…"
              />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mt-1 pb-1.5 border-b border-border">
              Client Info
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="form-group" style={{ minWidth: 120 }}>
                <label htmlFor="qp-first">First name</label>
                <input
                  id="qp-first"
                  value={form.client_first_name}
                  onChange={e => setForm(f => ({ ...f, client_first_name: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div className="form-group" style={{ minWidth: 120 }}>
                <label htmlFor="qp-last">Last name</label>
                <input
                  id="qp-last"
                  value={form.client_last_name}
                  onChange={e => setForm(f => ({ ...f, client_last_name: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="form-group" style={{ minWidth: 120 }}>
                <label htmlFor="qp-phone">Phone</label>
                <input
                  id="qp-phone"
                  type="tel"
                  value={form.client_phone}
                  onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                  placeholder="555-555-5555"
                />
              </div>
              <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
                <label htmlFor="qp-email">Email</label>
                <input
                  id="qp-email"
                  type="email"
                  value={form.client_email}
                  onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="qp-address">Address</label>
              <input
                id="qp-address"
                ref={addressInputRef}
                value={form.client_address}
                onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))}
                placeholder="123 Main St, City, State"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetNewForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Creating…' : <>Create & Open Project <span aria-hidden="true">→</span></>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Skeleton loading */}
      {loading && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4" aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 flex flex-col gap-2.5" aria-hidden="true">
              <div className="skeleton h-[18px] w-[70%] rounded-md" />
              <div className="skeleton h-[13px] w-[90%] rounded" />
              <div className="skeleton h-[13px] w-[55%] rounded" />
              <div className="flex gap-2 mt-1">
                <div className="skeleton h-[22px] w-16 rounded-full" />
                <div className="skeleton h-[22px] w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && quotes.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>{hasActiveFilters ? 'No projects match your filters.' : 'No projects yet. Create one to get started.'}</p>
          {!hasActiveFilters && (
            <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>
              + New Project
            </button>
          )}
          {hasActiveFilters && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Tile view */}
      {!loading && quotes.length > 0 && viewMode === 'tiles' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
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

      {/* List view */}
      {!loading && quotes.length > 0 && viewMode === 'list' && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-border bg-bg-elevated">
                <th className="w-10 px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">
                  <input
                    type="checkbox"
                    checked={sortedQuotes.length > 0 && selectedIds.size === sortedQuotes.length}
                    onChange={selectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px] whitespace-nowrap">Name</th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">Client</th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">Event date</th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">Guests</th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">Total</th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">Balance</th>
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedQuotes.map(q => {
                const eventDate = q.event_date
                  ? new Date(q.event_date + 'T00:00:00').toLocaleDateString()
                  : '—';
                const clientName = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ');
                const isSelected = selectedIds.has(q.id);
                return (
                  <tr
                    key={q.id}
                    className={`border-b border-border hover:bg-hover transition-colors ${isSelected ? 'bg-primary/10' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(q.id)}
                        aria-label={`Select ${q.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {quoteIdsWithConflict.has(q.id) && (
                        <span className="inline-flex items-center mr-1.5 align-middle" title="Inventory conflict">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#c00" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                    <td className="px-3 py-2.5 text-[13px] text-text-muted whitespace-nowrap">
                      {clientName || <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={STATUS_BADGE_STYLE[q.status || 'draft'] || STATUS_BADGE_STYLE.draft}
                      >
                        {q.status === 'approved' ? 'SIGNED' : (q.status || 'draft').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{eventDate}</td>
                    <td className="px-3 py-2.5">{q.guest_count > 0 ? q.guest_count : '—'}</td>
                    <td className="px-3 py-2.5">
                      {(q.has_unsigned_changes && q.signed_quote_total != null)
                        ? `$${Number(q.signed_quote_total).toFixed(2)}`
                        : (q.total != null && q.total > 0 ? `$${Number(q.total).toFixed(2)}` : '—')}
                    </td>
                    <td className="px-3 py-2.5">
                      {(q.has_unsigned_changes || q.status === 'approved' || q.status === 'confirmed' || q.status === 'closed') && (q.total != null || q.signed_quote_total != null) ? (
                        (() => {
                          const bal = q.has_unsigned_changes && q.signed_remaining_balance != null ? q.signed_remaining_balance : (q.remaining_balance ?? q.total);
                          return bal < 0 ? (
                            <span className="text-warning-strong font-medium">Overpaid ${Math.abs(bal).toFixed(2)}</span>
                          ) : (
                            <span className="text-danger font-medium">${Number(bal).toFixed(2)}</span>
                          );
                        })()
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" className="btn btn-primary btn-sm mr-1" onClick={() => navigate(`/quotes/${q.id}`)}>Open</button>
                      <button type="button" className="btn btn-ghost btn-sm mr-1" onClick={() => navigate(`/quotes/${q.id}`, { state: { autoEdit: true } })}>Edit</button>
                      <button type="button" className="btn btn-ghost btn-sm mr-1" onClick={() => handleDuplicateOne(q)}>Duplicate</button>
                      <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setConfirmDelete(q)}>Delete</button>
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
