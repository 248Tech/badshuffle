import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast.jsx';
import styles from './InventorySettingsPage.module.css';

export default function InventorySettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    inventory_default_view: 'grid',
    inventory_items_per_page: '48',
    inventory_show_source: '0',
  });

  useEffect(() => {
    api.getSettings().then(s => {
      setForm({
        inventory_default_view: s.inventory_default_view || 'grid',
        inventory_items_per_page: s.inventory_items_per_page || '48',
        inventory_show_source: s.inventory_show_source || '0',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings(form);
      toast.success('Inventory settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.page}><div className="skeleton" style={{ height: 200, borderRadius: 8 }} /></div>;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Inventory Settings</h1>
      <form onSubmit={handleSave} className={styles.form}>
        <div className="card">
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Display</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="is-default-view">Default view</label>
              <select id="is-default-view" className="input" value={form.inventory_default_view} onChange={e => set('inventory_default_view', e.target.value)}>
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </select>
              <p className={styles.hint}>The default layout when opening the Inventory page.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="is-per-page">Items per page</label>
              <select id="is-per-page" className="input" value={form.inventory_items_per_page} onChange={e => set('inventory_items_per_page', e.target.value)}>
                <option value="24">24</option>
                <option value="48">48</option>
                <option value="96">96</option>
                <option value="200">200</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={form.inventory_show_source === '1'}
                  onChange={e => set('inventory_show_source', e.target.checked ? '1' : '0')}
                />
                <span>Show source badge on items</span>
              </label>
              <p className={styles.hint}>Display the Chrome Extension puzzle-piece badge on imported items.</p>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
