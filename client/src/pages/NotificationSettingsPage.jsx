import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './SettingsPage.module.css';

export default function NotificationSettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    Promise.all([api.notificationSettings.list(), api.team.groups()])
      .then(([settings, team]) => {
        setRows(settings.types || []);
        setGroups(team.groups || []);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  const groupOptions = useMemo(() => groups.map((group) => ({ id: Number(group.id), name: group.name })), [groups]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        types: rows.map((row) => ({
          type: row.type,
          enabled: !!row.enabled,
          group_ids: (row.groups || []).map((group) => Number(group.id)),
        })),
      };
      const result = await api.notificationSettings.update(payload);
      setRows(result.types || []);
      toast.success('Notification settings saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleGroup(rowType, group) {
    setRows((current) => current.map((row) => {
      if (row.type !== rowType) return row;
      const exists = (row.groups || []).some((entry) => Number(entry.id) === Number(group.id));
      return {
        ...row,
        groups: exists
          ? (row.groups || []).filter((entry) => Number(entry.id) !== Number(group.id))
          : [...(row.groups || []), group],
      };
    }));
  }

  return (
    <div className={styles.page}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className={styles.title}>Notification Settings</h1>
          <p className={styles.hint}>Turn notification types on or off and optionally limit them to specific team groups.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/team/groups" className="btn btn-ghost btn-sm">Manage Groups</Link>
          <button type="button" className="btn btn-primary btn-sm" disabled={loading || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {loading ? <div className="empty-state">Loading notification settings…</div> : null}
      {!loading ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <article key={row.type} className="border border-border rounded-xl p-4 bg-surface">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <strong>{row.label}</strong>
                    <p className={styles.hint} style={{ marginTop: 6 }}>{row.description}</p>
                  </div>
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={!!row.enabled}
                      onChange={(e) => setRows((current) => current.map((entry) => entry.type === row.type ? { ...entry, enabled: e.target.checked } : entry))}
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                <div className="mt-3">
                  <div className={styles.hint} style={{ marginBottom: 8 }}>Groups</div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    {groupOptions.length === 0 ? <span className={styles.hint}>No groups created yet. Notifications will follow module permissions only.</span> : null}
                    {groupOptions.map((group) => {
                      const checked = (row.groups || []).some((entry) => Number(entry.id) === Number(group.id));
                      return (
                        <label key={`${row.type}-${group.id}`} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 bg-bg">
                          <input type="checkbox" checked={checked} onChange={() => toggleGroup(row.type, group)} />
                          <span>{group.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
