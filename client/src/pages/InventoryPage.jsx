import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import ItemGrid from '../components/ItemGrid.jsx';
import AssociationList from '../components/AssociationList.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './InventoryPage.module.css';

const EMPTY_FORM = {
  title: '', photo_url: '', hidden: false,
  unit_price: '', quantity_in_stock: '', category: '', description: '', taxable: true
};

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewAssocItem, setViewAssocItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (categoryFilter) params.category = categoryFilter;
    api.getItems(params).then(d => setItems(d.items || [])).finally(() => setLoading(false));
  }, [search, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      photo_url: item.photo_url || '',
      hidden: !!item.hidden,
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
      quantity_in_stock: item.quantity_in_stock != null ? String(item.quantity_in_stock) : '',
      category: item.category || '',
      description: item.description || '',
      taxable: item.taxable !== 0
    });
    setShowAdd(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        photo_url: form.photo_url || null,
        hidden: form.hidden ? 1 : 0,
        unit_price: form.unit_price !== '' ? parseFloat(form.unit_price) : 0,
        quantity_in_stock: form.quantity_in_stock !== '' ? parseInt(form.quantity_in_stock, 10) : 0,
        category: form.category || null,
        description: form.description || null,
        taxable: form.taxable ? 1 : 0
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inventory</h1>
          <p className={styles.sub}>{items.length} items</p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
            />
            Show hidden
          </label>
          <button className="btn btn-primary" onClick={() => { setShowAdd(true); setEditingItem(null); setForm(EMPTY_FORM); }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          placeholder="Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {categories.length > 0 && (
          <select
            className={styles.categorySelect}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Add / Edit Form */}
      {(showAdd || editingItem) && (
        <div className={`card ${styles.formCard}`}>
          <h3 className={styles.formTitle}>{editingItem ? 'Edit Item' : 'Add Item'}</h3>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Chiavari Chair — Gold"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input
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
            <div className={styles.formRow}>
              <div className="form-group">
                <label>Unit Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Qty in Stock</label>
                <input
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
              <label>Photo URL</label>
              <input
                value={form.photo_url}
                onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description…"
              />
            </div>
            <div className={styles.checkboxRow}>
              <label className={styles.toggleInline}>
                <input
                  type="checkbox"
                  checked={form.hidden}
                  onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))}
                />
                Hidden (sub-item / accessory)
              </label>
              <label className={styles.toggleInline}>
                <input
                  type="checkbox"
                  checked={form.taxable}
                  onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))}
                />
                Taxable
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setEditingItem(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>

          {editingItem && (
            <div className={styles.assocSection}>
              <AssociationList itemId={editingItem.id} />
            </div>
          )}
        </div>
      )}

      <ItemGrid
        items={items}
        loading={loading}
        showHidden={showHidden}
        onEdit={handleEdit}
        onDelete={setConfirmDelete}
      />

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
