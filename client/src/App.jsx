import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { api, getToken, setToken, clearToken } from './api';
import { warmCoreRoutes } from './lib/routePrefetch.js';
import { hasPermission } from './lib/permissions.js';

// ── Auth-path pages — eager (shown before JS bundle is fully parsed) ──────────
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import ForgotPage from './pages/ForgotPage.jsx';
import ResetPage from './pages/ResetPage.jsx';

// ── App pages — lazy (only parsed when first navigated to) ────────────────────
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const InventoryPage = lazy(() => import('./pages/InventoryPage.jsx'));
const MapsPage = lazy(() => import('./pages/MapsPage.jsx'));
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
const TeamPage = lazy(() => import('./pages/TeamPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
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

function AuthGate({ children, setAuthUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState('loading'); // 'loading' | 'authed' | 'unauthed'
  const hasRedirectedToLogin = useRef(false);
  const token = getToken();
  const isAuthRoute = location.pathname === '/login'
    || location.pathname === '/forgot'
    || location.pathname === '/reset'
    || location.pathname === '/setup';
  const authBootstrapKey = `${isAuthRoute ? location.pathname : 'app'}:${token ? 'token' : 'no-token'}`;

  useEffect(() => {
    let cancelled = false;

    if (isAuthRoute && !token && location.pathname !== '/setup') {
      setState('unauthed');
      return () => {
        cancelled = true;
      };
    }

    const doAuth = async () => {
      if (import.meta.env.DEV && !getToken() && !isAuthRoute) {
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
        setAuthUser(me);
        setState('authed');
      } catch {
        if (cancelled) return;
        clearToken();
        setAuthUser(null);
        if (import.meta.env.DEV && location.pathname === '/login') {
          try {
            const data = await api.auth.devLogin();
            if (!cancelled && data.token) {
              setToken(data.token);
              const me = await api.auth.me();
              if (!cancelled) {
                setAuthUser(me);
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
  }, [authBootstrapKey, isAuthRoute, location.pathname, navigate, setAuthUser, token]);

  useEffect(() => {
    if (location.pathname === '/login') hasRedirectedToLogin.current = false;
  }, [location.pathname]);

  useEffect(() => {
    if (state !== 'authed') return undefined;
    return warmCoreRoutes(location.pathname);
  }, [state, location.pathname]);

  if (state === 'loading') return <PageSpinner />;
  return children;
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);

  function PermissionRoute({ children, moduleKey, minimum = 'read' }) {
    if (!authUser || !moduleKey) return children;
    return hasPermission(authUser.permissions, moduleKey, minimum)
      ? children
      : <Navigate to="/dashboard" replace />;
  }

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
                <AuthGate setAuthUser={setAuthUser}>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/setup" element={<SetupPage />} />
                    <Route path="/forgot" element={<ForgotPage />} />
                    <Route path="/reset" element={<ResetPage />} />

                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Layout authUser={authUser} />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<PermissionRoute moduleKey="dashboard"><DashboardPage /></PermissionRoute>} />
                      <Route path="maps" element={<PermissionRoute moduleKey="maps"><MapsPage /></PermissionRoute>} />
                      <Route path="inventory" element={<PermissionRoute moduleKey="inventory"><InventoryPage /></PermissionRoute>} />
                      <Route path="inventory/:id" element={<PermissionRoute moduleKey="inventory"><ItemDetailPage /></PermissionRoute>} />
                      <Route path="import" element={<PermissionRoute moduleKey="settings" minimum="modify"><ImportPage /></PermissionRoute>} />
                      <Route path="quotes" element={<PermissionRoute moduleKey="projects"><QuotePage /></PermissionRoute>} />
                      <Route path="quotes/:id" element={<PermissionRoute moduleKey="projects"><QuoteDetailPage /></PermissionRoute>} />
                      <Route path="billing" element={<PermissionRoute moduleKey="billing"><BillingPage /></PermissionRoute>} />
                      <Route path="stats" element={<PermissionRoute moduleKey="dashboard"><StatsPage /></PermissionRoute>} />
                      <Route path="extension" element={<PermissionRoute moduleKey="settings"><ExtensionPage /></PermissionRoute>} />
                      <Route path="leads" element={<PermissionRoute moduleKey="directory"><LeadsPage /></PermissionRoute>} />
                      <Route path="files" element={<PermissionRoute moduleKey="files"><FilesPage /></PermissionRoute>} />
                      <Route path="messages" element={<PermissionRoute moduleKey="messages"><MessagesPage /></PermissionRoute>} />
                      <Route path="admin" element={<PermissionRoute moduleKey="admin"><AdminPage /></PermissionRoute>} />
                      <Route path="templates" element={<PermissionRoute moduleKey="messages" minimum="modify"><TemplatesPage /></PermissionRoute>} />
                      <Route path="vendors" element={<PermissionRoute moduleKey="directory"><VendorsPage /></PermissionRoute>} />
                      <Route path="settings" element={<PermissionRoute moduleKey="settings"><SettingsPage /></PermissionRoute>} />
                      <Route path="directory" element={<PermissionRoute moduleKey="directory"><DirectoryPage /></PermissionRoute>} />
                      <Route path="team" element={<PermissionRoute moduleKey="directory"><TeamPage /></PermissionRoute>} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="inventory-settings" element={<PermissionRoute moduleKey="inventory" minimum="modify"><InventorySettingsPage /></PermissionRoute>} />
                      <Route path="message-settings" element={<PermissionRoute moduleKey="settings" minimum="modify"><MessageSettingsPage /></PermissionRoute>} />
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
