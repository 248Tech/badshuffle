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

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/import',    label: 'Import',    icon: '⬇️' },
  { to: '/quotes',    label: 'Quotes',    icon: '📋' },
  { to: '/billing',   label: 'Billing',   icon: '💰', role: 'operator' },
  { to: '/leads',     label: 'Leads',     icon: '👤' },
  { to: '/files',     label: 'Files',     icon: '🗂️' },
  { to: '/messages',  label: 'Messages',  icon: '💬' },
  { to: '/stats',     label: 'Stats',     icon: '📊' },
  { to: '/extension', label: 'Extension', icon: '🧩' },
  { to: '/vendors',   label: 'Vendors',   icon: '🏭', role: 'operator' },
  { to: '/admin',     label: 'Admin',     icon: '👥', role: 'admin' },
  { to: '/templates', label: 'Templates',  icon: '✉️', role: 'operator' },
  { to: '/settings',  label: 'Settings',  icon: '⚙️', role: 'operator' },
];

export default function Sidebar({ role = '' }) {
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
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🔀</span>
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
