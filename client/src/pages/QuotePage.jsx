import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, isAbortError } from '../api.js';
import QuoteCard from '../components/QuoteCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import { useToast } from '../components/Toast.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { syncQuoteNameWithCitySuffix } from '../lib/quoteTitle.js';

const STATUS_BADGE_STYLE = {
  draft:     { background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' },
  sent:      { background: 'var(--color-info-subtle)', color: 'var(--color-info-strong)' },
  approved:  { background: 'var(--color-success-subtle)', color: 'var(--color-success-strong)' },
  confirmed: { background: 'color-mix(in srgb, var(--color-discount) 12%, var(--color-bg))', color: 'var(--color-discount)' },
  closed:    { background: 'var(--color-surface)', color: 'var(--color-text-muted)' },
};

const QUOTE_LIST_COLUMN_KEY = 'quote-list-columns-v1';
const DEFAULT_LIST_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'client', label: 'Client' },
  { key: 'status', label: 'Status' },
  { key: 'event_date', label: 'Event date' },
  { key: 'guests', label: 'Guests' },
  { key: 'total', label: 'Total' },
  { key: 'balance', label: 'Balance' },
];

function sanitizeListColumns(value) {
  const known = new Map(DEFAULT_LIST_COLUMNS.map((column) => [column.key, column]));
  const requested = Array.isArray(value) ? value : [];
  const next = requested
    .filter((column) => column && known.has(column.key))
    .map((column) => ({
      key: column.key,
      visible: column.key === 'name' ? true : column.visible !== false,
    }));
  for (const column of DEFAULT_LIST_COLUMNS) {
    if (!next.some((entry) => entry.key === column.key)) {
      next.push({ key: column.key, visible: column.required ? true : true });
    }
  }
  return next.map((column) => ({
    ...column,
    visible: known.get(column.key)?.required ? true : column.visible !== false,
  }));
}

function parseSortBy(value) {
  const [rawField = 'created', rawDir = 'desc'] = String(value || 'created_desc').split('_');
  const fieldMap = { created: 'created', event: 'event', name: 'name', total: 'total' };
  return {
    sort_by: fieldMap[rawField] || 'created',
    sort_dir: rawDir === 'asc' ? 'asc' : 'desc',
  };
}

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
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
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
  const [page, setPage] = useState(1);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [listColumns, setListColumns] = useState(() => {
    try {
      return sanitizeListColumns(JSON.parse(window.localStorage.getItem(QUOTE_LIST_COLUMN_KEY) || 'null'));
    } catch {
      return sanitizeListColumns(null);
    }
  });
  const pageSize = 24;
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const columnsPanelRef = useRef(null);

  const buildQuoteParams = useCallback((pageOverride = page) => {
    const sort = parseSortBy(sortBy);
    return {
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(filters.status && { status: filters.status }),
      ...(filters.event_from && { event_from: filters.event_from }),
      ...(filters.event_to && { event_to: filters.event_to }),
      ...(filters.has_balance && { has_balance: '1' }),
      page: pageOverride,
      limit: pageSize,
      ...sort,
    };
  }, [debouncedSearch, filters.status, filters.event_from, filters.event_to, filters.has_balance, page, sortBy]);

  const applyQuoteResponse = useCallback((d, requestedPage = page) => {
    setQuotes(d.quotes || []);
    setTotalQuotes(Number(d.total || 0));
    const nextPages = Math.max(1, Number(d.pages || 1));
    if (requestedPage > nextPages) {
      setPage(nextPages);
    }
  }, [page]);

  const load = useCallback((pageOverride = page) => {
    setLoading(true);
    return api.getQuotes(buildQuoteParams(pageOverride))
      .then((d) => applyQuoteResponse(d, pageOverride))
      .finally(() => setLoading(false));
  }, [applyQuoteResponse, buildQuoteParams, page]);

  const loadConflicts = useCallback(() => {
    api.getConflicts()
      .then(d => setQuoteIdsWithConflict(new Set((d.conflicts || []).map(c => c.quote_id))))
      .catch((err) => {
        console.error('[QuotePage] Failed to load conflicts; preserving previous conflict state:', err?.message || err);
      });
  }, []);

  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, filters.status, filters.event_from, filters.event_to, filters.has_balance, sortBy]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.getQuotes(buildQuoteParams(), { signal: controller.signal, dedupeKey: 'quotes:list', cancelPrevious: true })
      .then(d => {
        applyQuoteResponse(d, page);
      })
      .catch((err) => {
        if (!isAbortError(err)) console.error('[QuotePage] Failed to load quotes:', err?.message || err);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
    };
  }, [applyQuoteResponse, buildQuoteParams, page]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, viewMode]);

  useEffect(() => {
    window.localStorage.setItem(QUOTE_LIST_COLUMN_KEY, JSON.stringify(listColumns));
  }, [listColumns]);

  useEffect(() => {
    if (!showColumnsPanel) return undefined;
    const handlePointerDown = (event) => {
      if (!columnsPanelRef.current?.contains(event.target)) {
        setShowColumnsPanel(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [showColumnsPanel]);

  const hasActiveFilters = filters.search || filters.status || filters.event_from || filters.event_to || filters.has_balance;
  const clearFilters = () => setFilters({ search: '', status: '', event_from: '', event_to: '', has_balance: false });
  const extraFilterCount = [filters.status, filters.event_from || filters.event_to, filters.has_balance].filter(Boolean).length;

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
    const allVisibleSelected = quotes.length > 0 && quotes.every(q => selectedIds.has(q.id));
    if (allVisibleSelected) setSelectedIds(new Set());
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

  const openPullSheetExport = (mode = 'aggregate') => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    navigate(`/quotes/pull-sheets/export?mode=${mode}&ids=${ids.join(',')}`);
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
  const totalPages = Math.max(1, Math.ceil(totalQuotes / pageSize));
  const allVisibleSelected = quotes.length > 0 && quotes.every((q) => selectedIds.has(q.id));
  const visibleListColumns = useMemo(() => {
    const defs = new Map(DEFAULT_LIST_COLUMNS.map((column) => [column.key, column]));
    return listColumns
      .filter((column) => column.visible)
      .map((column) => defs.get(column.key))
      .filter(Boolean);
  }, [listColumns]);

  const sel = 'px-2.5 py-1.5 text-[13px] border border-border rounded-md bg-bg text-text cursor-pointer focus:outline-none focus:border-primary';

  const toggleListColumn = (key) => {
    setListColumns((prev) => {
      const next = prev.map((column) => {
        if (column.key !== key) return column;
        if (DEFAULT_LIST_COLUMNS.find((item) => item.key === key)?.required) {
          return { ...column, visible: true };
        }
        return { ...column, visible: !column.visible };
      });
      if (!next.some((column) => column.visible)) {
        return prev;
      }
      return next;
    });
  };

  const moveListColumn = (key, direction) => {
    setListColumns((prev) => {
      const index = prev.findIndex((column) => column.key === key);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [column] = next.splice(index, 1);
      next.splice(targetIndex, 0, column);
      return next;
    });
  };

  const renderListCell = (quote, columnKey) => {
    const eventDate = quote.event_date
      ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
      : '—';
    const clientName = [quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ');
    if (columnKey === 'name') {
      return (
        <td className="px-3 py-2.5 whitespace-nowrap">
          {quoteIdsWithConflict.has(quote.id) && (
            <span className="inline-flex items-center mr-1.5 align-middle" title="Inventory conflict">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#c00" stroke="#8b0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
                <line x1="12" y1="8" x2="12" y2="13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="1.1" fill="#fff" stroke="none" />
              </svg>
            </span>
          )}
          <button type="button" className="link" onClick={() => navigate(`/quotes/${quote.id}`)}>
            {quote.name}
          </button>
        </td>
      );
    }
    if (columnKey === 'client') {
      return (
        <td className="px-3 py-2.5 text-[13px] text-text-muted whitespace-nowrap">
          {clientName || <span className="opacity-40">—</span>}
        </td>
      );
    }
    if (columnKey === 'status') {
      return (
        <td className="px-3 py-2.5">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={STATUS_BADGE_STYLE[quote.status || 'draft'] || STATUS_BADGE_STYLE.draft}
          >
            {quote.status === 'approved' ? 'SIGNED' : (quote.status || 'draft').toUpperCase()}
          </span>
        </td>
      );
    }
    if (columnKey === 'event_date') {
      return <td className="px-3 py-2.5 whitespace-nowrap">{eventDate}</td>;
    }
    if (columnKey === 'guests') {
      return <td className="px-3 py-2.5 whitespace-nowrap">{quote.guest_count > 0 ? quote.guest_count : '—'}</td>;
    }
    if (columnKey === 'total') {
      return (
        <td className="px-3 py-2.5 whitespace-nowrap">
          {(quote.has_unsigned_changes && quote.signed_quote_total != null)
            ? `$${Number(quote.signed_quote_total).toFixed(2)}`
            : (quote.total != null && quote.total > 0 ? `$${Number(quote.total).toFixed(2)}` : '—')}
        </td>
      );
    }
    if (columnKey === 'balance') {
      return (
        <td className="px-3 py-2.5 whitespace-nowrap">
          {(quote.has_unsigned_changes || quote.status === 'approved' || quote.status === 'confirmed' || quote.status === 'closed') && (quote.total != null || quote.signed_quote_total != null) ? (
            (() => {
              const bal = quote.has_unsigned_changes && quote.signed_remaining_balance != null ? quote.signed_remaining_balance : (quote.remaining_balance ?? quote.total);
              return bal < 0
                ? <span className="font-medium" style={{ color: 'var(--color-warning-strong)' }}>Overpaid ${Math.abs(bal).toFixed(2)}</span>
                : <span className="font-medium" style={{ color: 'var(--color-danger)' }}>${Number(bal).toFixed(2)}</span>;
            })()
          ) : '—'}
        </td>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {totalQuotes} {hasActiveFilters ? 'matching' : 'total'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Desktop-only controls */}
          <select className={`${sel} hidden sm:block`} value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort order">
            <option value="created_desc">Newest</option>
            <option value="created_asc">Oldest</option>
            <option value="event_asc">Event ↑</option>
            <option value="event_desc">Event ↓</option>
            <option value="name_asc">Name A→Z</option>
            <option value="name_desc">Name Z→A</option>
            <option value="total_desc">Total ↓</option>
            <option value="total_asc">Total ↑</option>
          </select>
          <select className={`${sel} hidden sm:block`} value={viewMode} onChange={e => setViewMode(e.target.value)} aria-label="View mode">
            <option value="tiles">Tiles</option>
            <option value="list">List</option>
          </select>
          <div className="relative hidden sm:block" ref={columnsPanelRef}>
            <button
              type="button"
              className={`${sel} ${viewMode === 'list' ? '' : 'opacity-50'}`}
              onClick={() => {
                if (viewMode !== 'list') return;
                setShowColumnsPanel((open) => !open);
              }}
              aria-expanded={showColumnsPanel}
              disabled={viewMode !== 'list'}
            >
              Columns
            </button>
            {showColumnsPanel && viewMode === 'list' && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[280px] rounded-xl border border-border bg-bg shadow-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div>
                    <h3 className="text-[13px] font-semibold text-text">Project columns</h3>
                    <p className="text-[12px] text-text-muted">Show, hide, and reorder the list view.</p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setListColumns(sanitizeListColumns(null))}>
                    Reset
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {listColumns.map((column, index) => {
                    const meta = DEFAULT_LIST_COLUMNS.find((entry) => entry.key === column.key);
                    return (
                      <div key={column.key} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                        <label className="flex items-center gap-2 min-w-0 flex-1 text-[13px] text-text">
                          <input
                            type="checkbox"
                            checked={column.visible}
                            disabled={meta?.required}
                            onChange={() => toggleListColumn(column.key)}
                          />
                          <span className="truncate">{meta?.label || column.key}</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => moveListColumn(column.key, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${meta?.label || column.key} left`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => moveListColumn(column.key, 1)}
                            disabled={index === listColumns.length - 1}
                            aria-label={`Move ${meta?.label || column.key} right`}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-primary whitespace-nowrap" onClick={() => showNew ? resetNewForm() : setShowNew(true)}>
            {showNew ? 'Cancel' : '+ New'}
          </button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────── */}
      <div className="bg-bg-elevated rounded-lg p-3 flex flex-col gap-2.5">
        {/* Always-visible row: search + mobile extras */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 flex items-center min-w-0">
            <svg className="absolute left-2.5 text-text-muted pointer-events-none shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="w-full pl-8 pr-2.5 py-1.5 text-[13px] border border-border rounded-md bg-bg text-text focus:outline-none focus:border-primary"
              placeholder="Search project, client…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              aria-label="Search"
            />
          </div>

          {/* Mobile: filters toggle + sort */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            <select className={sel} value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort order">
              <option value="created_desc">New</option>
              <option value="created_asc">Old</option>
              <option value="event_asc">Event ↑</option>
              <option value="event_desc">Event ↓</option>
              <option value="name_asc">A→Z</option>
              <option value="total_desc">$↓</option>
            </select>
            <button
              type="button"
              className={`relative px-3 py-1.5 text-[13px] border rounded-md cursor-pointer transition-colors whitespace-nowrap ${showFiltersPanel || extraFilterCount > 0 ? 'border-primary bg-primary text-white' : 'border-border bg-bg text-text'}`}
              onClick={() => setShowFiltersPanel(v => !v)}
              aria-expanded={showFiltersPanel}
            >
              Filters
              {extraFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {extraFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop: always visible. Mobile: only when showFiltersPanel */}
        <div className={`flex flex-wrap items-center gap-2 ${showFiltersPanel ? 'flex' : 'hidden sm:flex'}`}>
          <select
            className={sel}
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
            placeholder="Event date"
          />
          <label className="flex items-center gap-1.5 text-[13px] text-text-muted cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={filters.has_balance}
              onChange={e => setFilters(f => ({ ...f, has_balance: e.target.checked }))}
            />
            Outstanding balance
          </label>
          {hasActiveFilters && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear
            </button>
          )}
          {quotes.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>
              {allVisibleSelected ? 'Clear visible selection' : 'Select all visible'}
            </button>
          )}
        </div>
      </div>

      {/* ── Batch action bar ──────────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-bg-elevated rounded-lg flex-wrap">
          <span className="text-[13px] text-text-muted">{selectedCount} selected</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openPullSheetExport('aggregate')}>
            Combined pull
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openPullSheetExport('individual')}>
            Export pull sheets
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={batchActioning} onClick={handleBatchDuplicate}>
            Duplicate
          </button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={handleBatchDelete}>
            Delete
          </button>
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {/* ── New project form ──────────────────────────────────────── */}
      {showNew && (
        <div className="card p-4 sm:p-5">
          <h3 className="text-[15px] font-bold mb-3.5">New Project</h3>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted pb-1.5 border-b border-border">
              Event Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="form-group sm:col-span-2">
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
              <div className="form-group">
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
              <div className="form-group">
                <label htmlFor="qp-date">Event date</label>
                <input
                  id="qp-date"
                  type="date"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
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
              <div className="form-group">
                <label htmlFor="qp-notes">Notes</label>
                <input
                  id="qp-notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any relevant details…"
                />
              </div>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted pb-1.5 border-b border-border mt-1">
              Client Info
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="form-group">
                <label htmlFor="qp-first">First name</label>
                <input
                  id="qp-first"
                  value={form.client_first_name}
                  onChange={e => setForm(f => ({ ...f, client_first_name: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div className="form-group">
                <label htmlFor="qp-last">Last name</label>
                <input
                  id="qp-last"
                  value={form.client_last_name}
                  onChange={e => setForm(f => ({ ...f, client_last_name: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
              <div className="form-group">
                <label htmlFor="qp-phone">Phone</label>
                <input
                  id="qp-phone"
                  type="tel"
                  value={form.client_phone}
                  onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                  placeholder="555-555-5555"
                />
              </div>
              <div className="form-group">
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
                {saving ? 'Creating…' : 'Create & Open →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-busy="true" aria-label="Loading projects">
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

      {/* ── Empty state ───────────────────────────────────────────── */}
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

      {/* ── Tile view — always on mobile, hidden on desktop when list mode ── */}
      {!loading && quotes.length > 0 && (
        <div className={viewMode === 'list' ? 'sm:hidden' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {quotes.map(q => (
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
        </div>
      )}

      {/* ── List view (desktop only, hidden on mobile) ────────────── */}
      {!loading && quotes.length > 0 && viewMode === 'list' && (
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-border bg-bg-elevated">
                <th className="w-10 px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]">
                  <input
                    type="checkbox"
                    checked={quotes.length > 0 && quotes.every(q => selectedIds.has(q.id))}
                    onChange={selectAll}
                    aria-label="Select all"
                  />
                </th>
                {visibleListColumns.map((column) => (
                  <th key={column.key} className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px] whitespace-nowrap">
                    {column.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left font-semibold text-text-muted text-[13px]"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => {
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
                    {visibleListColumns.map((column) => (
                      <React.Fragment key={column.key}>
                        {renderListCell(q, column.key)}
                      </React.Fragment>
                    ))}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" className="btn btn-primary btn-sm mr-1" onClick={() => navigate(`/quotes/${q.id}`)}>Open</button>
                      <button type="button" className="btn btn-ghost btn-sm mr-1" onClick={() => handleDuplicateOne(q)}>Dup.</button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => setConfirmDelete(q)}>Del.</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] text-text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <span aria-hidden="true">←</span> Prev
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next <span aria-hidden="true">→</span>
            </button>
          </div>
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
