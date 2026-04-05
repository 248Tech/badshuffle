import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const { code } = useParams();

  useEffect(() => {
    let cancelled = false;
    api.resolveScanCode(code)
      .then((result) => {
        if (cancelled) return;
        navigate(result.href || '/dashboard', { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        navigate('/dashboard', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <div style={{ display: 'flex', minHeight: '40vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );
}
