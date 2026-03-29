import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api.js';
import ItemGrid from '../components/ItemGrid.jsx';
import AssociationList from '../components/AssociationList.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './InventoryPage.module.css';

const EMPTY_FORM = {
  title: '', photo_url: '', hidden: false,
  unit_price: '', quantity_in_stock: '', category: '', description: '', taxable: true,
  item_type: 'product', is_subrental: false
};

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [accessories, setAccessories] = useState([]);
  const [accessorySearch, setAccessorySearch] = useState('');
  const [accessoryResults, setAccessoryResults] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const formRef = useRef(null);
  const photoInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (selectedCategory) params.category = selectedCategory;
    if (selectedType) params.item_type = selectedType;
    api.getItems(params).then(d => setItems(d.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, [search, selectedCategory, selectedType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.getSettings().then(s => {
      setShowSource((s.inventory_show_source || '0') === '1');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingItem) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingItem(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingItem]);

  const loadAccessories = useCallback((itemId) => {
    if (!itemId) return;
    api.getItemAccessories(itemId).then(d => setAccessories(d.items || [])).catch(() => {});
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const result = await api.uploadFiles(formData);
      const uploaded = result.files?.[0];
      if (uploaded?.id) {
        setForm(f => ({ ...f, photo_url: String(uploaded.id) }));
        toast.success('Photo uploaded');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const searchAccessories = useCallback(async (q) => {
    if (!q.trim()) { setAccessoryResults([]); return; }
    try {
      const d = await api.getItems({ search: q });
      setAccessoryResults((d.items || []).filter(i => !i.hidden));
    } catch { setAccessoryResults([]); }
  }, []);

  const handleEdit = (item) => {
    setEditingItem(item);
    setAccessories([]);
    setAccessorySearch('');
    setAccessoryResults([]);
    loadAccessories(item.id);
    setForm({
      title: item.title,
      photo_url: item.photo_url || '',
      hidden: !!item.hidden,
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
      quantity_in_stock: item.quantity_in_stock != null ? String(item.quantity_in_stock) : '',
      category: item.category || '',
      description: item.description || '',
      taxable: item.taxable !== 0,
      item_type: item.item_type || 'product',
      is_subrental: !!item.is_subrental
    });
    setShowAdd(false);
  };

  const handleCloseEdit = () => {
    setEditingItem(null);
    setAccessories([]);
    setAccessorySearch('');
    setAccessoryResults([]);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        photo_url: form.photo_url || null,
        hidden: (form.hidden || form.item_type === 'accessory') ? 1 : 0,
        unit_price: form.unit_price !== '' ? parseFloat(form.unit_price) : 0,
        quantity_in_stock: form.quantity_in_stock !== '' ? parseInt(form.quantity_in_stock, 10) : 0,
        category: form.category || null,
        description: form.description || null,
        taxable: form.taxable ? 1 : 0,
        item_type: form.item_type || 'product',
        is_subrental: form.is_subrental ? 1 : 0
      };
      if (editingItem) {
        await api.updateItem(editingItem.id, payload);
        toast.success('Item updated');
        setEditingItem(null);
      } else {
        await api.createItem({ ...payload, source: 'manual' });
        toast.success('Item created');
        setShowAdd(false);
      }
      setForm(EMPTY_FORM);
      load();
      api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteItem(confirmDelete.id);
      toast.info(`Deleted ${confirmDelete.title}`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const navBtnBase = 'px-3.5 py-1 text-[13px] border border-border rounded-full bg-bg text-text-muted cursor-pointer hover:bg-surface hover:text-text hover:border-primary transition-colors whitespace-nowrap';
  const navBtnActive = 'px-3.5 py-1 text-[13px] border rounded-full cursor-pointer whitespace-nowrap bg-primary border-primary text-white';

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{items.length} items</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[13px] text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
            />
            Show hidden
          </label>
          <button type="button" className="btn btn-primary" onClick={() => { setShowAdd(true); setEditingItem(null); setForm(EMPTY_FORM); }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5 py-1">
        {[null, 'product', 'group', 'accessory'].map(t => (
          <button
            key={t ?? 'all'}
            type="button"
            className={selectedType === t ? navBtnActive : navBtnBase}
            onClick={() => setSelectedType(t)}
          >
            {t === null ? 'All types' : t === 'product' ? 'Products' : t === 'group' ? 'Groups' : 'Accessories'}
          </button>
        ))}
      </div>

      {/* Category navbar */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={!selectedCategory ? navBtnActive : navBtnBase}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={selectedCategory === cat ? navBtnActive : navBtnBase}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2.5 items-center flex-wrap">
        <div className="relative flex flex-1 min-w-[180px] items-center">
          <svg className="absolute left-2.5 text-text-muted pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="flex-1 min-w-[180px] pl-9 pr-3 py-2 border border-border rounded-lg text-[14px] bg-bg text-text focus:outline-none focus:border-primary shadow-sm transition-colors"
            placeholder="Search items…"
            aria-label="Search items"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Add / Edit Form */}
      {showAdd && (
        <div ref={formRef} className="card p-5">
          <h3 className="text-[15px] font-bold mb-3.5">Add Item</h3>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
              <div className="form-group">
                <label htmlFor="inv-title">Title *</label>
                <input
                  id="inv-title"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Chiavari Chair — Gold"
                />
              </div>
              <div className="form-group">
                <label htmlFor="inv-category">Category</label>
                <input
                  id="inv-category"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Chairs"
                  list="category-list"
                />
                <datalist id="category-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="inv-type">Item type</label>
              <select
                id="inv-type"
                value={form.item_type}
                onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}
              >
                <option value="product">Product — standard rentable item</option>
                <option value="group">Group — package of multiple items</option>
                <option value="accessory">Accessory — hidden sub-item / add-on</option>
              </select>
            </div>
            <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
              <div className="form-group">
                <label htmlFor="inv-price">Unit Price ($)</label>
                <input
                  id="inv-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label htmlFor="inv-qty">Qty in Stock</label>
                <input
                  id="inv-qty"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity_in_stock}
                  onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="inv-photo">Photo</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="inv-photo"
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-border rounded-md text-[13px] bg-bg text-text"
                  value={form.photo_url}
                  onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                  placeholder="https://… or upload below"
                />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoUpload}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
                </button>
                {form.photo_url && /^\d+$/.test(form.photo_url.trim()) && (
                  <img
                    src={api.fileServeUrl(form.photo_url.trim())}
                    alt="preview"
                    className="w-12 h-12 object-cover rounded-md border border-border shrink-0"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="inv-desc">Description</label>
              <textarea
                id="inv-desc"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description…"
              />
            </div>
            <div className="flex gap-5 flex-wrap">
              <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hidden}
                  onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))}
                />
                Hidden (sub-item / accessory)
              </label>
              <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.taxable}
                  onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))}
                />
                Taxable
              </label>
              <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_subrental}
                  onChange={e => setForm(f => ({ ...f, is_subrental: e.target.checked }))}
                />
                Subrental
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setEditingItem(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ItemGrid
        items={items}
        loading={loading}
        showHidden={showHidden}
        showSource={showSource}
        onEdit={handleEdit}
        onDelete={setConfirmDelete}
        searchQuery={search}
        onClearSearch={() => setSearch('')}
      />

      {editingItem && (
        <>
          <div className={styles.drawerBackdrop} onClick={handleCloseEdit} aria-hidden="true" />
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Edit ${editingItem.title}`}>
            <div className={styles.drawerHeader}>
              <div>
                <div className={styles.drawerEyebrow}>Inventory</div>
                <h3 className={styles.drawerTitle}>Edit Item</h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleCloseEdit}>
                Close
              </button>
            </div>

            <div className={styles.drawerBody}>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
                  <div className="form-group">
                    <label htmlFor="inv-edit-title">Title *</label>
                    <input
                      id="inv-edit-title"
                      required
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Chiavari Chair — Gold"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="inv-edit-category">Category</label>
                    <input
                      id="inv-edit-category"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Chairs"
                      list="category-list"
                    />
                    <datalist id="category-list">
                      {categories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="inv-edit-type">Item type</label>
                  <select
                    id="inv-edit-type"
                    value={form.item_type}
                    onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}
                  >
                    <option value="product">Product — standard rentable item</option>
                    <option value="group">Group — package of multiple items</option>
                    <option value="accessory">Accessory — hidden sub-item / add-on</option>
                  </select>
                </div>

                <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
                  <div className="form-group">
                    <label htmlFor="inv-edit-price">Unit Price ($)</label>
                    <input
                      id="inv-edit-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_price}
                      onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="inv-edit-qty">Qty in Stock</label>
                    <input
                      id="inv-edit-qty"
                      type="number"
                      min="0"
                      step="1"
                      value={form.quantity_in_stock}
                      onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="inv-edit-photo">Photo</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      id="inv-edit-photo"
                      className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-border rounded-md text-[13px] bg-bg text-text"
                      value={form.photo_url}
                      onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                      placeholder="https://… or upload below"
                    />
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={uploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
                    </button>
                    {form.photo_url && /^\d+$/.test(form.photo_url.trim()) && (
                      <img
                        src={api.fileServeUrl(form.photo_url.trim())}
                        alt="preview"
                        className="w-12 h-12 object-cover rounded-md border border-border shrink-0"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="inv-edit-desc">Description</label>
                  <textarea
                    id="inv-edit-desc"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description…"
                  />
                </div>

                <div className="flex gap-5 flex-wrap">
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hidden}
                      onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))}
                    />
                    Hidden (sub-item / accessory)
                  </label>
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.taxable}
                      onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))}
                    />
                    Taxable
                  </label>
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_subrental}
                      onChange={e => setForm(f => ({ ...f, is_subrental: e.target.checked }))}
                    />
                    Subrental
                  </label>
                </div>

                <div className={styles.drawerSection}>
                  <AssociationList itemId={editingItem.id} />
                </div>

                <div className={styles.drawerSection}>
                  <h4 className="text-[13px] font-semibold mb-1">Permanent accessories</h4>
                  <p className="text-[12px] text-text-muted mb-3">These links are saved with the item now. Quote auto-add is planned, but not wired yet.</p>
                  {accessories.length > 0 && (
                    <ul className="list-none p-0 m-0 mb-2.5 flex flex-col gap-1">
                      {accessories.map(acc => (
                        <li key={acc.id} className="flex items-center justify-between px-2.5 py-1.5 bg-surface rounded text-[13px]">
                          <span>{acc.title}</span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              await api.removeItemAccessory(editingItem.id, acc.id);
                              loadAccessories(editingItem.id);
                            }}
                          >Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="relative">
                    <input
                      className="w-full pl-3 pr-3 py-2 border border-border rounded-lg text-[13px] bg-bg text-text focus:outline-none focus:border-primary"
                      placeholder="Search items to add as accessory…"
                      aria-label="Search items to add as accessory"
                      value={accessorySearch}
                      onChange={e => { setAccessorySearch(e.target.value); searchAccessories(e.target.value); }}
                    />
                    {accessoryResults.length > 0 && (
                      <ul className="absolute top-full left-0 right-0 z-[100] bg-bg border border-border rounded shadow-lg mt-0.5 max-h-[200px] overflow-y-auto list-none p-1">
                        {accessoryResults.filter(r => r.id !== editingItem.id && !accessories.find(a => a.id === r.id)).map(r => (
                          <li key={r.id}>
                            <button
                              type="button"
                              className="block w-full text-left px-3.5 py-2 text-[13px] text-text hover:bg-surface cursor-pointer rounded"
                              onClick={async () => {
                                await api.addItemAccessory(editingItem.id, { accessory_id: r.id });
                                setAccessorySearch('');
                                setAccessoryResults([]);
                                loadAccessories(editingItem.id);
                              }}
                            >{r.title}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className={styles.drawerFooter}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleCloseEdit}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </aside>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
