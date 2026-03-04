import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { clearToken, api } from '../api';

const NAV = [
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/import',    label: 'Import',    icon: '⬇️' },
  { to: '/quotes',    label: 'Quotes',    icon: '📋' },
  { to: '/leads',     label: 'Leads',     icon: '👤' },
  { to: '/stats',     label: 'Stats',     icon: '📊' },
  { to: '/extension', label: 'Extension', icon: '🧩' },
  { to: '/admin',     label: 'Admin',     icon: '👥' },
  { to: '/settings',  label: 'Settings',  icon: '⚙️' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    api.admin.getUsers()
      .then(users => setPendingCount(users.filter(u => !u.approved).length))
      .catch(() => {}); // 403 for non-admins — silent
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🔀</span>
        <span className={styles.logoText}>BadShuffle</span>
      </div>
      <ul className={styles.nav}>
        {NAV.map(item => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.icon}>{item.icon}</span>
              {item.label}
              {item.to === '/admin' && pendingCount > 0 && (
                <span className={styles.pendingBadge}>{pendingCount}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <span className={styles.footerText}>Goodshuffle Assistant</span>
        <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  );
}
