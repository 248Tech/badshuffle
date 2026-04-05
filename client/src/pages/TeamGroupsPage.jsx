import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './TeamPage.module.css';

export default function TeamGroupsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingGroupId, setSavingGroupId] = useState(null);
  const [data, setData] = useState({ groups: [], members: [] });
  const [form, setForm] = useState({ name: '', description: '' });

  async function load() {
    setLoading(true);
    try {
      setData(await api.team.groups());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.team.createGroup(form);
      setForm({ name: '', description: '' });
      toast.success('Group created');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleToggleMember(group, memberId, checked) {
    const ids = new Set((group.members || []).map((member) => Number(member.id)));
    if (checked) ids.add(Number(memberId));
    else ids.delete(Number(memberId));
    setSavingGroupId(group.id);
    try {
      const next = await api.team.updateGroupMembers(group.id, { user_ids: Array.from(ids) });
      setData(next);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingGroupId(null);
    }
  }

  async function handleDelete(group) {
    if (!window.confirm(`Delete group "${group.name}"?`)) return;
    try {
      await api.team.deleteGroup(group.id);
      toast.success('Group deleted');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team Groups</h1>
          <p className={styles.subtitle}>Create staff groups and control who receives grouped notifications.</p>
        </div>
        <Link to="/team" className="btn btn-ghost btn-sm">Back To Team</Link>
      </div>

      <div className={styles.grid} style={{ gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)' }}>
        <section className={`card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Create Group</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="form-group">
              <label htmlFor="tg-name">Name</label>
              <input id="tg-name" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="tg-desc">Description</label>
              <textarea id="tg-desc" rows={3} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!form.name.trim()}>Create Group</button>
          </form>
        </section>

        <section className={`card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Groups</h2>
          {loading ? <div className="empty-state">Loading groups…</div> : null}
          {!loading && data.groups.length === 0 ? <div className="empty-state">No groups yet.</div> : null}
          {!loading && data.groups.length > 0 ? (
            <div className="flex flex-col gap-4">
              {data.groups.map((group) => (
                <article key={group.id} className={styles.detailBlock}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <strong>{group.name}</strong>
                      {group.description ? <p className={styles.bio} style={{ marginTop: 6 }}>{group.description}</p> : null}
                      <div className={styles.lastSeen}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(group)}>Delete</button>
                  </div>
                  <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    {data.members.map((member) => {
                      const checked = (group.members || []).some((entry) => Number(entry.id) === Number(member.id));
                      return (
                        <label key={`${group.id}-${member.id}`} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 bg-surface">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={savingGroupId === group.id}
                            onChange={(e) => handleToggleMember(group, member.id, e.target.checked)}
                          />
                          <span>{member.full_name || member.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
