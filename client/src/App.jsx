import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { api, getToken, setToken, clearToken } from './api';
import { warmCoreRoutes } from './lib/routePrefetch.js';

// ── Auth-path pages — eager (shown before JS bundle is fully parsed) ──────────
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import ForgotPage from './pages/ForgotPage.jsx';
import ResetPage from './pages/ResetPage.jsx';

// ── App pages — lazy (only parsed when first navigated to) ────────────────────
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const InventoryPage = lazy(() => import('./pages/InventoryPage.jsx'));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage.jsx'));
const ImportPage = lazy(() => import('./pages/ImportPage.jsx'));
const QuotePage = lazy(() => import('./pages/QuotePage.jsx'));
const QuoteDetailPage = lazy(() => import('./pages/QuoteDetailPage.jsx'));
const BillingPage = lazy(() => import('./pages/BillingPage.jsx'));
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const ExtensionPage = lazy(() => import('./pages/ExtensionPage.jsx'));
const LeadsPage = lazy(() => import('./pages/LeadsPage.jsx'));
const FilesPage = lazy(() => import('./pages/FilesPage.jsx'));
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage.jsx'));
const VendorsPage = lazy(() => import('./pages/VendorsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage.jsx'));
const InventorySettingsPage = lazy(() => import('./pages/InventorySettingsPage.jsx'));
const MessageSettingsPage = lazy(() => import('./pages/MessageSettingsPage.jsx'));
// Public pages — lazy (most users never visit these from inside the app)
const PublicQuotePage = lazy(() => import('./pages/PublicQuotePage.jsx'));
const PublicCatalogPage = lazy(() => import('./pages/PublicCatalogPage.jsx'));
const PublicItemPage = lazy(() => import('./pages/PublicItemPage.jsx'));

function PageSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div className="spinner" />
    </div>
  );
}

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
      if (import.meta.env.DEV && !getToken()) {
        try {
          const data = await api.auth.devLogin();
          if (data.token) setToken(data.token);
        } catch (e) {}
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
        if (import.meta.env.DEV && location.pathname === '/login') {
          try {
            const data = await api.auth.devLogin();
            if (!cancelled && data.token) {
              setToken(data.token);
              const me = await api.auth.me();
              if (!cancelled) {
                setRole(me.role);
                setState('authed');
              }
            }
          } catch {}
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
    return () => {
      cancelled = true;
    };
  }, [navigate, setRole, location.pathname]);

  useEffect(() => {
    if (location.pathname === '/login') hasRedirectedToLogin.current = false;
  }, [location.pathname]);

  useEffect(() => {
    if (state !== 'authed') return undefined;
    return warmCoreRoutes(location.pathname);
  }, [state, location.pathname]);

  if (state === 'loading') return null;
  return children;
}

export default function App() {
  const [role, setRole] = useState('');

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Public routes */}
            <Route path="/quote/public/:token" element={<PublicQuotePage />} />
            <Route path="/catalog" element={<PublicCatalogPage />} />
            <Route path="/catalog/item/:id" element={<PublicItemPage />} />

            {/* App routes */}
            <Route
              path="*"
              element={
                <AuthGate setRole={setRole}>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/setup" element={<SetupPage />} />
                    <Route path="/forgot" element={<ForgotPage />} />
                    <Route path="/reset" element={<ResetPage />} />

                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Layout role={role} />
                        </ProtectedRoute>
                      }
                    >
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
                      <Route path="directory" element={<DirectoryPage />} />
                      <Route path="inventory-settings" element={<InventorySettingsPage />} />
                      <Route path="message-settings" element={<MessageSettingsPage />} />
                    </Route>
                  </Routes>
                </AuthGate>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
