import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './SettingsPage.module.css';

const THEMES = [
  { id: 'default', label: 'Default', primary: '#1a8fc1', accent: '#16b2a5', sidebar: '#0d3b52' },
  { id: 'shadcn', label: 'shadcn/ui', primary: '#18181b', accent: '#52525b', sidebar: '#09090b' },
  { id: 'material', label: 'Material UI', primary: '#1976d2', accent: '#9c27b0', sidebar: '#1565c0' },
  { id: 'chakra', label: 'Chakra UI', primary: '#3182ce', accent: '#38b2ac', sidebar: '#2d3748' },
  { id: 'noir', label: 'Noir (Dark)', primary: '#60a5fa', accent: '#34d399', sidebar: '#050509' },
];

function dispatchAppearanceUpdate(detail) {
  window.dispatchEvent(new CustomEvent('bs:settings-updated', { detail: { settings: detail } }));
}

export default function AppearanceSettingsPage() {
  const toast = useToast();
  const logoInputRef = useRef(null);
  const [form, setForm] = useState({
    ui_theme: 'default',
    ui_scale: '100',
    company_logo: '',
    map_default_style: 'map',
    notification_tray_position: 'bottom_right',
    notification_icon_bg_opacity: '90',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [, setLogoServeEpoch] = useState(0);

  useEffect(() => {
    api.getSettings().then((s) => {
      setForm({
        ui_theme: s.ui_theme || 'default',
        ui_scale: s.ui_scale || '100',
        company_logo: s.company_logo || '',
        map_default_style: s.map_default_style || 'map',
        notification_tray_position: s.notification_tray_position || 'bottom_right',
        notification_icon_bg_opacity: s.notification_icon_bg_opacity || '90',
      });
    }).finally(() => setLoading(false));
  }, []);

  const logoPreviewSrc = useMemo(() => {
    const value = String(form.company_logo || '').trim();
    if (!value) return '';
    return /^\d+$/.test(value)
      ? `${window.location.origin}${api.fileServeUrl(value, { variant: 'ui' })}`
      : value;
  }, [form.company_logo]);

  const handleThemeChange = (themeId) => {
    setForm((current) => ({ ...current, ui_theme: themeId }));
    if (themeId === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', themeId);
  };

  const handleScaleChange = (value) => {
    const clamped = Math.min(150, Math.max(75, Number(value)));
    setForm((current) => ({ ...current, ui_scale: String(clamped) }));
    document.documentElement.style.fontSize = `${(clamped / 100) * 14}px`;
  };

  const handleLogoUpload = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const uploaded = await api.uploadFile(file);
      setForm((current) => ({ ...current, company_logo: String(uploaded.file?.id || '') }));
      setLogoServeEpoch(Date.now());
    } catch (error) {
      toast.error(error.message || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        ui_theme: form.ui_theme,
        ui_scale: form.ui_scale,
        company_logo: form.company_logo,
        map_default_style: form.map_default_style,
        notification_tray_position: form.notification_tray_position,
        notification_icon_bg_opacity: form.notification_icon_bg_opacity,
      });
      localStorage.setItem('bs_theme', form.ui_theme || 'default');
      localStorage.setItem('bs_ui_scale', form.ui_scale || '100');
      dispatchAppearanceUpdate({
        notification_tray_position: form.notification_tray_position,
        notification_icon_bg_opacity: form.notification_icon_bg_opacity,
      });
      toast.success('Appearance saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className="skeleton" style={{ height: 30, width: 180, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 13, width: 280, borderRadius: 4, marginTop: 6 }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Appearance</h1>
        <p className={styles.sub}>Theme, branding, tray placement, and other cosmetic settings.</p>
      </div>

      <form onSubmit={handleSave}>
        <div className={`card ${styles.card}`}>
          <h3 className={styles.section}>Theme</h3>
          <p className={styles.hint} style={{ marginBottom: 14 }}>Choose a UI skin. Changes apply instantly as a live preview.</p>
          <div className={styles.themeGrid}>
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`${styles.themeCard} ${form.ui_theme === theme.id ? styles.themeCardSelected : ''}`}
                onClick={() => handleThemeChange(theme.id)}
              >
                <div className={styles.themeSwatches}>
                  <span style={{ background: theme.primary }} />
                  <span style={{ background: theme.accent }} />
                  <span style={{ background: theme.sidebar }} />
                </div>
                <span className={styles.themeName}>{theme.label}</span>
                {form.ui_theme === theme.id ? (
                  <span className={styles.themeCheck}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <label htmlFor="appearance-ui-scale" style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 8 }}>
              UI Scale: {form.ui_scale}%
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 320 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>75%</span>
              <input
                id="appearance-ui-scale"
                type="range"
                min="75"
                max="150"
                step="5"
                value={form.ui_scale}
                onChange={(event) => handleScaleChange(event.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>150%</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Branding</h3>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label htmlFor="appearance-company-logo">Company Logo</label>
              <div className={styles.logoRow}>
                <input
                  id="appearance-company-logo"
                  type="url"
                  value={/^\d+$/.test(form.company_logo) ? '' : form.company_logo}
                  onChange={(event) => setForm((current) => ({ ...current, company_logo: event.target.value }))}
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
              {logoPreviewSrc ? (
                <div className={styles.logoPreviewWrap}>
                  <img src={logoPreviewSrc} alt="Company logo preview" className={styles.logoPreview} onError={(event) => { event.target.style.display = 'none'; }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((current) => ({ ...current, company_logo: '' }))}>
                    Clear logo
                  </button>
                </div>
              ) : null}
              <span className={styles.hint}>Shown at the top of public quote views.</span>
            </div>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label htmlFor="appearance-map-style">Quote map dialog default</label>
              <select
                id="appearance-map-style"
                value={form.map_default_style}
                onChange={(event) => setForm((current) => ({ ...current, map_default_style: event.target.value }))}
              >
                <option value="map">Map</option>
                <option value="sat">Satellite</option>
              </select>
              <span className={styles.hint}>Default style when opening a quote address map.</span>
            </div>
          </div>
        </div>

        <div className={`card ${styles.card}`} style={{ marginTop: 16 }}>
          <h3 className={styles.section}>Notifications</h3>
          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="appearance-tray-position">Notification tray position</label>
              <select
                id="appearance-tray-position"
                value={form.notification_tray_position}
                onChange={(event) => setForm((current) => ({ ...current, notification_tray_position: event.target.value }))}
              >
                <option value="bottom_right">Bottom right</option>
                <option value="bottom_left">Bottom left</option>
                <option value="top_right">Top right</option>
                <option value="top_left">Top left</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="appearance-icon-opacity">Notification icon background: {form.notification_icon_bg_opacity}%</label>
              <input
                id="appearance-icon-opacity"
                type="range"
                min="30"
                max="100"
                step="5"
                value={form.notification_icon_bg_opacity}
                onChange={(event) => setForm((current) => ({ ...current, notification_icon_bg_opacity: event.target.value }))}
              />
              <span className={styles.hint}>Solid bell background opacity for the app header icon.</span>
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <Link to="/settings/notifications" className="btn btn-ghost btn-sm">Open Notification Controls</Link>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Link to="/settings" className="btn btn-ghost">Back to Settings</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Appearance'}
          </button>
        </div>
      </form>
    </div>
  );
}
