import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import QuotePage from './pages/QuotePage.jsx';
import QuoteDetailPage from './pages/QuoteDetailPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import ExtensionPage from './pages/ExtensionPage.jsx';
import ItemDetailPage from './pages/ItemDetailPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LeadsPage from './pages/LeadsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import ForgotPage from './pages/ForgotPage.jsx';
import ResetPage from './pages/ResetPage.jsx';
import PublicQuotePage from './pages/PublicQuotePage.jsx';
import PublicCatalogPage from './pages/PublicCatalogPage.jsx';
import PublicItemPage from './pages/PublicItemPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FilesPage from './pages/FilesPage.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import BillingPage from './pages/BillingPage.jsx';
import VendorsPage from './pages/VendorsPage.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { api, getToken, setToken, clearToken } from './api';

function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function AuthGate({ children, setRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState('loading'); // 'loading' | 'authed' | 'unauthed'
  const hasRedirectedToLogin = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const doAuth = async () => {
      // Dev mode: auto-login with hardcoded admin account, no setup/login required
      if (import.meta.env.DEV && !getToken()) {
        try {
          const data = await api.auth.devLogin();
          if (data.token) setToken(data.token);
        } catch (e) {
          // server not ready yet or non-dev build; fall through to normal flow
        }
      }

      let setup = true;
      try {
        ({ setup } = await api.auth.status());
      } catch {
        if (!cancelled) setState('unauthed');
        return;
      }
      if (cancelled) return;

      if (!setup) {
        navigate('/setup', { replace: true });
        setState('unauthed');
        return;
      }

      const token = getToken();
      if (!token) {
        setState('unauthed');
        return;
      }

      try {
        const me = await api.auth.me();
        if (cancelled) return;
        setRole(me.role);
        setState('authed');
      } catch {
        if (cancelled) return;
        clearToken();
        setRole('');
        // If already at /login, try dev auto-login immediately (stale token case after DB clear)
        if (import.meta.env.DEV && location.pathname === '/login') {
          try {
            const data = await api.auth.devLogin();
            if (!cancelled && data.token) {
              setToken(data.token);
              const me = await api.auth.me();
              if (!cancelled) { setRole(me.role); setState('authed'); }
            }
          } catch { /* fall through to show login page */ }
          if (!cancelled) setState('unauthed');
          return;
        }
        setState('unauthed');
        if (location.pathname !== '/login' && !hasRedirectedToLogin.current) {
          hasRedirectedToLogin.current = true;
          navigate('/login', { replace: true });
        }
      }
    };

    doAuth();
    return () => { cancelled = true; };
  }, [navigate, setRole, location.pathname]);

  // When pathname changes to /login (e.g. after logout), allow redirect again in future
  useEffect(() => {
    if (location.pathname === '/login') hasRedirectedToLogin.current = false;
  }, [location.pathname]);

  if (state === 'loading') return null;
  return children;
}

export default function App() {
  const [role, setRole] = useState('');

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes — no auth required */}
          <Route path="/quote/public/:token" element={<PublicQuotePage />} />
          <Route path="/catalog" element={<PublicCatalogPage />} />
          <Route path="/catalog/item/:id" element={<PublicItemPage />} />

          {/* App routes (auth required except login/setup) */}
          <Route path="*" element={
            <AuthGate setRole={setRole}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/forgot" element={<ForgotPage />} />
                <Route path="/reset" element={<ResetPage />} />

                <Route path="/" element={<ProtectedRoute><Layout role={role} /></ProtectedRoute>}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="inventory" element={<InventoryPage />} />
                  <Route path="inventory/:id" element={<ItemDetailPage />} />
                  <Route path="import" element={<ImportPage />} />
                  <Route path="quotes" element={<QuotePage />} />
                  <Route path="quotes/:id" element={<QuoteDetailPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="stats" element={<StatsPage />} />
                  <Route path="extension" element={<ExtensionPage />} />
                  <Route path="leads" element={<LeadsPage />} />
                  <Route path="files" element={<FilesPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="templates" element={<TemplatesPage />} />
                  <Route path="vendors" element={<VendorsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </AuthGate>
          } />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
