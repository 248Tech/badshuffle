import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../api';
import MessageBody from '../components/messages/MessageBody.jsx';
import { computeTotals, effectivePrice } from '../lib/quoteTotals.js';
import s from './PublicQuotePage.module.css'; // spinner keyframes + detailOverlay animation

function ImgPlaceholder({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function fmt(n) {
  return '$' + (n || 0).toFixed(2);
}

function parseSignatureData(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function formatDateRange(start, end) {
  if (!start && !end) return null;
  const formatOne = (value) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  if (start && end) return `${formatOne(start)} – ${formatOne(end)}`;
  return formatOne(start || end);
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

// ── Contract View ─────────────────────────────────────────────────────────────
function ContractView({
  quote, totals, sectionsWithItems, eventDate, companyLogoUrl,
  resolveImageUrl, fmt, signature, needsResign, isExpired, isActionable,
  signerName, setSignerName, agreeChecked, setAgreeChecked,
  signing, signSuccess, signError, handleSignContract,
  approvePending, setApprovePending, approving, approveError, approveSuccess,
  handleApprove, setApproveError,
  messages, msgListRef, msgText, setMsgText, msgSending, msgSent,
  handleSendMessage, setMsgSent,
  DOMPurify,
}) {
  const co = quote.company_name;
  const coEmail = quote.company_email;
  const coAddr = quote.company_address;

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 py-8 px-4 print:bg-white print:py-0 print:px-0">
      {/* Paper page */}
      <div
        className="bg-white dark:bg-[#fafaf8] mx-auto shadow-2xl print:shadow-none"
        style={{ maxWidth: 820, fontFamily: '"Georgia", "Times New Roman", serif', color: '#1a1a1a' }}
      >
        {/* ── Letterhead ─────────────────────────────── */}
        <div style={{ borderBottom: '3px solid #1a1a1a', padding: '40px 52px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
            {/* Left: company */}
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
            {/* Right: quote meta */}
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

        {/* ── Document title ─────────────────────────── */}
        <div style={{ padding: '32px 52px 24px', borderBottom: '1px solid #d4d4d4' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2, marginBottom: 8 }}>
            {quote.name}
          </h1>
          {/* Status */}
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

        {/* ── Client / Venue ─────────────────────────── */}
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

        {/* ── Line items ─────────────────────────────── */}
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
                      <th style={{ textAlign: 'left', padding: '6px 8px 8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 48 }}></th>
                      <th style={{ textAlign: 'left', padding: '6px 8px 8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '6px 0 8px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 44 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '6px 0 8px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 90 }}>Unit Price</th>
                      <th style={{ textAlign: 'right', padding: '6px 0 8px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', width: 90 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, idx) => {
                      const imgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
                      const unitPrice = effectivePrice(item);
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

            {/* Totals block */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px solid #1a1a1a' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 280, marginLeft: 'auto', fontSize: 13 }}>
                {totals.subtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#555' }}>Equipment subtotal</span><span>{fmt(totals.subtotal)}</span>
                  </div>
                )}
                {totals.deliveryTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#555' }}>Delivery &amp; pickup</span><span>{fmt(totals.deliveryTotal)}</span>
                  </div>
                )}
                {totals.customSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#555' }}>Other items</span><span>{fmt(totals.customSubtotal)}</span>
                  </div>
                )}
                {totals.adjTotal !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#555' }}>{totals.adjTotal < 0 ? 'Discounts' : 'Surcharges'}</span><span>{fmt(totals.adjTotal)}</span>
                  </div>
                )}
                {totals.rate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#555' }}>Tax ({totals.rate}%)</span><span>{fmt(totals.tax)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTop: '1.5px solid #1a1a1a', fontWeight: 700, fontSize: 16 }}>
                  <span>Total Due</span><span>{fmt(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Quote notes ────────────────────────────── */}
        {quote.quote_notes && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4', background: '#fdfdf9' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>Notes</div>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: '#444', margin: 0 }}>{quote.quote_notes}</p>
          </div>
        )}

        {/* ── Rental Terms ───────────────────────────── */}
        {quote.rental_terms?.body_text && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>
              Rental Terms{quote.rental_terms.name ? ` — ${quote.rental_terms.name}` : ''}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#444', whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}
              className="print:max-h-none print:overflow-visible"
            >
              {quote.rental_terms.body_text}
            </div>
          </div>
        )}

        {/* ── Payment Policy ─────────────────────────── */}
        {quote.payment_policy?.body_text && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>
              Payment Policy{quote.payment_policy.name ? ` — ${quote.payment_policy.name}` : ''}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#444', whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}
              className="print:max-h-none print:overflow-visible"
            >
              {quote.payment_policy.body_text}
            </div>
          </div>
        )}

        {/* ── Contract body ──────────────────────────── */}
        {!isExpired && quote.contract?.body_html && (
          <div style={{ padding: '20px 52px', borderBottom: '1px solid #d4d4d4' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 8 }}>Agreement</div>
            <div
              style={{ fontSize: 12, lineHeight: 1.7, color: '#444', maxHeight: 300, overflowY: 'auto' }}
              className="print:max-h-none print:overflow-visible"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(quote.contract.body_html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'span', 'div'], ALLOWED_ATTR: ['href', 'target', 'rel'] }) }}
            />
          </div>
        )}

        {/* ── Expiration notice ──────────────────────── */}
        {isExpired && (
          <div style={{ padding: '16px 52px', borderBottom: '1px solid #d4d4d4', background: '#fff8f0', borderLeft: '4px solid #f97316' }}>
            <p style={{ fontSize: 13, color: '#7c2d12', margin: 0, fontWeight: 500 }}>
              {quote.expiration_message || 'This quote has expired. Please reach out to renew.'}
            </p>
          </div>
        )}

        {/* ── Signature block ────────────────────────── */}
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
                      <img
                        src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(signature.svg)))}`}
                        alt="Signature"
                        style={{ maxWidth: 280, width: '100%', height: 'auto', display: 'block' }}
                      />
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
                    style={{
                      padding: '10px 24px', background: agreeChecked && signerName.trim() ? '#16a34a' : '#9ca3af',
                      color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                      cursor: signing || !agreeChecked || !signerName.trim() ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onClick={handleSignContract}
                    disabled={signing || !agreeChecked || !signerName.trim()}
                  >
                    {signing ? 'Signing…' : needsResign ? 'Re-sign contract' : 'Sign contract'}
                  </button>
                  {signSuccess && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>Contract signed. Thank you!</span>}
                  {signError && <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{signError}</span>}
                </div>

                {/* Print signature lines */}
                <div className="print:block hidden" style={{ marginTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                    <div>
                      <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: 6 }}>
                        <div style={{ fontSize: 11, color: '#666' }}>Client Signature</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: 6 }}>
                        <div style={{ fontSize: 11, color: '#666' }}>Date</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Always-visible print signature lines when contract not yet signed */}
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

        {/* ── Approve / CTA ──────────────────────────── */}
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
                  <button
                    type="button"
                    style={{ padding: '11px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: approving ? 'not-allowed' : 'pointer', width: '100%' }}
                    onClick={() => setApprovePending(true)}
                    disabled={approving}
                  >
                    Approve this Quote
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Confirm approval?</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        style={{ flex: 1, padding: '9px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: approving ? 'not-allowed' : 'pointer' }}
                        onClick={handleApprove}
                        disabled={approving}
                      >
                        {approving ? 'Approving…' : 'Yes, approve'}
                      </button>
                      <button
                        type="button"
                        style={{ flex: 1, padding: '9px 0', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                        onClick={() => { setApprovePending(false); setApproveError(null); }}
                      >
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

        {/* ── Messages ───────────────────────────────── */}
        <div className="print:hidden" style={{ padding: '24px 52px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666', marginBottom: 14 }}>Messages</div>
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 14 }} ref={msgListRef}>
              {messages.map(m => (
                <div key={m.id} style={{ maxWidth: '78%', alignSelf: m.direction === 'inbound' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    padding: '9px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                    background: m.direction === 'inbound' ? '#f0fdf4' : '#f0f9ff',
                    borderBottomRightRadius: m.direction === 'inbound' ? 3 : 12,
                    borderBottomLeftRadius: m.direction === 'inbound' ? 12 : 3,
                  }}>
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
          {msgSent && (
            <div style={{ fontSize: 13, color: '#16a34a', background: '#f0fdf4', padding: '9px 14px', borderRadius: 8, marginBottom: 12 }}>
              Message sent — we'll be in touch soon.
            </div>
          )}
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
              {msgText.length > 800 && (
                <span style={{ fontSize: 12, color: '#b45309', fontWeight: 500 }}>{msgText.length}/1000</span>
              )}
              <button
                type="submit"
                style={{ padding: '9px 22px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: msgSending || !msgText.trim() ? 'not-allowed' : 'pointer', opacity: msgSending || !msgText.trim() ? 0.5 : 1, transition: 'opacity 0.15s' }}
                disabled={msgSending || !msgText.trim()}
              >
                {msgSending ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <div style={{ padding: '14px 52px', borderTop: '1.5px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#888' }}>
          <span>{co || 'Quote'}</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

function ItemDetailModal({ item, resolveImageUrl, onClose, isDark }) {
  const closeRef = React.useRef(null);
  const cardRef = React.useRef(null);

  React.useEffect(() => { closeRef.current?.focus(); }, []);

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !cardRef.current) return;
    const focusable = Array.from(cardRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  if (!item) return null;
  const name = item.label || item.title;
  const unitPrice = effectivePrice(item);
  const originalUnitPrice = item.unit_price_override != null ? item.unit_price_override : (item.unit_price || 0);
  const showDiscount = unitPrice !== originalUnitPrice;
  const qty = item.quantity ?? 1;
  const lineTotal = unitPrice * qty;
  const imgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
  const description = item.description || null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={s.detailOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Item details" onKeyDown={handleKeyDown}>
        <div
          ref={cardRef}
          className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
          style={{ animation: 'detailSlideIn 0.22s ease' }}
        >
          <button
            ref={closeRef}
            type="button"
            className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-black/20 dark:hover:bg-white/20 transition-colors text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >&times;</button>

          {imgUrl ? (
            <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden">
              <img src={imgUrl} alt="" className="w-full h-full object-contain p-6" onError={e => { e.target.style.display = 'none'; }} />
            </div>
          ) : (
            <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <ImgPlaceholder size={56} />
            </div>
          )}

          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 leading-tight">{name}</h2>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">{fmt(unitPrice)}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">per unit</span>
              {showDiscount && (
                <span className="text-sm text-slate-400 dark:text-slate-500 line-through">{fmt(originalUnitPrice)}</span>
              )}
            </div>
            {qty > 1 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {qty} × {fmt(unitPrice)} = <strong className="text-slate-700 dark:text-slate-200">{fmt(lineTotal)}</strong>
              </p>
            )}
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 mt-4 pt-4">{description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicQuotePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approvePending, setApprovePending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [approveError, setApproveError] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);
  const [signError, setSignError] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const detailOpenerRef = React.useRef(null);
  const [messages, setMessages] = useState([]);
  const msgListRef = React.useRef(null);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('pq-dark');
      if (saved !== null) return saved === '1';
    } catch {}
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  });
  // viewMode is initialised after quote loads; null = not yet decided
  const [viewMode, setViewMode] = useState(null);

  const toggleDark = () => {
    setIsDark(d => {
      const next = !d;
      try { localStorage.setItem('pq-dark', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const loadQuote = React.useCallback(async ({ withLoading = false } = {}) => {
    if (!token) return null;
    if (withLoading) { setLoading(true); setError(null); }
    try {
      const data = await api.getPublicQuote(token);
      setQuote(data);
      if (data?.name) document.title = `${data.name} — Quote`;
      // Set initial view from server default (only on first load)
      setViewMode(prev => {
        if (prev !== null) return prev;
        const def = data?.quote_view_default || 'standard';
        const stdOn = data?.quote_view_standard_enabled !== '0';
        const conOn = data?.quote_view_contract_enabled !== '0';
        if (def === 'contract' && conOn) return 'contract';
        if (stdOn) return 'standard';
        if (conOn) return 'contract';
        return 'standard';
      });
      return data;
    } catch (err) {
      if (withLoading) setError(err.message || 'Not found');
      throw err;
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadQuote({ withLoading: true }).catch(() => {});
  }, [token, loadQuote]);

  useEffect(() => {
    if (!token) return;
    const poll = () => {
      loadQuote().catch(() => {});
      api.getPublicMessages(token).then(d => setMessages(d.messages || [])).catch(() => {});
    };
    api.getPublicMessages(token).then(d => setMessages(d.messages || [])).catch(() => {});
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [token, loadQuote]);

  const prevMsgCountRef = React.useRef(0);
  React.useEffect(() => {
    const el = msgListRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
    if (messages.length > prevMsgCountRef.current) setMsgSent(false);
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setMsgSending(true);
    try {
      const clientName = [quote?.client_first_name, quote?.client_last_name].filter(Boolean).join(' ') || undefined;
      const clientEmail = quote?.client_email || undefined;
      await api.sendPublicMessage(token, { body_text: msgText.trim(), from_name: clientName, from_email: clientEmail });
      setMsgText('');
      setMsgSent(true);
      api.getPublicMessages(token).then(d => setMessages(d.messages || [])).catch(() => {});
    } catch {}
    finally { setMsgSending(false); }
  };

  useEffect(() => {
    if (!detailItem) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { setDetailItem(null); detailOpenerRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailItem]);

  const handleApprove = () => {
    setApprovePending(false);
    setApproving(true);
    setApproveError(null);
    api.approveQuoteByToken(token)
      .then(async () => { await loadQuote(); setApproveSuccess(true); })
      .catch(err => { setApproveError(err.message || 'Something went wrong. Please try again.'); })
      .finally(() => setApproving(false));
  };

  const handleSignContract = () => {
    if (!agreeChecked || !signerName.trim()) return;
    setSigning(true);
    setSignError(null);
    api.signContractByToken(token, { signer_name: signerName.trim(), signature_data: 'agreed' })
      .then(async () => { await loadQuote(); setSignSuccess(true); })
      .catch(err => { setSignError(err.message || 'Something went wrong. Please try again.'); })
      .finally(() => setSigning(false));
  };

  const dc = isDark ? 'dark' : '';

  if (!token) {
    return (
      <div className={dc}>
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center max-w-sm w-full shadow-sm">
            <div className="text-3xl mb-3" aria-hidden="true">⚠</div>
            <p className="text-base font-semibold text-slate-900 dark:text-white mb-1">Invalid quote link</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">This link does not appear to be valid.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={dc}>
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center max-w-sm w-full shadow-sm">
            <div className={s.spinner} />
            <p className="text-base font-semibold text-slate-900 dark:text-white">Loading quote&hellip;</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={dc}>
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center max-w-sm w-full shadow-sm">
            <div className="text-3xl mb-3" aria-hidden="true">⚠</div>
            <p className="text-base font-semibold text-slate-900 dark:text-white mb-1">Could not load quote</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const taxRate = quote.tax_rate != null ? quote.tax_rate : 0;
  const totals = computeTotals({ items: quote.items, customItems: quote.customItems, adjustments: quote.adjustments, taxRate });
  const items = quote.items || [];
  const customItems = quote.customItems || [];
  const sections = (quote.sections && quote.sections.length > 0) ? quote.sections : [{ id: 'default', title: 'Items' }];
  const sectionsWithItems = sections
    .map((section) => {
      const sectionItems = items.filter((item) => String(item.section_id || sections[0].id) === String(section.id));
      const sectionCustomItems = customItems.filter((item) => String(item.section_id || sections[0].id) === String(section.id));
      const sectionSubtotal = sectionItems.reduce((sum, item) => sum + (effectivePrice(item) * (item.quantity || 1)), 0)
        + sectionCustomItems.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 1)), 0);
      return { ...section, items: sectionItems, customItems: sectionCustomItems, subtotal: sectionSubtotal, dateRangeLabel: formatDateRange(section.rental_start, section.rental_end) };
    })
    .filter((section) => section.items.length > 0 || section.customItems.length > 0);

  const eventDate = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const isActionable = quote.status === 'sent' || !quote.status;
  const isExpired = !!quote.is_expired;
  const needsResign = !!quote.has_unsigned_changes;
  const signature = parseSignatureData(quote.contract?.signature_data);
  const hasClient = quote.client_first_name || quote.client_last_name || quote.client_email || quote.client_phone || quote.client_address;
  const hasVenue = quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  function resolveImageUrl(value, signedUrl) {
    if (signedUrl) return `${origin}${signedUrl}`;
    if (value === undefined || value === null || value === '') return null;
    const str = String(value).trim();
    if (!str) return null;
    if (/^\d+$/.test(str)) return `${origin}${api.fileServeUrl(str)}`;
    if (str.startsWith('http://') || str.startsWith('https://')) return str;
    return `${origin}${api.proxyImageUrl(str)}`;
  }
  const companyLogoUrl = resolveImageUrl(quote.company_logo, quote.signed_company_logo);

  const stdEnabled = quote.quote_view_standard_enabled !== '0';
  const conEnabled = quote.quote_view_contract_enabled !== '0';
  const showViewToggle = stdEnabled && conEnabled;
  const effectiveView = viewMode ?? (quote.quote_view_default || 'standard');

  const statusPill = quote.status === 'approved'
    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
    : quote.status === 'confirmed'
    ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30'
    : quote.status === 'closed'
    ? 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30'
    : 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30';

  const statusLabel = quote.status === 'approved' ? '✓ Approved'
    : quote.status === 'confirmed' ? '✓ Confirmed'
    : quote.status === 'closed' ? 'Closed'
    : 'Pending approval';

  const TotalsCard = () => (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:border-slate-300 print:break-inside-avoid">
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quote Total</span>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {totals.subtotal > 0 && (
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>Equipment subtotal</span><span>{fmt(totals.subtotal)}</span>
          </div>
        )}
        {totals.deliveryTotal > 0 && (
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>Delivery &amp; pickup</span><span>{fmt(totals.deliveryTotal)}</span>
          </div>
        )}
        {totals.customSubtotal > 0 && (
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>Other items</span><span>{fmt(totals.customSubtotal)}</span>
          </div>
        )}
        {totals.adjTotal !== 0 && (
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>{totals.adjTotal < 0 ? 'Discounts' : 'Surcharges'}</span><span>{fmt(totals.adjTotal)}</span>
          </div>
        )}
        {totals.rate > 0 && (
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>Tax ({totals.rate}%)</span><span>{fmt(totals.tax)}</span>
          </div>
        )}
        <div className="pt-3 mt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <span className="text-base font-bold text-slate-900 dark:text-white">Total</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(totals.total)}</span>
        </div>
      </div>
    </div>
  );

  const ApproveSection = ({ compact = false }) => (
    <>
      {!isExpired && isActionable && !approvePending && (
        <button
          type="button"
          className={`${compact ? 'px-5 py-2.5' : 'w-full px-5 py-3.5'} bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow-lg hover:shadow-emerald-500/25`}
          onClick={() => setApprovePending(true)}
          disabled={approving}
        >
          Approve this Quote
        </button>
      )}
      {!isExpired && isActionable && approvePending && (
        <div className={`flex ${compact ? 'flex-row items-center gap-2' : 'flex-col gap-3'}`}>
          {!compact && <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center">Confirm approval?</span>}
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? 'Approving…' : 'Yes, approve'}
            </button>
            <button
              type="button"
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              onClick={() => { setApprovePending(false); setApproveError(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {approveError && <p className="text-xs text-red-500 dark:text-red-400 font-medium" role="alert">{approveError}</p>}
    </>
  );

  return (
    <div className={dc}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 print:bg-white print:pb-0" style={{ paddingBottom: 'max(80px, calc(68px + env(safe-area-inset-bottom)))' }}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 overflow-hidden print:bg-white print:border-b print:border-slate-200">
          {/* Decorative orbs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden print:hidden" aria-hidden="true">
            <div className="absolute -top-48 -right-48 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl" />
          </div>

          <div className="relative w-full px-6 sm:px-10 xl:px-16 py-12 sm:py-16 print:py-6 print:px-6">
            {/* Top bar: branding + dark-mode toggle */}
            <div className="flex items-start justify-between mb-10 print:mb-4">
              <div className="flex items-center gap-4">
                {companyLogoUrl && (
                  <img
                    src={companyLogoUrl}
                    alt={quote.company_name ? `${quote.company_name} logo` : 'Company logo'}
                    className="max-h-14 w-auto max-w-[220px] object-contain object-left print:hidden"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                {quote.company_name && (
                  <span className="text-sm font-semibold text-slate-300 print:text-slate-700">{quote.company_name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 print:hidden">
                {showViewToggle && (
                  <button
                    type="button"
                    onClick={() => setViewMode(v => v === 'contract' ? 'standard' : 'contract')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition-all duration-150"
                    aria-label={effectiveView === 'contract' ? 'Switch to standard view' : 'Switch to contract view'}
                  >
                    {effectiveView === 'contract' ? <GridIcon /> : <FileIcon />}
                    <span className="hidden sm:inline">{effectiveView === 'contract' ? 'Standard' : 'Contract'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleDark}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition-all duration-150"
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? <SunIcon /> : <MoonIcon />}
                  <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
                </button>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight text-white print:text-slate-900 mb-6 print:mb-3 print:text-3xl leading-none max-w-5xl">
              {quote.name}
            </h1>

            {/* Meta pills */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full ${statusPill} print:bg-slate-100 print:text-slate-700`}>
                {statusLabel}
              </span>
              {eventDate && (
                <span className="inline-flex items-center gap-2 text-sm text-slate-300 bg-white/8 px-3.5 py-1.5 rounded-full backdrop-blur-sm print:text-slate-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  {eventDate}
                </span>
              )}
              {quote.guest_count > 0 && (
                <span className="inline-flex items-center gap-2 text-sm text-slate-300 bg-white/8 px-3.5 py-1.5 rounded-full backdrop-blur-sm print:text-slate-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  {quote.guest_count} guests
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Contract view ────────────────────────────────────────────── */}
        {effectiveView === 'contract' && (
          <ContractView
            quote={quote}
            totals={totals}
            sectionsWithItems={sectionsWithItems}
            eventDate={eventDate}
            companyLogoUrl={companyLogoUrl}
            resolveImageUrl={resolveImageUrl}
            fmt={fmt}
            signature={signature}
            needsResign={needsResign}
            isExpired={isExpired}
            isActionable={isActionable}
            signerName={signerName}
            setSignerName={setSignerName}
            agreeChecked={agreeChecked}
            setAgreeChecked={setAgreeChecked}
            signing={signing}
            signSuccess={signSuccess}
            signError={signError}
            handleSignContract={handleSignContract}
            approvePending={approvePending}
            setApprovePending={setApprovePending}
            approving={approving}
            approveError={approveError}
            approveSuccess={approveSuccess}
            handleApprove={handleApprove}
            setApproveError={setApproveError}
            messages={messages}
            msgListRef={msgListRef}
            msgText={msgText}
            setMsgText={setMsgText}
            msgSending={msgSending}
            msgSent={msgSent}
            handleSendMessage={handleSendMessage}
            setMsgSent={setMsgSent}
            DOMPurify={DOMPurify}
          />
        )}

        {/* ── Standard (card grid) layout ──────────────────────────────── */}
        {effectiveView !== 'contract' && <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8 print:px-6 print:py-4">
          <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start max-w-[1600px] mx-auto print:block">

            {/* ── Left column ──────────────────────────────────────────── */}
            <div className="space-y-6 min-w-0 print:space-y-4">

              {/* Client / Venue cards */}
              {(hasClient || hasVenue) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {hasClient && (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm print:shadow-none print:border-slate-300 print:break-inside-avoid">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">Client</span>
                      </div>
                      {(quote.client_first_name || quote.client_last_name) && (
                        <p className="text-base font-semibold text-slate-900 dark:text-white mb-1.5">
                          {[quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ')}
                        </p>
                      )}
                      {quote.client_email && <p className="text-sm text-slate-500 dark:text-slate-400">{quote.client_email}</p>}
                      {quote.client_phone && <p className="text-sm text-slate-500 dark:text-slate-400">{quote.client_phone}</p>}
                      {quote.client_address && <p className="text-sm text-slate-500 dark:text-slate-400">{quote.client_address}</p>}
                    </div>
                  )}
                  {hasVenue && (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm print:shadow-none print:border-slate-300 print:break-inside-avoid">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Venue</span>
                      </div>
                      {quote.venue_name && <p className="text-base font-semibold text-slate-900 dark:text-white mb-1.5">{quote.venue_name}</p>}
                      {quote.venue_email && <p className="text-sm text-slate-500 dark:text-slate-400">{quote.venue_email}</p>}
                      {quote.venue_phone && <p className="text-sm text-slate-500 dark:text-slate-400">{quote.venue_phone}</p>}
                      {quote.venue_address && <p className="text-sm text-slate-500 dark:text-slate-400">{quote.venue_address}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Item card grid */}
              {sectionsWithItems.length > 0 && (
                <div className="space-y-8">
                  {sectionsWithItems.map((section) => (
                    <div key={section.id}>
                      {/* Section header */}
                      {(sectionsWithItems.length > 1 || section.dateRangeLabel) && (
                        <div className="flex items-center justify-between mb-5">
                          {sectionsWithItems.length > 1 && (
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{section.title || 'Items'}</h2>
                          )}
                          {section.dateRangeLabel && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full ml-auto">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                              {section.dateRangeLabel}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Inventory item cards */}
                      {section.items.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-5 print:grid-cols-4 print:gap-2">
                          {section.items.map(item => {
                            const itemImgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
                            const unitPrice = effectivePrice(item);
                            const qty = item.quantity ?? 1;
                            return (
                              <button
                                key={item.qitem_id}
                                type="button"
                                className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl dark:hover:shadow-slate-900/60 hover:-translate-y-1 transition-all duration-200 text-left w-full print:shadow-none print:rounded-xl print:border-slate-300"
                                onClick={() => { detailOpenerRef.current = document.activeElement; setDetailItem(item); }}
                              >
                                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden print:aspect-[3/2]">
                                  {itemImgUrl ? (
                                    <img
                                      src={itemImgUrl}
                                      alt=""
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 print:transform-none"
                                      onError={e => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                                      <ImgPlaceholder size={36} />
                                    </div>
                                  )}
                                </div>
                                <div className="p-3.5">
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug mb-2.5 line-clamp-2 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                    {item.label || item.title}
                                  </p>
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{fmt(unitPrice)}</span>
                                    {qty > 1 && (
                                      <span className="text-xs font-medium text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">×{qty}</span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Custom items list */}
                      {section.customItems.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm mb-5">
                          <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {section.customItems.map(ci => {
                              const ciImgUrl = resolveImageUrl(ci.photo_url, ci.signed_photo_url);
                              return (
                                <button
                                  key={ci.id}
                                  type="button"
                                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                                  onClick={() => setDetailItem(ci)}
                                >
                                  <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                                    {ciImgUrl ? (
                                      <img src={ciImgUrl} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                                        <ImgPlaceholder size={20} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{ci.title}</p>
                                    {ci.description && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{ci.description}</p>}
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <p className="text-sm font-bold text-sky-600 dark:text-sky-400">{fmt((ci.unit_price || 0) * (ci.quantity || 1))}</p>
                                    {(ci.quantity ?? 1) > 1 && <p className="text-xs text-slate-400 dark:text-slate-500">×{ci.quantity}</p>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section subtotal */}
                      {sectionsWithItems.length > 1 && (
                        <div className="flex justify-end">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Section subtotal: <strong className="text-slate-900 dark:text-white">{fmt(section.subtotal)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Totals — mobile only (desktop has sidebar) / always shown in print */}
              <div className="lg:hidden print:block">
                <TotalsCard />
              </div>

              {/* Quote notes */}
              {quote.quote_notes && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-6 py-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <svg className="flex-shrink-0 text-amber-500 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1.5">Notes</p>
                      <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{quote.quote_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rental Terms */}
              {quote.rental_terms?.body_text && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:border-slate-300 print:break-inside-avoid">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <svg className="text-slate-400 dark:text-slate-500 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Rental Terms{quote.rental_terms.name ? ` — ${quote.rental_terms.name}` : ''}
                    </span>
                  </div>
                  <div className="px-6 py-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-h-72 overflow-y-auto whitespace-pre-wrap print:max-h-none print:overflow-visible">
                    {quote.rental_terms.body_text}
                  </div>
                </div>
              )}

              {/* Payment Policy */}
              {quote.payment_policy?.body_text && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:border-slate-300 print:break-inside-avoid">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <svg className="text-slate-400 dark:text-slate-500 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Payment Policy{quote.payment_policy.name ? ` — ${quote.payment_policy.name}` : ''}
                    </span>
                  </div>
                  <div className="px-6 py-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-h-72 overflow-y-auto whitespace-pre-wrap print:max-h-none print:overflow-visible">
                    {quote.payment_policy.body_text}
                  </div>
                </div>
              )}

              {/* Expiration notice */}
              {isExpired && (
                <div className="flex items-start gap-4 bg-orange-50 dark:bg-orange-950/30 border border-l-4 border-orange-200 border-l-orange-500 dark:border-orange-800/40 dark:border-l-orange-500 rounded-2xl px-6 py-5">
                  <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden="true">⚠</span>
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200 leading-relaxed">
                    {quote.expiration_message || 'This quote has expired. Please reach out to renew.'}
                  </p>
                </div>
              )}

              {/* Contract */}
              {!isExpired && quote.contract && (quote.contract.body_html || quote.contract.signed_at) && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm print:shadow-none print:border-slate-300 print:break-inside-avoid">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <svg className="text-slate-400 dark:text-slate-500 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contract</span>
                  </div>
                  {quote.contract.body_html && (
                    <div
                      className="px-6 py-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-h-80 overflow-y-auto border-b border-slate-100 dark:border-slate-700 print:max-h-none print:overflow-visible"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(quote.contract.body_html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'span', 'div'], ALLOWED_ATTR: ['href', 'target', 'rel'] }) }}
                    />
                  )}
                  {quote.contract.signed_at && !needsResign ? (
                    <div className="flex items-center gap-4 px-6 py-5 bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">✓</div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          Signed {new Date(quote.contract.signed_at).toLocaleString()}
                          {quote.contract.signer_name && ` by ${quote.contract.signer_name}`}.
                        </p>
                        {signature?.svg && (
                          <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                            <img
                              src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(signature.svg)))}`}
                              alt="Signature"
                              className="max-w-[280px] w-full h-auto block"
                            />
                            <div className="flex gap-3 flex-wrap mt-1.5 text-xs text-emerald-600 dark:text-emerald-500">
                              {signature.signer_ip && <span>IP {signature.signer_ip}</span>}
                              {signature.typed_name && <span>{signature.typed_name}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-6 flex flex-col gap-4 print:hidden">
                      {needsResign && (
                        <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-950/30 border border-l-4 border-orange-200 border-l-orange-500 dark:border-orange-800/40 dark:border-l-orange-500 rounded-xl px-4 py-3 text-sm font-medium text-orange-900 dark:text-orange-200 leading-relaxed">
                          Updated changes require a new signature. The prior signature stays on file.
                        </div>
                      )}
                      <input
                        type="text"
                        className="px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 max-w-sm w-full outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        aria-label="Full name (acts as your signature)"
                        placeholder="Full name (acts as your signature)"
                        autoComplete="name"
                        value={signerName}
                        onChange={e => setSignerName(e.target.value)}
                      />
                      <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400 cursor-pointer leading-relaxed">
                        <input
                          type="checkbox"
                          className="mt-0.5 w-4 h-4 flex-shrink-0 accent-sky-600 cursor-pointer"
                          checked={agreeChecked}
                          onChange={e => setAgreeChecked(e.target.checked)}
                        />
                        I have read and agree to the terms above
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-lg hover:shadow-emerald-500/25"
                          onClick={handleSignContract}
                          disabled={signing || !agreeChecked || !signerName.trim()}
                        >
                          {signing ? 'Signing…' : (needsResign ? 'Re-sign contract' : 'Sign contract')}
                        </button>
                        {signSuccess && <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium" role="status">Contract signed. Thank you!</span>}
                        {signError && <span className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">{signError}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Expired contract placeholder */}
              {isExpired && quote.contract && !quote.contract.signed_at && (
                <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-950/30 border border-l-4 border-orange-200 border-l-orange-500 dark:border-orange-800/40 dark:border-l-orange-500 rounded-2xl px-6 py-5">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200">Signature disabled — this quote has expired.</p>
                </div>
              )}

              {/* Approve success banner */}
              {approveSuccess && (
                <div className="flex items-center gap-4 px-6 py-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl" role="status">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">✓</div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Quote approved — thank you! We look forward to working with you.</p>
                </div>
              )}

              {/* Message thread */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm print:hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                  <svg className="text-slate-400 dark:text-slate-500 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Messages</span>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4">
                  {messages.length > 0 && (
                    <div className="flex flex-col gap-3 max-h-72 overflow-y-auto" ref={msgListRef}>
                      {messages.map(m => (
                        <div key={m.id} className={`max-w-[80%] ${m.direction === 'inbound' ? 'self-end' : 'self-start'}`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.direction === 'inbound' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 rounded-br-sm' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200 rounded-bl-sm'}`}>
                            <MessageBody msg={m} />
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                            {m.direction === 'inbound' ? (m.from_email || 'You') : (quote.company_name || 'Your rental company')}
                            {' · '}
                            {m.sent_at ? new Date(m.sent_at.replace(' ', 'T') + 'Z').toLocaleString() : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {msgSent && (
                    <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 rounded-xl" role="status">
                      Message sent — we'll be in touch soon.
                    </div>
                  )}
                  <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
                    <textarea
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 resize-y font-[inherit] box-border outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      rows={3}
                      placeholder="Have a question or comment about this quote? Send us a message…"
                      value={msgText}
                      onChange={e => { setMsgText(e.target.value.slice(0, 1000)); setMsgSent(false); }}
                      maxLength={1000}
                      required
                    />
                    <div className="flex justify-end items-center gap-3">
                      {msgText.length > 800 && (
                        <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{msgText.length}/1000</span>
                      )}
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-lg hover:shadow-sky-500/25"
                        disabled={msgSending || !msgText.trim()}
                      >
                        {msgSending ? 'Sending…' : 'Send message'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            </div>{/* /left column */}

            {/* ── Right: sticky sidebar ─────────────────────────────────── */}
            <div className="hidden lg:flex flex-col gap-4 lg:sticky lg:top-6 print:hidden">
              <TotalsCard />
              <div className="flex flex-col gap-2">
                <ApproveSection />
              </div>
              <button
                type="button"
                className="w-full px-5 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                onClick={() => window.print()}
              >
                Print / Save PDF
              </button>
            </div>

          </div>
        </div>}

        {/* ── Mobile sticky action bar (standard view only) ────────────── */}
        {effectiveView !== 'contract' && <div
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2.5 px-4 z-50 shadow-[0_-2px_16px_rgba(0,0,0,0.08)] print:hidden"
          style={{
            paddingTop: 12,
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(16px, env(safe-area-inset-left))',
            paddingRight: 'max(16px, env(safe-area-inset-right))',
          }}
        >
          <button
            type="button"
            className="px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
          <ApproveSection compact />
        </div>}

        {detailItem && (
          <ItemDetailModal
            item={detailItem}
            resolveImageUrl={resolveImageUrl}
            onClose={() => { setDetailItem(null); detailOpenerRef.current?.focus(); }}
            isDark={isDark}
          />
        )}

      </div>
    </div>
  );
}
