import React, { useState, useEffect } from 'react';
import { api, getToken } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const toast = useToast();
  const THEMES = [
    { id: 'default',  label: 'Default',     primary: '#1a8fc1', accent: '#16b2a5', sidebar: '#0d3b52' },
    { id: 'shadcn',   label: 'shadcn/ui',   primary: '#18181b', accent: '#52525b', sidebar: '#09090b' },
    { id: 'material', label: 'Material UI', primary: '#1976d2', accent: '#9c27b0', sidebar: '#1565c0' },
    { id: 'chakra',   label: 'Chakra UI',   primary: '#3182ce', accent: '#38b2ac', sidebar: '#2d3748' },
    { id: 'noir',     label: 'Noir (Dark)', primary: '#60a5fa', accent: '#34d399', sidebar: '#050509' },
  ];

  const [form, setForm] = useState({
    company_name: '',
    company_email: '',
    company_logo: '',
    company_address: '',
    mapbox_access_token: '',
    map_default_style: 'map',
    google_places_api_key: '',
    quote_event_types: '',
    quote_auto_append_city_title: '0',
    allowed_file_types: '',
    image_webp_quality: '68',
    image_avif_enabled: '0',
    tax_rate: '0',
    currency: 'USD',
    ui_theme: 'default',
    ui_scale: '100'
  });
  const [quoteInventory, setQuoteInventory] = useState({
    quote_inventory_filter_mode: 'popular',
    quote_inventory_max_categories: '10',
    quote_inventory_manual_categories: '',
    count_oos_oversold: '0',
    inventory_show_source: '0'
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
  const [aiKeys, setAiKeys] = useState({ ai_claude_key: '', ai_openai_key: '', ai_gemini_key: '' });
  const [aiFeatures, setAiFeatures] = useState({
    ai_suggest_enabled: '1', ai_suggest_model: 'claude',
    ai_pdf_import_enabled: '1', ai_pdf_import_model: 'claude',
    ai_email_draft_enabled: '0', ai_email_draft_model: 'claude',
    ai_description_enabled: '0', ai_description_model: 'claude',
  });
  const [quoteView, setQuoteView] = useState({
    quote_view_default: 'standard',
    quote_view_standard_enabled: '1',
    quote_view_contract_enabled: '1',
  });
  const [advanced, setAdvanced] = useState({ verbose_errors: '0' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImap, setTestingImap] = useState(false);

  // Updates
  const [updateInfo, setUpdateInfo]         = useState(null);
  const [updateReleases, setUpdateReleases] = useState(null);
  const [selectedTag, setSelectedTag]       = useState('');
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateApplying, setUpdateApplying] = useState(false);
  const [updateStatus, setUpdateStatus]     = useState('');   // 'restarting' | ''
  const [updateError, setUpdateError]       = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [, setLogoServeEpoch] = useState(0);
  const logoInputRef = React.useRef(null);
  const [systemCategories, setSystemCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [compressionPreview, setCompressionPreview] = useState({ original: '', compressed: '' });
  const [compressionPreviewLoading, setCompressionPreviewLoading] = useState(false);

  useEffect(() => {
    api.getCategories().then(d => setSystemCategories(d.categories || [])).catch(() => setSystemCategories([]));
    api.getUpdateStatus().then(setUpdateInfo).catch(() => {});
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
          map_default_style: s.map_default_style || 'map',
          google_places_api_key: s.google_places_api_key || '',
          quote_event_types: s.quote_event_types || '',
          quote_auto_append_city_title: s.quote_auto_append_city_title || '0',
          allowed_file_types: s.allowed_file_types || '',
          image_webp_quality: s.image_webp_quality || '68',
          image_avif_enabled: s.image_avif_enabled || '0',
          tax_rate: s.tax_rate || '0',
          currency: s.currency || 'USD',
          ui_theme: s.ui_theme || 'default',
          ui_scale: s.ui_scale || '100'
        });
        // Apply saved theme on load
        const t = s.ui_theme || 'default';
        if (t === 'default') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', t);
        // Apply saved scale on load
        const scale = parseFloat(s.ui_scale) || 100;
        document.documentElement.style.fontSize = (scale / 100) * 14 + 'px';
        setQuoteInventory({
          quote_inventory_filter_mode: s.quote_inventory_filter_mode || 'popular',
          quote_inventory_max_categories: s.quote_inventory_max_categories || '10',
          quote_inventory_manual_categories: s.quote_inventory_manual_categories || '',
          count_oos_oversold: s.count_oos_oversold || '0',
          inventory_show_source: s.inventory_show_source || '0'
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
        setAiKeys({
          ai_claude_key: s.ai_claude_key || '',
          ai_openai_key: s.ai_openai_key || '',
          ai_gemini_key: s.ai_gemini_key || '',
        });
        setAiFeatures({
          ai_suggest_enabled: s.ai_suggest_enabled || '1',
          ai_suggest_model: s.ai_suggest_model || 'claude',
          ai_pdf_import_enabled: s.ai_pdf_import_enabled || '1',
          ai_pdf_import_model: s.ai_pdf_import_model || 'claude',
          ai_email_draft_enabled: s.ai_email_draft_enabled || '0',
          ai_email_draft_model: s.ai_email_draft_model || 'claude',
          ai_description_enabled: s.ai_description_enabled || '0',
          ai_description_model: s.ai_description_model || 'claude',
        });
        setQuoteView({
          quote_view_default: s.quote_view_default || 'standard',
          quote_view_standard_enabled: s.quote_view_standard_enabled !== undefined ? s.quote_view_standard_enabled : '1',
          quote_view_contract_enabled: s.quote_view_contract_enabled !== undefined ? s.quote_view_contract_enabled : '1',
        });
        setAdvanced({ verbose_errors: s.verbose_errors || '0' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const cl = form.company_logo?.trim();
    if (!cl || !/^\d+$/.test(cl)) return;
    api.prefetchFileServeUrls([cl]).then(() => setLogoServeEpoch((e) => e + 1)).catch(() => {});
  }, [form.company_logo]);

  useEffect(() => {
    let cancelled = false;
    const quality = Number(form.image_webp_quality || 68);
    const avifEnabled = form.image_avif_enabled === '1';
    setCompressionPreviewLoading(true);
    Promise.all([
      api.getImageCompressionPreview({ original: true }),
      api.getImageCompressionPreview({ quality, format: avifEnabled ? 'avif' : 'webp', avif: avifEnabled }),
    ])
      .then(([originalBlob, compressedBlob]) => {
        if (cancelled) return;
        const next = {
          original: URL.createObjectURL(originalBlob),
          compressed: URL.createObjectURL(compressedBlob),
        };
        setCompressionPreview((prev) => {
          if (prev.original) URL.revokeObjectURL(prev.original);
          if (prev.compressed) URL.revokeObjectURL(prev.compressed);
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompressionPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.image_webp_quality, form.image_avif_enabled]);

  const handleCheckUpdates = async () => {
    setUpdateChecking(true);
    setUpdateError('');
    setUpdateReleases(null);
    try {
      const data = await api.getUpdateReleases();
      const releases = data.releases || [];
      setUpdateReleases(releases);
      const newerInstallable = releases.find(r => r.is_newer && r.installable);
      const newer = newerInstallable || releases.find(r => r.is_newer) || null;
      setSelectedTag(newer ? newer.tag : (releases[0]?.tag || ''));
      if (updateInfo?.is_pkg && releases.length > 0 && !newerInstallable && releases.some(r => r.is_newer)) {
        setUpdateError('A newer release exists, but it does not include packaged update assets yet.');
      }
      // refresh cached status
      api.getUpdateStatus().then(setUpdateInfo).catch(() => {});
    } catch (e) {
      setUpdateError(e.message || 'Could not reach GitHub');
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!selectedTag) return;
    setUpdateApplying(true);
    setUpdateError('');
    try {
      await api.applyUpdate(selectedTag);
      setUpdateStatus('restarting');
      // Poll /api/health until server comes back, then reload
      const pollStart = Date.now();
      const poll = () => {
        setTimeout(async () => {
          try {
            const r = await fetch('/api/health');
            if (r.ok) { window.location.reload(); return; }
          } catch {}
          if (Date.now() - pollStart < 60000) poll();
        }, 2000);
      };
      poll();
    } catch (e) {
      setUpdateError(e.message || 'Update failed');
      setUpdateApplying(false);
    }
  };

  const handleThemeChange = (themeId) => {
    setForm(f => ({ ...f, ui_theme: themeId }));
    if (themeId === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', themeId);
  };

  const handleScaleChange = (val) => {
    const clamped = Math.min(150, Math.max(75, Number(val)));
    setForm(f => ({ ...f, ui_scale: String(clamped) }));
    document.documentElement.style.fontSize = (clamped / 100) * 14 + 'px';
  };

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
        ...quoteView,
        ...recaptcha,
        ai_claude_key_enc: aiKeys.ai_claude_key,
        ai_openai_key_enc: aiKeys.ai_openai_key,
        ai_gemini_key_enc: aiKeys.ai_gemini_key,
        ...aiFeatures,
        ...advanced,
      });
      localStorage.setItem('bs_theme', form.ui_theme || 'default');
      localStorage.setItem('bs_ui_scale', form.ui_scale || '100');
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
        const fid = String(files[0].id);
        setForm(f => ({ ...f, company_logo: fid }));
        api.prefetchFileServeUrls([fid]).catch(() => {});
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

  if (loading) return (
    <div className={styles.page} aria-busy="true" aria-label="Loading settings">
      <div className={styles.header} aria-hidden="true">
        <div className="skeleton" style={{ height: 24, width: 120, borderRadius: 5 }} />
        <div className="skeleton" style={{ height: 13, width: 240, borderRadius: 4, marginTop: 6 }} />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 24 }} aria-hidden="true">
          <div className="skeleton" style={{ height: 13, width: 100, borderRadius: 4, marginBottom: 20 }} />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} style={{ marginBottom: 16 }}>
              <div className="skeleton" style={{ height: 11, width: 80, borderRadius: 3, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 36, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.sub}>Configure company info and quote defaults.</p>
      </div>

      <form onSubmit={handleSave}>
        <div className={`card ${styles.card}`}>
          <h3 className={styles.section}>Appearance</h3>
          <p className={styles.hint} style={{ marginBottom: 14 }}>Choose a UI skin. Changes apply instantly as a live preview.</p>
          <div className={styles.themeGrid}>
            {THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                className={`${styles.themeCard} ${form.ui_theme === t.id ? styles.themeCardSelected : ''}`}
                onClick={() => handleThemeChange(t.id)}
              >
                <div className={styles.themeSwatches}>
                  <span style={{ background: t.primary }} />
                  <span style={{ background: t.accent }} />
                  <span style={{ background: t.sidebar }} />
                </div>
                <span className={styles.themeName}>{t.label}</span>
                {form.ui_theme === t.id && (
                  <span className={styles.themeCheck}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <label htmlFor="s-ui-scale" style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 8 }}>
              UI Scale: {form.ui_scale}%
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 320 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>75%</span>
              <input
                id="s-ui-scale"
                type="range"
                min="75"
                max="150"
                step="5"
                value={form.ui_scale}
                onChange={e => handleScaleChange(e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>150%</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Adjusts text and element size across the app. Default: 100%.
            </p>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Company</h3>
          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="s-company-name">Company Name</label>
              <input
                id="s-company-name"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="Acme Events Co."
              />
            </div>
            <div className="form-group">
              <label htmlFor="s-company-email">Company Email</label>
              <input
                id="s-company-email"
                type="email"
                value={form.company_email}
                onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))}
                placeholder="hello@example.com"
              />
            </div>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label htmlFor="s-company-address">Company Address</label>
              <input
                id="s-company-address"
                value={form.company_address}
                onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))}
                placeholder="123 Main St, City, State ZIP"
              />
              <span className={styles.hint}>Used for &quot;Directions from company&quot; when viewing an address on a quote.</span>
            </div>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label htmlFor="s-company-logo">Company Logo</label>
              <div className={styles.logoRow}>
                <input
                  id="s-company-logo"
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
                    aria-hidden="true"
                  />
                  {logoUploading ? <span className="spinner" /> : 'Upload image'}
                </label>
              </div>
              {form.company_logo && (
                <div className={styles.logoPreviewWrap}>
                  <img
                    src={/^\d+$/.test(form.company_logo) ? `${window.location.origin}${api.fileServeUrl(form.company_logo, { variant: 'ui' })}` : form.company_logo}
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
              <label htmlFor="s-tax-rate">Tax Rate (%)</label>
              <input
                id="s-tax-rate"
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
              <label htmlFor="s-currency">Currency</label>
              <select id="s-currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="USD">USD — US Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="AUD">AUD — Australian Dollar</option>
              </select>
            </div>
          </div>

          <h3 className={styles.section}>Allowed file types</h3>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label htmlFor="s-allowed-file-types">Extra allowed upload types</label>
              <textarea
                id="s-allowed-file-types"
                rows={3}
                value={form.allowed_file_types}
                onChange={e => setForm(f => ({ ...f, allowed_file_types: e.target.value }))}
                placeholder=".docx, .xlsx, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              <span className={styles.hint}>
                Add extra upload types as file extensions or MIME types, separated by commas or spaces. Default image and PDF types are already allowed.
              </span>
            </div>
          </div>

          <h3 className={styles.section}>Image compression</h3>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 260px' }}>
              <label htmlFor="s-image-webp-quality">WebP quality: {form.image_webp_quality}</label>
              <input
                id="s-image-webp-quality"
                type="range"
                min="40"
                max="90"
                step="1"
                value={form.image_webp_quality}
                onChange={e => setForm(f => ({ ...f, image_webp_quality: e.target.value }))}
              />
              <span className={styles.hint}>New image uploads are auto-converted to WebP and compressed aggressively. Lower values reduce size further.</span>
            </div>
            <div className="form-group" style={{ flex: '1 1 220px', alignSelf: 'end' }}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={form.image_avif_enabled === '1'}
                  onChange={e => setForm(f => ({ ...f, image_avif_enabled: e.target.checked ? '1' : '0' }))}
                />
                <span>Also generate AVIF variants</span>
              </label>
              <span className={styles.hint}>When enabled, compatible browsers will receive even smaller AVIF images. WebP remains the fallback.</span>
            </div>
          </div>
          <div className={styles.compressionPreviewCard}>
            <div className={styles.compressionPreviewHeader}>
              <div>
                <strong>Quality preview</strong>
                <p className={styles.hint} style={{ marginTop: 6 }}>
                  Preview uses the same server-side compression pipeline as uploads. Originals are discarded after processing and the UI serves optimized variants.
                </p>
              </div>
              <span className={styles.previewBadge}>
                {form.image_avif_enabled === '1' ? 'AVIF + WebP' : 'WebP only'}
              </span>
            </div>
            <div className={styles.compressionPreviewGrid}>
              <div className={styles.previewPanel}>
                <span className={styles.previewLabel}>Original sample</span>
                <div className={styles.previewImageFrame}>
                  {compressionPreview.original ? (
                    <img src={compressionPreview.original} alt="Original compression sample" className={styles.previewImage} />
                  ) : (
                    <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                  )}
                </div>
              </div>
              <div className={styles.previewPanel}>
                <span className={styles.previewLabel}>
                  Compressed preview
                  {compressionPreviewLoading ? ' (updating...)' : ` (${form.image_avif_enabled === '1' ? 'AVIF preferred' : 'WebP'})`}
                </span>
                <div className={styles.previewImageFrame}>
                  {compressionPreview.compressed ? (
                    <img src={compressionPreview.compressed} alt="Compressed compression sample" className={styles.previewImage} />
                  ) : (
                    <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                  )}
                </div>
              </div>
            </div>
            <p className={styles.hint} style={{ marginTop: 12 }}>
              New uploads generate <strong>thumb</strong>, <strong>ui</strong>, and <strong>large</strong> variants for fast grids, normal app views, and larger detail displays.
            </p>
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
              <label htmlFor="s-mapbox-token">Mapbox access token</label>
              <input
                id="s-mapbox-token"
                type="password"
                value={form.mapbox_access_token}
                onChange={e => setForm(f => ({ ...f, mapbox_access_token: e.target.value }))}
                placeholder="pk.eyJ1…"
                autoComplete="off"
              />
              <span className={styles.hint}>Public token only. Leave blank to hide the map; Google Maps links will still work.</span>
            </div>
          </div>
          <div className={styles.row} style={{ marginTop: 12 }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label htmlFor="s-map-style">Open map dialog as</label>
              <select
                id="s-map-style"
                value={form.map_default_style || 'map'}
                onChange={e => setForm(f => ({ ...f, map_default_style: e.target.value }))}
              >
                <option value="map">Map</option>
                <option value="sat">Satellite</option>
              </select>
              <span className={styles.hint}>Default style when opening the address map from a quote.</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Google Places</h3>
          <p className={styles.hint} style={{ marginBottom: 12 }}>
            Enables address autocomplete when creating a quote. Uses the Google Places API.
          </p>
          <ol className={styles.mapboxSteps} style={{ marginBottom: 16 }}>
            <li>Open the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className={styles.link}>Google Cloud Console</a> and create or select a project.</li>
            <li>Enable the <strong>Places API</strong> (and optionally <strong>Maps JavaScript API</strong>) from the API Library.</li>
            <li>Go to <strong>Credentials</strong> → <strong>Create credentials</strong> → <strong>API key</strong>.</li>
            <li>Restrict the key to your domain if desired, then paste it below.</li>
          </ol>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label htmlFor="s-gplaces-key">Google Places API key</label>
              <input
                id="s-gplaces-key"
                type="password"
                value={form.google_places_api_key}
                onChange={e => setForm(f => ({ ...f, google_places_api_key: e.target.value }))}
                placeholder="AIza…"
                autoComplete="off"
              />
              <span className={styles.hint}>Address autocomplete will appear in the new quote wizard once a key is saved.</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Sales Team</h3>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label htmlFor="s-event-types">Event types</label>
              <textarea
                id="s-event-types"
                rows={6}
                value={form.quote_event_types}
                onChange={e => setForm(f => ({ ...f, quote_event_types: e.target.value }))}
                placeholder={'Wedding\nCorporate\nBirthday'}
              />
              <span className={styles.hint}>One event type per line. These appear in the project create and edit event details screens.</span>
            </div>
          </div>
          <div className={styles.row} style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.quote_auto_append_city_title === '1'}
                onChange={e => setForm(f => ({ ...f, quote_auto_append_city_title: e.target.checked ? '1' : '0' }))}
              />
              <span>Automatically append the project city to the title</span>
            </label>
          </div>
          <p className={styles.hint}>Example: <code>Maria Antaran&apos;s Wedding - Clarkston</code>.</p>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Client quote view</h3>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            Control which view modes are available on the public quote link and which is shown by default.
          </p>
          <div className={styles.row} style={{ flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={quoteView.quote_view_standard_enabled === '1'}
                onChange={e => setQuoteView(q => ({ ...q, quote_view_standard_enabled: e.target.checked ? '1' : '0' }))}
              />
              <span>Enable <strong>Standard view</strong> — card grid with large photos</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={quoteView.quote_view_contract_enabled === '1'}
                onChange={e => setQuoteView(q => ({ ...q, quote_view_contract_enabled: e.target.checked ? '1' : '0' }))}
              />
              <span>Enable <strong>Contract view</strong> — formal document layout</span>
            </label>
          </div>
          <div className={styles.row} style={{ marginTop: 14 }}>
            <div className="form-group" role="group" aria-labelledby="s-quote-view-default">
              <span id="s-quote-view-default" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Default view</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="radio"
                    name="quote_view_default"
                    checked={quoteView.quote_view_default === 'standard'}
                    onChange={() => setQuoteView(q => ({ ...q, quote_view_default: 'standard' }))}
                  />
                  Standard view
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="radio"
                    name="quote_view_default"
                    checked={quoteView.quote_view_default === 'contract'}
                    onChange={() => setQuoteView(q => ({ ...q, quote_view_default: 'contract' }))}
                  />
                  Contract view
                </label>
              </div>
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
                <label htmlFor="s-recaptcha-site">reCAPTCHA site key</label>
                <input
                  id="s-recaptcha-site"
                  value={recaptcha.recaptcha_site_key}
                  onChange={e => setRecaptcha(f => ({ ...f, recaptcha_site_key: e.target.value }))}
                  placeholder="From Google reCAPTCHA admin"
                />
              </div>
              <div className="form-group">
                <label htmlFor="s-recaptcha-secret">reCAPTCHA secret key</label>
                <input
                  id="s-recaptcha-secret"
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
              <label htmlFor="s-smtp-host">SMTP Host</label>
              <input id="s-smtp-host" value={smtp.smtp_host} onChange={e => setSmtp(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label htmlFor="s-smtp-port">Port</label>
              <input id="s-smtp-port" type="number" value={smtp.smtp_port} onChange={e => setSmtp(f => ({ ...f, smtp_port: e.target.value }))} />
            </div>
            <div className="form-group" style={{ maxWidth: 120 }}>
              <label htmlFor="s-smtp-secure">Secure (TLS)</label>
              <select id="s-smtp-secure" value={smtp.smtp_secure} onChange={e => setSmtp(f => ({ ...f, smtp_secure: e.target.value }))}>
                <option value="false">STARTTLS</option>
                <option value="true">TLS/SSL</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="s-smtp-user">Username</label>
              <input id="s-smtp-user" value={smtp.smtp_user} onChange={e => setSmtp(f => ({ ...f, smtp_user: e.target.value }))} placeholder="user@example.com" />
            </div>
            <div className="form-group">
              <label htmlFor="s-smtp-pass">Password</label>
              <input id="s-smtp-pass" type="password" value={smtp.smtp_pass} onChange={e => setSmtp(f => ({ ...f, smtp_pass: e.target.value }))} placeholder="App password" />
            </div>
            <div className="form-group">
              <label htmlFor="s-smtp-from">From address</label>
              <input id="s-smtp-from" value={smtp.smtp_from} onChange={e => setSmtp(f => ({ ...f, smtp_from: e.target.value }))} placeholder="Acme Events <noreply@example.com>" />
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
              <label htmlFor="s-imap-host">IMAP Host</label>
              <input id="s-imap-host" value={imap.imap_host} onChange={e => setImap(f => ({ ...f, imap_host: e.target.value }))} placeholder="imap.gmail.com" />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label htmlFor="s-imap-port">Port</label>
              <input id="s-imap-port" type="number" value={imap.imap_port} onChange={e => setImap(f => ({ ...f, imap_port: e.target.value }))} />
            </div>
            <div className="form-group" style={{ maxWidth: 120 }}>
              <label htmlFor="s-imap-secure">Secure</label>
              <select id="s-imap-secure" value={imap.imap_secure} onChange={e => setImap(f => ({ ...f, imap_secure: e.target.value }))}>
                <option value="true">TLS/SSL</option>
                <option value="false">STARTTLS</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="s-imap-user">Username</label>
              <input id="s-imap-user" value={imap.imap_user} onChange={e => setImap(f => ({ ...f, imap_user: e.target.value }))} placeholder="user@example.com" />
            </div>
            <div className="form-group">
              <label htmlFor="s-imap-pass">Password</label>
              <input id="s-imap-pass" type="password" value={imap.imap_pass} onChange={e => setImap(f => ({ ...f, imap_pass: e.target.value }))} placeholder="App password" />
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
            <div className="form-group" role="group" aria-labelledby="s-cat-filter-source" style={{ flex: '1 1 100%' }}>
              <span id="s-cat-filter-source" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Category filter source</span>
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
              <label htmlFor="s-max-cats">Max categories (1–15)</label>
              <input
                id="s-max-cats"
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
                <span style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>Categories to show as filter buttons</span>
                <p className={styles.hint} style={{ marginBottom: 10 }}>Click tags to select or deselect. Only selected categories appear on the quote page.</p>
                {systemCategories.length > 0 && (
                  <>
                    <input
                      type="search"
                      aria-label="Filter categories"
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
          <h3 className={styles.section}>Availability &amp; Conflicts</h3>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={quoteInventory.count_oos_oversold === '1'}
              onChange={e => setQuoteInventory(q => ({ ...q, count_oos_oversold: e.target.checked ? '1' : '0' }))}
            />
            <span>Count out-of-stock items (quantity = 0) as oversold in conflict detection</span>
          </label>
          <label className={styles.checkRow} style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={quoteInventory.inventory_show_source === '1'}
              onChange={e => setQuoteInventory(q => ({ ...q, inventory_show_source: e.target.checked ? '1' : '0' }))}
            />
            <span>Show source indicator on inventory cards (puzzle piece icon for extension-imported items)</span>
          </label>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>AI Integration</h3>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            Connect AI providers and enable AI-powered features. API keys are stored encrypted.
          </p>

          <h3 className={styles.section} style={{ marginTop: 8 }}>API Keys</h3>
          <div className={styles.row}>
            <div className="form-group">
              <label>Anthropic (Claude) API Key</label>
              <input
                type="password"
                value={aiKeys.ai_claude_key}
                onChange={e => setAiKeys(k => ({ ...k, ai_claude_key: e.target.value }))}
                placeholder="sk-ant-…"
                autoComplete="off"
              />
              <span className={styles.hint}>Used when a feature is set to Claude.</span>
            </div>
            <div className="form-group">
              <label>OpenAI (GPT-4) API Key</label>
              <input
                type="password"
                value={aiKeys.ai_openai_key}
                onChange={e => setAiKeys(k => ({ ...k, ai_openai_key: e.target.value }))}
                placeholder="sk-…"
                autoComplete="off"
              />
              <span className={styles.hint}>Used when a feature is set to GPT-4.</span>
            </div>
            <div className="form-group">
              <label>Google (Gemini) API Key</label>
              <input
                type="password"
                value={aiKeys.ai_gemini_key}
                onChange={e => setAiKeys(k => ({ ...k, ai_gemini_key: e.target.value }))}
                placeholder="AIza…"
                autoComplete="off"
              />
              <span className={styles.hint}>Used when a feature is set to Gemini.</span>
            </div>
          </div>

          <h3 className={styles.section} style={{ marginTop: 8 }}>Feature Toggles</h3>
          <div className={styles.aiFeatureTable}>
            {[
              { key: 'ai_suggest', label: 'AI Quote Suggestions', desc: 'Recommends items to add based on event type and guest count.' },
              { key: 'ai_pdf_import', label: 'PDF Quote Import', desc: 'Extracts line items from uploaded PDF quotes.' },
              { key: 'ai_email_draft', label: 'AI Email Drafts', desc: 'Drafts follow-up and confirmation emails.' },
              { key: 'ai_description', label: 'AI Item Descriptions', desc: 'Generates item descriptions in inventory.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className={styles.aiFeatureRow}>
                <div className={styles.aiFeatureInfo}>
                  <label className={styles.aiFeatureLabel}>
                    <input
                      type="checkbox"
                      checked={aiFeatures[`${key}_enabled`] === '1'}
                      onChange={e => setAiFeatures(f => ({ ...f, [`${key}_enabled`]: e.target.checked ? '1' : '0' }))}
                    />
                    {label}
                  </label>
                  <span className={styles.hint}>{desc}</span>
                </div>
                <div className={styles.aiModelSelect}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Model</label>
                  <select
                    value={aiFeatures[`${key}_model`]}
                    onChange={e => setAiFeatures(f => ({ ...f, [`${key}_model`]: e.target.value }))}
                    disabled={aiFeatures[`${key}_enabled`] !== '1'}
                  >
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="gpt4">GPT-4 (OpenAI)</option>
                    <option value="gemini">Gemini (Google)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Updates ─────────────────────────────────────────────────── */}
        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Updates</h3>

          <div className={styles.updateRow}>
            <span className={styles.updateVersion}>
              Current version: <strong>v{updateInfo?.current || '…'}</strong>
              {updateInfo?.update_available && (
                <span className={styles.updateBadge}>Update available</span>
              )}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCheckUpdates}
              disabled={updateChecking || updateStatus === 'restarting'}
            >
              {updateChecking ? 'Checking…' : 'Check for Updates'}
            </button>
          </div>

          {updateError && (
            <p className={styles.updateError}>{updateError}</p>
          )}

          {updateStatus === 'restarting' && (
            <div className={styles.updateRestarting}>
              <span className={styles.updateSpinner} />
              Update installed — waiting for server to restart…
            </div>
          )}

          {updateReleases && updateReleases.length > 0 && updateStatus !== 'restarting' && (
            <div className={styles.updatePanel}>
              <div className={styles.updateSelectRow}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label>Release</label>
                  <select
                    value={selectedTag}
                    onChange={e => setSelectedTag(e.target.value)}
                    disabled={updateApplying}
                  >
                    {updateReleases.map(r => (
                      <option key={r.tag} value={r.tag}>
                        {r.name || r.tag}{r.is_newer ? ' ★ newer' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {updateInfo?.is_pkg ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleApplyUpdate}
                    disabled={updateApplying || !selectedTag || !updateReleases.find(r => r.tag === selectedTag)?.installable}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {updateApplying ? 'Installing…' : 'Install'}
                  </button>
                ) : (
                  <span className={styles.hint} style={{ alignSelf: 'flex-end', paddingBottom: 6 }}>
                    Auto-install only available in the packaged .exe build.
                  </span>
                )}
              </div>

              {/* What's New */}
              {selectedTag && (() => {
                const rel = updateReleases.find(r => r.tag === selectedTag);
                if (!rel) return null;
                return (
                  <>
                    {updateInfo?.is_pkg && !rel.installable && (
                      <p className={styles.updateError} style={{ marginTop: 8 }}>
                        This release cannot be auto-installed because the packaged update assets are missing.
                      </p>
                    )}
                    {rel.body ? (
                      <details className={styles.whatsNew} open>
                        <summary>What's New in {rel.name || rel.tag}</summary>
                        <pre className={styles.whatsNewBody}>{rel.body.trim()}</pre>
                      </details>
                    ) : null}
                  </>
                );
              })()}
            </div>
          )}

          {updateReleases && updateReleases.length === 0 && (
            <p className={styles.hint} style={{ marginTop: 8 }}>No releases found.</p>
          )}
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Advanced</h3>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={advanced.verbose_errors === '1'}
              onChange={e => setAdvanced(a => ({ ...a, verbose_errors: e.target.checked ? '1' : '0' }))}
            />
            <span>Show verbose error details on error screens</span>
          </label>
          <p className={styles.hint} style={{ marginTop: 6 }}>
            When enabled, internal error messages are shown on error screens and returned in API error responses. Useful for debugging; disable in production.
          </p>
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
