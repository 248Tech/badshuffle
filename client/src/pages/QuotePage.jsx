import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import QuoteCard from '../components/QuoteCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuotePage.module.css';

export default function QuotePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', guest_count: '', event_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState('tiles'); // 'tiles' | 'list'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActioning, setBatchActioning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getQuotes().then(d => setQuotes(d.quotes || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createQuote({
        name: form.name,
        guest_count: Number(form.guest_count) || 0,
        event_date: form.event_date || null,
        notes: form.notes || null
      });
      toast.success('Quote created');
      setShowNew(false);
      setForm({ name: '', guest_count: '', event_date: '', notes: '' });
      load();
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
      toast.info(`Deleted quote "${confirmDelete.name}"`);
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
      toast.success('Quote duplicated');
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
      toast.success(`${ids.length} quote(s) duplicated`);
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
    setConfirmDelete(ids.length === 1 ? first : { id: 'batch', name: `${ids.length} selected quotes`, _batchIds: ids });
  };

  const handleDeleteConfirmBatch = async () => {
    const batch = confirmDelete?._batchIds;
    if (!batch?.length) return handleDeleteConfirm();
    try {
      for (const id of batch) {
        await api.deleteQuote(id);
      }
      toast.info(`Deleted ${batch.length} quote(s)`);
      setSelectedIds(new Set());
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Quotes</h1>
          <p className={styles.sub}>{quotes.length} saved quotes</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
            >
              List
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${viewMode === 'tiles' ? 'active' : ''}`}
              onClick={() => setViewMode('tiles')}
              aria-pressed={viewMode === 'tiles'}
            >
              Tiles
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(v => !v)}>
            {showNew ? 'Cancel' : '+ New Quote'}
          </button>
        </div>
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
          <h3 className={styles.formTitle}>New Quote</h3>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Event name *</label>
                <input
                  required
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
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Creating…' : 'Create Quote →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <div className="spinner" />
          Loading quotes…
        </div>
      )}

      {!loading && quotes.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>No quotes yet. Create one to get started.</p>
        </div>
      )}

      {!loading && quotes.length > 0 && viewMode === 'tiles' && (
        <div className={styles.grid}>
          {quotes.map(q => (
            <QuoteCard
              key={q.id}
              quote={q}
              total={q.total}
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
                    checked={quotes.length > 0 && selectedIds.size === quotes.length}
                    onChange={selectAll}
                    aria-label="Select all"
                  />
                </th>
                <th>Name</th>
                <th>Event date</th>
                <th>Guests</th>
                <th>Contract total</th>
                <th className={styles.colActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => {
                const eventDate = q.event_date
                  ? new Date(q.event_date + 'T00:00:00').toLocaleDateString()
                  : '—';
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
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={() => navigate(`/quotes/${q.id}`)}
                      >
                        {q.name}
                      </button>
                    </td>
                    <td>{eventDate}</td>
                    <td>{q.guest_count > 0 ? q.guest_count : '—'}</td>
                    <td>{q.total != null && q.total > 0 ? `$${Number(q.total).toFixed(2)}` : '—'}</td>
                    <td className={styles.colActions}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/quotes/${q.id}`)}>
                        Open
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
          title={confirmDelete._batchIds ? 'Delete selected quotes?' : 'Delete quote?'}
          message={
            confirmDelete._batchIds
              ? `Delete ${confirmDelete._batchIds.length} quote(s)? All items in those quotes will be removed.`
              : `Delete quote "${confirmDelete.name}"? All items in this quote will also be removed.`
          }
          onConfirm={confirmDelete._batchIds ? handleDeleteConfirmBatch : handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
