import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { clearToken } from '../api';
import styles from './Layout.module.css';

export default function Layout({ role = '' }) {
  const navigate = useNavigate();

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
