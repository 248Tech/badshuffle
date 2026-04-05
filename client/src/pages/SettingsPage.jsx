import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './SettingsPage.module.css';
import { AI_PROVIDER_MODELS, AI_PROVIDER_OPTIONS, getDefaultModelForProvider } from '../lib/aiProviderOptions.js';

function parseFeatureModelSetting(rawValue, fallbackProvider = 'claude') {
  const normalized = String(rawValue || '').trim();
  if (!normalized) {
    return {
      provider: fallbackProvider,
      model: getDefaultModelForProvider(fallbackProvider),
    };
  }

  if (normalized.includes(':')) {
    const [providerPart, ...modelParts] = normalized.split(':');
    const provider = String(providerPart || fallbackProvider).trim().toLowerCase() || fallbackProvider;
    const model = modelParts.join(':').trim() || getDefaultModelForProvider(provider);
    return { provider, model };
  }

  if (normalized === 'gpt4') {
    return { provider: 'openai', model: getDefaultModelForProvider('openai') };
  }

  if (AI_PROVIDER_MODELS[normalized]) {
    return {
      provider: normalized,
      model: getDefaultModelForProvider(normalized),
    };
  }

  return {
    provider: fallbackProvider,
    model: normalized,
  };
}

function serializeFeatureModelSetting(provider, model) {
  const normalizedProvider = String(provider || 'claude').trim().toLowerCase() || 'claude';
  const normalizedModel = String(model || '').trim() || getDefaultModelForProvider(normalizedProvider);
  return `${normalizedProvider}:${normalizedModel}`;
}

export default function SettingsPage() {
  const toast = useToast();

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
    presence_offline_after_minutes: '30',
    app_timezone: 'America/New_York',
    notification_tray_position: 'bottom_right',
    allowed_file_types: '',
    image_compression_enabled: '1',
    image_auto_webp_enabled: '1',
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
  const [aiKeys, setAiKeys] = useState({ ai_claude_key: '', ai_openai_key: '', ai_gemini_key: '', onyx_api_key: '' });
  const [aiFeatures, setAiFeatures] = useState({
    ai_suggest_enabled: '1', ai_suggest_model: 'claude',
    ai_pdf_import_enabled: '1', ai_pdf_import_model: 'claude',
    ai_email_draft_enabled: '0', ai_email_draft_model: 'claude',
    ai_description_enabled: '0', ai_description_model: 'claude',
  });
  const [aiAssistant, setAiAssistant] = useState({
    ai_agent_enabled: '1',
    ai_agent_provider: 'openai',
    ai_agent_model: 'gpt-4o-mini',
  });
  const [localAi, setLocalAi] = useState({
    ai_local_enabled: '0',
    ai_local_mode: 'managed_ollama',
    ai_local_autostart_enabled: '1',
    ai_local_install_path: '',
    ai_local_base_url: 'http://127.0.0.1:11434',
    ai_local_default_model: 'llama3.2:3b',
  });
  const [localAiDiag, setLocalAiDiag] = useState(null);
  const [onyx, setOnyx] = useState({
    onyx_enabled: '0',
    onyx_mode: 'managed_local',
    onyx_local_enabled: '1',
    onyx_local_autostart_enabled: '1',
    onyx_local_install_path: '',
    onyx_local_port: '3000',
    onyx_external_enabled: '1',
    onyx_base_url: '',
    onyx_default_persona_id: '',
    onyx_team_persona_id: '',
    onyx_quote_persona_id: '',
    team_chat_ai_fallback_enabled: '1',
  });
  const [quoteView, setQuoteView] = useState({
    quote_view_default: 'standard',
    quote_view_standard_enabled: '1',
    quote_view_contract_enabled: '1',
  });
  const [advanced, setAdvanced] = useState({ verbose_errors: '0' });
  const [encryptedSettingsScan, setEncryptedSettingsScan] = useState(null);
  const [encryptedSettingsLoading, setEncryptedSettingsLoading] = useState(false);
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
  const [systemCategories, setSystemCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [compressionPreview, setCompressionPreview] = useState({ original: '', compressed: '' });
  const [compressionPreviewLoading, setCompressionPreviewLoading] = useState(false);

  useEffect(() => {
    api.getCategories().then(d => setSystemCategories(d.categories || [])).catch(() => setSystemCategories([]));
    api.getUpdateStatus().then(setUpdateInfo).catch(() => {});
    api.admin.getLocalModelDiagnostics().then(setLocalAiDiag).catch(() => setLocalAiDiag(null));
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
          presence_offline_after_minutes: s.presence_offline_after_minutes || '30',
          app_timezone: s.app_timezone || 'America/New_York',
          notification_tray_position: s.notification_tray_position || 'bottom_right',
          allowed_file_types: s.allowed_file_types || '',
          image_compression_enabled: s.image_compression_enabled !== undefined ? s.image_compression_enabled : '1',
          image_auto_webp_enabled: s.image_auto_webp_enabled !== undefined ? s.image_auto_webp_enabled : '1',
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
          onyx_api_key: s.onyx_api_key || '',
        });
        setOnyx({
          onyx_enabled: s.onyx_enabled || '0',
          onyx_mode: s.onyx_mode || 'managed_local',
          onyx_local_enabled: s.onyx_local_enabled !== undefined ? s.onyx_local_enabled : '1',
          onyx_local_autostart_enabled: s.onyx_local_autostart_enabled !== undefined ? s.onyx_local_autostart_enabled : '1',
          onyx_local_install_path: s.onyx_local_install_path || '',
          onyx_local_port: s.onyx_local_port || '3000',
          onyx_external_enabled: s.onyx_external_enabled !== undefined ? s.onyx_external_enabled : '1',
          onyx_base_url: s.onyx_base_url || '',
          onyx_default_persona_id: s.onyx_default_persona_id || '',
          onyx_team_persona_id: s.onyx_team_persona_id || '',
          onyx_quote_persona_id: s.onyx_quote_persona_id || '',
          team_chat_ai_fallback_enabled: s.team_chat_ai_fallback_enabled !== undefined ? s.team_chat_ai_fallback_enabled : '1',
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
        setAiAssistant({
          ai_agent_enabled: s.ai_agent_enabled !== undefined ? s.ai_agent_enabled : '1',
          ai_agent_provider: s.ai_agent_provider || 'openai',
          ai_agent_model: s.ai_agent_model || 'gpt-4o-mini',
        });
        setLocalAi({
          ai_local_enabled: s.ai_local_enabled !== undefined ? s.ai_local_enabled : '0',
          ai_local_mode: s.ai_local_mode || 'managed_ollama',
          ai_local_autostart_enabled: s.ai_local_autostart_enabled !== undefined ? s.ai_local_autostart_enabled : '1',
          ai_local_install_path: s.ai_local_install_path || '',
          ai_local_base_url: s.ai_local_base_url || 'http://127.0.0.1:11434',
          ai_local_default_model: s.ai_local_default_model || 'llama3.2:3b',
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
    let cancelled = false;
    const quality = Number(form.image_webp_quality || 68);
    const compressionEnabled = form.image_compression_enabled === '1';
    const autoWebpEnabled = form.image_auto_webp_enabled === '1';
    const avifEnabled = form.image_avif_enabled === '1';
    setCompressionPreviewLoading(true);
    const originalRequest = api.getImageCompressionPreview({ original: true });
    const optimizedRequest = compressionEnabled
      ? api.getImageCompressionPreview({
          quality,
          format: avifEnabled ? 'avif' : (autoWebpEnabled ? 'webp' : 'png'),
          avif: avifEnabled,
        })
      : originalRequest;
    Promise.all([originalRequest, optimizedRequest])
      .then(([originalBlob, optimizedBlob]) => {
        if (cancelled) return;
        const next = {
          original: URL.createObjectURL(originalBlob),
          compressed: URL.createObjectURL(optimizedBlob),
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
  }, [form.image_compression_enabled, form.image_auto_webp_enabled, form.image_webp_quality, form.image_avif_enabled]);

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
        onyx_api_key_enc: aiKeys.onyx_api_key,
        ...aiFeatures,
        ...aiAssistant,
        ...localAi,
        ...onyx,
        ...advanced,
      });
      localStorage.setItem('bs_theme', form.ui_theme || 'default');
      localStorage.setItem('bs_ui_scale', form.ui_scale || '100');
      window.dispatchEvent(new CustomEvent('bs:settings-updated', {
        detail: {
          settings: {
            notification_tray_position: form.notification_tray_position,
          },
        },
      }));
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssistantProviderChange = (provider) => {
    const normalizedProvider = String(provider || 'openai').trim().toLowerCase();
    const providerModels = getModelOptionsForProvider(normalizedProvider);
    const nextModel = providerModels[0]?.value || '';
    setAiAssistant((current) => ({
      ...current,
      ai_agent_provider: normalizedProvider,
      ai_agent_model: nextModel,
    }));
  };

  const getModelOptionsForProvider = (provider) => {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const baseOptions = [...(AI_PROVIDER_MODELS[normalizedProvider] || [])];
    if (normalizedProvider !== 'local') return baseOptions;
    const seen = new Set(baseOptions.map((entry) => entry.value));
    (localAiDiag?.models || []).forEach((entry) => {
      if (!entry?.name || seen.has(entry.name)) return;
      seen.add(entry.name);
      baseOptions.unshift({ value: entry.name, label: `${entry.name} (installed)` });
    });
    return baseOptions;
  };

  const assistantModelOptions = getModelOptionsForProvider(aiAssistant.ai_agent_provider);
  const assistantModelKnown = assistantModelOptions.some((option) => option.value === aiAssistant.ai_agent_model);

  const updateFeatureModelProvider = (featureKey, provider) => {
    const normalizedProvider = String(provider || 'claude').trim().toLowerCase() || 'claude';
    setAiFeatures((current) => ({
      ...current,
      [`${featureKey}_model`]: serializeFeatureModelSetting(normalizedProvider, getDefaultModelForProvider(normalizedProvider)),
    }));
  };

  const updateFeatureModelValue = (featureKey, model, providerOverride = null) => {
    setAiFeatures((current) => {
      const currentSelection = parseFeatureModelSetting(current[`${featureKey}_model`], 'claude');
      const provider = providerOverride || currentSelection.provider;
      return {
        ...current,
        [`${featureKey}_model`]: serializeFeatureModelSetting(provider, model),
      };
    });
  };

  const handleScanEncryptedSettings = async () => {
    setEncryptedSettingsLoading(true);
    try {
      const result = await api.admin.getEncryptedSettingsDiagnostics();
      setEncryptedSettingsScan(result);
      if (result.ok) toast.success('Encrypted settings look healthy');
      else toast.error('One or more encrypted settings rows are malformed');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEncryptedSettingsLoading(false);
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
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Appearance & cosmetic controls</label>
              <p className={styles.hint} style={{ marginTop: 0 }}>
                Theme, UI scale, company logo, notification tray position, bell styling, and map display defaults now live on a dedicated page.
              </p>
              <Link to="/settings/appearance" className="btn btn-ghost btn-sm">Open Appearance Settings</Link>
            </div>
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

          <h3 className={styles.section}>Notifications & Presence</h3>
          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="s-presence-offline-after">Offline after idle (minutes)</label>
              <input
                id="s-presence-offline-after"
                type="number"
                min="5"
                max="240"
                step="1"
                value={form.presence_offline_after_minutes}
                onChange={e => setForm(f => ({ ...f, presence_offline_after_minutes: e.target.value }))}
              />
              <span className={styles.hint}>
                Team members are treated as offline after this many idle minutes without a keystroke or button press.
              </span>
            </div>
            <div className="form-group">
              <label htmlFor="s-app-timezone">Notification timezone</label>
              <select
                id="s-app-timezone"
                value={form.app_timezone}
                onChange={e => setForm(f => ({ ...f, app_timezone: e.target.value }))}
              >
                {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'UTC'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <span className={styles.hint}>Exact notification timestamps use this timezone across the app.</span>
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <Link to="/settings/notifications" className="btn btn-ghost btn-sm">Open Notification Controls</Link>
            </div>
          </div>

          <h3 className={styles.section}>Image compression</h3>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 220px', alignSelf: 'end' }}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={form.image_compression_enabled === '1'}
                  onChange={e => setForm(f => ({ ...f, image_compression_enabled: e.target.checked ? '1' : '0' }))}
                />
                <span>Enable image compression</span>
              </label>
              <span className={styles.hint}>Only images at least 200 KB are processed. Smaller uploads stay untouched so they do not grow.</span>
            </div>
            <div className="form-group" style={{ flex: '1 1 220px', alignSelf: 'end' }}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={form.image_auto_webp_enabled === '1'}
                  disabled={form.image_compression_enabled !== '1'}
                  onChange={e => setForm(f => ({ ...f, image_auto_webp_enabled: e.target.checked ? '1' : '0' }))}
                />
                <span>Auto-convert pictures to WebP</span>
              </label>
              <span className={styles.hint}>When disabled, processed images keep a browser-friendly source format instead of being converted to WebP.</span>
            </div>
            <div className="form-group" style={{ flex: '1 1 260px' }}>
              <label htmlFor="s-image-webp-quality">WebP quality: {form.image_webp_quality}</label>
              <input
                id="s-image-webp-quality"
                type="range"
                min="40"
                max="90"
                step="1"
                value={form.image_webp_quality}
                disabled={form.image_compression_enabled !== '1'}
                onChange={e => setForm(f => ({ ...f, image_webp_quality: e.target.value }))}
              />
              <span className={styles.hint}>Lower values reduce file size further. Compression now uses a faster encoding profile to speed up uploads.</span>
            </div>
            <div className="form-group" style={{ flex: '1 1 220px', alignSelf: 'end' }}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={form.image_avif_enabled === '1'}
                  disabled={form.image_compression_enabled !== '1'}
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
                {form.image_compression_enabled !== '1'
                  ? 'Compression off'
                  : form.image_avif_enabled === '1'
                    ? (form.image_auto_webp_enabled === '1' ? 'AVIF + WebP' : 'AVIF + source format')
                    : (form.image_auto_webp_enabled === '1' ? 'WebP only' : 'Source format')}
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
                  {form.image_compression_enabled === '1' ? 'Processed preview' : 'Unchanged upload preview'}
                  {compressionPreviewLoading ? ' (updating...)' : ` (${form.image_compression_enabled === '1' ? (form.image_avif_enabled === '1' ? 'AVIF preferred' : (form.image_auto_webp_enabled === '1' ? 'WebP' : 'source format')) : 'original file'})`}
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
              Processed uploads generate <strong>thumb</strong>, <strong>ui</strong>, and <strong>large</strong> variants for fast grids, normal app views, and larger detail displays.
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
            <div className={styles.aiFeatureRow}>
              <div className={styles.aiFeatureInfo}>
                <label className={styles.aiFeatureLabel}>
                  <input
                    type="checkbox"
                    checked={aiAssistant.ai_agent_enabled === '1'}
                    onChange={e => setAiAssistant((current) => ({ ...current, ai_agent_enabled: e.target.checked ? '1' : '0' }))}
                  />
                  BadShuffle AI Assistant
                </label>
                <span className={styles.hint}>
                  Main provider and model used by the assistant stack. Inventory AI writing uses this when AI Assistant is enabled.
                </span>
              </div>
              <div className={styles.aiAssistantControls}>
                <div className={styles.aiModelSelect}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Provider</label>
                  <select
                    value={aiAssistant.ai_agent_provider}
                    onChange={e => handleAssistantProviderChange(e.target.value)}
                    disabled={aiAssistant.ai_agent_enabled !== '1'}
                  >
                    {AI_PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.aiModelSelect}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Model</label>
                  <select
                    value={aiAssistant.ai_agent_model}
                    onChange={e => setAiAssistant((current) => ({ ...current, ai_agent_model: e.target.value }))}
                    disabled={aiAssistant.ai_agent_enabled !== '1'}
                  >
                    {!assistantModelKnown && aiAssistant.ai_agent_model && (
                      <option value={aiAssistant.ai_agent_model}>{`${aiAssistant.ai_agent_model} (custom)`}</option>
                    )}
                    {assistantModelOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.aiModelSelect}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Custom model override</label>
                  <input
                    type="text"
                    value={aiAssistant.ai_agent_model}
                    onChange={e => setAiAssistant((current) => ({ ...current, ai_agent_model: e.target.value }))}
                    disabled={aiAssistant.ai_agent_enabled !== '1'}
                    placeholder="Enter any provider-supported model id"
                  />
                </div>
              </div>
            </div>
            {[
              { key: 'ai_suggest', label: 'AI Quote Suggestions', desc: 'Recommends items to add based on event type and guest count.' },
              { key: 'ai_pdf_import', label: 'PDF Quote Import', desc: 'Extracts line items from uploaded PDF quotes.' },
              { key: 'ai_email_draft', label: 'AI Email Drafts', desc: 'Drafts follow-up and confirmation emails.' },
              { key: 'ai_description', label: 'AI Item Descriptions', desc: 'Generates item descriptions in inventory.' },
            ].map(({ key, label, desc }) => {
              const featureSelection = parseFeatureModelSetting(aiFeatures[`${key}_model`], 'claude');
              const featureModelOptions = getModelOptionsForProvider(featureSelection.provider);
              const featureModelKnown = featureModelOptions.some((option) => option.value === featureSelection.model);
              return (
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
                  <div className={styles.aiAssistantControls}>
                    <div className={styles.aiModelSelect}>
                      <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Provider</label>
                      <select
                        value={featureSelection.provider}
                        onChange={e => updateFeatureModelProvider(key, e.target.value)}
                        disabled={aiFeatures[`${key}_enabled`] !== '1'}
                      >
                        {AI_PROVIDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.aiModelSelect}>
                      <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Model</label>
                      <select
                        value={featureSelection.model}
                        onChange={e => updateFeatureModelValue(key, e.target.value, featureSelection.provider)}
                        disabled={aiFeatures[`${key}_enabled`] !== '1'}
                      >
                        {!featureModelKnown && featureSelection.model && (
                          <option value={featureSelection.model}>{`${featureSelection.model} (custom)`}</option>
                        )}
                        {featureModelOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.aiModelSelect}>
                      <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Custom model override</label>
                      <input
                        type="text"
                        value={featureSelection.model}
                        onChange={e => updateFeatureModelValue(key, e.target.value, featureSelection.provider)}
                        disabled={aiFeatures[`${key}_enabled`] !== '1'}
                        placeholder="Enter any provider-supported model id"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          <h3 className={styles.section} style={{ marginTop: 18 }}>Local AI Runtime</h3>
          <div className={styles.aiFeatureTable}>
            <div className={styles.aiFeatureRow}>
              <div className={styles.aiFeatureInfo}>
                <label className={styles.aiFeatureLabel}>
                  <input
                    type="checkbox"
                    checked={localAi.ai_local_enabled === '1'}
                    onChange={e => setLocalAi((current) => ({ ...current, ai_local_enabled: e.target.checked ? '1' : '0' }))}
                  />
                  Enable local AI runtime
                </label>
                <span className={styles.hint}>
                  Uses a managed local Ollama runtime for on-device AI. Select `Local` in any provider selector above to use installed local models.
                </span>
              </div>
              <div className={styles.aiAssistantControls}>
                <div className={styles.aiModelSelect}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Runtime</label>
                  <select
                    value={localAi.ai_local_mode}
                    onChange={e => setLocalAi((current) => ({ ...current, ai_local_mode: e.target.value }))}
                    disabled={localAi.ai_local_enabled !== '1'}
                  >
                    <option value="managed_ollama">Managed Ollama</option>
                  </select>
                </div>
                <div className={styles.aiModelSelect}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Default local model</label>
                  <select
                    value={localAi.ai_local_default_model}
                    onChange={e => setLocalAi((current) => ({ ...current, ai_local_default_model: e.target.value }))}
                    disabled={localAi.ai_local_enabled !== '1'}
                  >
                    {getModelOptionsForProvider('local').map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.aiModelSelect}>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Admin controls</label>
                  <Link to="/admin" className="btn btn-ghost btn-sm">Open Admin &gt; System</Link>
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <div className="form-group">
                <label>Local runtime base URL</label>
                <input
                  value={localAi.ai_local_base_url}
                  onChange={e => setLocalAi((current) => ({ ...current, ai_local_base_url: e.target.value }))}
                  placeholder="http://127.0.0.1:11434"
                />
              </div>
              <div className="form-group">
                <label>Managed install path</label>
                <input
                  value={localAi.ai_local_install_path}
                  onChange={e => setLocalAi((current) => ({ ...current, ai_local_install_path: e.target.value }))}
                  placeholder="/path/to/local-model-runtime"
                />
              </div>
              <div className="form-group">
                <label>Autostart</label>
                <select
                  value={localAi.ai_local_autostart_enabled}
                  onChange={e => setLocalAi((current) => ({ ...current, ai_local_autostart_enabled: e.target.value }))}
                >
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </div>
            </div>

            <div className={styles.hint} style={{ marginTop: 8 }}>
              Runtime status: {localAiDiag?.health?.ok ? 'Healthy' : 'Offline'}{localAiDiag?.models?.length ? ` · Installed models: ${localAiDiag.models.map((entry) => entry.name).join(', ')}` : ' · No local models detected yet'}
            </div>
          </div>

          <h3 className={styles.section} style={{ marginTop: 18 }}>Onyx Integration</h3>
          <div className={styles.aiFeatureTable}>
            <div className={styles.aiFeatureRow}>
              <div className={styles.aiFeatureInfo}>
                <label className={styles.aiFeatureLabel}>
                  <input
                    type="checkbox"
                    checked={onyx.onyx_enabled === '1'}
                    onChange={e => setOnyx((prev) => ({ ...prev, onyx_enabled: e.target.checked ? '1' : '0' }))}
                  />
                  Enable Onyx team chat and quote AI
                </label>
                <span className={styles.hint}>BadShuffle will route chat through either an app-managed local Onyx companion or an external Onyx server. Current Onyx chat APIs require a token for BadShuffle requests.</span>
              </div>
            </div>
            <div className={styles.aiFeatureRow}>
              <div className={styles.aiFeatureInfo}>
                <label className={styles.aiFeatureLabel}>
                  <input
                    type="checkbox"
                    checked={onyx.team_chat_ai_fallback_enabled === '1'}
                    onChange={e => setOnyx((prev) => ({ ...prev, team_chat_ai_fallback_enabled: e.target.checked ? '1' : '0' }))}
                  />
                  Fallback to BadShuffle AI Assistant when Onyx is unavailable
                </label>
                <span className={styles.hint}>
                  If Onyx is down, not configured, or rejects requests, team chat will use the provider and model selected in BadShuffle AI Assistant above instead of returning an unavailable error.
                </span>
              </div>
            </div>
            <div className={styles.row}>
              <div className="form-group">
                <label>Onyx Mode</label>
                <select value={onyx.onyx_mode} onChange={e => setOnyx((prev) => ({ ...prev, onyx_mode: e.target.value }))}>
                  <option value="managed_local">Managed local companion</option>
                  <option value="external">External Onyx server</option>
                  <option value="auto">Auto-detect local, else external</option>
                </select>
              </div>
              <div className="form-group">
                <label>Onyx API Key</label>
                <input
                  type="password"
                  value={aiKeys.onyx_api_key}
                  onChange={e => setAiKeys((prev) => ({ ...prev, onyx_api_key: e.target.value }))}
                  placeholder="Bearer token or API key from your Onyx instance"
                  autoComplete="off"
                />
                <div className={styles.hint}>
                  Required for BadShuffle team chat and quote AI. Create a token in Onyx and paste it here. This is separate from the model-provider keys configured inside Onyx.
                </div>
              </div>
            </div>
            <div className={styles.row}>
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={onyx.onyx_local_enabled === '1'} onChange={e => setOnyx((prev) => ({ ...prev, onyx_local_enabled: e.target.checked ? '1' : '0' }))} />
                  {' '}Allow managed local Onyx
                </label>
                <div className={styles.hint}>When enabled, BadShuffle can install, start, and detect a local Onyx companion service.</div>
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={onyx.onyx_external_enabled === '1'} onChange={e => setOnyx((prev) => ({ ...prev, onyx_external_enabled: e.target.checked ? '1' : '0' }))} />
                  {' '}Allow external Onyx
                </label>
                <div className={styles.hint}>Keep this enabled if you want to manually point BadShuffle at a separately hosted Onyx instance.</div>
              </div>
            </div>
            {(onyx.onyx_mode === 'managed_local' || onyx.onyx_mode === 'auto') && (
              <div className={styles.row}>
                <div className="form-group">
                  <label>Managed Install Path</label>
                  <input
                    value={onyx.onyx_local_install_path}
                    onChange={e => setOnyx((prev) => ({ ...prev, onyx_local_install_path: e.target.value }))}
                    placeholder="/path/to/badshuffle/onyx-local"
                  />
                </div>
                <div className="form-group">
                  <label>Managed Local Port</label>
                  <input
                    value={onyx.onyx_local_port}
                    onChange={e => setOnyx((prev) => ({ ...prev, onyx_local_port: e.target.value }))}
                    placeholder="3000"
                  />
                </div>
              </div>
            )}
            {(onyx.onyx_mode === 'managed_local' || onyx.onyx_mode === 'auto') && (
              <div className={styles.row}>
                <div className="form-group">
                  <label>Managed Local Autostart</label>
                  <select value={onyx.onyx_local_autostart_enabled} onChange={e => setOnyx((prev) => ({ ...prev, onyx_local_autostart_enabled: e.target.value }))}>
                    <option value="1">Enabled</option>
                    <option value="0">Disabled</option>
                  </select>
                </div>
              </div>
            )}
            {(onyx.onyx_mode === 'external' || onyx.onyx_mode === 'auto') && (
              <div className={styles.row}>
                <div className="form-group">
                  <label>External Onyx Base URL</label>
                  <input
                    value={onyx.onyx_base_url}
                    onChange={e => setOnyx((prev) => ({ ...prev, onyx_base_url: e.target.value }))}
                    placeholder="https://onyx.example.com"
                  />
                </div>
              </div>
            )}
            <div className={styles.row}>
              <div className="form-group">
                <label>Default Persona ID</label>
                <input value={onyx.onyx_default_persona_id} onChange={e => setOnyx((prev) => ({ ...prev, onyx_default_persona_id: e.target.value }))} placeholder="1" />
              </div>
              <div className="form-group">
                <label>Team Chat Persona ID</label>
                <input value={onyx.onyx_team_persona_id} onChange={e => setOnyx((prev) => ({ ...prev, onyx_team_persona_id: e.target.value }))} placeholder="2" />
              </div>
              <div className="form-group">
                <label>Quote Chat Persona ID</label>
                <input value={onyx.onyx_quote_persona_id} onChange={e => setOnyx((prev) => ({ ...prev, onyx_quote_persona_id: e.target.value }))} placeholder="3" />
              </div>
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
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleScanEncryptedSettings} disabled={encryptedSettingsLoading}>
                {encryptedSettingsLoading ? 'Scanning…' : 'Scan Encrypted Settings'}
              </button>
              <span className={styles.hint}>Checks SMTP, IMAP, and AI key rows for bad decrypt data.</span>
            </div>
            {encryptedSettingsScan ? (
              <div className="border border-border rounded-xl p-3 bg-surface">
                <div className={styles.hint} style={{ marginBottom: 8 }}>
                  {encryptedSettingsScan.ok ? 'All encrypted settings rows decrypted successfully.' : 'Malformed encrypted rows found:'}
                </div>
                <div className="flex flex-col gap-2">
                  {(encryptedSettingsScan.rows || []).map((row) => (
                    <div key={row.key} className="text-sm flex items-center justify-between gap-3 flex-wrap">
                      <strong>{row.key}</strong>
                      <span>{!row.has_value ? 'empty' : row.valid ? 'ok' : row.error || 'bad decrypt'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
