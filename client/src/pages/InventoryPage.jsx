import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import ItemGrid from '../components/ItemGrid.jsx';
import AssociationList from '../components/AssociationList.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './InventoryPage.module.css';

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewAssocItem, setViewAssocItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', photo_url: '', hidden: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getItems().then(d => setItems(d.items || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({ title: item.title, photo_url: item.photo_url || '', hidden: !!item.hidden });
    setShowAdd(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await api.updateItem(editingItem.id, {
          title: form.title,
          photo_url: form.photo_url || null,
          hidden: form.hidden ? 1 : 0
        });
        toast.success('Item updated');
        setEditingItem(null);
      } else {
        await api.createItem({
          title: form.title,
          photo_url: form.photo_url || null,
          source: 'manual',
          hidden: form.hidden ? 1 : 0
        });
        toast.success('Item created');
        setShowAdd(false);
      }
      setForm({ title: '', photo_url: '', hidden: false });
      load();
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
          <p className={styles.sub}>{items.length} total items</p>
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
          <button className="btn btn-primary" onClick={() => { setShowAdd(true); setEditingItem(null); setForm({ title: '', photo_url: '', hidden: false }); }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {(showAdd || editingItem) && (
        <div className={`card ${styles.formCard}`}>
          <h3 className={styles.formTitle}>{editingItem ? 'Edit Item' : 'Add Item'}</h3>
          <form onSubmit={handleSave} className={styles.form}>
            <div className="form-group">
              <label>Title *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Chiavari Chair — Gold"
              />
            </div>
            <div className="form-group">
              <label>Photo URL</label>
              <input
                value={form.photo_url}
                onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <label className={styles.toggleInline}>
              <input
                type="checkbox"
                checked={form.hidden}
                onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))}
              />
              Hidden (sub-item / accessory)
            </label>
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
