import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import QuoteBuilder from '../components/QuoteBuilder.jsx';
import QuoteExport from '../components/QuoteExport.jsx';
import AISuggestModal from '../components/AISuggestModal.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuoteDetailPage.module.css';

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const load = useCallback(() => {
    api.getQuote(id)
      .then(data => {
        setQuote(data);
        setForm({
          name: data.name,
          guest_count: data.guest_count || '',
          event_date: data.event_date || '',
          notes: data.notes || ''
        });
      })
      .catch(() => navigate('/quotes'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateQuote(id, {
        name: form.name,
        guest_count: Number(form.guest_count) || 0,
        event_date: form.event_date || null,
        notes: form.notes || null
      });
      toast.success('Quote updated');
      setEditing(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAIAdd = async (item) => {
    try {
      await api.addQuoteItem(id, { item_id: item.id });
      toast.success(`Added ${item.title}`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (!quote) return null;

  const date = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/quotes')}>
          ← Quotes
        </button>
        <div className={styles.topActions}>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(v => !v)}>
            {editing ? 'Cancel Edit' : '✏️ Edit'}
          </button>
          <button
            className="btn btn-accent btn-sm"
            onClick={() => setShowAI(true)}
          >
            ✨ AI Suggest
          </button>
        </div>
      </div>

      {editing ? (
        <div className={`card ${styles.editCard}`}>
          <form onSubmit={handleSaveEdit} className={styles.form}>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Event name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Guest count</label>
                <input type="number" min="0" value={form.guest_count}
                  onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Event date</label>
                <input type="date" value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.quoteHeader}>
          <h1 className={styles.title}>{quote.name}</h1>
          <div className={styles.meta}>
            {date && <span className={styles.metaTag}>📅 {date}</span>}
            {quote.guest_count > 0 && (
              <span className={styles.metaTag}>👥 {quote.guest_count} guests</span>
            )}
            <span className={styles.metaTag}>
              {(quote.items || []).length} items
            </span>
          </div>
          {quote.notes && <p className={styles.notes}>{quote.notes}</p>}
        </div>
      )}

      <div className={styles.columns}>
        <div className={styles.builderCol}>
          <QuoteBuilder
            quoteId={id}
            items={quote.items}
            onItemsChange={load}
          />
        </div>
        <div className={styles.exportCol}>
          <div className={`card ${styles.exportCard}`}>
            <h3 className={styles.exportTitle}>Export</h3>
            <QuoteExport quote={quote} />
          </div>
        </div>
      </div>

      {showAI && (
        <AISuggestModal
          quoteId={id}
          guestCount={quote.guest_count || 0}
          currentItems={quote.items || []}
          onAdd={handleAIAdd}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
}
