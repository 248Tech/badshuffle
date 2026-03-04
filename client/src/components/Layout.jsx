import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import styles from './Layout.module.css';

export default function Layout({ role = '' }) {
  return (
    <div className={styles.layout}>
      <Sidebar role={role} />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
