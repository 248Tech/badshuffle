import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import styles from './ItemEditModal.module.css';

export default function ItemEditModal({ itemId, onClose, onSaved }) {
  const toast = useToast();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [imgError, setImgError] = useState(false);

  const load = useCallback(() => {
    if (!itemId) return;
    setLoading(true);
    api.getItem(itemId)
      .then(data => {
        setItem(data);
        setForm({
          title: data.title,
          photo_url: data.photo_url || '',
          category: data.category || '',
          description: data.description || '',
          unit_price: data.unit_price != null ? String(data.unit_price) : '',
          quantity_in_stock: data.quantity_in_stock != null ? String(data.quantity_in_stock) : '',
          labor_hours: data.labor_hours != null ? String(data.labor_hours) : '0',
          taxable: data.taxable !== 0,
          hidden: !!data.hidden,
          is_subrental: !!data.is_subrental,
          vendor_id: data.vendor_id != null ? String(data.vendor_id) : ''
        });
      })
      .catch(() => {
        toast.error('Item not found');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [itemId, onClose, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const p = item?.photo_url;
    if (!p || !/^\d+$/.test(String(p).trim())) return;
    api.prefetchFileServeUrls([String(p).trim()]).catch(() => {});
  }, [item?.photo_url]);
  useEffect(() => {
    api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
    api.getVendors().then(d => setVendors(d.vendors || [])).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateItem(itemId, {
        title: form.title,
        photo_url: form.photo_url || null,
        category: form.category || null,
        description: form.description || null,
        unit_price: form.unit_price !== '' ? parseFloat(form.unit_price) : 0,
        quantity_in_stock: form.quantity_in_stock !== '' ? parseInt(form.quantity_in_stock, 10) : 0,
        labor_hours: form.labor_hours !== '' ? parseFloat(form.labor_hours) : 0,
        taxable: form.taxable ? 1 : 0,
        hidden: form.hidden ? 1 : 0,
        is_subrental: form.is_subrental ? 1 : 0,
        vendor_id: form.vendor_id !== '' ? parseInt(form.vendor_id, 10) : null
      });
      toast.success('Item updated');
      if (typeof onSaved === 'function') onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!itemId) return null;

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="item-edit-title">
        <div className={styles.header}>
          <h2 className={styles.title} id="item-edit-title">Edit product</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close"><span aria-hidden="true">×</span></button>
        </div>
        {loading ? (
          <div className={styles.loading}><div className="spinner" /></div>
        ) : item ? (
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.layout}>
              <div className={styles.imageCol}>
                <div className={styles.imgWrapper}>
                  {item.photo_url && !imgError ? (
                    <img
                      src={api.proxyImageUrl(item.photo_url, { variant: 'ui' })}
                      alt={item.title}
                      className={styles.img}
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <img src="/placeholder.png" alt="" className={styles.img} aria-hidden="true" />
                  )}
                </div>
              </div>
              <div className={styles.fields}>
                <div className="form-group">
                  <label htmlFor="edit-title">Title *</label>
                  <input id="edit-title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className={styles.formRow}>
                  <div className="form-group">
                    <label htmlFor="edit-category">Category</label>
                    <input id="edit-category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      list={`cat-list-${itemId}`} placeholder="e.g. Chairs" />
                    <datalist id={`cat-list-${itemId}`}>{categories.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-price">Unit Price ($)</label>
                    <input id="edit-price" type="number" min="0" step="0.01" value={form.unit_price}
                      onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-qty">Qty in Stock</label>
                    <input id="edit-qty" type="number" min="0" value={form.quantity_in_stock}
                      onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-labor">Labor hours</label>
                    <input id="edit-labor" type="number" min="0" step="0.25" value={form.labor_hours}
                      onChange={e => setForm(f => ({ ...f, labor_hours: e.target.value }))} placeholder="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-photo">Photo URL</label>
                  <input id="edit-photo" value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} placeholder="https://…" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-desc">Description</label>
                  <textarea id="edit-desc" rows={3} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className={styles.checkboxRow}>
                  <label className={styles.check}>
                    <input type="checkbox" checked={form.taxable} onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))} />
                    Taxable
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" checked={form.hidden} onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))} />
                    Hidden
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" checked={form.is_subrental} onChange={e => setForm(f => ({ ...f, is_subrental: e.target.checked }))} />
                    Subrental
                  </label>
                </div>
                {form.is_subrental && (
                  <div className="form-group">
                    <label htmlFor="edit-vendor">Vendor</label>
                    <select id="edit-vendor" value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
                      <option value="">— No vendor —</option>
                      {vendors.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
