import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { clearToken, api } from '../api';

function pathToLabel(path) {
  if (!path || path === '/') return 'Dashboard';
  const p = path.replace(/^\//, '');
  if (p === 'dashboard') return 'Dashboard';
  if (p === 'inventory') return 'Inventory';
  if (p.startsWith('inventory/')) return `Item`;
  if (p === 'quotes') return 'Quotes';
  if (p.startsWith('quotes/')) return 'Quote';
  if (p === 'billing') return 'Billing';
  if (p === 'leads') return 'Leads';
  if (p === 'files') return 'Files';
  if (p === 'messages') return 'Messages';
  if (p === 'stats') return 'Stats';
  if (p === 'extension') return 'Extension';
  if (p === 'admin') return 'Admin';
  if (p === 'templates') return 'Templates';
  if (p === 'settings') return 'Settings';
  return p;
}

const ICONS = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1"/>
      <rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/>
      <rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  ),
  inventory: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 5.5l-5.5-4-5.5 4v7a1 1 0 001 1h9a1 1 0 001-1v-7z"/>
      <path d="M5.5 14v-5.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5V14"/>
    </svg>
  ),
  import: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v9M4.5 7l3.5 3.5L11.5 7"/>
      <path d="M2 12h12"/>
    </svg>
  ),
  quotes: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="12" height="14" rx="1"/>
      <path d="M5 5h6M5 8h6M5 11h3"/>
    </svg>
  ),
  billing: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="10" rx="1.5"/>
      <path d="M1 7h14"/>
      <path d="M4 11h2M9 11h3"/>
    </svg>
  ),
  leads: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3"/>
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"/>
    </svg>
  ),
  files: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5A1.5 1.5 0 013.5 2H7l2 2h3.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z"/>
    </svg>
  ),
  messages: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9.5a5 5 0 01-5 5H3l-1.5 1.5v-7A5 5 0 017 4h2a5 5 0 015 5v.5z"/>
    </svg>
  ),
  stats: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13l3.5-5 3 3 2.5-4 3 4"/>
      <path d="M2 13h12"/>
    </svg>
  ),
  extension: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5" height="5" rx="1"/>
      <rect x="9" y="2" width="5" height="5" rx="1"/>
      <rect x="2" y="9" width="5" height="5" rx="1"/>
      <path d="M9 11.5h5M11.5 9v5"/>
    </svg>
  ),
  vendors: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4h14l-1.5 7H2.5L1 4z"/>
      <path d="M1 4L2 1h12l1 3"/>
      <circle cx="5" cy="14" r="1"/>
      <circle cx="11" cy="14" r="1"/>
    </svg>
  ),
  admin: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="5" r="2.5"/>
      <path d="M1 13c0-2.485 2.015-4 4.5-4"/>
      <circle cx="11" cy="5" r="2"/>
      <path d="M9 13c0-2.2 1.343-3.5 3.5-3.5A3.5 3.5 0 0115 13"/>
    </svg>
  ),
  templates: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="13" height="10" rx="1"/>
      <path d="M1.5 7l5 3 5-3"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
    </svg>
  ),
};

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  { to: '/inventory', label: 'Inventory', icon: ICONS.inventory },
  { to: '/import',    label: 'Import',    icon: ICONS.import },
  { to: '/quotes',    label: 'Quotes',    icon: ICONS.quotes },
  { to: '/billing',   label: 'Billing',   icon: ICONS.billing,   role: 'operator' },
  { to: '/leads',     label: 'Leads',     icon: ICONS.leads },
  { to: '/files',     label: 'Files',     icon: ICONS.files },
  { to: '/messages',  label: 'Messages',  icon: ICONS.messages },
  { to: '/stats',     label: 'Stats',     icon: ICONS.stats },
  { to: '/extension', label: 'Extension', icon: ICONS.extension },
  { to: '/vendors',   label: 'Vendors',   icon: ICONS.vendors,   role: 'operator' },
  { to: '/admin',     label: 'Admin',     icon: ICONS.admin,     role: 'admin' },
  { to: '/templates', label: 'Templates', icon: ICONS.templates, role: 'operator' },
  { to: '/settings',  label: 'Settings',  icon: ICONS.settings,  role: 'operator' },
];

export default function Sidebar({ role = '', mobileOpen = false, onMobileClose }) {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [online, setOnline] = useState([]);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

  useEffect(() => {
    api.auth.me().then(me => setCurrentUserEmail(me.email)).catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => {
      api.presence.list()
        .then(d => setOnline(d.online || []))
        .catch(() => setOnline([]));
    };
    load();
    const interval = setInterval(load, 25000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.admin.getUsers()
      .then(users => setPendingCount(users.filter(u => !u.approved).length))
      .catch(() => {}); // 403 for non-admins — silent
    api.getUnreadCount()
      .then(d => setUnreadCount(d.count || 0))
      .catch(() => {});
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  const navItems = NAV.filter(item => {
    if (item.role === 'admin') return role === 'admin';
    if (item.role === 'operator') return role === 'admin' || role === 'operator';
    return true;
  });

  return (
    <nav className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''}`} aria-hidden={onMobileClose ? !mobileOpen : undefined}>
      <div className={styles.logo}>
        {onMobileClose && (
          <button type="button" className={styles.closeBtn} onClick={onMobileClose} aria-label="Close menu">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
        )}
        <span className={styles.logoIcon}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h10M3 11h16M9 15h10"/>
          </svg>
        </span>
        <span className={styles.logoText}>BadShuffle</span>
      </div>
      <ul className={styles.nav}>
        {navItems.map(item => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
              onClick={onMobileClose}
            >
              <span className={styles.icon}>{item.icon}</span>
              {item.label}
              {(item.to === '/admin' && pendingCount > 0) && (
                <span className={styles.pendingBadge}>{pendingCount}</span>
              )}
              {(item.to === '/messages' && unreadCount > 0) && (
                <span className={styles.pendingBadge}>{unreadCount}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className={styles.teamSection}>
        <div className={styles.teamTitle}>Team</div>
        <ul className={styles.teamList}>
          {online.length === 0 && (
            <li className={styles.teamEmpty}>No one else online</li>
          )}
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
      <div className={styles.footer}>
        <span className={styles.footerText}>Goodshuffle Assistant</span>
        <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  );
}
