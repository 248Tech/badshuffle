import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './VendorsPage.module.css';

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

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

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
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendors</h1>
          <p className={styles.sub}>Suppliers for subrental items.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ Add Vendor</button>
      </div>

      {loading ? (
        <div className={styles.list} aria-busy="true" aria-label="Loading vendors">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`card ${styles.row}`} aria-hidden="true">
              <div className={styles.info}>
                <div className="skeleton" style={{ height: 16, width: `${40 + (i % 3) * 15}%`, borderRadius: 5, marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 13, width: `${30 + (i % 2) * 20}%`, borderRadius: 4 }} />
              </div>
              <div className={styles.actions}>
                <div className="skeleton" style={{ height: 30, width: 48, borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 30, width: 54, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="empty-state">
          <p>No vendors yet. Add one to assign subrental items to suppliers.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {vendors.map(v => (
            <div key={v.id} className={`card ${styles.row}`}>
              <div className={styles.info}>
                <span className={styles.name}>{v.name}</span>
                {v.email && <span className={styles.meta}>{v.email}</span>}
                {v.phone && <span className={styles.meta}>{v.phone}</span>}
                {v.address && <span className={styles.meta}>{v.address}</span>}
                {v.notes && <span className={styles.notes}>{v.notes}</span>}
              </div>
              <div className={styles.actions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Edit</button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => setConfirmDelete(v.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)} onKeyDown={e => e.key === 'Escape' && setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vendor-modal-title">
            <div className={styles.modalHeader}>
              <h2 id="vendor-modal-title">{editId ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setShowForm(false)} aria-label="Close"><span aria-hidden="true">×</span></button>
            </div>
            <form onSubmit={handleSave} className={styles.form}>
              <div className="form-group">
                <label htmlFor="vnd-name">Name *</label>
                <input id="vnd-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vendor name" />
              </div>
              <div className={styles.row2}>
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
              <div className={styles.formActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
                  {saving ? 'Saving…' : editId ? 'Save changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className={styles.overlay} onClick={() => setConfirmDelete(null)} onKeyDown={e => e.key === 'Escape' && setConfirmDelete(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vendor-delete-title">
            <div className={styles.modalHeader}>
              <h2 id="vendor-delete-title">Delete vendor?</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setConfirmDelete(null)} aria-label="Close"><span aria-hidden="true">×</span></button>
            </div>
            <p style={{ padding: '0 0 16px', fontSize: 14, color: 'var(--color-text-muted)' }}>
              This will remove the vendor. Items assigned to this vendor will have their vendor cleared.
            </p>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
