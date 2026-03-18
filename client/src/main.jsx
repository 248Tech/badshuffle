import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './theme.css';

// Apply saved UI scale before first render
const savedScale = parseFloat(localStorage.getItem('bs_ui_scale')) || 100;
if (savedScale !== 100) {
  document.documentElement.style.fontSize = (savedScale / 100) * 14 + 'px';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
