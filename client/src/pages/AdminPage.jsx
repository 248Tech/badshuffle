import React, { useState, useEffect, useCallback } from 'react';
import { api, getToken } from '../api';
import styles from './AdminPage.module.css';

function ConfirmDialog({ title, text, onConfirm, onCancel }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.dialogTitle}>{title}</div>
        <div className={styles.dialogText}>{text}</div>
        <div className={styles.dialogActions}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
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

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');
  const [notAuthorised, setNotAuthorised] = useState(false);

  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null); // { id, email }

  const currentUserId = getCurrentUserId();

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.admin.getUsers();
      setUsers(data);
    } catch (e) {
      if (e.message && e.message.includes('403')) {
        setNotAuthorised(true);
      } else {
        setError(e.message);
      }
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const pendingCount = users.filter(u => !u.approved).length;
  const displayed = tab === 'pending' ? users.filter(u => !u.approved) : users;

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
    try {
      await api.admin.approveUser(id);
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleReject(id) {
    try {
      await api.admin.rejectUser(id);
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    setConfirmDelete(null);
    try {
      await api.admin.deleteUser(id);
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
  }

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
      {confirmDelete && (
        <ConfirmDialog
          title="Delete user"
          text={`Delete ${confirmDelete.email}? This cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className={styles.header}>
        <div>
          <div className={styles.title}>Admin</div>
          <div className={styles.sub}>Manage user accounts</div>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}

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
        {createError && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{createError}</div>}
      </div>

      <div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`} onClick={() => setTab('all')}>
            All Users
          </button>
          <button className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`} onClick={() => setTab('pending')}>
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
                    <td>{u.role}</td>
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
                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleApprove(u.id)}>Approve</button>
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleReject(u.id)}>Reject</button>
                          </>
                        )}
                        <button
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
    </div>
  );
}
