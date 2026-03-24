import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { clearToken, api } from '../api';

function pathToLabel(path) {
  if (!path || path === '/') return 'Dashboard';
  const p = path.replace(/^\//, '');
  if (p === 'dashboard') return 'Dashboard';
  if (p === 'inventory') return 'Inventory';
  if (p.startsWith('inventory/')) return 'Item';
  if (p === 'quotes') return 'Projects';
  if (p.startsWith('quotes/')) return 'Project';
  if (p === 'billing') return 'Billing';
  if (p === 'leads') return 'Leads';
  if (p === 'files') return 'Files';
  if (p === 'messages') return 'Messages';
  if (p === 'stats') return 'Stats';
  if (p === 'extension') return 'Extension';
  if (p === 'admin') return 'Admin';
  if (p === 'templates') return 'Templates';
  if (p === 'settings') return 'Settings';
  if (p === 'directory') return 'Directory';
  if (p === 'vendors') return 'Vendors';
  if (p === 'inventory-settings') return 'Inventory Settings';
  if (p === 'message-settings') return 'Message Settings';
  return p;
}

const AngryFace = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="13" fill="var(--color-accent)" />
    <path d="M7 9.5l4 2.5" stroke="#1a0000" strokeWidth="2" strokeLinecap="round"/>
    <path d="M21 9.5l-4 2.5" stroke="#1a0000" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="10.5" cy="14" r="1.6" fill="#1a0000"/>
    <circle cx="17.5" cy="14" r="1.6" fill="#1a0000"/>
    <path d="M9.5 20c1.2-2.2 7.8-2.2 9 0" stroke="#1a0000" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <path d="M9.5 20h9" stroke="#1a0000" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const ICONS = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  ),
  inventory: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 5.5l-5.5-4-5.5 4v7a1 1 0 001 1h9a1 1 0 001-1v-7z"/>
      <path d="M5.5 14v-5.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5V14"/>
    </svg>
  ),
  import: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v9M4.5 7l3.5 3.5L11.5 7"/><path d="M2 12h12"/>
    </svg>
  ),
  quotes: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="12" height="14" rx="1"/><path d="M5 5h6M5 8h6M5 11h3"/>
    </svg>
  ),
  billing: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="10" rx="1.5"/>
      <path d="M1 7h14"/><path d="M4 11h2M9 11h3"/>
    </svg>
  ),
  leads: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"/>
    </svg>
  ),
  files: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5A1.5 1.5 0 013.5 2H7l2 2h3.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z"/>
    </svg>
  ),
  messages: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9.5a5 5 0 01-5 5H3l-1.5 1.5v-7A5 5 0 017 4h2a5 5 0 015 5v.5z"/>
    </svg>
  ),
  stats: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13l3.5-5 3 3 2.5-4 3 4"/><path d="M2 13h12"/>
    </svg>
  ),
  extension: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
      <rect x="2" y="9" width="5" height="5" rx="1"/><path d="M9 11.5h5M11.5 9v5"/>
    </svg>
  ),
  vendors: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4h14l-1.5 7H2.5L1 4z"/><path d="M1 4L2 1h12l1 3"/>
      <circle cx="5" cy="14" r="1"/><circle cx="11" cy="14" r="1"/>
    </svg>
  ),
  admin: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="5" r="2.5"/><path d="M1 13c0-2.485 2.015-4 4.5-4"/>
      <circle cx="11" cy="5" r="2"/><path d="M9 13c0-2.2 1.343-3.5 3.5-3.5A3.5 3.5 0 0115 13"/>
    </svg>
  ),
  templates: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="13" height="10" rx="1"/><path d="M1.5 7l5 3 5-3"/>
    </svg>
  ),
  settings: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
    </svg>
  ),
  directory: (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5A1.5 1.5 0 013.5 2h4L9 3.5H12.5A1.5 1.5 0 0114 5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z"/>
      <circle cx="8" cy="8" r="1.5"/><path d="M5.5 11c0-1.38 1.12-2 2.5-2s2.5.62 2.5 2"/>
    </svg>
  ),
};

const NAV_GROUPS = [
  {
    id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, to: '/dashboard',
    children: [{ to: '/stats', label: 'Stats', icon: ICONS.stats }],
  },
  {
    id: 'projects', label: 'Projects', icon: ICONS.quotes, to: '/quotes',
    children: [{ to: '/billing', label: 'Billing', icon: ICONS.billing, role: 'operator' }],
  },
  {
    id: 'inventory', label: 'Inventory', icon: ICONS.inventory, to: '/inventory',
    children: [{ to: '/inventory-settings', label: 'Inventory Settings', icon: ICONS.settings, role: 'operator' }],
  },
  {
    id: 'messages', label: 'Messages', icon: ICONS.messages,
    children: [
      { to: '/messages', label: 'Inbox', icon: ICONS.messages },
      { to: '/templates', label: 'Templates', icon: ICONS.templates, role: 'operator' },
      { to: '/message-settings', label: 'Message Settings', icon: ICONS.settings, role: 'operator' },
    ],
  },
  {
    id: 'directory', label: 'Directory', icon: ICONS.directory, to: '/directory',
    children: [
      { to: '/leads', label: 'Leads', icon: ICONS.leads },
      { to: '/vendors', label: 'Vendors', icon: ICONS.vendors, role: 'operator' },
    ],
  },
  { id: 'files', label: 'Files', icon: ICONS.files, to: '/files' },
  {
    id: 'settings', label: 'Settings', icon: ICONS.settings, to: '/settings', role: 'operator',
    children: [
      { to: '/extension', label: 'Extension', icon: ICONS.extension },
      { to: '/admin', label: 'Admin', icon: ICONS.admin, role: 'admin' },
      { to: '/import', label: 'Import', icon: ICONS.import },
    ],
  },
];

function canSee(item, role) {
  if (item.role === 'admin') return role === 'admin';
  if (item.role === 'operator') return role === 'admin' || role === 'operator';
  return true;
}

function Chevron({ open }) {
  return (
    <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
      width="11" height="11" viewBox="0 0 12 12"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5l3 3 3-3"/>
    </svg>
  );
}

function CollapseIcon({ collapsed }) {
  return collapsed ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2l5 5-5 5"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2L4 7l5 5"/>
    </svg>
  );
}

export default function Sidebar({ role = '', mobileOpen = false, onMobileClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [online, setOnline] = useState([]);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('bs_sidebar_collapsed') === '1'; } catch { return false; }
  });

  // Flyout for collapsed mode: which group + pixel offset from top of viewport
  const [flyout, setFlyout] = useState(null); // { id, top }
  const groupRowRefs = useRef({});
  const flyoutTimers = useRef({});
  const expandTimers = useRef({});

  function getInitialExpanded() {
    const expanded = new Set();
    for (const group of NAV_GROUPS) {
      if (!group.children) continue;
      const childPaths = group.children.map(c => c.to);
      if (childPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))) {
        expanded.add(group.id);
      }
      if (group.to && (location.pathname === group.to || location.pathname.startsWith(group.to + '/'))) {
        expanded.add(group.id);
      }
    }
    return expanded;
  }

  const [expandedGroups, setExpandedGroups] = useState(getInitialExpanded);

  useEffect(() => {
    for (const group of NAV_GROUPS) {
      if (!group.children) continue;
      const childPaths = group.children.map(c => c.to);
      if (childPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))) {
        setExpandedGroups(prev => new Set([...prev, group.id]));
      }
    }
    // Close flyout on navigation
    setFlyout(null);
  }, [location.pathname]);

  useEffect(() => {
    api.auth.me().then(me => setCurrentUserEmail(me.email)).catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => {
      api.presence.list().then(d => setOnline(d.online || [])).catch(() => setOnline([]));
      api.getUnreadCount().then(d => setUnreadCount(d.count || 0)).catch(() => {});
    };
    load();
    const interval = setInterval(load, 25000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.admin.getUsers()
      .then(users => setPendingCount(users.filter(u => !u.approved).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      Object.values(expandTimers.current).forEach(clearTimeout);
      Object.values(flyoutTimers.current).forEach(clearTimeout);
    };
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  function toggleGroup(id) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCollapse() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('bs_sidebar_collapsed', next ? '1' : '0'); } catch {}
      if (next) setFlyout(null);
      return next;
    });
  }

  // Expanded-mode: 1.5s hover auto-expand
  const handleExpandHoverEnter = useCallback((id, hasChildren) => {
    if (!hasChildren || collapsed) return;
    expandTimers.current[id] = setTimeout(() => {
      setExpandedGroups(prev => new Set([...prev, id]));
    }, 1500);
  }, [collapsed]);

  const handleExpandHoverLeave = useCallback((id) => {
    clearTimeout(expandTimers.current[id]);
  }, []);

  // Collapsed-mode: show flyout on hover
  const handleFlyoutEnter = useCallback((id, hasChildren) => {
    if (!collapsed || !hasChildren) return;
    clearTimeout(flyoutTimers.current['close']);
    flyoutTimers.current[id] = setTimeout(() => {
      const el = groupRowRefs.current[id];
      if (el) {
        const rect = el.getBoundingClientRect();
        setFlyout({ id, top: rect.top });
      }
    }, 200);
  }, [collapsed]);

  const handleFlyoutLeave = useCallback((id) => {
    if (!collapsed) return;
    clearTimeout(flyoutTimers.current[id]);
    // Small grace period so the mouse can move onto the flyout
    flyoutTimers.current['close'] = setTimeout(() => setFlyout(null), 150);
  }, [collapsed]);

  const handleFlyoutMouseEnter = useCallback(() => {
    clearTimeout(flyoutTimers.current['close']);
  }, []);

  const handleFlyoutMouseLeave = useCallback(() => {
    flyoutTimers.current['close'] = setTimeout(() => setFlyout(null), 150);
  }, []);

  const visibleGroups = NAV_GROUPS.filter(g => canSee(g, role));

  // Find flyout group data
  const flyoutGroupData = flyout ? NAV_GROUPS.find(g => g.id === flyout.id) : null;
  const flyoutChildren = flyoutGroupData
    ? (flyoutGroupData.children || []).filter(c => canSee(c, role))
    : [];

  return (
    <nav
      className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''} ${collapsed ? styles.collapsed : ''}`}
      aria-hidden={onMobileClose ? !mobileOpen : undefined}
    >
      {/* Logo */}
      <div className={styles.logo}>
        {onMobileClose && (
          <button type="button" className={styles.closeBtn} onClick={onMobileClose} aria-label="Close menu">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
        )}
        <span className={styles.logoIcon}><AngryFace /></span>
        <span className={`${styles.logoText} ${collapsed ? styles.logoTextHidden : ''}`}>BadShuffle</span>
      </div>

      {/* Nav groups */}
      <ul className={styles.nav}>
        {visibleGroups.map(group => {
          const visibleChildren = group.children ? group.children.filter(c => canSee(c, role)) : [];
          const hasChildren = visibleChildren.length > 0;
          const isExpanded = expandedGroups.has(group.id) && !collapsed;
          const isGroupActive = group.to
            ? (location.pathname === group.to || location.pathname.startsWith(group.to + '/'))
            : visibleChildren.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));

          const linkClass = [
            styles.link,
            styles.groupLink,
            collapsed && styles.linkCollapsed,
            isGroupActive && styles.active,
          ].filter(Boolean).join(' ');

          return (
            <li
              key={group.id}
              className={styles.groupItem}
              ref={el => { groupRowRefs.current[group.id] = el; }}
              onMouseEnter={() => {
                handleExpandHoverEnter(group.id, hasChildren);
                handleFlyoutEnter(group.id, hasChildren);
              }}
              onMouseLeave={() => {
                handleExpandHoverLeave(group.id);
                handleFlyoutLeave(group.id);
              }}
            >
              <div className={styles.groupRow}>
                {group.to ? (
                  <NavLink
                    to={group.to}
                    end
                    title={collapsed ? group.label : undefined}
                    className={({ isActive }) =>
                      [styles.link, styles.groupLink, collapsed && styles.linkCollapsed, isActive && styles.active].filter(Boolean).join(' ')
                    }
                    onClick={onMobileClose}
                  >
                    <span className={styles.icon}>{group.icon}</span>
                    <span className={styles.linkLabel}>{group.label}</span>
                    {group.id === 'messages' && unreadCount > 0 && <span className={styles.pendingBadge}>{unreadCount}</span>}
                    {group.id === 'settings' && pendingCount > 0 && <span className={styles.pendingBadge}>{pendingCount}</span>}
                  </NavLink>
                ) : (
                  /* Groups without a `to` (e.g. Messages): click navigates to first child when collapsed, toggles when expanded */
                  <button
                    type="button"
                    title={collapsed ? group.label : undefined}
                    className={linkClass}
                    onClick={() => {
                      if (collapsed) {
                        const first = visibleChildren[0];
                        if (first) navigate(first.to);
                      } else {
                        toggleGroup(group.id);
                      }
                    }}
                  >
                    <span className={styles.icon}>{group.icon}</span>
                    <span className={styles.linkLabel}>{group.label}</span>
                    {group.id === 'messages' && unreadCount > 0 && <span className={styles.pendingBadge}>{unreadCount}</span>}
                  </button>
                )}

                {hasChildren && !collapsed && (
                  <button
                    type="button"
                    className={styles.chevronBtn}
                    onClick={() => toggleGroup(group.id)}
                    aria-label={isExpanded ? `Collapse ${group.label}` : `Expand ${group.label}`}
                    aria-expanded={isExpanded}
                  >
                    <Chevron open={isExpanded} />
                  </button>
                )}
              </div>

              {hasChildren && isExpanded && (
                <ul className={styles.subNav}>
                  {visibleChildren.map(child => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        className={({ isActive }) => `${styles.subLink} ${isActive ? styles.subActive : ''}`}
                        onClick={onMobileClose}
                      >
                        {child.icon && <span className={styles.subIcon}>{child.icon}</span>}
                        {child.label}
                        {child.to === '/admin' && pendingCount > 0 && <span className={styles.pendingBadge}>{pendingCount}</span>}
                        {child.to === '/messages' && unreadCount > 0 && <span className={styles.pendingBadge}>{unreadCount}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Flyout popup for collapsed mode */}
      {collapsed && flyout && flyoutGroupData && flyoutChildren.length > 0 && (
        <div
          className={styles.flyout}
          style={{ top: flyout.top }}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
        >
          <div className={styles.flyoutTitle}>{flyoutGroupData.label}</div>
          {flyoutChildren.map(child => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => `${styles.flyoutLink} ${isActive ? styles.flyoutActive : ''}`}
              onClick={() => setFlyout(null)}
            >
              {child.icon && <span className={styles.subIcon}>{child.icon}</span>}
              {child.label}
              {child.to === '/admin' && pendingCount > 0 && <span className={styles.pendingBadge}>{pendingCount}</span>}
              {child.to === '/messages' && unreadCount > 0 && <span className={styles.pendingBadge}>{unreadCount}</span>}
            </NavLink>
          ))}
        </div>
      )}

      {/* Team presence */}
      <div className={`${styles.teamSection} ${collapsed ? styles.hidden : ''}`}>
        <div className={styles.teamTitle}>Team</div>
        <ul className={styles.teamList}>
          {online.length === 0 && <li className={styles.teamEmpty}>No one else online</li>}
          {online.map(u => (
            <li key={u.userId} className={styles.teamItem}>
              <span className={styles.teamUser}>
                {u.email}
                {currentUserEmail && u.email === currentUserEmail && <span className={styles.teamYou}> (you)</span>}
              </span>
              <span className={styles.teamPage}>{pathToLabel(u.path)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.collapseBtn} ${collapsed ? styles.collapseBtnCollapsed : ''}`}
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon collapsed={collapsed} />
          <span className={`${styles.collapseBtnLabel} ${collapsed ? styles.collapseBtnLabelHidden : ''}`}>Collapse</span>
        </button>
        {!collapsed && (
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        )}
      </div>
    </nav>
  );
}
