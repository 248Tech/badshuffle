import React, { useState, useEffect } from 'react';
import { api, getToken } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState({
    company_name: '',
    company_email: '',
    company_logo: '',
    company_address: '',
    mapbox_access_token: '',
    tax_rate: '0',
    currency: 'USD'
  });
  const [quoteInventory, setQuoteInventory] = useState({
    quote_inventory_filter_mode: 'popular',
    quote_inventory_max_categories: '10',
    quote_inventory_manual_categories: ''
  });
  const [smtp, setSmtp] = useState({
    smtp_host: '', smtp_port: '587', smtp_secure: 'false',
    smtp_user: '', smtp_pass: '', smtp_from: ''
  });
  const [imap, setImap] = useState({
    imap_host: '', imap_port: '993', imap_secure: 'true',
    imap_user: '', imap_pass: '', imap_poll_enabled: '0'
  });
  const [recaptcha, setRecaptcha] = useState({
    recaptcha_enabled: '0',
    recaptcha_site_key: '',
    recaptcha_secret_key: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = React.useRef(null);
  const [systemCategories, setSystemCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    api.getCategories().then(d => setSystemCategories(d.categories || [])).catch(() => setSystemCategories([]));
  }, []);

  useEffect(() => {
    api.getSettings()
      .then(s => {
        setForm({
          company_name: s.company_name || '',
          company_email: s.company_email || '',
          company_logo: s.company_logo || '',
          company_address: s.company_address || '',
          mapbox_access_token: s.mapbox_access_token || '',
          tax_rate: s.tax_rate || '0',
          currency: s.currency || 'USD'
        });
        setQuoteInventory({
          quote_inventory_filter_mode: s.quote_inventory_filter_mode || 'popular',
          quote_inventory_max_categories: s.quote_inventory_max_categories || '10',
          quote_inventory_manual_categories: s.quote_inventory_manual_categories || ''
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
        setRecaptcha({
          recaptcha_enabled: s.recaptcha_enabled || '0',
          recaptcha_site_key: s.recaptcha_site_key || '',
          recaptcha_secret_key: s.recaptcha_secret_key || ''
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
        imap_pass_enc: imap.imap_pass,
        ...quoteInventory,
        ...recaptcha
      });
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please choose an image file (e.g. PNG, JPG)');
      return;
    }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const { files } = await api.uploadFiles(formData);
      if (files && files[0]) {
        setForm(f => ({ ...f, company_logo: String(files[0].id) }));
        toast.success('Logo uploaded. Save settings to apply.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
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
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Company Address</label>
              <input
                value={form.company_address}
                onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))}
                placeholder="123 Main St, City, State ZIP"
              />
              <span className={styles.hint}>Used for &quot;Directions from company&quot; when viewing an address on a quote.</span>
            </div>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Company Logo</label>
              <div className={styles.logoRow}>
                <input
                  type="url"
                  value={/^\d+$/.test(form.company_logo) ? '' : form.company_logo}
                  onChange={e => setForm(f => ({ ...f, company_logo: e.target.value }))}
                  placeholder="https://example.com/logo.png or upload below"
                  className={styles.logoUrlInput}
                />
                <span className={styles.logoOr}>or</span>
                <label className={styles.uploadLabel}>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                    disabled={logoUploading}
                  />
                  {logoUploading ? <span className="spinner" /> : 'Upload image'}
                </label>
              </div>
              {form.company_logo && (
                <div className={styles.logoPreviewWrap}>
                  <img
                    src={/^\d+$/.test(form.company_logo) ? `${window.location.origin}${api.fileServeUrl(form.company_logo)}` : form.company_logo}
                    alt="Company logo preview"
                    className={styles.logoPreview}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setForm(f => ({ ...f, company_logo: '' }))}
                  >
                    Clear logo
                  </button>
                </div>
              )}
              <span className={styles.hint}>URL or upload. Shown at the top of the client quote view.</span>
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
          <h3 className={styles.section}>Mapbox</h3>
          <p className={styles.hint} style={{ marginBottom: 12 }}>
            When you click an address on a quote, BadShuffle can show a map and directions. Map data and geocoding are provided by Mapbox. Optional: add an access token to enable the map.
          </p>
          <div className={styles.mapboxInstructions}>
            <p className={styles.mapboxStepsTitle}>How to set up Mapbox</p>
            <ol className={styles.mapboxSteps}>
              <li>Create a free account at <a href="https://account.mapbox.com/auth/signup/" target="_blank" rel="noopener noreferrer" className={styles.link}>Mapbox</a>.</li>
              <li>Go to <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className={styles.link}>Access tokens</a>.</li>
              <li>Use the default public token or create a new one. Copy the token (it starts with <code>pk.</code>).</li>
              <li>Paste it below and save. The address map dialog will then show a Mapbox map when you click client or venue addresses on a quote.</li>
            </ol>
            <p className={styles.hint}>
              <a href="https://docs.mapbox.com/help/getting-started/access-tokens/" target="_blank" rel="noopener noreferrer" className={styles.link}>Mapbox docs: Access tokens</a>
            </p>
          </div>
          <div className={styles.row} style={{ marginTop: 16 }}>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Mapbox access token</label>
              <input
                type="password"
                value={form.mapbox_access_token}
                onChange={e => setForm(f => ({ ...f, mapbox_access_token: e.target.value }))}
                placeholder="pk.eyJ1…"
                autoComplete="off"
              />
              <span className={styles.hint}>Public token only. Leave blank to hide the map; Google Maps links will still work.</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Login protection</h3>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            A simple math question is always shown on the login page. Optionally enable reCAPTCHA v2 when you have a site key and secret from Google.
          </p>
          <div className={styles.row} style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={recaptcha.recaptcha_enabled === '1'}
                onChange={e => setRecaptcha(f => ({ ...f, recaptcha_enabled: e.target.checked ? '1' : '0' }))}
              />
              Enable reCAPTCHA v2 on login
            </label>
          </div>
          {(recaptcha.recaptcha_enabled === '1') && (
            <div className={styles.row} style={{ marginTop: 12 }}>
              <div className="form-group">
                <label>reCAPTCHA site key</label>
                <input
                  value={recaptcha.recaptcha_site_key}
                  onChange={e => setRecaptcha(f => ({ ...f, recaptcha_site_key: e.target.value }))}
                  placeholder="From Google reCAPTCHA admin"
                />
              </div>
              <div className="form-group">
                <label>reCAPTCHA secret key</label>
                <input
                  type="password"
                  value={recaptcha.recaptcha_secret_key}
                  onChange={e => setRecaptcha(f => ({ ...f, recaptcha_secret_key: e.target.value }))}
                  placeholder="Keep secret; used by server only"
                />
              </div>
            </div>
          )}
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
          <h3 className={styles.section}>Quote inventory (sales)</h3>
          <p className={styles.hint} style={{ marginBottom: 12 }}>
            Control which category filter buttons appear above the search bar when adding items to a quote.
          </p>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Category filter source</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="radio"
                    name="quote_inventory_filter_mode"
                    checked={quoteInventory.quote_inventory_filter_mode === 'popular'}
                    onChange={() => setQuoteInventory(q => ({ ...q, quote_inventory_filter_mode: 'popular' }))}
                  />
                  Show popular categories (by quote usage)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="radio"
                    name="quote_inventory_filter_mode"
                    checked={quoteInventory.quote_inventory_filter_mode === 'manual'}
                    onChange={() => setQuoteInventory(q => ({ ...q, quote_inventory_filter_mode: 'manual' }))}
                  />
                  Manually select categories
                </label>
              </div>
            </div>
          </div>
          <div className={styles.row}>
            <div className="form-group" style={{ maxWidth: 140 }}>
              <label>Max categories (1–15)</label>
              <input
                type="number"
                min={1}
                max={15}
                value={quoteInventory.quote_inventory_max_categories}
                onChange={e => setQuoteInventory(q => ({ ...q, quote_inventory_max_categories: e.target.value }))}
              />
            </div>
          </div>
          {quoteInventory.quote_inventory_filter_mode === 'manual' && (
            <div className={styles.row}>
              <div className="form-group" style={{ flex: '1 1 100%' }}>
                <label>Categories to show as filter buttons</label>
                <p className={styles.hint} style={{ marginBottom: 10 }}>Click tags to select or deselect. Only selected categories appear on the quote page.</p>
                {systemCategories.length > 0 && (
                  <>
                    <input
                      type="search"
                      placeholder="Filter categories…"
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className={styles.categoryFilterInput}
                    />
                    <div className={styles.categoryTagGrid}>
                      {(categoryFilter
                        ? systemCategories.filter(c => c.toLowerCase().includes(categoryFilter.toLowerCase()))
                        : systemCategories
                      ).map(cat => {
                        const selected = (quoteInventory.quote_inventory_manual_categories || '')
                          .split(',')
                          .map(s => s.trim())
                          .filter(Boolean)
                          .includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            className={`${styles.categoryTag} ${selected ? styles.categoryTagSelected : ''}`}
                            onClick={() => {
                              const current = (quoteInventory.quote_inventory_manual_categories || '')
                                .split(',')
                                .map(s => s.trim())
                                .filter(Boolean);
                              const next = selected ? current.filter(c => c !== cat) : [...current, cat].sort();
                              setQuoteInventory(q => ({ ...q, quote_inventory_manual_categories: next.join(', ') }));
                            }}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {systemCategories.length === 0 && (
                  <span className={styles.hint}>No categories in inventory yet. Add categories to items in Inventory.</span>
                )}
              </div>
            </div>
          )}
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
