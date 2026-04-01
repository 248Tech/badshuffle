import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import s from './Sidebar.module.css';
import { clearToken, api } from '../api';
import { prefetchRoute } from '../lib/routePrefetch.js';
import { hasPermission } from '../lib/permissions.js';

function pathToLabel(path) {
  if (!path || path === '/') return 'Dashboard';
  const p = path.replace(/^\//, '');
  const map = {
    dashboard: 'Dashboard', inventory: 'Inventory', quotes: 'Projects',
    maps: 'Maps', team: 'Team', profile: 'Profile',
    billing: 'Billing', leads: 'Leads', files: 'Files', messages: 'Messages',
    stats: 'Stats', extension: 'Extension', admin: 'Admin', templates: 'Templates',
    settings: 'Settings', directory: 'Directory', vendors: 'Vendors',
    'inventory-settings': 'Inventory Settings', 'message-settings': 'Message Settings',
  };
  if (map[p]) return map[p];
  if (p.startsWith('inventory/')) return 'Item';
  if (p.startsWith('quotes/')) return 'Project';
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
  dashboard: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>,
  maps: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 14s4-3.2 4-7A4 4 0 1 0 4 7c0 3.8 4 7 4 7z"/><circle cx="8" cy="7" r="1.5"/></svg>,
  inventory: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 5.5l-5.5-4-5.5 4v7a1 1 0 001 1h9a1 1 0 001-1v-7z"/><path d="M5.5 14v-5.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5V14"/></svg>,
  import: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1v9M4.5 7l3.5 3.5L11.5 7"/><path d="M2 12h12"/></svg>,
  quotes: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="12" height="14" rx="1"/><path d="M5 5h6M5 8h6M5 11h3"/></svg>,
  billing: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 7h14"/><path d="M4 11h2M9 11h3"/></svg>,
  leads: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"/></svg>,
  files: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3.5A1.5 1.5 0 013.5 2H7l2 2h3.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z"/></svg>,
  messages: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9.5a5 5 0 01-5 5H3l-1.5 1.5v-7A5 5 0 017 4h2a5 5 0 015 5v.5z"/></svg>,
  stats: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13l3.5-5 3 3 2.5-4 3 4"/><path d="M2 13h12"/></svg>,
  extension: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><path d="M9 11.5h5M11.5 9v5"/></svg>,
  vendors: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4h14l-1.5 7H2.5L1 4z"/><path d="M1 4L2 1h12l1 3"/><circle cx="5" cy="14" r="1"/><circle cx="11" cy="14" r="1"/></svg>,
  admin: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="5" r="2.5"/><path d="M1 13c0-2.485 2.015-4 4.5-4"/><circle cx="11" cy="5" r="2"/><path d="M9 13c0-2.2 1.343-3.5 3.5-3.5A3.5 3.5 0 0115 13"/></svg>,
  templates: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="3" width="13" height="10" rx="1"/><path d="M1.5 7l5 3 5-3"/></svg>,
  settings: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>,
  profile: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.1 2.7-5 6-5s6 1.9 6 5"/></svg>,
  directory: <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3.5A1.5 1.5 0 013.5 2h4L9 3.5H12.5A1.5 1.5 0 0114 5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z"/><circle cx="8" cy="8" r="1.5"/><path d="M5.5 11c0-1.38 1.12-2 2.5-2s2.5.62 2.5 2"/></svg>,
};

const NAV_GROUPS = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, to: '/dashboard', module: 'dashboard', children: [{ to: '/stats', label: 'Stats', icon: ICONS.stats, module: 'dashboard' }] },
  { id: 'projects', label: 'Projects', icon: ICONS.quotes, to: '/quotes', module: 'projects' },
  { id: 'maps', label: 'Maps', icon: ICONS.maps, to: '/maps', module: 'maps' },
  { id: 'messages', label: 'Messages', icon: ICONS.messages, module: 'messages', children: [{ to: '/messages', label: 'Inbox', icon: ICONS.messages, module: 'messages' }, { to: '/templates', label: 'Templates', icon: ICONS.templates, module: 'messages', minimum: 'modify' }, { to: '/message-settings', label: 'Message Settings', icon: ICONS.settings, module: 'settings', minimum: 'modify' }] },
  { id: 'directory', label: 'Directory', icon: ICONS.directory, to: '/directory', module: 'directory', children: [{ to: '/team', label: 'Team', icon: ICONS.admin, module: 'directory' }, { to: '/leads', label: 'Leads', icon: ICONS.leads, module: 'directory' }, { to: '/vendors', label: 'Vendors', icon: ICONS.vendors, module: 'directory' }] },
  { id: 'inventory', label: 'Inventory', icon: ICONS.inventory, to: '/inventory', module: 'inventory', children: [{ to: '/inventory-settings', label: 'Inventory Settings', icon: ICONS.settings, module: 'inventory', minimum: 'modify' }] },
  { id: 'files', label: 'Files', icon: ICONS.files, to: '/files', module: 'files' },
  { id: 'billing', label: 'Billing', icon: ICONS.billing, to: '/billing', module: 'billing' },
  { id: 'settings', label: 'Settings', icon: ICONS.settings, to: '/settings', module: 'settings', children: [{ to: '/admin', label: 'Admin', icon: ICONS.admin, module: 'admin' }, { to: '/import', label: 'Import', icon: ICONS.import, module: 'settings', minimum: 'modify' }, { to: '/extension', label: 'Extension', icon: ICONS.extension, module: 'settings' }] },
];

function canSee(item, authUser) {
  if (!item.module) return true;
  return hasPermission(authUser?.permissions, item.module, item.minimum || 'read');
}

// Pill badge for unread/pending counts
function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto shrink-0 bg-danger text-white rounded-full text-[10px] font-bold px-[5px] py-px leading-none">
      {count}
    </span>
  );
}

export default function Sidebar({ authUser = null, mobileOpen = false, onMobileClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [online, setOnline] = useState([]);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('bs_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const [flyout, setFlyout] = useState(null);
  const groupRowRefs = useRef({});
  const flyoutTimers = useRef({});
  const expandTimers = useRef({});

  function getInitialExpanded() {
    const expanded = new Set();
    for (const group of NAV_GROUPS) {
      if (!group.children) continue;
      const childPaths = group.children.map(c => c.to);
      if (childPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))) expanded.add(group.id);
      if (group.to && (location.pathname === group.to || location.pathname.startsWith(group.to + '/'))) expanded.add(group.id);
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
    setFlyout(null);
  }, [location.pathname]);

  useEffect(() => { setCurrentUserEmail(authUser?.email || null); }, [authUser]);

  useEffect(() => {
    const load = () => {
      api.presence.list().then(d => setOnline(d.online || [])).catch(() => setOnline([]));
      if (hasPermission(authUser?.permissions, 'messages', 'read')) {
        api.getUnreadCount().then(d => setUnreadCount(d.count || 0)).catch(() => {});
      } else {
        setUnreadCount(0);
      }
    };
    load();
    const id = setInterval(load, 25000);
    return () => clearInterval(id);
  }, [authUser]);

  useEffect(() => {
    if (!hasPermission(authUser?.permissions, 'admin', 'read')) {
      setPendingCount(0);
      return;
    }
    api.admin.getUsers().then(users => setPendingCount(users.filter(u => !u.approved).length)).catch(() => {});
  }, [authUser]);

  useEffect(() => {
    return () => {
      Object.values(expandTimers.current).forEach(clearTimeout);
      Object.values(flyoutTimers.current).forEach(clearTimeout);
    };
  }, []);

  function handleLogout() { clearToken(); navigate('/login', { replace: true }); }

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

  const handleExpandHoverEnter = useCallback((id, hasChildren) => {
    if (!hasChildren || collapsed) return;
    expandTimers.current[id] = setTimeout(() => {
      setExpandedGroups(prev => new Set([...prev, id]));
    }, 1500);
  }, [collapsed]);

  const handleExpandHoverLeave = useCallback((id) => { clearTimeout(expandTimers.current[id]); }, []);

  const handleFlyoutEnter = useCallback((id, hasChildren) => {
    if (!collapsed || !hasChildren) return;
    clearTimeout(flyoutTimers.current['close']);
    flyoutTimers.current[id] = setTimeout(() => {
      const el = groupRowRefs.current[id];
      if (el) { const rect = el.getBoundingClientRect(); setFlyout({ id, top: rect.top }); }
    }, 200);
  }, [collapsed]);

  const handleFlyoutLeave = useCallback((id) => {
    if (!collapsed) return;
    clearTimeout(flyoutTimers.current[id]);
    flyoutTimers.current['close'] = setTimeout(() => setFlyout(null), 150);
  }, [collapsed]);

  const handleFlyoutMouseEnter = useCallback(() => { clearTimeout(flyoutTimers.current['close']); }, []);
  const handleFlyoutMouseLeave = useCallback(() => { flyoutTimers.current['close'] = setTimeout(() => setFlyout(null), 150); }, []);

  const visibleGroups = NAV_GROUPS.filter(g => canSee(g, authUser));
  const flyoutGroupData = flyout ? NAV_GROUPS.find(g => g.id === flyout.id) : null;
  const flyoutChildren = flyoutGroupData ? (flyoutGroupData.children || []).filter(c => canSee(c, authUser)) : [];

  // Shared link classes
  const linkBase = 'relative flex items-center gap-2.5 px-2.5 py-[9px] min-h-[40px] rounded-sm text-[13.5px] font-medium w-full text-left border-none bg-transparent cursor-pointer transition-colors duration-[130ms] whitespace-nowrap overflow-hidden';
  const linkIdle = 'text-white/[.68] hover:bg-sidebar-hover hover:text-white/95';
  const linkActive = 'bg-sidebar-hover text-white';

  const subLinkBase = 'relative flex items-center gap-2 px-2.5 py-[7px] rounded-sm text-[12.5px] font-medium w-full text-left border-none bg-transparent cursor-pointer transition-colors duration-[130ms] whitespace-nowrap';
  const subLinkIdle = 'text-white/[.56] hover:bg-sidebar-hover hover:text-white/90';
  const subLinkActive = 'text-white/95 bg-white/[.08]';

  return (
    <nav
      className={`
        ${s.sidebar} bg-sidebar flex flex-col h-screen overflow-hidden shrink-0
        max-md:fixed max-md:top-0 max-md:left-0 max-md:bottom-0 max-md:z-[999]
        max-md:transition-transform max-md:duration-200 max-md:ease-out
        ${mobileOpen ? 'max-md:translate-x-0 max-md:shadow-[4px_0_20px_rgba(0,0,0,0.2)]' : 'max-md:-translate-x-full'}
      `}
      style={{ width: collapsed ? '56px' : 'var(--sidebar-width)', minWidth: collapsed ? '56px' : 'var(--sidebar-width)' }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-[14px] border-b border-white/[.07] relative shrink-0 overflow-hidden max-md:pl-[52px]">
        {onMobileClose && (
          <button
            type="button"
            className="hidden max-md:flex absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center bg-white/10 hover:bg-white/[.18] border-none rounded-sm text-white/90 cursor-pointer transition-colors"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        )}
        <span className="flex items-center justify-center shrink-0 w-7 h-7" aria-hidden="true"><AngryFace /></span>
        <span className={`${s.logoText} ${collapsed ? s.logoTextHidden : ''} text-[17px] font-bold text-white tracking-tight`}>
          BadShuffle
        </span>
      </div>

      {/* Nav */}
      <ul className="list-none flex-1 px-1.5 py-2.5 flex flex-col gap-px overflow-y-auto overflow-x-hidden">
        {visibleGroups.map(group => {
          const visibleChildren = group.children ? group.children.filter(c => canSee(c, authUser)) : [];
          const hasChildren = visibleChildren.length > 0;
          const isExpanded = expandedGroups.has(group.id) && !collapsed;
          const isGroupActive = group.to
            ? (location.pathname === group.to || location.pathname.startsWith(group.to + '/'))
            : visibleChildren.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'));

          // Icon + label inside a link — shared render
          const renderLinkContent = (active) => (
            <>
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-accent rounded-r-sm" aria-hidden="true" />}
              <span className={`flex items-center justify-center shrink-0 w-[19px] opacity-85 ${collapsed ? 'mx-auto' : ''}`} aria-hidden="true">
                {group.icon}
              </span>
              <span className={`${s.linkLabel} ${collapsed ? s.linkLabelHidden : ''} flex-1 overflow-hidden text-ellipsis`}>
                {group.label}
              </span>
              {!collapsed && group.id === 'messages' && <Badge count={unreadCount} />}
              {!collapsed && group.id === 'settings' && <Badge count={pendingCount} />}
            </>
          );

          return (
            <li
              key={group.id}
              className="flex flex-col"
              ref={el => { groupRowRefs.current[group.id] = el; }}
              onMouseEnter={() => { handleExpandHoverEnter(group.id, hasChildren); handleFlyoutEnter(group.id, hasChildren); }}
              onMouseLeave={() => { handleExpandHoverLeave(group.id); handleFlyoutLeave(group.id); }}
            >
              <div className="flex items-stretch rounded-sm overflow-hidden">
                {group.to ? (
                  <NavLink
                    to={group.to}
                    end
                    title={collapsed ? group.label : undefined}
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? linkActive : linkIdle} flex-1 min-w-0 ${hasChildren ? 'rounded-r-none' : ''}`
                    }
                    onClick={onMobileClose}
                    onMouseEnter={() => prefetchRoute(group.to)}
                    onFocus={() => prefetchRoute(group.to)}
                  >
                    {({ isActive }) => renderLinkContent(isActive)}
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    title={collapsed ? group.label : undefined}
                    className={`${linkBase} ${isGroupActive ? linkActive : linkIdle} flex-1 min-w-0 ${hasChildren && !collapsed ? 'rounded-r-none' : ''}`}
                    onClick={() => {
                      if (collapsed) { const first = visibleChildren[0]; if (first) navigate(first.to); }
                      else toggleGroup(group.id);
                    }}
                  >
                    {renderLinkContent(isGroupActive)}
                  </button>
                )}

                {hasChildren && !collapsed && (
                  <button
                    type="button"
                    className="shrink-0 w-[26px] bg-transparent border-none text-white/40 hover:text-white/85 hover:bg-sidebar-hover cursor-pointer flex items-center justify-center p-0 transition-colors duration-[130ms] rounded-r-sm"
                    onClick={() => toggleGroup(group.id)}
                    aria-label={isExpanded ? `Collapse ${group.label}` : `Expand ${group.label}`}
                    aria-expanded={isExpanded}
                  >
                    <svg
                      className={`${s.chevron} ${isExpanded ? s.chevronOpen : ''} block`}
                      width="11" height="11" viewBox="0 0 12 12"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M3 4.5l3 3 3-3"/>
                    </svg>
                  </button>
                )}
              </div>

              {hasChildren && isExpanded && (
                <ul className="list-none pl-2.5 pt-0.5 pb-[3px] flex flex-col gap-px">
                  {visibleChildren.map(child => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        className={({ isActive }) => `${subLinkBase} ${isActive ? subLinkActive : subLinkIdle}`}
                        onClick={onMobileClose}
                        onMouseEnter={() => prefetchRoute(child.to)}
                        onFocus={() => prefetchRoute(child.to)}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-r-sm" aria-hidden="true" />}
                            {child.icon && <span className="flex items-center justify-center w-3.5 shrink-0 opacity-65" aria-hidden="true">{child.icon}</span>}
                            {child.label}
                            {child.to === '/admin' && <Badge count={pendingCount} />}
                            {child.to === '/messages' && <Badge count={unreadCount} />}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Flyout popup (collapsed mode) */}
      {collapsed && flyout && flyoutGroupData && flyoutChildren.length > 0 && (
        <div
          className="fixed left-14 z-[1001] bg-sidebar rounded-r-sm py-1.5 min-w-[176px] shadow-[6px_4px_20px_rgba(0,0,0,0.35)] border border-white/10 border-l-0"
          style={{ top: flyout.top }}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
        >
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.06em] px-3.5 pt-1 pb-1.5">
            {flyoutGroupData.label}
          </div>
          {flyoutChildren.map(child => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium transition-colors duration-100 whitespace-nowrap no-underline ${
                  isActive ? 'text-white bg-white/10' : 'text-white/72 hover:bg-sidebar-hover hover:text-white'
                }`
              }
              onClick={() => setFlyout(null)}
              onMouseEnter={() => prefetchRoute(child.to)}
              onFocus={() => prefetchRoute(child.to)}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-r-sm" aria-hidden="true" />}
                  {child.icon && <span className="flex items-center w-3.5 shrink-0 opacity-65" aria-hidden="true">{child.icon}</span>}
                  {child.label}
                  {child.to === '/admin' && <Badge count={pendingCount} />}
                  {child.to === '/messages' && <Badge count={unreadCount} />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}

      {/* Team presence */}
      {!collapsed && (
        <div className="px-3.5 py-3 border-t border-white/[.07] shrink-0">
          <div className="text-[10px] text-white uppercase tracking-[.06em] mb-1.5 font-semibold">Team</div>
          <ul className="list-none flex flex-col gap-[5px]">
            {online.length === 0 && <li className="text-[12px] text-white/45 italic">No one else online</li>}
            {online.map(u => (
              <li key={u.userId} className="flex flex-col gap-px text-[12px] text-white">
                <span className="font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                  {u.full_name || u.email}
                  {currentUserEmail && u.email === currentUserEmail && <span className="opacity-80 font-normal"> (you)</span>}
                </span>
                <span className="text-[11px] text-white/70">{u.label || pathToLabel(u.path)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="px-2 py-2.5 border-t border-white/[.07] flex flex-col gap-1.5 shrink-0">
        <NavLink
          to="/profile"
          title={collapsed ? 'Profile' : undefined}
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkActive : linkIdle} text-left ${collapsed ? 'justify-center px-[7px]' : ''}`
          }
          onMouseEnter={() => prefetchRoute('/profile')}
          onFocus={() => prefetchRoute('/profile')}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-accent rounded-r-sm" aria-hidden="true" />}
              <span className={`flex items-center justify-center shrink-0 w-[19px] opacity-85 ${collapsed ? 'mx-auto' : ''}`} aria-hidden="true">
                {ICONS.profile}
              </span>
              <span className={`${s.linkLabel} ${collapsed ? s.linkLabelHidden : ''} flex-1 overflow-hidden text-ellipsis`}>Profile</span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          className={`flex items-center gap-2 px-2.5 py-[7px] border-none bg-transparent text-white/45 hover:bg-sidebar-hover hover:text-white/85 rounded-sm cursor-pointer text-[12px] font-medium transition-colors duration-[130ms] w-full whitespace-nowrap overflow-hidden ${collapsed ? 'justify-center px-[7px]' : 'text-left'}`}
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2l5 5-5 5"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L4 7l5 5"/></svg>
          )}
          <span className={`${s.logoText} ${collapsed ? s.logoTextHidden : ''}`}>Collapse</span>
        </button>
        {!collapsed && (
          <button
            type="button"
            className="bg-transparent border border-white/15 hover:bg-white/[.09] hover:border-white/25 rounded-sm text-white/60 hover:text-white/88 text-[12px] px-2.5 py-1.5 cursor-pointer text-left transition-colors duration-[130ms] whitespace-nowrap w-full"
            onClick={handleLogout}
          >Sign out</button>
        )}
      </div>
    </nav>
  );
}
