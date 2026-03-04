import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import QuoteBuilder from '../components/QuoteBuilder.jsx';
import QuoteExport from '../components/QuoteExport.jsx';
import AISuggestModal from '../components/AISuggestModal.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuoteDetailPage.module.css';

function computeTotals(items, taxRate) {
  const subtotal = (items || []).reduce((sum, it) => {
    const price = (it.unit_price || 0) * (it.quantity || 1);
    return sum + price;
  }, 0);
  const taxableSubtotal = (items || []).reduce((sum, it) => {
    if (it.taxable === 0) return sum;
    return sum + (it.unit_price || 0) * (it.quantity || 1);
  }, 0);
  const rate = parseFloat(taxRate) || 0;
  const tax = taxableSubtotal * (rate / 100);
  return { subtotal, tax, total: subtotal + tax, rate };
}

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [quote, setQuote] = useState(null);
  const [settings, setSettings] = useState({});
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
  useEffect(() => {
    api.getSettings().then(s => setSettings(s)).catch(() => {});
  }, []);

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

  const handleSend = async () => {
    try {
      await api.sendQuote(id);
      toast.success('Quote sent; client link ready.');
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

  const totals = computeTotals(quote.items, settings.tax_rate);

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
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{quote.name}</h1>
            <span className={`${styles.badge} ${styles['badge_' + (quote.status || 'draft')]}`}>
              {quote.status || 'draft'}
            </span>
          </div>
          <div className={styles.quoteActions}>
            {quote.status === 'draft' && (
              <button type="button" onClick={handleSend} className={`btn btn-primary btn-sm ${styles.btnSend}`}>
                Send to Client
              </button>
            )}
            {quote.public_token && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const url = `${window.location.origin}/quote/public/${quote.public_token}`;
                  navigator.clipboard.writeText(url);
                  toast.success('Client link copied to clipboard');
                }}
              >
                Copy Client Link
              </button>
            )}
          </div>
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

          {totals.subtotal > 0 && (
            <div className={styles.totalsBar}>
              <span>Subtotal: <strong>${totals.subtotal.toFixed(2)}</strong></span>
              {totals.rate > 0 && <span>Tax ({totals.rate}%): <strong>${totals.tax.toFixed(2)}</strong></span>}
              {totals.rate > 0 && <span className={styles.total}>Total: <strong>${totals.total.toFixed(2)}</strong></span>}
            </div>
          )}
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
            <QuoteExport quote={quote} settings={settings} totals={totals} />
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
