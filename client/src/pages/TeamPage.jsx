import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import styles from './TeamPage.module.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatLastSeen(value, isOnline) {
  if (!value) return 'No recent activity';
  if (isOnline) return 'Online now';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'No recent activity';
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.max(1, Math.round(diffMs / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

function durationFromTimestamp(value) {
  if (!value) return 0;
  const timestamp = new Date(String(value).replace(' ', 'T') + 'Z').getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : 0;
}

function formatEventDate(date) {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function RoleBadge({ role }) {
  const label = role === 'admin' ? 'Admin' : 'Operator';
  return <span className={styles.roleBadge}>{label}</span>;
}

function profilePhotoUrl(member, variant = 'thumb') {
  if (!member?.photo_url) return '';
  return api.proxyImageUrl(member.photo_url, { variant });
}

function StatusPill({ isOnline }) {
  return (
    <span className={`${styles.statusPill} ${isOnline ? styles.statusOnline : styles.statusOffline}`}>
      <span className={styles.statusDot} aria-hidden="true" />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}

function TeamCardSkeleton() {
  return (
    <div className={`card ${styles.card}`} aria-hidden="true">
      <div className={styles.cardHeader}>
        <div>
          <div className="skeleton" style={{ width: 140, height: 18, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 86, height: 12, borderRadius: 6 }} />
        </div>
        <div className="skeleton" style={{ width: 72, height: 28, borderRadius: 999 }} />
      </div>
      <div className={styles.focusBlock}>
        <div className="skeleton" style={{ width: 92, height: 11, borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '70%', height: 15, borderRadius: 6 }} />
      </div>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}><div className="skeleton" style={{ width: '100%', height: 52, borderRadius: 12 }} /></div>
        <div className={styles.kpiCard}><div className="skeleton" style={{ width: '100%', height: 52, borderRadius: 12 }} /></div>
      </div>
      <div className={styles.recentSection}>
        <div className="skeleton" style={{ width: 112, height: 12, borderRadius: 6, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: '100%', height: 16, borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '84%', height: 16, borderRadius: 6 }} />
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ members: [], range: null });
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load(showLoading = false) {
      if (showLoading) setLoading(true);
      setError('');
      try {
        const response = await api.team.overview();
        if (cancelled) return;
        setData({
          members: response.members || [],
          range: response.range || null,
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load team');
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    }
    load(true);
    const refreshId = setInterval(() => load(false), 30_000);
    const tickId = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => {
      cancelled = true;
      clearInterval(refreshId);
      clearInterval(tickId);
    };
  }, []);

  useEffect(() => {
    const ids = (data.members || [])
      .map((member) => String(member.photo_url || '').trim())
      .filter((value) => /^\d+$/.test(value));
    if (ids.length) api.prefetchFileServeUrls(ids).catch(() => {});
  }, [data.members]);

  const summary = useMemo(() => {
    const members = data.members || [];
    return {
      online: members.filter((member) => member.is_online).length,
      totalSales: members.reduce((sum, member) => sum + Number(member.sales_total_ytd || 0), 0),
      totalQuotes: members.reduce((sum, member) => sum + Number(member.quote_count || 0), 0),
    };
  }, [data.members]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team</h1>
          <p className={styles.subtitle}>
            Live staff roster with presence, current focus, and year-to-date sales performance.
          </p>
        </div>
        <div className={styles.headerMeta}>
          <Link to="/team/groups" className="btn btn-ghost btn-sm">Groups</Link>
          <div className={`card ${styles.summaryCard}`}>
            <span className={styles.summaryLabel}>Online now</span>
            <strong className={styles.summaryValue}>{summary.online}</strong>
          </div>
          <div className={`card ${styles.summaryCard}`}>
            <span className={styles.summaryLabel}>YTD sales</span>
            <strong className={styles.summaryValue}>{formatCurrency(summary.totalSales)}</strong>
          </div>
          <div className={`card ${styles.summaryCard}`}>
            <span className={styles.summaryLabel}>Quotes created</span>
            <strong className={styles.summaryValue}>{summary.totalQuotes}</strong>
          </div>
        </div>
      </div>

      {data.range && (
        <div className={styles.rangeNote}>
          Sales totals cover <strong>{new Date(`${data.range.sales_start}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          {' '}through{' '}
          <strong>{new Date(`${data.range.sales_end}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>.
        </div>
      )}

      {loading ? (
        <div className={styles.grid} aria-busy="true" aria-label="Loading team">
          {Array.from({ length: 6 }).map((_, index) => <TeamCardSkeleton key={index} />)}
        </div>
      ) : error ? (
        <div className="empty-state">{error}</div>
      ) : data.members.length === 0 ? (
        <div className="empty-state">No active team members found.</div>
      ) : (
        <div className={styles.grid}>
          {data.members.map((member) => (
            <article key={member.id} className={`card ${styles.card}`}>
              <div className={styles.cardHeader}>
                <div className={styles.identity}>
                  <div className={styles.identityRow}>
                    {member.photo_url ? (
                      <img className={styles.avatar} src={profilePhotoUrl(member)} alt={member.full_name || member.email} />
                    ) : (
                      <div className={styles.avatarFallback} aria-hidden="true">
                        {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.identityMeta}>
                      <h2 className={styles.name}>{member.full_name || member.email}</h2>
                      <div className={styles.identitySubline}>
                        {member.username ? <span className={styles.username}>@{member.username}</span> : null}
                        <span className={styles.email}>{member.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.roleRow}>
                    <RoleBadge role={member.role} />
                    <span className={styles.lastSeen}>{formatLastSeen(member.last_seen_at, member.is_online)}</span>
                  </div>
                </div>
                <StatusPill isOnline={!!member.is_online} />
              </div>

              <div className={styles.focusBlock}>
                <span className={styles.sectionLabel}>Currently working on</span>
                <div className={styles.focusValue}>{member.current_label || 'No recent activity'}</div>
                <div className={styles.presenceMeta}>
                  {member.is_online && member.online_since_at ? <span>Online for {formatDuration(durationFromTimestamp(member.online_since_at))}</span> : null}
                  {member.last_active_at ? <span>Idle for {formatDuration(durationFromTimestamp(member.last_active_at))}</span> : null}
                </div>
              </div>

              {member.phone || member.bio ? (
                <div className={styles.detailBlock}>
                  {member.phone ? <div className={styles.detailLine}>{member.phone}</div> : null}
                  {member.bio ? <p className={styles.bio}>{member.bio}</p> : null}
                </div>
              ) : null}

              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Sales totals</span>
                  <strong className={styles.kpiValue}>{formatCurrency(member.sales_total_ytd)}</strong>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Quotes</span>
                  <strong className={styles.kpiValue}>{Number(member.quote_count || 0)}</strong>
                </div>
              </div>

              <div className={styles.recentSection}>
                <div className={styles.recentHeader}>
                  <span className={styles.sectionLabel}>Recent projects</span>
                </div>
                {member.recent_quotes && member.recent_quotes.length > 0 ? (
                  <ul className={styles.recentList}>
                    {member.recent_quotes.map((quote) => (
                      <li key={quote.id} className={styles.recentItem}>
                        <Link to={`/quotes/${quote.id}`} className={styles.quoteLink}>
                          <span className={styles.quoteName}>{quote.name}</span>
                          <span className={styles.quoteMeta}>
                            <span className={`${styles.quoteStatus} ${styles[`status${String(quote.status || '').charAt(0).toUpperCase()}${String(quote.status || '').slice(1)}`] || ''}`}>
                              {quote.status || 'draft'}
                            </span>
                            {quote.event_date ? <span>{formatEventDate(quote.event_date)}</span> : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyRecent}>No projects created yet.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
