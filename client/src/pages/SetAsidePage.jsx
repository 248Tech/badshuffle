import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './InventoryPage.module.css';

function iconForReason(code) {
  switch (code) {
    case 'repair': return '🛠';
    case 'damage': return '⚠';
    case 'hold_for_client': return '🔖';
    case 'missing': return '🔍';
    case 'cleaning': return '🧼';
    default: return '•';
  }
}

export default function SetAsidePage() {
  const toast = useToast();
  const location = useLocation();
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const preselectedItemId = search.get('item_id');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [items, setItems] = useState([]);
  const [data, setData] = useState({ reasons: [], records: [] });
  const [form, setForm] = useState({ item_id: preselectedItemId || '', quantity: '1', reason_code: 'repair', reason_note: '', related_quote_id: '', related_quote_label: '' });

  async function load() {
    setLoading(true);
    try {
      const [records, inventory] = await Promise.all([
        api.getSetAsides(),
        api.getItems({ limit: 500 }),
      ]);
      setData(records);
      setItems(inventory.items || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.item_id) {
      toast.error('Choose an item first');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        quantity: Number(form.quantity || 0),
        reason_code: form.reason_code,
        reason_note: form.reason_note,
        related_quote_id: form.related_quote_id || null,
        related_quote_label: form.related_quote_label || null,
      };
      if (editingRecordId) {
        await api.updateSetAside(editingRecordId, payload);
        toast.success('Set aside updated');
      } else {
        await api.createSetAside(form.item_id, payload);
        toast.success('Item set aside');
      }
      setEditingRecordId(null);
      setForm((current) => ({ ...current, item_id: preselectedItemId || '', quantity: '1', reason_code: 'repair', reason_note: '', related_quote_id: '', related_quote_label: '' }));
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(record) {
    setEditingRecordId(record.id);
    setForm({
      item_id: String(record.item_id),
      quantity: String(record.quantity),
      reason_code: record.reason_code,
      reason_note: record.reason_note || '',
      related_quote_id: record.related_quote_id ? String(record.related_quote_id) : '',
      related_quote_label: record.related_quote_label || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleResolve(record) {
    const quantity = window.prompt(`How many "${record.item_title}" should be resolved?`, String(record.quantity));
    if (!quantity) return;
    const resolutionReason = window.prompt('Resolution reason');
    if (!resolutionReason) return;
    const disposition = window.confirm('Return these items to inventory? Click Cancel to remove them from inventory.') ? 'return_to_inventory' : 'remove_from_inventory';
    try {
      await api.resolveSetAside(record.id, {
        quantity: Number(quantity),
        resolution_reason: resolutionReason,
        disposition,
      });
      toast.success('Set aside resolved');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Set Aside</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Temporarily remove inventory from availability until it is returned or resolved.</p>
        </div>
        <Link to="/inventory" className="btn btn-ghost btn-sm">Back To Inventory</Link>
      </div>

      <div className="card p-5">
        <h3 className="text-[15px] font-bold mb-3.5">Mark Item As Set Aside</h3>
        <form onSubmit={handleSubmit} className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="form-group">
            <label htmlFor="sa-item">Item</label>
            <select id="sa-item" value={form.item_id} disabled={!!editingRecordId} onChange={(e) => setForm((current) => ({ ...current, item_id: e.target.value }))}>
              <option value="">Choose an item…</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="sa-qty">Quantity</label>
            <input id="sa-qty" type="number" min="1" value={form.quantity} onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="sa-reason">Reason</label>
            <select id="sa-reason" value={form.reason_code} onChange={(e) => setForm((current) => ({ ...current, reason_code: e.target.value }))}>
              {(data.reasons || []).map((reason) => <option key={reason.code} value={reason.code}>{reason.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="sa-related-quote-id">Related Project ID</label>
            <input id="sa-related-quote-id" value={form.related_quote_id} onChange={(e) => setForm((current) => ({ ...current, related_quote_id: e.target.value }))} placeholder="Optional project id" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="sa-related-quote-label">Related Project Label</label>
            <input id="sa-related-quote-label" value={form.related_quote_label} onChange={(e) => setForm((current) => ({ ...current, related_quote_label: e.target.value }))} placeholder="Optional project name override" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="sa-note">Reason Note</label>
            <textarea id="sa-note" rows={3} value={form.reason_note} onChange={(e) => setForm((current) => ({ ...current, reason_note: e.target.value }))} />
          </div>
          <div className="flex justify-end" style={{ gridColumn: '1 / -1' }}>
            <div className="flex gap-2">
              {editingRecordId ? <button type="button" className="btn btn-ghost" onClick={() => {
                setEditingRecordId(null);
                setForm({ item_id: preselectedItemId || '', quantity: '1', reason_code: 'repair', reason_note: '', related_quote_id: '', related_quote_label: '' });
              }}>Cancel</button> : null}
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editingRecordId ? 'Save Changes' : 'Set Aside'}</button>
            </div>
          </div>
        </form>
      </div>

      <div className="card p-5">
        <h3 className="text-[15px] font-bold mb-3.5">Active Set Aside Items</h3>
        {loading ? <div className="empty-state">Loading set aside items…</div> : null}
        {!loading && data.records.length === 0 ? <div className="empty-state">No active set aside items.</div> : null}
        {!loading && data.records.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.records.map((record) => (
              <article key={record.id} className="border border-border rounded-xl p-4 bg-surface flex gap-4 flex-wrap items-start">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-bg shrink-0">
                  <img
                    src={record.item_photo_url ? api.proxyImageUrl(record.item_photo_url, { variant: 'thumb' }) : '/placeholder.png'}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="font-semibold">{record.item_title}</div>
                  <div className="text-sm text-text-muted mt-1">{iconForReason(record.reason_code)} {record.reason_code.replace(/_/g, ' ')} · Qty {record.quantity}</div>
                  {record.reason_note ? <div className="text-sm text-text-muted mt-1">{record.reason_note}</div> : null}
                  <div className="text-sm text-text-muted mt-1">Project: {record.related_quote_label || (record.related_quote_id ? `#${record.related_quote_id}` : 'None')}</div>
                  <div className="text-sm text-text-muted mt-1">Created: {record.created_at} · By: {record.created_by_name || 'Unknown'}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleEdit(record)}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleResolve(record)}>Resolve</button>
                  {record.related_quote_id ? <Link to={`/quotes/${record.related_quote_id}`} className="btn btn-ghost btn-sm">Project</Link> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
