import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { clearToken } from '../api';

const NAV = [
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/import',    label: 'Import',    icon: '⬇️' },
  { to: '/quotes',    label: 'Quotes',    icon: '📋' },
  { to: '/stats',     label: 'Stats',     icon: '📊' },
  { to: '/extension', label: 'Extension', icon: '🧩' },
];

export default function Sidebar() {
  const navigate = useNavigate();

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
