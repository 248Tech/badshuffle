import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');

function computeTotals(items, taxRate) {
  const list = items || [];
  const equipment = list.filter(it => !isLogistics(it));
  const logistics = list.filter(it => isLogistics(it));
  const subtotal = equipment.reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const deliveryTotal = logistics.reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const taxableEquipment = equipment.filter(it => it.taxable !== 0).reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const taxableDelivery = logistics.filter(it => it.taxable !== 0).reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const rate = parseFloat(taxRate) || 0;
  const tax = (taxableEquipment + taxableDelivery) * (rate / 100);
  const grandTotal = subtotal + deliveryTotal + tax;
  return { subtotal, deliveryTotal, tax, total: grandTotal, rate };
}

export default function PublicQuotePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);

  const loadQuote = () => {
    setLoading(true);
    api.getPublicQuote(token)
      .then(data => { setQuote(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { loadQuote(); }, [token]);

  const handleApprove = () => {
    setApproving(true);
    api.approveQuoteByToken(token)
      .then(data => { setQuote(data.quote); setApproveSuccess(true); })
      .catch(err => { setError(err.message); })
      .finally(() => setApproving(false));
  };

  const handleSignContract = () => {
    if (!agreeChecked || !signerName.trim()) return;
    setSigning(true);
    api.signContractByToken(token, { signer_name: signerName.trim(), signature_data: 'agreed' })
      .then(data => {
        setQuote(q => (q ? { ...q, contract: data.contract } : q));
        setSignSuccess(true);
      })
      .catch(err => { setError(err.message); })
      .finally(() => setSigning(false));
  };

  if (loading) return <p>Loading quote…</p>;
  if (error) return <p>Error: {error}</p>;

  const taxRate = quote.tax_rate != null ? quote.tax_rate : 0;
  const totals = computeTotals(quote.items, taxRate);
  const equipmentItems = (quote.items || []).filter(it => !isLogistics(it));
  const logisticsItems = (quote.items || []).filter(it => isLogistics(it));
  const date = quote.event_date ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString() : null;

  const s = (obj) => ({ ...obj, fontFamily: 'sans-serif' });
  const section = { marginTop: 24 };
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 };
  const card = { padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' };

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', ...s({}) }}>
      <h1 style={{ marginBottom: 4 }}>{quote.name}</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
        {date && <span>Event date: {date}</span>}
        {quote.guest_count > 0 && <span>Guests: {quote.guest_count}</span>}
      </div>

      {quote.notes && <div style={section}><p style={{ margin: 0 }}>{quote.notes}</p></div>}

      <div style={{ ...section, ...grid }}>
        {(quote.client_first_name || quote.client_last_name || quote.client_email || quote.client_phone || quote.client_address) && (
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', marginBottom: 8 }}>Client</div>
            <div style={{ fontSize: 14 }}>
              {(quote.client_first_name || quote.client_last_name) && <div>{[quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ')}</div>}
              {quote.client_email && <div>{quote.client_email}</div>}
              {quote.client_phone && <div>{quote.client_phone}</div>}
              {quote.client_address && <div>{quote.client_address}</div>}
            </div>
          </div>
        )}
        {(quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address) && (
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', marginBottom: 8 }}>Venue</div>
            <div style={{ fontSize: 14 }}>
              {quote.venue_name && <div>{quote.venue_name}</div>}
              {quote.venue_email && <div>{quote.venue_email}</div>}
              {quote.venue_phone && <div>{quote.venue_phone}</div>}
              {quote.venue_address && <div>{quote.venue_address}</div>}
            </div>
          </div>
        )}
      </div>

      <div style={section}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', padding: '8px 0' }}>Item</th>
              <th style={{ textAlign: 'right', borderBottom: '2px solid #e5e7eb', padding: '8px 0' }}>Qty</th>
              <th style={{ textAlign: 'right', borderBottom: '2px solid #e5e7eb', padding: '8px 0' }}>Unit</th>
              <th style={{ textAlign: 'right', borderBottom: '2px solid #e5e7eb', padding: '8px 0' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {equipmentItems.map(item => (
              <tr key={item.qitem_id}>
                <td style={{ padding: '8px 0' }}>{item.label || item.title}</td>
                <td style={{ textAlign: 'right' }}>{item.quantity ?? 1}</td>
                <td style={{ textAlign: 'right' }}>${(item.unit_price || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>${((item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}</td>
              </tr>
            ))}
            {logisticsItems.length > 0 && (
              <>
                <tr><td colSpan={4} style={{ paddingTop: 12, fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Delivery / Pickup</td></tr>
                {logisticsItems.map(item => (
                  <tr key={item.qitem_id}>
                    <td style={{ padding: '4px 0' }}>{item.label || item.title}</td>
                    <td style={{ textAlign: 'right' }}>{item.quantity ?? 1}</td>
                    <td style={{ textAlign: 'right' }}>${(item.unit_price || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>${((item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ ...section, padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, maxWidth: 280, marginLeft: 'auto' }}>
        {totals.subtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>}
        {totals.deliveryTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Delivery</span><span>${totals.deliveryTotal.toFixed(2)}</span></div>}
        {totals.rate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Tax ({totals.rate}%)</span><span>${totals.tax.toFixed(2)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}><span>Total</span><span>${totals.total.toFixed(2)}</span></div>
      </div>

      {quote.quote_notes && <div style={{ ...section, fontSize: 13, color: '#6b7280' }}><strong>Notes:</strong> {quote.quote_notes}</div>}

      {quote.contract && (quote.contract.body_html || quote.contract.signed_at) && (
        <div style={{ ...section, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', marginBottom: 12 }}>Contract</div>
          {quote.contract.body_html && (
            <div
              style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}
              dangerouslySetInnerHTML={{ __html: quote.contract.body_html }}
            />
          )}
          {quote.contract.signed_at ? (
            <p style={{ margin: 0, fontSize: 13, color: '#065f46' }}>
              Signed {new Date(quote.contract.signed_at).toLocaleString()}
              {quote.contract.signer_name && ` by ${quote.contract.signer_name}`}.
            </p>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={agreeChecked} onChange={e => setAgreeChecked(e.target.checked)} />
                I agree to the terms above
              </label>
              <input
                type="text"
                placeholder="Full name (signature)"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                style={{ display: 'block', width: '100%', maxWidth: 280, padding: '8px 12px', marginBottom: 10, border: '1px solid #e5e7eb', borderRadius: 6 }}
              />
              <button
                type="button"
                onClick={handleSignContract}
                disabled={signing || !agreeChecked || !signerName.trim()}
                style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: signing ? 'wait' : 'pointer' }}
              >
                {signing ? 'Signing…' : 'Sign contract'}
              </button>
            </>
          )}
          {signSuccess && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#065f46' }}>Contract signed. Thank you!</p>}
        </div>
      )}

      {approveSuccess && (
        <div style={{ ...section, padding: 12, background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, color: '#065f46' }}>
          Quote approved. Thank you!
        </div>
      )}

      <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {quote.status !== 'approved' && (
          <button
            onClick={handleApprove}
            disabled={approving}
            style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: approving ? 'wait' : 'pointer' }}
          >
            {approving ? 'Approving…' : 'Approve this Quote'}
          </button>
        )}
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
