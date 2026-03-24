import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { clearToken, api } from '../api';
import styles from './Layout.module.css';

export default function Layout({ role = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.presence.update(location.pathname).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.layout}>
      <Sidebar role={role} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className={styles.mainWrap}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.menuToggle}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span className={styles.menuToggleIcon} aria-hidden>☰</span>
          </button>
          <div className={styles.userMenu}>
            <Link to="/extension" className={styles.menuItem}>Help</Link>
            {(role === 'admin' || role === 'operator') && (
              <Link to="/settings" className={styles.menuItem}>Settings</Link>
            )}
            <button type="button" className={styles.menuItem} onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.mainInner}>
            <Outlet />
          </div>
        </main>
      </div>
      {sidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={() => setSidebarOpen(false)}
          onKeyDown={e => e.key === 'Escape' && setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}
    </div>
  );
}
