import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import QuotePage from './pages/QuotePage.jsx';
import QuoteDetailPage from './pages/QuoteDetailPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import ExtensionPage from './pages/ExtensionPage.jsx';
import { ToastProvider } from './components/Toast.jsx';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/inventory" replace />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="quotes" element={<QuotePage />} />
            <Route path="quotes/:id" element={<QuoteDetailPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="extension" element={<ExtensionPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
