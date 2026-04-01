import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { clearToken, api } from '../api';
import s from './Layout.module.css';
import { prefetchRoute } from '../lib/routePrefetch.js';
import { hasPermission } from '../lib/permissions.js';

const BOT_NAV = [
  {
    to: '/dashboard', label: 'Home', module: 'dashboard',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4a1 1 0 001-1v-3h2v3a1 1 0 001 1h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
  },
  {
    to: '/quotes', label: 'Projects', module: 'projects',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
  },
  {
    to: '/inventory', label: 'Inventory', module: 'inventory',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
  },
  {
    to: '/messages', label: 'Messages', module: 'messages',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/></svg>,
  },
];

export default function Layout({ authUser = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = authUser?.role || '';
  const permissions = authUser?.permissions || {};
  const mobileNav = BOT_NAV.filter((item) => hasPermission(permissions, item.module, 'read'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const mainRef = useRef(null);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    api.presence.update(location.pathname).catch(() => {});
    const id = setInterval(() => {
      api.presence.update(location.pathname).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [location.pathname]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      const scrollFraction = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      const isScrollingDown = scrollTop > lastScrollRef.current + 4; // 4px threshold
      const isScrollingUp = scrollTop < lastScrollRef.current - 4;
      if (isScrollingDown && scrollFraction > 0.08) {
        setNavVisible(false);
      } else if (isScrollingUp || scrollFraction < 0.08) {
        setNavVisible(true);
      }
      lastScrollRef.current = scrollTop;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ height: '100dvh' }}>
      <Sidebar authUser={authUser} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Top bar — tablet only (640–768px). Desktop uses sidebar; mobile uses bottom nav. */}
        <header
          className="md:hidden shrink-0 flex items-center gap-2 bg-bg border-b border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] min-h-[44px] px-3"
          style={{
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))',
          }}
        >
          {/* Hamburger — tablet only, hidden on mobile (640px-) which uses bottom nav */}
          <button
            type="button"
            className="hidden sm:flex md:hidden items-center justify-center w-11 h-11 rounded bg-transparent border-none text-text-base hover:bg-border cursor-pointer text-xl transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span aria-hidden="true" className="leading-none">☰</span>
          </button>

          <div className="flex-1" />

          <nav className="flex items-center gap-1">
            <Link
              to="/extension"
              className="text-sm text-text-muted hover:text-primary hover:bg-border inline-flex items-center px-3 min-h-[44px] rounded transition-colors no-underline"
              onMouseEnter={() => prefetchRoute('/extension')}
              onFocus={() => prefetchRoute('/extension')}
            >Help</Link>
            {hasPermission(permissions, 'settings', 'read') && (
              <Link
                to="/settings"
                className="text-sm text-text-muted hover:text-primary hover:bg-border inline-flex items-center px-3 min-h-[44px] rounded transition-colors no-underline"
                onMouseEnter={() => prefetchRoute('/settings')}
                onFocus={() => prefetchRoute('/settings')}
              >Settings</Link>
            )}
            <button
              type="button"
              className="text-sm text-text-muted hover:text-primary hover:bg-border inline-flex items-center px-3 min-h-[44px] rounded bg-transparent border-none cursor-pointer transition-colors"
              onClick={handleLogout}
            >Logout</button>
          </nav>
        </header>

        {/* Page content */}
        <main ref={mainRef} className={`flex-1 overflow-y-auto overflow-x-hidden bg-surface p-5 xl:p-8 ${s.main}`}>
          <div className="w-full">
            <Outlet context={{ authUser, role, permissions }} />
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[998] md:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={e => e.key === 'Escape' && setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Bottom tab bar — mobile only (<= 640px) */}
      <nav
        className={`flex sm:hidden fixed bottom-0 left-0 right-0 z-[900] bg-bg border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.08)] transition-transform duration-300 ${navVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main navigation"
      >
        {mobileNav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-[3px] py-2 min-h-[56px] bg-transparent border-none cursor-pointer no-underline text-[10px] font-medium tracking-[0.02em] transition-colors [-webkit-tap-highlight-color:transparent] ${
                isActive ? 'text-primary' : 'text-text-muted hover:text-primary'
              }`
            }
            onMouseEnter={() => prefetchRoute(to)}
            onFocus={() => prefetchRoute(to)}
          >
            <span className="flex items-center justify-center w-6 h-6" aria-hidden="true">{icon}</span>
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2 min-h-[56px] bg-transparent border-none cursor-pointer text-[10px] font-medium tracking-[0.02em] text-text-muted hover:text-primary transition-colors"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open full menu"
        >
          <span className="flex items-center justify-center w-6 h-6" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
          </span>
          <span className="leading-none">More</span>
        </button>
      </nav>
    </div>
  );
}
