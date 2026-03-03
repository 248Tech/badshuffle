import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import QuoteCard from '../components/QuoteCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuotePage.module.css';

export default function QuotePage() {
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', guest_count: '', event_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

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
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Quotes</h1>
          <p className={styles.sub}>{quotes.length} saved quotes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Cancel' : '+ New Quote'}
        </button>
      </div>

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

      <div className={styles.grid}>
        {quotes.map(q => (
          <QuoteCard key={q.id} quote={q} onDelete={setConfirmDelete} />
        ))}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete quote "${confirmDelete.name}"? All items in this quote will also be removed.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
