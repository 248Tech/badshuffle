import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './TemplatesPage.module.css';

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', subject: '', body_text: '', is_default: false });

  const load = () => {
    setLoading(true);
    api.getTemplates()
      .then(d => setTemplates(d.templates || []))
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing('new');
    setForm({ name: '', subject: '', body_text: '', is_default: false });
  };

  const openEdit = (t) => {
    setEditing(t.id);
    setForm({ name: t.name, subject: t.subject || '', body_text: t.body_text || t.body_html || '', is_default: !!t.is_default });
  };

  const closeEdit = () => { setEditing(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing === 'new') {
        await api.createTemplate({ name: form.name, subject: form.subject, body_text: form.body_text, is_default: form.is_default });
        toast.success('Template created');
      } else {
        await api.updateTemplate(editing, { name: form.name, subject: form.subject, body_text: form.body_text, is_default: form.is_default });
        toast.success('Template updated');
      }
      closeEdit();
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const setDefault = async (id) => {
    try {
      await api.updateTemplate(id, { is_default: true });
      toast.success('Default template set');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      toast.info('Template deleted');
      if (editing === id) closeEdit();
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Email templates</h1>
        <p className={styles.sub}>Templates for sending quotes to clients. Choose a default to pre-fill the send modal.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>+ New template</button>
      </div>

      <div className={`card ${styles.card}`}>
        {templates.length === 0 && !editing && (
          <p className={styles.empty}>No templates yet. Create one to use when sending quotes.</p>
        )}
        <ul className={styles.list}>
          {templates.map(t => (
            <li key={t.id} className={styles.row}>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.subject}>{t.subject || '(no subject)'}</span>
              {t.is_default && <span className={styles.badge}>Default</span>}
              <div className={styles.actions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                {!t.is_default && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDefault(t.id)}>Set default</button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>

        {editing && (
          <form onSubmit={handleSave} className={styles.form}>
            <h3 className={styles.formTitle}>{editing === 'new' ? 'New template' : 'Edit template'}</h3>
            <div className="form-group">
              <label>Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Quote cover email" />
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Quote from..." />
            </div>
            <div className="form-group">
              <label>Body</label>
              <textarea rows={6} value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))} placeholder="Email body (plain text)..." />
            </div>
            <div className={styles.checkRow}>
              <label>
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                Default template (pre-fill when sending quote)
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={closeEdit}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
