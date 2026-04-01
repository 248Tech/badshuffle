import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const EMPTY_FORM = { name: '', email: '', phone: '', address: '', notes: '' };

export default function VendorsPage() {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    api.getVendors()
      .then(d => setVendors(d.vendors || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (v) => {
    setEditId(v.id);
    setForm({ name: v.name || '', email: v.email || '', phone: v.phone || '', address: v.address || '', notes: v.notes || '' });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await api.updateVendor(editId, form);
        toast.success('Vendor updated');
      } else {
        await api.createVendor(form);
        toast.success('Vendor created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteVendor(id);
      setVendors(v => v.filter(x => x.id !== id));
      toast.info('Vendor deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Suppliers for subrental items.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ Add Vendor</button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading vendors">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-start gap-4" aria-hidden="true">
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="skeleton h-4 rounded" style={{ width: `${40 + (i % 3) * 15}%` }} />
                <div className="skeleton h-3 rounded" style={{ width: `${30 + (i % 2) * 20}%` }} />
              </div>
              <div className="flex gap-2">
                <div className="skeleton h-[30px] w-12 rounded-md" />
                <div className="skeleton h-[30px] w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="empty-state">
          <p>No vendors yet. Add one to assign subrental items to suppliers.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {vendors.map(v => (
            <div key={v.id} className="card p-4 sm:p-5 flex items-start gap-4">
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <span className="text-[15px] font-semibold">{v.name}</span>
                {v.email && <span className="text-[13px] text-text-muted">{v.email}</span>}
                {v.phone && <span className="text-[13px] text-text-muted">{v.phone}</span>}
                {v.address && <span className="text-[13px] text-text-muted">{v.address}</span>}
                {v.notes && <span className="text-[12px] text-text-muted italic mt-1">{v.notes}</span>}
              </div>
              <div className="flex gap-2 flex-wrap shrink-0">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Edit</button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => setConfirmDelete(v.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
          onKeyDown={e => e.key === 'Escape' && setShowForm(false)}
        >
          <div
            className="bg-surface rounded-lg p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-modal-title"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="vendor-modal-title" className="text-[18px] font-bold">{editId ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button type="button" className="text-text-muted hover:text-text text-[22px] leading-none bg-transparent border-none cursor-pointer" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div className="form-group">
                <label htmlFor="vnd-name">Name *</label>
                <input id="vnd-name" required autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vendor name" />
              </div>
              <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-3">
                <div className="form-group">
                  <label htmlFor="vnd-email">Email</label>
                  <input id="vnd-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vendor@example.com" />
                </div>
                <div className="form-group">
                  <label htmlFor="vnd-phone">Phone</label>
                  <input id="vnd-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="vnd-address">Address</label>
                <input id="vnd-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Warehouse Blvd" />
              </div>
              <div className="form-group">
                <label htmlFor="vnd-notes">Notes</label>
                <textarea id="vnd-notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Pickup hours, contact notes…" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
                  {saving ? 'Saving…' : editId ? 'Save changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message="Remove this vendor? Items assigned to them will have their vendor cleared."
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
