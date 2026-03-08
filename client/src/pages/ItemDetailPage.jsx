import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './ItemDetailPage.module.css';

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [imgError, setImgError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getItem(id)
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
          hidden: !!data.hidden
        });
      })
      .catch(() => navigate('/inventory'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateItem(id, {
        title: form.title,
        photo_url: form.photo_url || null,
        category: form.category || null,
        description: form.description || null,
        unit_price: form.unit_price !== '' ? parseFloat(form.unit_price) : 0,
        quantity_in_stock: form.quantity_in_stock !== '' ? parseInt(form.quantity_in_stock, 10) : 0,
        labor_hours: form.labor_hours !== '' ? parseFloat(form.labor_hours) : 0,
        taxable: form.taxable ? 1 : 0,
        hidden: form.hidden ? 1 : 0
      });
      toast.success('Item updated');
      setEditing(false);
      load();
      api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (!item) return null;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/inventory')}>
          ← Inventory
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(v => !v)}>
          {editing ? 'Cancel' : '✏️ Edit'}
        </button>
      </div>

      <div className={styles.layout}>
        {/* Left: image */}
        <div className={styles.imageCol}>
          <div className={styles.imgWrapper}>
            {item.photo_url && !imgError ? (
              <img
                src={api.proxyImageUrl(item.photo_url)}
                alt={item.title}
                className={styles.img}
                onError={() => setImgError(true)}
              />
            ) : (
              <img src="/placeholder.png" alt="" className={styles.img} aria-hidden />
            )}
          </div>
          {item.category && <span className={`badge ${styles.catBadge}`}>{item.category}</span>}
        </div>

        {/* Right: info or edit form */}
        <div className={styles.infoCol}>
          {editing ? (
            <form onSubmit={handleSave} className={styles.form}>
              <div className="form-group">
                <label>Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label>Category</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    list="cat-list" placeholder="e.g. Chairs" />
                  <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="form-group">
                  <label>Unit Price ($)</label>
                  <input type="number" min="0" step="0.01" value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Qty in Stock</label>
                  <input type="number" min="0" value={form.quantity_in_stock}
                    onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Labor hours</label>
                  <input type="number" min="0" step="0.25" value={form.labor_hours}
                    onChange={e => setForm(f => ({ ...f, labor_hours: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label>Photo URL</label>
                <input value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} placeholder="https://…" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} value={form.description}
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
              </div>
              <div className={styles.formActions}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className={styles.title}>{item.title}</h1>
              <div className={styles.metaGrid}>
                {item.unit_price > 0 && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Price</span>
                    <span className={styles.metaValue}>${item.unit_price.toFixed(2)}</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>In Stock</span>
                  <span className={styles.metaValue}>{item.quantity_in_stock || 0}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Labor hours</span>
                  <span className={styles.metaValue}>{item.labor_hours != null ? Number(item.labor_hours) : 0}</span>
                </div>
                {item.quantity_going_out > 0 && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Going Out</span>
                    <span className={styles.metaValue}>{item.quantity_going_out}</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Source</span>
                  <span className={`badge badge-${item.source}`}>{item.source}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Taxable</span>
                  <span className={styles.metaValue}>{item.taxable !== 0 ? 'Yes' : 'No'}</span>
                </div>
                {item.hidden ? (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Status</span>
                    <span className={styles.metaValue}>Hidden</span>
                  </div>
                ) : null}
              </div>
              {item.description && (
                <div className={styles.desc}>
                  <h3 className={styles.sectionTitle}>Description</h3>
                  <p>{item.description}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quote history */}
      {(item.quote_history || []).length > 0 && (
        <div className={`card ${styles.historyCard}`}>
          <h3 className={styles.sectionTitle}>Quote History</h3>
          <table className={styles.historyTable}>
            <thead>
              <tr><th>Quote</th><th>Event Date</th><th>Qty</th></tr>
            </thead>
            <tbody>
              {item.quote_history.map(q => (
                <tr key={q.id}>
                  <td><Link to={`/quotes/${q.id}`} className={styles.quoteLink}>{q.label || q.name}</Link></td>
                  <td>{q.event_date || '—'}</td>
                  <td>{q.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
