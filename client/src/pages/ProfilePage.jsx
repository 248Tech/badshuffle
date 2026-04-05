import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './ProfilePage.module.css';

function emptyForm() {
  return {
    first_name: '',
    last_name: '',
    username: '',
    display_name: '',
    phone: '',
    email: '',
    photo_url: '',
    bio: '',
    live_notifications_enabled: true,
    live_notification_sound_enabled: false,
  };
}

function toForm(user) {
  return {
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    username: user?.username || '',
    display_name: user?.display_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    photo_url: user?.photo_url || '',
    bio: user?.bio || '',
    live_notifications_enabled: Number(user?.live_notifications_enabled || 0) === 1,
    live_notification_sound_enabled: Number(user?.live_notification_sound_enabled || 0) === 1,
  };
}

function initialsFromForm(form) {
  const first = String(form.first_name || '').trim();
  const last = String(form.last_name || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.trim().toUpperCase();
  if (initials) return initials;
  return String(form.email || '?').trim().charAt(0).toUpperCase() || '?';
}

function filePreviewUrl(photoUrl) {
  if (!photoUrl) return '';
  return api.proxyImageUrl(photoUrl, { variant: 'ui' });
}

function slugifyUsernameBase(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'user';
}

export default function ProfilePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [savedForm, setSavedForm] = useState(emptyForm);
  const [createdAt, setCreatedAt] = useState(null);
  const [role, setRole] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.auth.me()
      .then((me) => {
        if (cancelled) return;
        const nextForm = toForm(me);
        setForm(nextForm);
        setSavedForm(nextForm);
        setCreatedAt(me.created_at || null);
        setRole(me.role || '');
        if (me.photo_url && /^\d+$/.test(String(me.photo_url).trim())) {
          api.prefetchFileServeUrls([String(me.photo_url)]).catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);
  const generatedIdentity = useMemo(() => {
    const fullName = [form.first_name, form.last_name].map((value) => String(value || '').trim()).filter(Boolean).join(' ').trim();
    const emailBase = String(form.email || '').trim().split('@')[0] || 'user';
    return {
      display_name: fullName || emailBase,
      username: slugifyUsernameBase(fullName || emailBase),
    };
  }, [form.email, form.first_name, form.last_name]);

  async function handlePhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const result = await api.uploadFiles(formData);
      const uploaded = result.files?.[0];
      if (!uploaded?.id) throw new Error('Photo upload failed');
      const photoId = String(uploaded.id);
      setForm((current) => ({ ...current, photo_url: photoId }));
      api.prefetchFileServeUrls([photoId]).catch(() => {});
      toast.success('Profile photo uploaded');
    } catch (err) {
      toast.error(err.message || 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api.auth.updateMe(form);
      const nextForm = toForm(updated);
      setForm(nextForm);
      setSavedForm(nextForm);
      setCreatedAt(updated.created_at || createdAt);
      setRole(updated.role || role);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className="skeleton" style={{ width: 220, height: 28, borderRadius: 8 }} />
        <div className={`card ${styles.card}`}>
          <div className="skeleton" style={{ width: 220, height: 220, borderRadius: 24 }} />
          <div className="skeleton" style={{ width: '100%', height: 320, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="empty-state">{error}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>
          Manage your system identity, contact details, and the photo shown across the team workspace.
        </p>
      </div>

      <div className={styles.metaBar}>
        <span className={styles.metaPill}>{role === 'admin' ? 'Admin' : role === 'operator' ? 'Operator' : 'User'}</span>
        {createdAt ? (
          <span className={styles.metaPill}>
            Joined {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        ) : null}
      </div>

      <form className={`card ${styles.card}`} onSubmit={handleSave}>
        <div className={styles.photoPanel}>
          <div className={styles.avatarFrame}>
            {form.photo_url ? (
              <img className={styles.avatarImage} src={filePreviewUrl(form.photo_url)} alt="Profile" />
            ) : (
              <div className={styles.avatarFallback}>{initialsFromForm(form)}</div>
            )}
          </div>
          <div className={styles.photoActions}>
            <label className={styles.uploadLabel}>
              <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} disabled={uploading} />
              {uploading ? 'Uploading…' : 'Upload photo'}
            </label>
            {form.photo_url ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setForm((current) => ({ ...current, photo_url: '' }))}
              >
                Remove photo
              </button>
            ) : null}
          </div>
          <p className={styles.photoHint}>
            Photos are automatically compressed and optimized for the app. A square or portrait image works best.
          </p>
        </div>

        <div className={styles.form}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>First Name</span>
              <input
                className={styles.input}
                value={form.first_name}
                onChange={(e) => setForm((current) => ({ ...current, first_name: e.target.value }))}
                maxLength={80}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Last Name</span>
              <input
                className={styles.input}
                value={form.last_name}
                onChange={(e) => setForm((current) => ({ ...current, last_name: e.target.value }))}
                maxLength={80}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Display Name</span>
              <input
                className={styles.input}
                value={dirty ? generatedIdentity.display_name : form.display_name}
                readOnly
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Username</span>
              <input
                className={styles.input}
                value={dirty ? generatedIdentity.username : form.username}
                readOnly
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Phone Number</span>
              <input
                className={styles.input}
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                maxLength={40}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                className={styles.input}
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                maxLength={255}
                required
              />
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Bio</span>
              <textarea
                className={styles.textarea}
                value={form.bio}
                onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
                maxLength={2000}
                placeholder="A short internal bio for your team."
              />
            </label>

            <div className={styles.field}>
              <span className={styles.label}>Live Notifications</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.live_notifications_enabled}
                  onChange={(e) => setForm((current) => ({ ...current, live_notifications_enabled: e.target.checked }))}
                />
                Enable Xbox-style live alerts
              </label>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Notification Sound</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, opacity: form.live_notifications_enabled ? 1 : 0.55 }}>
                <input
                  type="checkbox"
                  checked={form.live_notification_sound_enabled}
                  disabled={!form.live_notifications_enabled}
                  onChange={(e) => setForm((current) => ({ ...current, live_notification_sound_enabled: e.target.checked }))}
                />
                Play alert sound
              </label>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setForm(savedForm)}
              disabled={!dirty || saving}
            >
              Reset
            </button>
            <button type="submit" className="btn btn-primary" disabled={!dirty || saving || uploading}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
