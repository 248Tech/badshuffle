import React, { useState, useEffect } from 'react';
import { api, getToken } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState({
    company_name: '',
    company_email: '',
    tax_rate: '0',
    currency: 'USD'
  });
  const [smtp, setSmtp] = useState({
    smtp_host: '', smtp_port: '587', smtp_secure: 'false',
    smtp_user: '', smtp_pass: '', smtp_from: ''
  });
  const [imap, setImap] = useState({
    imap_host: '', imap_port: '993', imap_secure: 'true',
    imap_user: '', imap_pass: '', imap_poll_enabled: '0'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImap, setTestingImap] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then(s => {
        setForm({
          company_name: s.company_name || '',
          company_email: s.company_email || '',
          tax_rate: s.tax_rate || '0',
          currency: s.currency || 'USD'
        });
        setSmtp({
          smtp_host: s.smtp_host || '',
          smtp_port: s.smtp_port || '587',
          smtp_secure: s.smtp_secure || 'false',
          smtp_user: s.smtp_user || '',
          smtp_pass: s.smtp_pass || '',
          smtp_from: s.smtp_from || ''
        });
        setImap({
          imap_host: s.imap_host || '',
          imap_port: s.imap_port || '993',
          imap_secure: s.imap_secure !== undefined ? s.imap_secure : 'true',
          imap_user: s.imap_user || '',
          imap_pass: s.imap_pass || '',
          imap_poll_enabled: s.imap_poll_enabled || '0'
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        ...form,
        ...smtp,
        smtp_pass_enc: smtp.smtp_pass,
        ...imap,
        imap_pass_enc: imap.imap_pass
      });
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestImap = async () => {
    setTestingImap(true);
    try {
      const token = getToken();
      const resp = await fetch('/api/settings/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({
          imap_host: imap.imap_host,
          imap_port: imap.imap_port,
          imap_secure: imap.imap_secure,
          imap_user: imap.imap_user,
          imap_pass: imap.imap_pass
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (data.ok) {
        toast.success(data.message || 'IMAP connection successful');
      } else {
        toast.error(data.error || 'IMAP connection failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTestingImap(false);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.sub}>Configure company info and quote defaults.</p>
      </div>

      <form onSubmit={handleSave}>
        <div className={`card ${styles.card}`}>
          <h3 className={styles.section}>Company</h3>
          <div className={styles.row}>
            <div className="form-group">
              <label>Company Name</label>
              <input
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="Acme Events Co."
              />
            </div>
            <div className="form-group">
              <label>Company Email</label>
              <input
                type="email"
                value={form.company_email}
                onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))}
                placeholder="hello@example.com"
              />
            </div>
          </div>

          <h3 className={styles.section}>Pricing</h3>
          <div className={styles.row}>
            <div className="form-group">
              <label>Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={form.tax_rate}
                onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
                placeholder="0"
              />
              <span className={styles.hint}>Applied to taxable items in quote totals.</span>
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="USD">USD — US Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="AUD">AUD — Australian Dollar</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Outgoing Mail (SMTP)</h3>
          <div className={styles.row}>
            <div className="form-group">
              <label>SMTP Host</label>
              <input value={smtp.smtp_host} onChange={e => setSmtp(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label>Port</label>
              <input type="number" value={smtp.smtp_port} onChange={e => setSmtp(f => ({ ...f, smtp_port: e.target.value }))} />
            </div>
            <div className="form-group" style={{ maxWidth: 120 }}>
              <label>Secure (TLS)</label>
              <select value={smtp.smtp_secure} onChange={e => setSmtp(f => ({ ...f, smtp_secure: e.target.value }))}>
                <option value="false">STARTTLS</option>
                <option value="true">TLS/SSL</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className="form-group">
              <label>Username</label>
              <input value={smtp.smtp_user} onChange={e => setSmtp(f => ({ ...f, smtp_user: e.target.value }))} placeholder="user@example.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={smtp.smtp_pass} onChange={e => setSmtp(f => ({ ...f, smtp_pass: e.target.value }))} placeholder="App password" />
            </div>
            <div className="form-group">
              <label>From address</label>
              <input value={smtp.smtp_from} onChange={e => setSmtp(f => ({ ...f, smtp_from: e.target.value }))} placeholder="Acme Events <noreply@example.com>" />
            </div>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Incoming Mail (IMAP)</h3>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            When configured, BadShuffle polls your inbox every 5 minutes for client replies to sent quotes and logs them in Messages.
          </p>
          <div className={styles.row}>
            <div className="form-group">
              <label>IMAP Host</label>
              <input value={imap.imap_host} onChange={e => setImap(f => ({ ...f, imap_host: e.target.value }))} placeholder="imap.gmail.com" />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label>Port</label>
              <input type="number" value={imap.imap_port} onChange={e => setImap(f => ({ ...f, imap_port: e.target.value }))} />
            </div>
            <div className="form-group" style={{ maxWidth: 120 }}>
              <label>Secure</label>
              <select value={imap.imap_secure} onChange={e => setImap(f => ({ ...f, imap_secure: e.target.value }))}>
                <option value="true">TLS/SSL</option>
                <option value="false">STARTTLS</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className="form-group">
              <label>Username</label>
              <input value={imap.imap_user} onChange={e => setImap(f => ({ ...f, imap_user: e.target.value }))} placeholder="user@example.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={imap.imap_pass} onChange={e => setImap(f => ({ ...f, imap_pass: e.target.value }))} placeholder="App password" />
            </div>
          </div>
          <div className={styles.row} style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={imap.imap_poll_enabled === '1'}
                onChange={e => setImap(f => ({ ...f, imap_poll_enabled: e.target.checked ? '1' : '0' }))}
              />
              Enable auto-poll every 5 minutes
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={testingImap || !imap.imap_host}
              onClick={handleTestImap}
            >
              {testingImap ? 'Testing…' : 'Test IMAP connection'}
            </button>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Extension Token</h3>
          <p className={styles.hint}>
            Use your extension API token to connect the Chrome extension.{' '}
            <a href="/extension" className={styles.link}>Manage on Extension page →</a>
          </p>
        </div>

        <div className={styles.actions} style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
