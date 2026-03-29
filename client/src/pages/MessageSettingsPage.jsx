import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast.jsx';
import styles from './MessageSettingsPage.module.css';

export default function MessageSettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    message_email_signature: '',
    message_theme: 'default',
    message_auto_attach_pdf: '0',
  });

  useEffect(() => {
    api.getSettings().then(s => {
      setForm({
        message_email_signature: s.message_email_signature || '',
        message_theme: s.message_theme || 'default',
        message_auto_attach_pdf: s.message_auto_attach_pdf || '0',
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
      toast.success('Message settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.page}><div className="skeleton" style={{ height: 300, borderRadius: 8 }} /></div>;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Message Settings</h1>
      <form onSubmit={handleSave} className={styles.form}>
        <div className="card">
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Email Signature</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="sig">Signature</label>
              <textarea
                id="sig"
                className="input"
                rows={5}
                placeholder="e.g. Best regards, John Smith&#10;BadShuffle Events — (555) 123-4567"
                value={form.message_email_signature}
                onChange={e => set('message_email_signature', e.target.value)}
              />
              <p className={styles.hint}>Appended to outbound emails sent from the Messages page.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Messenger Theme</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ms-theme">Theme</label>
              <select id="ms-theme" className="input" value={form.message_theme} onChange={e => set('message_theme', e.target.value)}>
                <option value="default">Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="compact">Compact</option>
              </select>
              <p className={styles.hint}>Controls the visual style of the Messages inbox.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Attachments</h2>
            <div className={styles.field}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={form.message_auto_attach_pdf === '1'}
                  onChange={e => set('message_auto_attach_pdf', e.target.checked ? '1' : '0')}
                />
                <span>Auto-attach PDF to outbound quote emails</span>
              </label>
              <p className={styles.hint}>When sending a quote to a client, automatically attach the PDF export.</p>
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
