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
import { ToastProvider } from './components/Toast.jsx';
import { api, getToken } from './api';

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

    api.auth.status()
      .then(({ setup }) => {
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
        return api.auth.me()
          .then(me => {
            if (cancelled) return;
            setRole(me.role);
            setState('authed');
          })
          .catch(() => {
            if (cancelled) return;
            setRole('');
            setState('unauthed');
            if (location.pathname !== '/login' && !hasRedirectedToLogin.current) {
              hasRedirectedToLogin.current = true;
              navigate('/login', { replace: true });
            }
          });
      })
      .catch(() => {
        if (cancelled) return;
        setState('unauthed');
      });

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
        <AuthGate setRole={setRole}>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/forgot" element={<ForgotPage />} />
            <Route path="/reset" element={<ResetPage />} />
            <Route path="/quote/public/:token" element={<PublicQuotePage />} />

            {/* Protected app routes */}
            <Route path="/" element={<ProtectedRoute><Layout role={role} /></ProtectedRoute>}>
              <Route index element={<Navigate to="/inventory" replace />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="inventory/:id" element={<ItemDetailPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="quotes" element={<QuotePage />} />
              <Route path="quotes/:id" element={<QuoteDetailPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="extension" element={<ExtensionPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </ToastProvider>
  );
}
