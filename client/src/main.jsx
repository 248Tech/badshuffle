import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './theme.css';
import './index.css';

// Apply saved UI scale before first render
const savedScale = parseFloat(localStorage.getItem('bs_ui_scale')) || 100;
if (savedScale !== 100) {
  document.documentElement.style.fontSize = (savedScale / 100) * 14 + 'px';
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
