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
        <button className="btn btn-primary" onClick={openNew}>+ Add Vendor</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
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
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => setConfirmDelete(v.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editId ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button className={styles.closeBtn} onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSave} className={styles.form}>
              <div className="form-group">
                <label>Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vendor name" />
              </div>
              <div className={styles.row2}>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vendor@example.com" />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Warehouse Blvd" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Pickup hours, contact notes…" />
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
        <div className={styles.overlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete vendor?</h2>
              <button className={styles.closeBtn} onClick={() => setConfirmDelete(null)}>×</button>
            </div>
            <p style={{ padding: '0 0 16px', fontSize: 14, color: 'var(--color-text-muted)' }}>
              This will remove the vendor. Items assigned to this vendor will have their vendor cleared.
            </p>
            <div className={styles.formActions}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
