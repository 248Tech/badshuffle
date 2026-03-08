import React, { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { clearToken, api } from '../api';
import styles from './Layout.module.css';

export default function Layout({ role = '' }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.presence.update(location.pathname).catch(() => {});
  }, [location.pathname]);

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.layout}>
      <Sidebar role={role} />
      <div className={styles.mainWrap}>
        <header className={styles.topBar}>
          <div className={styles.userMenu}>
            <Link to="/extension" className={styles.menuItem}>Help</Link>
            {(role === 'admin' || role === 'operator') && (
              <Link to="/settings" className={styles.menuItem}>Settings</Link>
            )}
            <button type="button" className={styles.menuItem} onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
