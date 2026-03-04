import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import QuoteBuilder from '../components/QuoteBuilder.jsx';
import QuoteExport from '../components/QuoteExport.jsx';
import AISuggestModal from '../components/AISuggestModal.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuoteDetailPage.module.css';

const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');

function computeTotals(items, taxRate) {
  const list = items || [];
  const equipment = list.filter(it => !isLogistics(it));
  const logistics = list.filter(it => isLogistics(it));
  const subtotal = equipment.reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const deliveryTotal = logistics.reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const taxableEquipment = equipment.filter(it => it.taxable !== 0).reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const taxableDelivery = logistics.filter(it => it.taxable !== 0).reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const rate = parseFloat(taxRate) || 0;
  const tax = (taxableEquipment + taxableDelivery) * (rate / 100);
  const grandTotal = subtotal + deliveryTotal + tax;
  return { subtotal, deliveryTotal, tax, total: grandTotal, rate };
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
          notes: data.notes || '',
          venue_name: data.venue_name || '',
          venue_email: data.venue_email || '',
          venue_phone: data.venue_phone || '',
          venue_address: data.venue_address || '',
          venue_contact: data.venue_contact || '',
          venue_notes: data.venue_notes || '',
          quote_notes: data.quote_notes || '',
          tax_rate: data.tax_rate != null ? data.tax_rate : ''
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
        notes: form.notes || null,
        venue_name: form.venue_name || null,
        venue_email: form.venue_email || null,
        venue_phone: form.venue_phone || null,
        venue_address: form.venue_address || null,
        venue_contact: form.venue_contact || null,
        venue_notes: form.venue_notes || null,
        quote_notes: form.quote_notes || null,
        tax_rate: form.tax_rate === '' ? null : parseFloat(form.tax_rate)
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

  const taxRate = quote.tax_rate != null ? quote.tax_rate : settings.tax_rate;
  const totals = computeTotals(quote.items, taxRate);
  const logisticsItems = (quote.items || []).filter(it => (it.category || '').toLowerCase().includes('logistics'));

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
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Venue information</h4>
              <div className={styles.formRow}>
                <div className="form-group"><label>Name</label><input value={form.venue_name || ''} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))} /></div>
                <div className="form-group"><label>Email</label><input type="email" value={form.venue_email || ''} onChange={e => setForm(f => ({ ...f, venue_email: e.target.value }))} /></div>
                <div className="form-group"><label>Phone</label><input value={form.venue_phone || ''} onChange={e => setForm(f => ({ ...f, venue_phone: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label>Address</label><input value={form.venue_address || ''} onChange={e => setForm(f => ({ ...f, venue_address: e.target.value }))} /></div>
              <div className={styles.formRow}>
                <div className="form-group"><label>Contact</label><input value={form.venue_contact || ''} onChange={e => setForm(f => ({ ...f, venue_contact: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label>Venue notes</label><textarea rows={2} value={form.venue_notes || ''} onChange={e => setForm(f => ({ ...f, venue_notes: e.target.value }))} /></div>
            </div>
            <div className="form-group">
              <label>Quote notes</label>
              <textarea rows={2} value={form.quote_notes || ''} onChange={e => setForm(f => ({ ...f, quote_notes: e.target.value }))} placeholder="Internal or client-facing notes for this quote" />
            </div>
            <div className="form-group">
              <label>Tax rate (%)</label>
              <input type="number" min="0" step="0.01" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} placeholder="From settings if blank" />
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

          {(quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address || quote.venue_contact || quote.venue_notes) && (
            <div className={styles.venueBlock}>
              <h4 className={styles.venueTitle}>Venue information</h4>
              <div className={styles.venueGrid}>
                {quote.venue_name && <span><strong>Name:</strong> {quote.venue_name}</span>}
                {quote.venue_email && <span><strong>Email:</strong> {quote.venue_email}</span>}
                {quote.venue_phone && <span><strong>Phone:</strong> {quote.venue_phone}</span>}
                {quote.venue_address && <span><strong>Address:</strong> {quote.venue_address}</span>}
                {quote.venue_contact && <span><strong>Contact:</strong> {quote.venue_contact}</span>}
                {quote.venue_notes && <span><strong>Notes:</strong> {quote.venue_notes}</span>}
              </div>
            </div>
          )}
          {quote.quote_notes && <p className={styles.notes}><strong>Quote notes:</strong> {quote.quote_notes}</p>}

          {logisticsItems.length > 0 && (
            <div className={styles.logisticsBlock}>
              <h4 className={styles.logisticsTitle}>Logistics (delivery / pickup)</h4>
              <ul className={styles.logisticsList}>
                {logisticsItems.map(it => (
                  <li key={it.qitem_id}>{it.label || it.title} ×{it.quantity || 1} {it.unit_price > 0 ? `$${(it.unit_price * (it.quantity || 1)).toFixed(2)}` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {(totals.subtotal > 0 || totals.deliveryTotal > 0) && (
            <div className={styles.totalsBar}>
              {totals.subtotal > 0 && <span>Subtotal: <strong>${totals.subtotal.toFixed(2)}</strong></span>}
              {totals.deliveryTotal > 0 && <span>Delivery: <strong>${totals.deliveryTotal.toFixed(2)}</strong></span>}
              {totals.rate > 0 && <span>Tax ({totals.rate}%): <strong>${totals.tax.toFixed(2)}</strong></span>}
              <span className={styles.total}>Grand total: <strong>${totals.total.toFixed(2)}</strong></span>
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
