import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import QuotePage from './pages/QuotePage.jsx';
import QuoteDetailPage from './pages/QuoteDetailPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import ExtensionPage from './pages/ExtensionPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import ForgotPage from './pages/ForgotPage.jsx';
import ResetPage from './pages/ResetPage.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { api, getToken } from './api';

function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function AuthGate({ children }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.auth.status()
      .then(({ setup }) => {
        if (!setup) navigate('/setup', { replace: true });
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  if (checking) return null;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/forgot" element={<ForgotPage />} />
            <Route path="/reset" element={<ResetPage />} />

            {/* Protected app routes */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/inventory" replace />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="quotes" element={<QuotePage />} />
              <Route path="quotes/:id" element={<QuoteDetailPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="extension" element={<ExtensionPage />} />
            </Route>
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </ToastProvider>
  );
}
