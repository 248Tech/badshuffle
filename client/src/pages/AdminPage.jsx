import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  const [onyxDiag, setOnyxDiag] = useState(null);
  const [onyxLoading, setOnyxLoading] = useState(false);
  const [onyxInstalling, setOnyxInstalling] = useState(false);
  const [onyxStarting, setOnyxStarting] = useState(false);
  const [onyxStopping, setOnyxStopping] = useState(false);
  const [onyxRestarting, setOnyxRestarting] = useState(false);
  const [localModelDiag, setLocalModelDiag] = useState(null);
  const [localModelLoading, setLocalModelLoading] = useState(false);
  const [localModelInstalling, setLocalModelInstalling] = useState(false);
  const [localModelReinstalling, setLocalModelReinstalling] = useState(false);
  const [localModelStarting, setLocalModelStarting] = useState(false);
  const [localModelStopping, setLocalModelStopping] = useState(false);
  const [localModelRestarting, setLocalModelRestarting] = useState(false);
  const [localModelPulling, setLocalModelPulling] = useState(false);
  const [localModelDeleting, setLocalModelDeleting] = useState(false);
  const [localModelName, setLocalModelName] = useState('');
  const [rustDiag, setRustDiag] = useState(null);
  const [rustReleaseChecks, setRustReleaseChecks] = useState(null);
  const [rustParity, setRustParity] = useState(null);
  const [rustPricingParity, setRustPricingParity] = useState(null);
  const [rustLoading, setRustLoading] = useState(false);
  const [rustReleaseChecksLoading, setRustReleaseChecksLoading] = useState(false);
  const [rustParityLoading, setRustParityLoading] = useState(false);
  const [rustPricingParityLoading, setRustPricingParityLoading] = useState(false);
  const [rustParityRunning, setRustParityRunning] = useState(false);
  const [rustStarting, setRustStarting] = useState(false);
  const [rustStopping, setRustStopping] = useState(false);
  const [rustRestarting, setRustRestarting] = useState(false);
  const [rustQuoteCompare, setRustQuoteCompare] = useState(null);
  const [rustQuoteCompareLoading, setRustQuoteCompareLoading] = useState(false);
  const [rustPricingCompare, setRustPricingCompare] = useState(null);
  const [selectedRustQuoteId, setSelectedRustQuoteId] = useState('');
  const [memoryRecords, setMemoryRecords] = useState([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryMatches, setMemoryMatches] = useState([]);
  const [memoryMatchesLoading, setMemoryMatchesLoading] = useState(false);
  const [selectedMemoryQuoteId, setSelectedMemoryQuoteId] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.admin.getSystemSettings();
      setSettings(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadRustDiagnostics = useCallback(async () => {
    setRustLoading(true);
    setError('');
    try {
      const data = await api.admin.getRustEngineDiagnostics();
      setRustDiag(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustLoading(false);
    }
  }, []);


  const loadOnyxDiagnostics = useCallback(async () => {
    setOnyxLoading(true);
    setError('');
    try {
      const data = await api.admin.getOnyxDiagnostics();
      setOnyxDiag(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setOnyxLoading(false);
    }
  }, []);

  const loadLocalModelDiagnostics = useCallback(async () => {
    setLocalModelLoading(true);
    setError('');
    try {
      const data = await api.admin.getLocalModelDiagnostics();
      setLocalModelDiag(data);
      setLocalModelName((current) => current || data?.curated_models?.[0]?.id || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelLoading(false);
    }
  }, []);

  const loadRustParitySnapshot = useCallback(async () => {
    setRustParityLoading(true);
    setError('');
    try {
      const data = await api.admin.compareRustEngineBatch({
        limit: 5,
        include_items: '1',
        item_limit_per_quote: 5,
      });
      setRustParity(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustParityLoading(false);
    }
  }, []);

  const loadRustPricingParitySnapshot = useCallback(async () => {
    setRustPricingParityLoading(true);
    setError('');
    try {
      const data = await api.admin.compareRustEnginePricingBatch({ limit: 5 });
      setRustPricingParity(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustPricingParityLoading(false);
    }
  }, []);

  const loadRustReleaseChecks = useCallback(async () => {
    setRustReleaseChecksLoading(true);
    setError('');
    try {
      const data = await api.admin.getRustReleaseChecks();
      setRustReleaseChecks(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustReleaseChecksLoading(false);
    }
  }, []);

  const loadMemoryRecords = useCallback(async () => {
    setMemoryLoading(true);
    setError('');
    try {
      const data = await api.admin.listQuotePatternMemories({ limit: 12 });
      setMemoryRecords(data.records || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOnyxDiagnostics();
    loadLocalModelDiagnostics();
    loadRustDiagnostics();
    loadRustReleaseChecks();
    loadRustParitySnapshot();
    loadRustPricingParitySnapshot();
    loadMemoryRecords();
  }, [loadOnyxDiagnostics, loadLocalModelDiagnostics, loadRustDiagnostics, loadRustReleaseChecks, loadRustParitySnapshot, loadRustPricingParitySnapshot, loadMemoryRecords]);

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
  const packagedParity = rustReleaseChecks?.manifest?.parity || null;
  const packagedParityJson = rustReleaseChecks?.packaged_parity_json || null;
  const latestParity = rustReleaseChecks?.latest_parity || null;
  const paritySource = packagedParity || latestParity;

  function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
    if (!content) return;
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleRunRustParityNow() {
    setRustParityRunning(true);
    setError('');
    try {
      const data = await api.admin.runRustParityReport({
        limit: 5,
        include_items: '1',
        item_limit_per_quote: 5,
        context: 'admin-manual',
      });
      setRustParity({
        totals: data.totals,
        comparisons: data.json?.comparisons || [],
      });
      await loadRustPricingParitySnapshot();
      await loadRustReleaseChecks();
      setSuccess('Rust parity report refreshed.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustParityRunning(false);
    }
  }

  async function handleStartRustEngine() {
    setRustStarting(true);
    setError('');
    try {
      const data = await api.admin.startRustEngine();
      await loadRustDiagnostics();
      setSuccess(data.started ? 'Rust engine started.' : (data.message || 'Rust engine is already running.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustStarting(false);
    }
  }

  async function handleStopRustEngine() {
    setRustStopping(true);
    setError('');
    try {
      const data = await api.admin.stopRustEngine();
      await loadRustDiagnostics();
      setSuccess(data.stopped ? 'Rust engine stopped.' : (data.message || 'Rust engine is not running.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustStopping(false);
    }
  }

  async function handleRestartRustEngine() {
    setRustRestarting(true);
    setError('');
    try {
      const data = await api.admin.restartRustEngine();
      await loadRustDiagnostics();
      setSuccess(data.started ? 'Rust engine restarted.' : (data.message || 'Rust engine restarted.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustRestarting(false);
    }
  }


  async function handleInstallOnyx() {
    setOnyxInstalling(true);
    setError('');
    try {
      const data = await api.admin.installOnyx();
      await loadOnyxDiagnostics();
      setSuccess(data.installed ? 'Managed Onyx installed.' : (data.message || 'Managed Onyx already detected.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setOnyxInstalling(false);
    }
  }

  async function handleStartOnyx() {
    setOnyxStarting(true);
    setError('');
    try {
      const data = await api.admin.startOnyx();
      await loadOnyxDiagnostics();
      setSuccess(data.started ? 'Managed Onyx started.' : (data.message || 'Managed Onyx is already running.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setOnyxStarting(false);
    }
  }

  async function handleStopOnyx() {
    setOnyxStopping(true);
    setError('');
    try {
      const data = await api.admin.stopOnyx();
      await loadOnyxDiagnostics();
      setSuccess(data.stopped ? 'Managed Onyx stopped.' : (data.message || 'Managed Onyx is not running.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setOnyxStopping(false);
    }
  }

  async function handleRestartOnyx() {
    setOnyxRestarting(true);
    setError('');
    try {
      const data = await api.admin.restartOnyx();
      await loadOnyxDiagnostics();
      setSuccess(data.started ? 'Managed Onyx restarted.' : (data.message || 'Managed Onyx restarted.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setOnyxRestarting(false);
    }
  }

  async function handleInstallLocalRuntime() {
    setLocalModelInstalling(true);
    setError('');
    try {
      const data = await api.admin.installLocalModelRuntime();
      await loadLocalModelDiagnostics();
      setSuccess(data.installed ? 'Local AI runtime installed.' : (data.message || 'Local AI runtime already detected.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelInstalling(false);
    }
  }

  async function handleReinstallLocalRuntime() {
    setLocalModelReinstalling(true);
    setError('');
    try {
      const data = await api.admin.reinstallLocalModelRuntime();
      await loadLocalModelDiagnostics();
      setSuccess(data.reinstalled ? 'Ollama reinstalled.' : (data.message || 'Ollama reinstall completed.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelReinstalling(false);
    }
  }

  async function handleStartLocalRuntime() {
    setLocalModelStarting(true);
    setError('');
    try {
      const data = await api.admin.startLocalModelRuntime();
      await loadLocalModelDiagnostics();
      setSuccess(data.started ? 'Local AI runtime started.' : (data.message || 'Local AI runtime is already running.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelStarting(false);
    }
  }

  async function handleStopLocalRuntime() {
    setLocalModelStopping(true);
    setError('');
    try {
      const data = await api.admin.stopLocalModelRuntime();
      await loadLocalModelDiagnostics();
      setSuccess(data.stopped ? 'Local AI runtime stopped.' : (data.message || 'Local AI runtime is not running.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelStopping(false);
    }
  }

  async function handleRestartLocalRuntime() {
    setLocalModelRestarting(true);
    setError('');
    try {
      const data = await api.admin.restartLocalModelRuntime();
      await loadLocalModelDiagnostics();
      setSuccess(data.started ? 'Local AI runtime restarted.' : (data.message || 'Local AI runtime restarted.'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelRestarting(false);
    }
  }

  async function handlePullLocalModel() {
    if (!localModelName) return;
    setLocalModelPulling(true);
    setError('');
    try {
      const data = await api.admin.pullLocalModel(localModelName);
      await loadLocalModelDiagnostics();
      setSuccess(data.model ? `Local model pulled: ${data.model}` : 'Local model pulled.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelPulling(false);
    }
  }

  async function handleDeleteLocalModel(modelName) {
    if (!modelName) return;
    setLocalModelDeleting(true);
    setError('');
    try {
      const data = await api.admin.deleteLocalModel(modelName);
      await loadLocalModelDiagnostics();
      setSuccess(data.model ? `Deleted local model: ${data.model}` : 'Local model deleted.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalModelDeleting(false);
    }
  }

  async function handleLoadRustQuoteCompare(quoteId) {
    if (!quoteId) return;
    setSelectedRustQuoteId(String(quoteId));
    setRustQuoteCompareLoading(true);
    setRustPricingCompare(null);
    setError('');
    try {
      const [availabilityData, pricingData] = await Promise.all([
        api.admin.compareRustEngineQuote(quoteId, {
          include_items: '1',
          item_limit_per_quote: 10,
        }),
        api.admin.compareRustEnginePricing(quoteId),
      ]);
      setRustQuoteCompare(availabilityData);
      setRustPricingCompare(pricingData);
    } catch (e) {
      setError(e.message);
    } finally {
      setRustQuoteCompareLoading(false);
    }
  }

  async function handleLoadMemoryMatches(quoteId) {
    if (!quoteId) return;
    setSelectedMemoryQuoteId(String(quoteId));
    setMemoryMatchesLoading(true);
    setError('');
    try {
      const data = await api.admin.getSimilarQuotePatterns(quoteId, { limit: 5 });
      setMemoryMatches(data.matches || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setMemoryMatchesLoading(false);
    }
  }

  function renderJsonBlock(value) {
    if (!value) return null;
    return <pre className={styles.releaseSummary}>{JSON.stringify(value, null, 2)}</pre>;
  }

  function renderMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function renderRange(range) {
    if (!range?.start && !range?.end) return '—';
    if (range?.start && range?.end && range.start === range.end) return range.start;
    return `${range?.start || '—'} → ${range?.end || '—'}`;
  }

  function isOnyxInstalled(diag) {
    if (!diag) return false;
    return Boolean(
      diag.install_detected
      || diag.managed_runtime_detected
      || diag.compose_file
      || diag.deployment_exists
      || (diag.health?.ok && diag.install_root_exists)
    );
  }

  function renderItemList(items = []) {
    if (!items.length) return '—';
    return (
      <span className={styles.entityList}>
        {items.map((item, index) => (
          <React.Fragment key={item?.id || `${item?.title}-${index}`}>
            {index > 0 ? ', ' : ''}
            {item?.id ? (
              <Link className={styles.entityLink} to={`/inventory/${item.id}`}>
                {item?.title || `Item ${item.id}`}
              </Link>
            ) : (
              item?.title || 'Item'
            )}
          </React.Fragment>
        ))}
      </span>
    );
  }

  function renderTagList(tags = []) {
    if (!tags.length) return <span className={styles.parityMeta}>No tags</span>;
    return (
      <div className={styles.tagList}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tagChip}>{tag}</span>
        ))}
      </div>
    );
  }

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
        <div className={styles.divider} />
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Auto-start Rust engine on app startup</div>
            <div className={styles.toggleDesc}>
              Starts the Rust inventory engine when the BadShuffle server boots. Disable this if you only want to run Rust manually while debugging.
            </div>
          </div>
          <Toggle
            checked={settings.rust_autostart_enabled !== '0'}
            onChange={e => handleToggle('rust_autostart_enabled', e.target.checked)}
            disabled={saving}
            aria-label="Auto-start Rust engine on app startup"
          />
        </div>
        <div className={styles.divider} />
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Auto-start managed Onyx on app startup</div>
            <div className={styles.toggleDesc}>
              When managed local Onyx mode is enabled, BadShuffle will try to start the companion Onyx service during server boot.
            </div>
          </div>
          <Toggle
            checked={settings.onyx_local_autostart_enabled !== '0'}
            onChange={e => handleToggle('onyx_local_autostart_enabled', e.target.checked)}
            disabled={saving}
            aria-label="Auto-start managed Onyx on app startup"
          />
        </div>
        {success && <div role="status" style={{ color: 'var(--color-primary)', fontSize: 12, marginTop: 10 }}>{success}</div>}
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Quote Pattern Memory</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Records loaded</span>
            <span className={styles.systemValue}>{memoryRecords.length}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Selected quote</span>
            <span className={styles.systemValue}>{selectedMemoryQuoteId || '—'}</span>
          </div>
        </div>
        {!!memoryRecords.length && (
          <div className={styles.parityList}>
            {memoryRecords.map((row) => (
              <div key={`memory-${row.quote_id}`} className={styles.memoryCard}>
                <div className={styles.parityPrimary}>
                  <span className={styles.parityTitle}>
                    <Link className={styles.entityLink} to={`/quotes/${row.quote_id}`}>
                      {row.quote_name || `Quote ${row.quote_id}`}
                    </Link>
                  </span>
                  <span className={styles.parityMeta}>
                    {row.status || 'draft'}
                    {row.event_type ? ` · ${row.event_type}` : ''}
                    {row.event_date ? ` · ${row.event_date}` : ''}
                    {row.sync_reason ? ` · sync ${row.sync_reason}` : ''}
                  </span>
                  <span className={styles.parityMeta}>{row.summary || 'No summary available'}</span>
                  <span className={styles.parityMeta}>
                    {row.client_name || 'No client'}
                    {row.venue_name ? ` · ${row.venue_name}` : ''}
                    {row.total ? ` · ${renderMoney(row.total)}` : ''}
                    {row.last_synced_at ? ` · ${new Date(row.last_synced_at).toLocaleString()}` : ''}
                  </span>
                  {renderTagList(row.tags || [])}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12, alignSelf: 'flex-start' }}
                  onClick={() => handleLoadMemoryMatches(row.quote_id)}
                  disabled={memoryMatchesLoading}
                >
                  {memoryMatchesLoading && selectedMemoryQuoteId === String(row.quote_id) ? 'Loading…' : 'Inspect similar'}
                </button>
              </div>
            ))}
          </div>
        )}
        {!memoryLoading && !memoryRecords.length && (
          <div className={styles.empty}>No quote pattern records yet.</div>
        )}
        <div className={styles.inlineActions}>
          <button type="button" className="btn btn-secondary" onClick={loadMemoryRecords} disabled={memoryLoading}>
            {memoryLoading ? 'Refreshing…' : 'Refresh memory records'}
          </button>
        </div>
        {(memoryMatchesLoading || memoryMatches.length > 0 || selectedMemoryQuoteId) && (
          <div className={styles.parityDrilldown}>
            <div className={styles.systemSection} style={{ marginBottom: 8 }}>
              Similar Quote Retrieval{selectedMemoryQuoteId ? ` · Quote ${selectedMemoryQuoteId}` : ''}
            </div>
            {memoryMatchesLoading && <div className={styles.parityMeta}>Loading similar quote matches…</div>}
            {!memoryMatchesLoading && !memoryMatches.length && selectedMemoryQuoteId && (
              <div className={styles.parityMeta}>No similar quotes were found for this record yet.</div>
            )}
            {!memoryMatchesLoading && memoryMatches.map((match) => (
              <div key={`match-${match.quote_id}`} className={styles.memoryMatchCard}>
                <div className={styles.parityPrimary}>
                  <span className={styles.parityTitle}>
                    <Link className={styles.entityLink} to={`/quotes/${match.quote_id}`}>
                      {match.quote_name || `Quote ${match.quote_id}`}
                    </Link>
                  </span>
                  <span className={styles.parityMeta}>
                    score {match.score}
                    {match.status ? ` · ${match.status}` : ''}
                    {match.event_date ? ` · ${match.event_date}` : ''}
                    {match.venue_name ? ` · ${match.venue_name}` : ''}
                  </span>
                  <span className={styles.parityMeta}>
                    {match.client_name || 'No client'}
                    {match.total ? ` · ${renderMoney(match.total)}` : ''}
                  </span>
                  {!!match.reasons?.length && (
                    <span className={styles.parityMeta}>Why: {match.reasons.join(' · ')}</span>
                  )}
                  {renderTagList(match.tags || [])}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Onyx Runtime</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Onyx enabled</span>
            <span className={styles.systemValue}>{onyxDiag ? (onyxDiag.enabled ? 'Enabled' : 'Disabled') : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Active mode</span>
            <span className={styles.systemValue}>{onyxDiag?.mode || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Managed local</span>
            <span className={styles.systemValue}>{onyxDiag?.local_enabled ? 'Allowed' : 'Disabled'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>External mode</span>
            <span className={styles.systemValue}>{onyxDiag?.external_enabled ? 'Allowed' : 'Disabled'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Managed endpoint</span>
            <span className={styles.systemValue}>{onyxDiag?.base_url || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Install detected</span>
            <span className={styles.systemValue}>{isOnyxInstalled(onyxDiag) ? <span className={styles.badgeCurrent}>Detected</span> : <span className={styles.badgePending}>Not installed</span>}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Health</span>
            <span className={styles.systemValue}>{onyxDiag?.health?.ok ? <span className={styles.badgeCurrent}>Healthy</span> : <span className={styles.badgeUpdate}>Offline</span>}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Docker</span>
            <span className={styles.systemValue}>{onyxDiag?.docker?.ok ? <span className={styles.badgeCurrent}>Available</span> : <span className={styles.badgeUpdate}>Missing</span>}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last install</span>
            <span className={styles.systemValue}>{onyxDiag?.last_install_at ? new Date(onyxDiag.last_install_at).toLocaleString() : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last start</span>
            <span className={styles.systemValue}>{onyxDiag?.last_start_at ? new Date(onyxDiag.last_start_at).toLocaleString() : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last stop</span>
            <span className={styles.systemValue}>{onyxDiag?.last_stop_at ? new Date(onyxDiag.last_stop_at).toLocaleString() : '—'}</span>
          </div>
        </div>
        {!!onyxDiag && (
          <div className={styles.releasePaths}>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Install path</span><code>{onyxDiag.install_path || '—'}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Compose file</span><code>{onyxDiag.compose_file || '—'}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Manual start</span><code>{onyxDiag.start_command || '—'}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Onyx log</span><code>{onyxDiag.log_path || 'logs/onyx.log'}</code></div>
          </div>
        )}
        {!!onyxDiag?.docker?.error && <pre className={styles.releaseSummary}>{onyxDiag.docker.error}</pre>}
        {!!onyxDiag?.last_error && <pre className={styles.releaseSummary}>{onyxDiag.last_error}</pre>}
        <div className={styles.inlineActions}>
          <button type="button" className="btn btn-primary" onClick={handleInstallOnyx} disabled={onyxInstalling}>
            {onyxInstalling ? 'Installing…' : 'Install Onyx'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleStartOnyx} disabled={onyxStarting || onyxDiag?.health?.ok}>
            {onyxStarting ? 'Starting…' : (onyxDiag?.health?.ok ? 'Onyx running' : 'Start Onyx')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleStopOnyx} disabled={onyxStopping || !onyxDiag?.install_detected}>
            {onyxStopping ? 'Stopping…' : 'Stop Onyx'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRestartOnyx} disabled={onyxRestarting || !onyxDiag?.install_detected}>
            {onyxRestarting ? 'Restarting…' : 'Restart Onyx'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadOnyxDiagnostics} disabled={onyxLoading}>
            {onyxLoading ? 'Refreshing…' : 'Detect Onyx'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Ollama Runtime</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Local AI enabled</span>
            <span className={styles.systemValue}>{localModelDiag ? (localModelDiag.enabled ? 'Enabled' : 'Disabled') : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Runtime mode</span>
            <span className={styles.systemValue}>{localModelDiag?.mode || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Endpoint</span>
            <span className={styles.systemValue}>{localModelDiag?.base_url || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Health</span>
            <span className={styles.systemValue}>{localModelDiag?.health?.ok ? <span className={styles.badgeCurrent}>Healthy</span> : <span className={styles.badgeUpdate}>Offline</span>}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Binary</span>
            <span className={styles.systemValue}>{localModelDiag?.binary?.ok ? <span className={styles.badgeCurrent}>Detected</span> : <span className={styles.badgePending}>Missing</span>}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Installed models</span>
            <span className={styles.systemValue}>{localModelDiag?.models?.length || 0}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last install</span>
            <span className={styles.systemValue}>{localModelDiag?.last_install_at ? new Date(localModelDiag.last_install_at).toLocaleString() : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last start</span>
            <span className={styles.systemValue}>{localModelDiag?.last_start_at ? new Date(localModelDiag.last_start_at).toLocaleString() : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last stop</span>
            <span className={styles.systemValue}>{localModelDiag?.last_stop_at ? new Date(localModelDiag.last_stop_at).toLocaleString() : '—'}</span>
          </div>
        </div>
        {!!localModelDiag && (
          <div className={styles.releasePaths}>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Install path</span><code>{localModelDiag.install_path || '—'}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Manual start</span><code>{localModelDiag.start_command || '—'}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Runtime log</span><code>{localModelDiag.log_path || 'logs/local-model-runtime.log'}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Binary version</span><code>{localModelDiag.binary?.version || localModelDiag.binary?.error || '—'}</code></div>
          </div>
        )}
        {!!localModelDiag?.last_error && <pre className={styles.releaseSummary}>{localModelDiag.last_error}</pre>}
        <div className={styles.inlineActions}>
          <button type="button" className="btn btn-primary" onClick={handleInstallLocalRuntime} disabled={localModelInstalling}>
            {localModelInstalling ? 'Installing…' : 'Install Ollama'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReinstallLocalRuntime} disabled={localModelReinstalling}>
            {localModelReinstalling ? 'Reinstalling…' : 'Reinstall Ollama'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleStartLocalRuntime} disabled={localModelStarting || localModelDiag?.health?.ok}>
            {localModelStarting ? 'Starting…' : (localModelDiag?.health?.ok ? 'Ollama running' : 'Start Ollama')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleStopLocalRuntime} disabled={localModelStopping || (!localModelDiag?.tracked_pid && !localModelDiag?.detected_pid)}>
            {localModelStopping ? 'Stopping…' : 'Stop Ollama'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRestartLocalRuntime} disabled={localModelRestarting || (!localModelDiag?.binary?.ok && !localModelDiag?.health?.ok)}>
            {localModelRestarting ? 'Restarting…' : 'Restart Ollama'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadLocalModelDiagnostics} disabled={localModelLoading}>
            {localModelLoading ? 'Refreshing…' : 'Detect Ollama'}
          </button>
        </div>
        <div className={styles.inlineActions} style={{ marginTop: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ minWidth: 280, margin: 0 }}>
            <label>Pull local model</label>
            <select value={localModelName} onChange={(event) => setLocalModelName(event.target.value)}>
              <option value="">Select a model</option>
              {(localModelDiag?.curated_models || []).map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label} ({entry.id}){entry.installed ? ' · installed' : ''}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handlePullLocalModel} disabled={localModelPulling || !localModelName}>
            {localModelPulling ? 'Pulling…' : 'Pull Model'}
          </button>
        </div>
        {(localModelDiag?.models || []).length > 0 && (
          <div className={styles.releasePaths} style={{ marginTop: 16 }}>
            {(localModelDiag.models || []).map((entry) => (
              <div key={entry.name} className={styles.releasePath} style={{ alignItems: 'center' }}>
                <span className={styles.systemLabel}>{entry.name}</span>
                <code>{entry.modified_at || 'installed'}</code>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteLocalModel(entry.name)} disabled={localModelDeleting}>
                  {localModelDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Rust Engine</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Mode</span>
            <span className={styles.systemValue}>
              {rustDiag
                ? `${rustDiag.enabled ? 'Enabled' : 'Disabled'}${rustDiag.shadow_mode ? ' · Shadow' : ''}`
                : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Engine URL</span>
            <span className={styles.systemValue}>{rustDiag?.url || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Health</span>
            <span className={styles.systemValue}>
              {rustDiag
                ? (rustDiag.health?.ok ? <span className={styles.badgeCurrent}>Healthy</span> : <span className={styles.badgeUpdate}>Unavailable</span>)
                : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Ready</span>
            <span className={styles.systemValue}>
              {rustDiag
                ? (rustDiag.ready?.ok ? <span className={styles.badgeCurrent}>Ready</span> : <span className={styles.badgeUpdate}>Not ready</span>)
                : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Build state</span>
            <span className={styles.systemValue}>
              {rustDiag
                ? (rustDiag.build_state === 'current'
                  ? <span className={styles.badgeCurrent}>Current build</span>
                  : <span className={styles.badgeUpdate}>Outdated build</span>)
                : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Timeout</span>
            <span className={styles.systemValue}>{rustDiag?.timeout_ms != null ? `${rustDiag.timeout_ms} ms` : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Tracked PID</span>
            <span className={styles.systemValue}>{rustDiag?.tracked_pid || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Detected listener PID</span>
            <span className={styles.systemValue}>{rustDiag?.detected_pid || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last start</span>
            <span className={styles.systemValue}>{rustDiag?.last_start_at ? new Date(rustDiag.last_start_at).toLocaleString() : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Last stop</span>
            <span className={styles.systemValue}>{rustDiag?.last_stop_at ? new Date(rustDiag.last_stop_at).toLocaleString() : '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Inventory route</span>
            <span className={styles.systemValue}>
              {rustDiag?.capabilities?.inventory_check?.available
                ? <span className={styles.badgeCurrent}>Available</span>
                : <span className={styles.badgeUpdate}>Missing</span>}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Pricing route</span>
            <span className={styles.systemValue}>
              {rustDiag?.capabilities?.pricing_check?.available
                ? <span className={styles.badgeCurrent}>Available</span>
                : <span className={styles.badgeUpdate}>Missing</span>}
            </span>
          </div>
        </div>
        {!!rustDiag?.start_command && (
          <div className={styles.releasePaths}>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Manual start</span><code>{rustDiag.start_command}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Engine log</span><code>{rustDiag.log_path || 'logs/rust-engine.log'}</code></div>
          </div>
        )}
        {rustDiag?.health?.ok && rustDiag?.build_state !== 'current' && (
          <div className={styles.rustWarning}>
            The Rust service is running, but it looks like an older build. Pricing endpoints are missing, so pricing currently falls back to Node. Restart the engine if BadShuffle started it, or stop the external process and start it again on the current build.
          </div>
        )}
        {rustDiag?.last_error && (
          <pre className={styles.releaseSummary}>{rustDiag.last_error}</pre>
        )}
        <div className={styles.inlineActions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartRustEngine}
            disabled={rustStarting || rustDiag?.health?.ok}
          >
            {rustStarting ? 'Starting…' : (rustDiag?.health?.ok ? 'Rust engine running' : 'Start Rust engine')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleStopRustEngine}
            disabled={rustStopping || (!rustDiag?.tracked_pid && !rustDiag?.detected_pid)}
          >
            {rustStopping ? 'Stopping…' : 'Stop Rust engine'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRestartRustEngine}
            disabled={rustRestarting || (!rustDiag?.tracked_pid && !rustDiag?.detected_pid)}
          >
            {rustRestarting ? 'Restarting…' : 'Restart Rust engine'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadRustDiagnostics} disabled={rustLoading}>
            {rustLoading ? 'Refreshing…' : 'Refresh engine status'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Packaged Release Checks</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Artifact source</span>
            <span className={styles.systemValue}>
              {rustReleaseChecks
                ? (rustReleaseChecks.packaged
                  ? <span className={styles.badgeCurrent}>Packaged dist</span>
                  : <span className={styles.badgePending}>Latest AI report only</span>)
                : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Package version</span>
            <span className={styles.systemValue}>
              {rustReleaseChecks?.manifest?.version ? `v${rustReleaseChecks.manifest.version}` : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Packaged at</span>
            <span className={styles.systemValue}>
              {rustReleaseChecks?.manifest?.generated_at
                ? new Date(rustReleaseChecks.manifest.generated_at).toLocaleString()
                : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Parity context</span>
            <span className={styles.systemValue}>{paritySource?.context || '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Parity report generated</span>
            <span className={styles.systemValue}>
              {paritySource?.generated_at ? new Date(paritySource.generated_at).toLocaleString() : '—'}
            </span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Parity totals</span>
            <span className={styles.systemValue}>
              {paritySource?.totals
                ? `${paritySource.totals.quotes_checked ?? 0} quotes · ${paritySource.totals.summary_mismatches ?? 0} summary mismatches · ${paritySource.totals.item_mismatches ?? 0} item mismatches · ${paritySource.totals.errors ?? 0} errors`
                : '—'}
            </span>
          </div>
        </div>
        {!!rustReleaseChecks?.paths && (
          <div className={styles.releasePaths}>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Manifest</span><code>{rustReleaseChecks.paths.manifest}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Summary</span><code>{rustReleaseChecks.paths.summary}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Packaged parity JSON</span><code>{rustReleaseChecks.paths.packaged_parity_json}</code></div>
            <div className={styles.releasePath}><span className={styles.systemLabel}>Latest parity JSON</span><code>{rustReleaseChecks.paths.latest_parity_json}</code></div>
          </div>
        )}
        {rustReleaseChecks?.packaged_summary && (
          <pre className={styles.releaseSummary}>{rustReleaseChecks.packaged_summary}</pre>
        )}
        <div className={styles.inlineActions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRunRustParityNow}
            disabled={rustParityRunning}
          >
            {rustParityRunning ? 'Running parity…' : 'Run parity now'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => downloadTextFile(
              `rust-parity-${paritySource?.context || 'latest'}.json`,
              JSON.stringify(packagedParityJson || latestParity || {}, null, 2),
              'application/json;charset=utf-8'
            )}
            disabled={!packagedParityJson && !latestParity}
          >
            Download parity JSON
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => downloadTextFile(
              'RELEASE-CHECKS.md',
              rustReleaseChecks?.packaged_summary || '# Release Checks\n\nNo packaged summary is available yet.\n',
              'text/markdown;charset=utf-8'
            )}
            disabled={!rustReleaseChecks?.packaged_summary}
          >
            Download release summary
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadRustReleaseChecks} disabled={rustReleaseChecksLoading}>
            {rustReleaseChecksLoading ? 'Refreshing…' : 'Refresh release checks'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Rust Parity Snapshot</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Quotes checked</span>
            <span className={styles.systemValue}>{rustParity?.totals?.quotes_checked ?? '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Summary mismatches</span>
            <span className={styles.systemValue}>{rustParity?.totals?.summary_mismatches ?? '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Item mismatches</span>
            <span className={styles.systemValue}>{rustParity?.totals?.item_mismatches ?? '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Errors</span>
            <span className={styles.systemValue}>{rustParity?.totals?.errors ?? '—'}</span>
          </div>
        </div>
        {!!rustParity?.comparisons?.length && (
          <div className={styles.parityList}>
            {rustParity.comparisons.slice(0, 5).map((row) => (
              <div key={row.quote_id} className={styles.parityRow}>
                <div className={styles.parityPrimary}>
                  <span className={styles.parityTitle}>{row.quote?.name || `Quote ${row.quote_id}`}</span>
                  <span className={styles.parityMeta}>
                    id {row.quote_id}
                    {row.quote?.status ? ` · ${row.quote.status}` : ''}
                    {' · '}
                    summary {row.summary_match ? 'match' : 'mismatch'}
                    {row.items_match != null ? ` · items ${row.items_match ? 'match' : 'mismatch'}` : ''}
                    {row.error ? ` · ${row.error}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={() => handleLoadRustQuoteCompare(row.quote_id)}
                  disabled={rustQuoteCompareLoading}
                >
                  {rustQuoteCompareLoading && selectedRustQuoteId === String(row.quote_id) ? 'Loading…' : 'Inspect'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.inlineActions}>
          <button type="button" className="btn btn-secondary" onClick={loadRustParitySnapshot} disabled={rustParityLoading}>
            {rustParityLoading ? 'Running…' : 'Refresh parity snapshot'}
          </button>
        </div>
        {(rustQuoteCompare || rustQuoteCompareLoading) && (
          <div className={styles.parityDrilldown}>
            <div className={styles.systemSection} style={{ marginBottom: 8 }}>
              Quote Parity Drilldown{rustQuoteCompare?.quote?.name ? ` · ${rustQuoteCompare.quote.name}` : selectedRustQuoteId ? ` · Quote ${selectedRustQuoteId}` : ''}
            </div>
            {rustQuoteCompareLoading && <div className={styles.parityMeta}>Loading quote comparison…</div>}
            {rustQuoteCompare && !rustQuoteCompareLoading && (
              <>
                <div className={styles.systemGrid}>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Quote</span>
                    <span className={styles.systemValue}>
                      <Link className={styles.entityLink} to={`/quotes/${rustQuoteCompare.quote_id}`}>
                        {rustQuoteCompare.quote?.name || `Quote ${rustQuoteCompare.quote_id}`}
                      </Link>
                    </span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Quote status</span>
                    <span className={styles.systemValue}>{rustQuoteCompare.quote?.status || '—'}</span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Section</span>
                    <span className={styles.systemValue}>{rustQuoteCompare.section?.title || 'Whole quote'}</span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Target window</span>
                    <span className={styles.systemValue}>{renderRange(rustQuoteCompare.target_range)}</span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Summary status</span>
                    <span className={styles.systemValue}>
                      {rustQuoteCompare.summary_match ? <span className={styles.badgeCurrent}>Match</span> : <span className={styles.badgeUpdate}>Mismatch</span>}
                    </span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Items status</span>
                    <span className={styles.systemValue}>
                      {rustQuoteCompare.items_match == null
                        ? 'Not checked'
                        : (rustQuoteCompare.items_match ? <span className={styles.badgeCurrent}>Match</span> : <span className={styles.badgeUpdate}>Mismatch</span>)}
                    </span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Checked items</span>
                    <span className={styles.systemValue}>
                      {renderItemList(rustQuoteCompare.items)}
                    </span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Summary compact</span>
                    <span className={styles.systemValue}>
                      {rustQuoteCompare.summary_compact
                        ? `${rustQuoteCompare.summary_compact.changed_count || 0} changed keys`
                        : 'No changes'}
                    </span>
                  </div>
                  <div className={styles.systemRow}>
                    <span className={styles.systemLabel}>Items compact</span>
                    <span className={styles.systemValue}>
                      {rustQuoteCompare.items_compact
                        ? `${rustQuoteCompare.items_compact.changed_count || 0} changed items`
                        : 'No changes'}
                    </span>
                  </div>
                </div>
                {rustQuoteCompare.summary_compact && (
                  <div className={styles.parityDetailSection}>
                    <div className={styles.parityTitle}>Summary diff</div>
                    {!!rustQuoteCompare.summary_compact.changed_items?.length && (
                      <div className={styles.parityMeta}>
                        Changed items: {renderItemList(rustQuoteCompare.summary_compact.changed_items)}
                      </div>
                    )}
                    {renderJsonBlock(rustQuoteCompare.summary_compact)}
                  </div>
                )}
                {rustQuoteCompare.items_compact && (
                  <div className={styles.parityDetailSection}>
                    <div className={styles.parityTitle}>Item diff</div>
                    {!!rustQuoteCompare.items_compact.changed_items?.length && (
                      <div className={styles.parityMeta}>
                        Changed items: {renderItemList(rustQuoteCompare.items_compact.changed_items)}
                      </div>
                    )}
                    {renderJsonBlock(rustQuoteCompare.items_compact)}
                  </div>
                )}
                {(rustQuoteCompare.summary_diff || rustQuoteCompare.items_diff || rustQuoteCompare.error) && (
                  <div className={styles.parityDetailSection}>
                    <div className={styles.parityTitle}>Full compare payload</div>
                    {renderJsonBlock({
                      error: rustQuoteCompare.error || null,
                      summary_diff: rustQuoteCompare.summary_diff || null,
                      items_diff: rustQuoteCompare.items_diff || null,
                    })}
                  </div>
                )}
                {rustPricingCompare && (
                  <div className={styles.parityDetailSection}>
                    <div className={styles.parityTitle}>Pricing parity</div>
                    <div className={styles.systemGrid}>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Status</span>
                        <span className={styles.systemValue}>
                          {rustPricingCompare.match ? <span className={styles.badgeCurrent}>Match</span> : <span className={styles.badgeUpdate}>Mismatch</span>}
                        </span>
                      </div>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Subtotal</span>
                        <span className={styles.systemValue}>{renderMoney(rustPricingCompare.rust?.subtotal)}</span>
                      </div>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Delivery</span>
                        <span className={styles.systemValue}>{renderMoney(rustPricingCompare.rust?.deliveryTotal)}</span>
                      </div>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Custom items</span>
                        <span className={styles.systemValue}>{renderMoney(rustPricingCompare.rust?.customSubtotal)}</span>
                      </div>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Adjustments</span>
                        <span className={styles.systemValue}>{renderMoney(rustPricingCompare.rust?.adjTotal)}</span>
                      </div>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Taxable amount</span>
                        <span className={styles.systemValue}>{renderMoney(rustPricingCompare.rust?.taxableAmount)}</span>
                      </div>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Tax</span>
                        <span className={styles.systemValue}>{renderMoney(rustPricingCompare.rust?.tax)}</span>
                      </div>
                      <div className={styles.systemRow}>
                        <span className={styles.systemLabel}>Total</span>
                        <span className={styles.systemValue}>{renderMoney(rustPricingCompare.rust?.total)}</span>
                      </div>
                    </div>
                    {!rustPricingCompare.match && renderJsonBlock(rustPricingCompare.diff)}
                    {!rustPricingCompare.match && renderJsonBlock({
                      legacy: rustPricingCompare.legacy,
                      rust: rustPricingCompare.rust,
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Rust Pricing Snapshot</div>
        <div className={styles.systemGrid}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Quotes checked</span>
            <span className={styles.systemValue}>{rustPricingParity?.totals?.quotes_checked ?? '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Mismatches</span>
            <span className={styles.systemValue}>{rustPricingParity?.totals?.mismatches ?? '—'}</span>
          </div>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>Errors</span>
            <span className={styles.systemValue}>{rustPricingParity?.totals?.errors ?? '—'}</span>
          </div>
        </div>
        {!!rustPricingParity?.comparisons?.length && (
          <div className={styles.parityList}>
            {rustPricingParity.comparisons.slice(0, 5).map((row) => (
              <div key={`pricing-${row.quote_id}`} className={styles.parityRow}>
                <div className={styles.parityPrimary}>
                  <span className={styles.parityTitle}>{row.quote?.name || `Quote ${row.quote_id}`}</span>
                  <span className={styles.parityMeta}>
                    id {row.quote_id}
                    {row.quote?.status ? ` · ${row.quote.status}` : ''}
                    {' · '}
                    pricing {row.match ? 'match' : 'mismatch'}
                    {row.error ? ` · ${row.error}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={() => handleLoadRustQuoteCompare(row.quote_id)}
                  disabled={rustQuoteCompareLoading}
                >
                  {rustQuoteCompareLoading && selectedRustQuoteId === String(row.quote_id) ? 'Loading…' : 'Inspect'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.inlineActions}>
          <button type="button" className="btn btn-secondary" onClick={loadRustPricingParitySnapshot} disabled={rustPricingParityLoading}>
            {rustPricingParityLoading ? 'Running…' : 'Refresh pricing snapshot'}
          </button>
        </div>
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
      a.download = `badshuffle-backup-${new Date().toISOString().slice(0, 10)}.zip`;
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
      const result = await api.admin.importDb(importFile);
      const restoredUploads = Number(result?.restored_uploads || 0);
      setImportSuccess(
        restoredUploads > 0
          ? `Backup imported successfully. Restored ${restoredUploads} uploaded file${restoredUploads === 1 ? '' : 's'}. Reloading…`
          : 'Backup imported successfully. Reloading…'
      );
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
          Download a bundled backup containing the SQLite database and uploaded media files. Use this to back up your data or migrate to another machine without losing images.
        </p>
        <button type="button" className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Download backup (.zip)'}
        </button>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className={styles.systemSection}>Import Database</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Restore a previously exported <code>.zip</code> backup with media, or import a legacy <code>.db</code>-only backup. <strong>This will replace all current data.</strong>
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.db,application/zip,application/octet-stream"
            style={{ display: 'none' }}
            onChange={e => { setImportFile(e.target.files[0] || null); setImportError(''); setImportSuccess(''); }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
            {importFile ? importFile.name : 'Choose backup file…'}
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
