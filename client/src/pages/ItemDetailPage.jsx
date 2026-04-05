import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './ItemDetailPage.module.css';

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(!!location.state?.autoEdit);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [imgError, setImgError] = useState(false);
  const [barcodeUrl, setBarcodeUrl] = useState('');
  const [, setImgServeEpoch] = useState(0);

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
          hidden: !!data.hidden,
          is_subrental: !!data.is_subrental
        });
      })
      .catch(() => navigate('/inventory'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const p = item?.photo_url;
    if (!p || !/^\d+$/.test(String(p).trim())) return;
    api.prefetchFileServeUrls([String(p).trim()]).then(() => setImgServeEpoch((e) => e + 1)).catch(() => {});
  }, [item?.photo_url]);

  useEffect(() => {
    if (!item?.scan_code) {
      setBarcodeUrl('');
      return undefined;
    }
    let cancelled = false;
    const itemScanHref = `${window.location.origin}/scan/${encodeURIComponent(item.scan_code)}`;
    api.getBarcodeSvgData({
      format: 'qrcode',
      value: itemScanHref,
      label: item.scan_code,
    }).then((data) => {
      if (cancelled) return;
      const svg = String(data?.svg || '');
      if (!svg) {
        setBarcodeUrl('');
        return;
      }
      setBarcodeUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }).catch(() => {
      if (!cancelled) setBarcodeUrl('');
    });
    return () => {
      cancelled = true;
    };
  }, [item?.scan_code]);

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
        hidden: form.hidden ? 1 : 0,
        is_subrental: form.is_subrental ? 1 : 0
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

  if (loading) return (
    <div className={styles.page} aria-busy="true" aria-label="Loading item">
      <div className={styles.topBar} aria-hidden="true">
        <div className="skeleton" style={{ height: 30, width: 100, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 30, width: 64, borderRadius: 6 }} />
      </div>
      <div className={styles.layout} aria-hidden="true">
        <div className={styles.imageCol}>
          <div className="skeleton" style={{ width: '100%', paddingTop: '75%', borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 999 }} />
        </div>
        <div className={styles.infoCol}>
          <div className="skeleton" style={{ height: 28, width: '55%', borderRadius: 6 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: 11, width: 60, borderRadius: 3, marginBottom: 5 }} />
                <div className="skeleton" style={{ height: 18, width: 80, borderRadius: 4 }} />
              </div>
            ))}
          </div>
          <div>
            <div className="skeleton" style={{ height: 11, width: 80, borderRadius: 3, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: '90%', borderRadius: 4, marginBottom: 5 }} />
            <div className="skeleton" style={{ height: 13, width: '70%', borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </div>
  );
  if (!item) return null;

  const itemScanHref = item.scan_code ? `${window.location.origin}/scan/${encodeURIComponent(item.scan_code)}` : '';
  const itemBarcodeUrl = barcodeUrl;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/inventory')}>
          <span aria-hidden="true">←</span> Inventory
        </button>
        <div className="flex gap-2">
          <Link to={`/inventory/set-aside?item_id=${item.id}`} className="btn btn-ghost btn-sm">Set Aside</Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(v => !v)}>
            {editing ? 'Cancel' : '✏️ Edit'}
          </button>
        </div>
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
              <img src="/placeholder.png" alt="" className={styles.img} aria-hidden="true" />
            )}
          </div>
          {item.category && <span className={`badge ${styles.catBadge}`}>{item.category}</span>}
        </div>

        {/* Right: info or edit form */}
        <div className={styles.infoCol}>
          {editing ? (
            <form onSubmit={handleSave} className={styles.form}>
              <div className="form-group">
                <label htmlFor="idp-title">Title *</label>
                <input id="idp-title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label htmlFor="idp-category">Category</label>
                  <input id="idp-category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    list="cat-list" placeholder="e.g. Chairs" />
                  <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="form-group">
                  <label htmlFor="idp-price">Unit Price ($)</label>
                  <input id="idp-price" type="number" min="0" step="0.01" value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label htmlFor="idp-stock">Qty in Stock</label>
                  <input id="idp-stock" type="number" min="0" value={form.quantity_in_stock}
                    onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label htmlFor="idp-labor">Labor hours</label>
                  <input id="idp-labor" type="number" min="0" step="0.25" value={form.labor_hours}
                    onChange={e => setForm(f => ({ ...f, labor_hours: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="idp-photo">Photo URL</label>
                <input id="idp-photo" value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} placeholder="https://…" />
              </div>
              <div className="form-group">
                <label htmlFor="idp-desc">Description</label>
                <textarea id="idp-desc" rows={3} value={form.description}
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
                {item.quantity_set_aside > 0 && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Set Aside</span>
                    <span className={styles.metaValue}>{item.quantity_set_aside}</span>
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
                {item.is_subrental ? (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Type</span>
                    <span className={styles.metaValue}>Subrental</span>
                  </div>
                ) : null}
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
              {item.scan_code && (
                <div className={styles.barcodeCard}>
                  <div>
                    <h3 className={styles.sectionTitle}>Barcode</h3>
                    <div className={styles.barcodeCode}>{item.scan_code}</div>
                    <div className={styles.barcodeActions}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(itemScanHref);
                            toast.success('Product scan link copied');
                          } catch {
                            toast.error('Unable to copy scan link');
                          }
                        }}
                      >
                        Copy link
                      </button>
                      <a className="btn btn-ghost btn-sm" href={itemBarcodeUrl || '#'} target="_blank" rel="noreferrer">
                        Open QR
                      </a>
                    </div>
                  </div>
                  <div className={styles.barcodePreview}>
                    {itemBarcodeUrl ? <img src={itemBarcodeUrl} alt={`QR code for ${item.title}`} /> : <div className={styles.barcodeFallback}>QR unavailable</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quote history */}
      {(item.quote_history || []).length > 0 && (
        <div className={`card ${styles.historyCard}`}>
          <h3 className={styles.sectionTitle}>Project History</h3>
          <div className="overflow-x-auto">
          <table className={styles.historyTable}>
            <thead>
              <tr><th>Project</th><th>Event Date</th><th>Qty</th></tr>
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
        </div>
      )}
    </div>
  );
}
