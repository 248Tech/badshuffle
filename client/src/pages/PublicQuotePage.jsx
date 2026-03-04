import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function PublicQuotePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getPublicQuote(token)
      .then(data => { setQuote(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [token]);

  if (loading) return <p>Loading quote…</p>;
  if (error) return <p>Error: {error}</p>;

  const subtotal = (quote.items || []).reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0);

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', fontFamily: 'sans-serif' }}>
      <h1>{quote.name}</h1>
      <p>Status: <strong>{quote.status}</strong></p>
      {quote.event_date && <p>Event Date: {quote.event_date}</p>}
      {quote.guest_count > 0 && <p>Guests: {quote.guest_count}</p>}
      {quote.notes && <p>{quote.notes}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>Item</th>
            <th style={{ textAlign: 'right' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Unit Price</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(quote.items || []).map(item => (
            <tr key={item.qitem_id}>
              <td style={{ padding: '8px 0' }}>{item.label || item.title}</td>
              <td style={{ textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right' }}>${(item.unit_price || 0).toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>${((item.unit_price || 0) * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 12 }}>Subtotal</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 12 }}>${subtotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Print / Save PDF
        </button>
      </div>

      <style>{`@media print { button { display: none !important; } }`}</style>
    </div>
  );
}
