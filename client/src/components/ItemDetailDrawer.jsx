import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import styles from './ItemDetailDrawer.module.css';

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function ItemDetailDrawer({ itemId, onClose, onItemUpdated }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({});
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchItem = (id) => {
    setLoading(true);
    setError(null);
    api.getItem(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!itemId) return;
    setData(null);
    setEditOpen(false);
    fetchItem(itemId);
  }, [itemId]);

  useEffect(() => {
    const p = data?.photo_url;
    if (!p || !/^\d+$/.test(String(p).trim())) return;
    api.prefetchFileServeUrls([String(p).trim()]).catch(() => {});
  }, [data?.photo_url]);

  useEffect(() => {
    const p = data?.photo_url;
    if (!p || !/^\d+$/.test(String(p).trim())) return;
    api.prefetchFileServeUrls([String(p).trim()]).catch(() => {});
  }, [data?.photo_url]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !editOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, editOpen]);

  const openEdit = () => {
    if (!data) return;
    setForm({
      title: data.title || '',
      photo_url: data.photo_url || '',
      category: data.category || '',
      description: data.description || '',
      unit_price: data.unit_price != null ? String(data.unit_price) : '',
      quantity_in_stock: data.quantity_in_stock != null ? String(data.quantity_in_stock) : '',
      labor_hours: data.labor_hours != null ? String(data.labor_hours) : '0',
      taxable: data.taxable !== 0,
      hidden: !!data.hidden,
      is_subrental: !!data.is_subrental,
    });
    api.getCategories().then((d) => setCategories(d.categories || [])).catch(() => {});
    setEditOpen(true);
  };

  const doSave = async () => {
    if (!form.title?.trim()) return;
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
      });
      toast.success('Inventory item updated');
      setEditOpen(false);
      fetchItem(itemId);
      if (onItemUpdated) onItemUpdated(itemId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (e) => { e.preventDefault(); return doSave(); };

  const handleClickOutside = async () => {
    if (editOpen) await doSave();
    onClose();
  };

  const quotedRevenue = data
    ? (data.quote_history || []).reduce((sum, q) => sum + (data.unit_price || 0) * (q.quantity || 1), 0)
    : 0;

  return (
    <>
      <div className={styles.backdrop} onClick={handleClickOutside} aria-hidden="true" />
      <div className={styles.drawer} role="complementary" aria-label="Item details">
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            {loading ? 'Loading…' : (data?.title || '—')}
          </span>
          <div className={styles.headerActions}>
            {data && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={openEdit}
                aria-label="Edit inventory item"
                title="Edit inventory item"
              >
                <PencilIcon />
              </button>
            )}
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close" title="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {loading && (
            <div aria-busy="true" aria-label="Loading item details">
              <div className="skeleton" style={{ width: '100%', aspectRatio: '4/3' }} aria-hidden="true" />
              <div className={styles.skeletonSection} aria-hidden="true">
                {[75, 60, 85].map((w, i) => (
                  <div key={i} className="skeleton" style={{ height: 13, width: `${w}%`, borderRadius: 4 }} />
                ))}
              </div>
              <div className={styles.skeletonSection} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="skeleton" style={{ height: 13, width: '42%', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 13, width: '24%', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && !loading && (
            <div className={styles.errorState}>
              <span>Could not load item details.</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fetchItem(itemId)}>
                Retry
              </button>
            </div>
          )}

          {data && !loading && (
            <>
              {data.photo_url ? (
                <img
                  src={api.proxyImageUrl(data.photo_url, { variant: 'large' })}
                  alt={data.title}
                  className={styles.photo}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className={styles.photoPlaceholder} aria-hidden="true">📦</div>
              )}

              {data.description && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Description</h4>
                  <p className={styles.description}>{data.description}</p>
                </div>
              )}

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Pricing</h4>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Unit price</span>
                  <span className={styles.metaValue}>${(data.unit_price || 0).toFixed(2)}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Labor hours</span>
                  <span className={styles.metaValue}>{data.labor_hours != null ? Number(data.labor_hours) : 0} hrs</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Taxable</span>
                  <span className={styles.metaValue}>{data.taxable !== 0 ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Inventory</h4>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel} title="Total units owned">In stock</span>
                  <span className={styles.metaValue}>{data.quantity_in_stock || 0}</span>
                </div>
                {data.quantity_going_out > 0 && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel} title="Units reserved for upcoming confirmed events">Going out</span>
                    <span className={styles.metaValue}>{data.quantity_going_out}</span>
                  </div>
                )}
                {data.source && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Source</span>
                    <span className={`badge badge-${data.source}`}>{data.source}</span>
                  </div>
                )}
                {data.is_subrental ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Type</span>
                    <span className={styles.metaValue}>Subrental</span>
                  </div>
                ) : null}
                {data.hidden ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Visibility</span>
                    <span className={styles.metaValue}>Hidden</span>
                  </div>
                ) : null}
              </div>

              {(data.quote_history || []).length > 0 && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>History</h4>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel} title="Sum of unit price × quantity across all quotes">Quoted revenue</span>
                    <span className={styles.metaValue}>${quotedRevenue.toFixed(2)}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Times quoted</span>
                    <span className={styles.metaValue}>{data.quote_history.length}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editOpen && (
        <div
          className={styles.dialogBackdrop}
          onClick={() => setEditOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setEditOpen(false)}
        >
          <div
            className={styles.dialog}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inv-edit-title"
          >
            <div className={styles.dialogHeader}>
              <h3 id="inv-edit-title" className={styles.dialogTitle}>
                Edit Inventory Item
                <span className={styles.inventoryBadge}>Inventory</span>
              </h3>
              <button type="button" className={styles.iconBtn} onClick={() => setEditOpen(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className={styles.dialogBody}>
                <div className="form-group">
                  <label htmlFor="inv-title">Title *</label>
                  <input
                    id="inv-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className="form-group">
                    <label htmlFor="inv-cat">Category</label>
                    <input
                      id="inv-cat"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      list="inv-cat-list"
                      placeholder="e.g. Chairs"
                    />
                    <datalist id="inv-cat-list">
                      {categories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label htmlFor="inv-price">Unit Price ($)</label>
                    <input
                      id="inv-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_price}
                      onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className="form-group">
                    <label htmlFor="inv-stock">Qty in Stock</label>
                    <input
                      id="inv-stock"
                      type="number"
                      min="0"
                      value={form.quantity_in_stock}
                      onChange={(e) => setForm((f) => ({ ...f, quantity_in_stock: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="inv-labor">Labor hours</label>
                    <input
                      id="inv-labor"
                      type="number"
                      min="0"
                      step="0.25"
                      value={form.labor_hours}
                      onChange={(e) => setForm((f) => ({ ...f, labor_hours: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="inv-photo">Photo URL</label>
                  <input
                    id="inv-photo"
                    value={form.photo_url}
                    onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
                    placeholder="https://…"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="inv-desc">Description</label>
                  <textarea
                    id="inv-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className={styles.checkboxRow}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={form.taxable}
                      onChange={(e) => setForm((f) => ({ ...f, taxable: e.target.checked }))}
                    />
                    Taxable
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={form.hidden}
                      onChange={(e) => setForm((f) => ({ ...f, hidden: e.target.checked }))}
                    />
                    Hidden
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={form.is_subrental}
                      onChange={(e) => setForm((f) => ({ ...f, is_subrental: e.target.checked }))}
                    />
                    Subrental
                  </label>
                </div>
              </div>
              <div className={styles.dialogFooter}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
