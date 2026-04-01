import React from 'react';
import MessageBody from '../messages/MessageBody.jsx';
import { sanitizeContractHtml } from '../../lib/sanitizeHtml.js';

function ImgPlaceholder({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export default function PublicQuoteContractView({
  quote, totals, sectionsWithItems, eventDate, companyLogoUrl,
  resolveImageUrl, fmt, signature, needsResign, isExpired, isActionable,
  signerName, setSignerName, agreeChecked, setAgreeChecked,
  signing, signSuccess, signError, handleSignContract,
  approvePending, setApprovePending, approving, approveError, approveSuccess,
  handleApprove, setApproveError,
  messages, msgListRef, msgText, setMsgText, msgSending, msgSent,
  handleSendMessage, setMsgSent,
}) {
  const co = quote.company_name;
  const coEmail = quote.company_email;
  const coAddr = quote.company_address;

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div
        className="bg-white dark:bg-[#fafaf8] mx-auto shadow-2xl print:shadow-none"
        style={{ maxWidth: 820, fontFamily: '"Georgia", "Times New Roman", serif', color: '#1a1a1a' }}
      >
        <div style={{ borderBottom: '3px solid #1a1a1a', padding: '40px 52px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
            <div>
              {companyLogoUrl && (
                <img
                  src={companyLogoUrl}
                  alt={co ? `${co} logo` : 'Company logo'}
                  style={{ maxHeight: 56, width: 'auto', maxWidth: 220, objectFit: 'contain', display: 'block', marginBottom: 10 }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              {co && <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>{co}</div>}
              {coEmail && <div style={{ fontSize: 12, color: '#555', marginBottom: 1 }}>{coEmail}</div>}
              {coAddr && <div style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-line' }}>{coAddr}</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#666', marginBottom: 6 }}>Quote</div>
              {eventDate && (
                <div style={{ fontSize: 13, color: '#333', marginBottom: 3 }}>
                  <span style={{ color: '#666' }}>Date: </span>{eventDate}
                </div>
              )}
              {quote.guest_count > 0 && (
                <div style={{ fontSize: 13, color: '#333' }}>
                  <span style={{ color: '#666' }}>Guests: </span>{quote.guest_count}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 52px 24px', borderBottom: '1px solid #d4d4d4' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2, marginBottom: 8 }}>
            {quote.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              padding: '3px 10px', border: '1.5px solid',
              borderColor: quote.status === 'approved' ? '#16a34a' : quote.status === 'confirmed' ? '#0284c7' : quote.status === 'closed' ? '#64748b' : '#b45309',
              color: quote.status === 'approved' ? '#16a34a' : quote.status === 'confirmed' ? '#0284c7' : quote.status === 'closed' ? '#64748b' : '#b45309',
              borderRadius: 2,
            }}>
              {quote.status === 'approved' ? '✓ Approved' : quote.status === 'confirmed' ? '✓ Confirmed' : quote.status === 'closed' ? 'Closed' : 'Pending Approval'}
            </span>
          </div>
        </div>

        {(quote.client_first_name || quote.client_last_name || quote.client_email || quote.client_phone || quote.client_address ||
          quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address) && (
          <div style={{ padding: '24px 52px', borderBottom: '1px solid #d4d4d4', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            {(quote.client_first_name || quote.client_last_name || quote.client_email || quote.client_phone || quote.client_address) && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>Prepared For</div>
                {(quote.client_first_name || quote.client_last_name) && (
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
                    {[quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ')}
                  </div>
                )}
                {quote.client_email && <div style={{ fontSize: 13, color: '#444', marginBottom: 1 }}>{quote.client_email}</div>}
                {quote.client_phone && <div style={{ fontSize: 13, color: '#444', marginBottom: 1 }}>{quote.client_phone}</div>}
                {quote.client_address && <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-line' }}>{quote.client_address}</div>}
              </div>
            )}
            {(quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address) && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>Event Venue</div>
                {quote.venue_name && <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{quote.venue_name}</div>}
                {quote.venue_email && <div style={{ fontSize: 13, color: '#444', marginBottom: 1 }}>{quote.venue_email}</div>}
                {quote.venue_phone && <div style={{ fontSize: 13, color: '#444', marginBottom: 1 }}>{quote.venue_phone}</div>}
                {quote.venue_address && <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-line' }}>{quote.venue_address}</div>}
              </div>
            )}
          </div>
        )}

        {sectionsWithItems.length > 0 && (
          <div style={{ padding: '28px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 16 }}>Items &amp; Services</div>
            {sectionsWithItems.map((section, si) => (
              <div key={section.id} style={{ marginBottom: si < sectionsWithItems.length - 1 ? 28 : 0 }}>
                {sectionsWithItems.length > 1 && (
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e5e5e5' }}>
                    {section.title || 'Items'}
                    {section.dateRangeLabel && <span style={{ fontWeight: 400, color: '#777', marginLeft: 8, fontSize: 12 }}>{section.dateRangeLabel}</span>}
                  </div>
                )}
                {sectionsWithItems.length === 1 && section.dateRangeLabel && (
                  <div style={{ fontSize: 12, color: '#777', marginBottom: 10 }}>{section.dateRangeLabel}</div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #1a1a1a' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px 8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 48 }} />
                      <th style={{ textAlign: 'left', padding: '6px 8px 8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '6px 0 8px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 44 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '6px 0 8px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 90 }}>Unit Price</th>
                      <th style={{ textAlign: 'right', padding: '6px 0 8px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 90 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, idx) => {
                      const imgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
                      const unitPrice = item.unit_price_effective != null ? Number(item.unit_price_effective || 0) : Number(item.unit_price || 0);
                      const rowBg = idx % 2 === 1 ? '#f9f9f7' : 'transparent';
                      return (
                        <tr key={item.qitem_id} style={{ borderBottom: '1px solid #eee', background: rowBg }}>
                          <td style={{ padding: '8px 8px 8px 0', verticalAlign: 'middle' }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                              <div style={{ width: 36, height: 36, background: '#f0f0ee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ImgPlaceholder size={16} />
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 8px 8px 0', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600 }}>{item.label || item.title}</div>
                            {item.description && <div style={{ fontSize: 11, color: '#666', marginTop: 2, lineHeight: 1.4 }}>{item.description}</div>}
                          </td>
                          <td style={{ padding: '8px 0 8px 8px', textAlign: 'right', verticalAlign: 'top', color: '#444' }}>{item.quantity ?? 1}</td>
                          <td style={{ padding: '8px 0 8px 8px', textAlign: 'right', verticalAlign: 'top', color: '#444' }}>{fmt(unitPrice)}</td>
                          <td style={{ padding: '8px 0 8px 8px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>{fmt(unitPrice * (item.quantity || 1))}</td>
                        </tr>
                      );
                    })}
                    {section.customItems.map((ci, idx) => {
                      const imgUrl = resolveImageUrl(ci.photo_url, ci.signed_photo_url);
                      const rowBg = (section.items.length + idx) % 2 === 1 ? '#f9f9f7' : 'transparent';
                      return (
                        <tr key={ci.id} style={{ borderBottom: '1px solid #eee', background: rowBg }}>
                          <td style={{ padding: '8px 8px 8px 0', verticalAlign: 'middle' }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                              <div style={{ width: 36, height: 36, background: '#f0f0ee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ImgPlaceholder size={16} />
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 8px 8px 0', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600 }}>{ci.title}</div>
                            {ci.description && <div style={{ fontSize: 11, color: '#666', marginTop: 2, lineHeight: 1.4 }}>{ci.description}</div>}
                          </td>
                          <td style={{ padding: '8px 0 8px 8px', textAlign: 'right', verticalAlign: 'top', color: '#444' }}>{ci.quantity ?? 1}</td>
                          <td style={{ padding: '8px 0 8px 8px', textAlign: 'right', verticalAlign: 'top', color: '#444' }}>{fmt(ci.unit_price)}</td>
                          <td style={{ padding: '8px 0 8px 8px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>{fmt((ci.unit_price || 0) * (ci.quantity || 1))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {sectionsWithItems.length > 1 && (
                  <div style={{ textAlign: 'right', paddingTop: 8, fontSize: 13, color: '#444' }}>
                    Section subtotal: <strong>{fmt(section.subtotal)}</strong>
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px solid #1a1a1a' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 280, marginLeft: 'auto', fontSize: 13 }}>
                {totals.subtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#555' }}>Equipment subtotal</span><span>{fmt(totals.subtotal)}</span></div>}
                {totals.deliveryTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#555' }}>Delivery &amp; pickup</span><span>{fmt(totals.deliveryTotal)}</span></div>}
                {totals.customSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#555' }}>Other items</span><span>{fmt(totals.customSubtotal)}</span></div>}
                {totals.adjTotal !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#555' }}>{totals.adjTotal < 0 ? 'Discounts' : 'Surcharges'}</span><span>{fmt(totals.adjTotal)}</span></div>}
                {totals.rate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#555' }}>Tax ({totals.rate}%)</span><span>{fmt(totals.tax)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTop: '1.5px solid #1a1a1a', fontWeight: 700, fontSize: 16 }}>
                  <span>Total Due</span><span>{fmt(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {quote.quote_notes && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4', background: '#fdfdf9' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>Notes</div>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: '#444', margin: 0 }}>{quote.quote_notes}</p>
          </div>
        )}

        {quote.rental_terms?.body_text && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>
              Rental Terms{quote.rental_terms.name ? ` — ${quote.rental_terms.name}` : ''}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#444', whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }} className="print:max-h-none print:overflow-visible">
              {quote.rental_terms.body_text}
            </div>
          </div>
        )}

        {quote.payment_policy?.body_text && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>
              Payment Policy{quote.payment_policy.name ? ` — ${quote.payment_policy.name}` : ''}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#444', whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }} className="print:max-h-none print:overflow-visible">
              {quote.payment_policy.body_text}
            </div>
          </div>
        )}

        {!isExpired && quote.contract?.body_html && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>Agreement</div>
            <div
              style={{ fontSize: 12, lineHeight: 1.7, color: '#444', maxHeight: 300, overflowY: 'auto' }}
              className="print:max-h-none print:overflow-visible"
              dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(quote.contract.body_html) }}
            />
          </div>
        )}

        {isExpired && (
          <div style={{ padding: '16px 52px', borderBottom: '1px solid #d4d4d4', background: '#fff8f0', borderLeft: '4px solid #f97316' }}>
            <p style={{ fontSize: 13, color: '#7c2d12', margin: 0, fontWeight: 500 }}>
              {quote.expiration_message || 'This quote has expired. Please reach out to renew.'}
            </p>
          </div>
        )}

        {!isExpired && quote.contract && (
          <div style={{ padding: '28px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 20 }}>Signature</div>
            {quote.contract.signed_at && !needsResign ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#14532d', margin: '0 0 8px' }}>
                    Signed {new Date(quote.contract.signed_at).toLocaleString()}
                    {quote.contract.signer_name && ` by ${quote.contract.signer_name}`}.
                  </p>
                  {signature?.svg && (
                    <div style={{ borderTop: '1px solid #bbf7d0', paddingTop: 12, marginTop: 4 }}>
                      <img src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(signature.svg)))}`} alt="Signature" style={{ maxWidth: 280, width: '100%', height: 'auto', display: 'block' }} />
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: '#16a34a' }}>
                        {signature.signer_ip && <span>IP {signature.signer_ip}</span>}
                        {signature.typed_name && <span>{signature.typed_name}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="print:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {needsResign && (
                  <div style={{ background: '#fff8f0', border: '1px solid #fed7aa', borderLeft: '4px solid #f97316', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#7c2d12', fontWeight: 500 }}>
                    Updated changes require a new signature.
                  </div>
                )}
                <input
                  type="text"
                  style={{ padding: '10px 14px', border: '1.5px solid #d4d4d4', borderRadius: 6, fontSize: 14, maxWidth: 340, width: '100%', outline: 'none', fontFamily: 'inherit' }}
                  placeholder="Full name (acts as your signature)"
                  autoComplete="name"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  onFocus={e => { e.target.style.borderColor = '#0ea5e9'; }}
                  onBlur={e => { e.target.style.borderColor = '#d4d4d4'; }}
                />
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#444', cursor: 'pointer', lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, accentColor: '#0ea5e9', cursor: 'pointer' }}
                    checked={agreeChecked}
                    onChange={e => setAgreeChecked(e.target.checked)}
                  />
                  I have read and agree to the terms above
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    style={{ padding: '10px 24px', background: agreeChecked && signerName.trim() ? '#16a34a' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: signing || !agreeChecked || !signerName.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                    onClick={handleSignContract}
                    disabled={signing || !agreeChecked || !signerName.trim()}
                  >
                    {signing ? 'Signing…' : needsResign ? 'Re-sign contract' : 'Sign contract'}
                  </button>
                  {signSuccess && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>Contract signed. Thank you!</span>}
                  {signError && <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{signError}</span>}
                </div>

                <div className="print:block hidden" style={{ marginTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                    <div><div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: 6 }}><div style={{ fontSize: 11, color: '#666' }}>Client Signature</div></div></div>
                    <div><div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: 6 }}><div style={{ fontSize: 11, color: '#666' }}>Date</div></div></div>
                  </div>
                </div>
              </div>
            )}

            {!quote.contract.signed_at && (
              <div className="hidden print:block" style={{ marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
                  <div><div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontSize: 11, color: '#666' }}>Client Signature</div></div>
                  <div><div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontSize: 11, color: '#666' }}>Date</div></div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isExpired && isActionable && (
          <div className="print:hidden" style={{ padding: '24px 52px', borderBottom: '1px solid #d4d4d4', background: '#f9fafb' }}>
            {approveSuccess ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '14px 18px' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#14532d', margin: 0 }}>Quote approved — thank you! We look forward to working with you.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
                {!approvePending ? (
                  <button type="button" style={{ padding: '11px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: approving ? 'not-allowed' : 'pointer', width: '100%' }} onClick={() => setApprovePending(true)} disabled={approving}>
                    Approve this Quote
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Confirm approval?</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={{ flex: 1, padding: '9px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: approving ? 'not-allowed' : 'pointer' }} onClick={handleApprove} disabled={approving}>
                        {approving ? 'Approving…' : 'Yes, approve'}
                      </button>
                      <button type="button" style={{ flex: 1, padding: '9px 0', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }} onClick={() => { setApprovePending(false); setApproveError(null); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {approveError && <p style={{ fontSize: 12, color: '#dc2626', margin: 0, fontWeight: 500 }}>{approveError}</p>}
              </div>
            )}
          </div>
        )}

        <div className="print:hidden" style={{ padding: '24px 52px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 14 }}>Messages</div>
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 14 }} ref={msgListRef}>
              {messages.map((m) => (
                <div key={m.id} style={{ maxWidth: '78%', alignSelf: m.direction === 'inbound' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ padding: '9px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: m.direction === 'inbound' ? '#f0fdf4' : '#f0f9ff', borderBottomRightRadius: m.direction === 'inbound' ? 3 : 12, borderBottomLeftRadius: m.direction === 'inbound' ? 12 : 3 }}>
                    <MessageBody msg={m} />
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3, paddingLeft: 2 }}>
                    {m.direction === 'inbound' ? (m.from_email || 'You') : (quote.company_name || 'Your rental company')}
                    {' · '}{m.sent_at ? new Date(m.sent_at.replace(' ', 'T') + 'Z').toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          {msgSent && <div style={{ fontSize: 13, color: '#16a34a', background: '#f0fdf4', padding: '9px 14px', borderRadius: 8, marginBottom: 12 }}>Message sent — we'll be in touch soon.</div>}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #d4d4d4', borderRadius: 6, fontSize: 13, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
              rows={3}
              placeholder="Have a question or comment? Send us a message…"
              value={msgText}
              onChange={e => { setMsgText(e.target.value.slice(0, 1000)); setMsgSent(false); }}
              maxLength={1000}
              required
              onFocus={e => { e.target.style.borderColor = '#0ea5e9'; }}
              onBlur={e => { e.target.style.borderColor = '#d4d4d4'; }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              {msgText.length > 800 && <span style={{ fontSize: 12, color: '#b45309', fontWeight: 500 }}>{msgText.length}/1000</span>}
              <button type="submit" style={{ padding: '9px 22px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: msgSending || !msgText.trim() ? 'not-allowed' : 'pointer', opacity: msgSending || !msgText.trim() ? 0.5 : 1, transition: 'opacity 0.15s' }} disabled={msgSending || !msgText.trim()}>
                {msgSending ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ padding: '14px 52px', borderTop: '1.5px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#888' }}>
          <span>{co || 'Quote'}</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
