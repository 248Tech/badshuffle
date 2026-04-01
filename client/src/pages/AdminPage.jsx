import React, { useState, useEffect, useCallback } from 'react';
import { api, getToken } from '../api';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import styles from './AdminPage.module.css';

function Toggle({ checked, onChange, disabled, ariaLabel }) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles.toggleDisabled : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-label={ariaLabel} />
      <span className={styles.toggleTrack}>
        <span className={styles.toggleThumb} />
      </span>
    </label>
  );
}

function getCurrentUserId() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    return null;
  }
}

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [filterTab, setFilterTab] = useState('all');
  const [error, setError] = useState('');

  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [roleChanging, setRoleChanging] = useState(null); // id being changed

  const loadUsers = useCallback(async () => {
    try {
      const [data, rolesData] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getRoles().catch(() => ({ roles: [] })),
      ]);
      setUsers(data);
      setRoles(rolesData.roles || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const pendingCount = users.filter(u => !u.approved).length;
  const displayed = filterTab === 'pending' ? users.filter(u => !u.approved) : users;

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await api.admin.createUser({ email: createEmail, password: createPassword });
      setCreateEmail('');
      setCreatePassword('');
      await loadUsers();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove(id) {
    try { await api.admin.approveUser(id); await loadUsers(); }
    catch (e) { setError(e.message); }
  }

  async function handleReject(id) {
    try { await api.admin.rejectUser(id); await loadUsers(); }
    catch (e) { setError(e.message); }
  }

  async function handleDelete(id) {
    setConfirmDelete(null);
    try { await api.admin.deleteUser(id); await loadUsers(); }
    catch (e) { setError(e.message); }
  }

  async function handleRoleChange(id, role) {
    setRoleChanging(id);
    try { await api.admin.changeRole(id, role); await loadUsers(); }
    catch (e) { setError(e.message); }
    finally { setRoleChanging(null); }
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete ${confirmDelete.email}? This cannot be undone.`}
          confirmLabel="Delete user"
          confirmClass="btn-danger"
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {error && <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Create user</div>
        <form className={styles.createForm} onSubmit={handleCreate}>
          <label>
            Email
            <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} required minLength={8} />
          </label>
          <button className="btn btn-primary" disabled={creating} type="submit">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
        {createError && <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{createError}</div>}
      </div>

      <div>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${filterTab === 'all' ? styles.tabActive : ''}`} onClick={() => setFilterTab('all')}>
            All Users
          </button>
          <button type="button" className={`${styles.tab} ${filterTab === 'pending' ? styles.tabActive : ''}`} onClick={() => setFilterTab('pending')}>
            Pending{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        </div>

        <div className={`card ${styles.tableCard}`}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr><td colSpan={5} className={styles.empty}>No users</td></tr>
                )}
                {displayed.map(u => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className={styles.roleSelect}
                        value={u.role}
                        disabled={roleChanging === u.id}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        aria-label={`Role for ${u.email}`}
                      >
                        {roles.map((role) => (
                          <option key={role.key} value={role.key}>{role.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {u.approved
                        ? <span className={styles.badgeApproved}>Approved</span>
                        : <span className={styles.badgePending}>Pending</span>
                      }
                    </td>
                    <td>{u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                    <td>
                      <div className={styles.actions}>
                        {!u.approved && (
                          <>
                            <button type="button" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleApprove(u.id)}>Approve</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleReject(u.id)}>Reject</button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          disabled={u.id === currentUserId}
                          onClick={() => setConfirmDelete({ id: u.id, email: u.email })}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState({ key: '', name: '', description: '' });
  const [savingKey, setSavingKey] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.admin.getRoles();
      setRoles(data.roles || []);
      setModules(data.modules || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.admin.createRole({
        key: createForm.key,
        name: createForm.name,
        description: createForm.description,
      });
      setCreateForm({ key: '', name: '', description: '' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function setPermission(role, moduleKey, accessLevel) {
    setSavingKey(`${role.key}:${moduleKey}`);
    setError('');
    try {
      await api.admin.updateRolePermissions(role.key, {
        ...role.permissions,
        [moduleKey]: accessLevel,
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div className={styles.systemPane}>
      {error && <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Create role</div>
        <form className={styles.createForm} onSubmit={handleCreate}>
          <label>
            Role key
            <input value={createForm.key} onChange={e => setCreateForm((f) => ({ ...f, key: e.target.value }))} placeholder="event-worker" required />
          </label>
          <label>
            Role name
            <input value={createForm.name} onChange={e => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Event Worker" required />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Description
            <input value={createForm.description} onChange={e => setCreateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional internal description" />
          </label>
          <button className="btn btn-primary" type="submit">Create role</button>
        </form>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Role permissions</div>
        <div style={{ display: 'grid', gap: 18 }}>
          {roles.map((role) => (
            <section key={role.key} style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: 16, background: 'var(--color-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{role.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>@{role.key}{role.description ? ` • ${role.description}` : ''}</div>
                </div>
                {Number(role.is_system || 0) === 1 && <span className={styles.badgeApproved}>System role</span>}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {modules.map((module) => (
                  <div key={module.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) auto', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{module.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{module.key}</div>
                    </div>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      {['none', 'read', 'modify'].map((level) => {
                        const active = (role.permissions?.[module.key] || 'none') === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setPermission(role, module.key, level)}
                            disabled={savingKey === `${role.key}:${module.key}`}
                            title={`${module.label}: ${level}`}
                            aria-label={`${role.name} ${module.label} ${level}`}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 999,
                              border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: active ? 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))' : 'var(--color-bg)',
                              color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              fontWeight: 700,
                            }}
                          >
                            {level === 'none' ? 'N' : level === 'read' ? 'R' : 'M'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── System tab ────────────────────────────────────────────────────────────────

function SystemTab() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.admin.getSystemSettings();
      setSettings(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(key, value) {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await api.admin.updateSystemSettings({ [key]: value ? '1' : '0' });
      setSettings(s => ({ ...s, [key]: value ? '1' : '0' }));
      setSuccess('Saved.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return (
    <div className={styles.systemPane} aria-busy="true" aria-label="Loading system info">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '20px 24px', marginBottom: 16 }} aria-hidden="true">
          <div className="skeleton" style={{ height: 12, width: 130, borderRadius: 4, marginBottom: 16 }} />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="skeleton" style={{ height: 13, width: 120, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 13, width: 80, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const updateAvailable = settings.update_available === '1';
  const lastCheck = settings.update_check_last
    ? new Date(settings.update_check_last).toLocaleString()
    : 'Never';

  return (
    <div className={styles.systemPane}>
      {error && <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}

      {/* Version status */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Version &amp; Updates</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Current version</span>
            <span className={styles.systemValue}>v{settings.current_version || '?'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Latest release</span>
            <span className={styles.systemValue}>{settings.update_check_latest || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last checked</span>
            <span className={styles.systemValue}>{lastCheck}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Status</span>
            <span className={styles.systemValue}>
              {updateAvailable
                ? <span className={styles.badgeUpdate}>Update available</span>
                : <span className={styles.badgeCurrent}>Up to date</span>
              }
            </span>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Startup Behaviour</div>
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Check for updates on startup</div>
            <div className={styles.toggleDesc}>
              Queries GitHub releases API once every 12 hours. Fails gracefully when offline.
            </div>
          </div>
          <Toggle
            checked={settings.update_check_enabled !== '0'}
            onChange={e => handleToggle('update_check_enabled', e.target.checked)}
            disabled={saving}
            aria-label="Check for updates on startup"
          />
        </div>
        <div className={styles.divider} />
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Auto-kill previous instance on startup</div>
            <div className={styles.toggleDesc}>
              If a prior Badshuffle server is still running, terminate it before binding the port.
              Only kills processes identified by the Badshuffle lockfile.
            </div>
          </div>
          <Toggle
            checked={settings.autokill_enabled !== '0'}
            onChange={e => handleToggle('autokill_enabled', e.target.checked)}
            disabled={saving}
            aria-label="Auto-kill previous instance on startup"
          />
        </div>
        {success && <div role="status" style={{ color: 'var(--color-primary)', fontSize: 12, marginTop: 10 }}>{success}</div>}
      </div>
    </div>
  );
}

// ── Database tab ──────────────────────────────────────────────────────────────

function DatabaseTab() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const fileInputRef = React.useRef(null);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.admin.exportDb();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `badshuffle-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setShowImportConfirm(false);
    setImporting(true);
    setImportError('');
    setImportSuccess('');
    try {
      await api.admin.importDb(importFile);
      setImportSuccess('Database imported successfully. Reloading…');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={styles.systemPane}>
      {showImportConfirm && (
        <ConfirmDialog
          title="Import database backup"
          message={`Replace the current database with "${importFile?.name || 'the selected backup'}"? This will overwrite all current data and reload the app.`}
          confirmLabel="Import backup"
          confirmClass="btn-danger"
          onConfirm={handleImport}
          onCancel={() => setShowImportConfirm(false)}
        />
      )}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Export Database</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Download a binary backup of the current SQLite database. Use this to back up your data or migrate to another machine.
        </p>
        <button type="button" className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Download backup (.db)'}
        </button>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Import Database</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Restore a previously exported <code>.db</code> backup. <strong>This will replace all current data.</strong>
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,application/octet-stream"
            style={{ display: 'none' }}
            onChange={e => { setImportFile(e.target.files[0] || null); setImportError(''); setImportSuccess(''); }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
            {importFile ? importFile.name : 'Choose .db file…'}
          </button>
          {importFile && (
            <button type="button" className="btn btn-danger" onClick={() => setShowImportConfirm(true)} disabled={importing}>
              {importing ? 'Importing…' : 'Import & replace database'}
            </button>
          )}
        </div>
        {importError && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 10 }}>{importError}</p>}
        {importSuccess && <p role="status" style={{ color: 'var(--color-primary)', fontSize: 13, marginTop: 10 }}>{importSuccess}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'users',    label: 'Users' },
  { key: 'roles',    label: 'Roles' },
  { key: 'system',  label: 'System' },
  { key: 'database', label: 'Database' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const [notAuthorised, setNotAuthorised] = useState(false);
  const currentUserId = getCurrentUserId();

  // Quick auth check — 403 means not admin
  useEffect(() => {
    api.admin.getUsers().catch(e => {
      if (e.message && (e.message.includes('403') || e.message.includes('Admin'))) {
        setNotAuthorised(true);
      }
    });
  }, []);

  if (notAuthorised) {
    return (
      <div className={styles.page}>
        <div className={styles.header}><div><div className={styles.title}>Admin</div></div></div>
        <div className="card"><p style={{ color: 'var(--color-danger)', padding: 16 }}>Not authorised — admin access required.</p></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Admin</div>
          <div className={styles.sub}>Manage users and system settings</div>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users'    && <UsersTab currentUserId={currentUserId} />}
      {tab === 'roles'    && <RolesTab />}
      {tab === 'system'   && <SystemTab />}
      {tab === 'database' && <DatabaseTab />}
    </div>
  );
}
