import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../api';
import s from './PublicQuotePage.module.css';

const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');

function computeTotals(items, customItems, taxRate) {
  const list = items || [];
  const equipment = list.filter(it => !isLogistics(it));
  const logistics = list.filter(it => isLogistics(it));
  const subtotal = equipment.reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const deliveryTotal = logistics.reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const ciList = customItems || [];
  const customSubtotal = ciList.reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);
  const taxableEquipment = equipment.filter(it => it.taxable !== 0).reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const taxableDelivery = logistics.filter(it => it.taxable !== 0).reduce((sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1), 0);
  const taxableCustom = ciList.filter(ci => ci.taxable !== 0).reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);
  const rate = parseFloat(taxRate) || 0;
  const tax = (taxableEquipment + taxableDelivery + taxableCustom) * (rate / 100);
  const grandTotal = subtotal + deliveryTotal + customSubtotal + tax;
  return { subtotal, deliveryTotal, customSubtotal, tax, total: grandTotal, rate };
}

function fmt(n) {
  return '$' + (n || 0).toFixed(2);
}

function ItemDetailModal({ item, resolveImageUrl, onClose }) {
  if (!item) return null;
  const name = item.label || item.title;
  const unitPrice = item.unit_price != null ? item.unit_price : 0;
  const qty = item.quantity ?? 1;
  const lineTotal = unitPrice * qty;
  const imgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
  const description = item.description || null;

  return (
    <div className={s.detailOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Item details">
      <div className={s.detailCard} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.detailClose} onClick={onClose} aria-label="Close">&times;</button>
        <div className={s.detailImageWrap}>
          {imgUrl ? (
            <img src={imgUrl} alt="" className={s.detailImage} onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <div className={s.detailImagePlaceholder} aria-hidden>&#128230;</div>
          )}
        </div>
        <h2 className={s.detailTitle}>{name}</h2>
        <div className={s.detailPriceBlock}>
          <span className={s.detailUnitPrice}>{fmt(unitPrice)}</span>
          <span className={s.detailPerUnit}>per unit</span>
          {qty > 1 && (
            <span className={s.detailLine}>
              {qty} &times; {fmt(unitPrice)} = {fmt(lineTotal)}
            </span>
          )}
        </div>
        {description && (
          <p className={s.detailDescription}>{description}</p>
        )}
      </div>
    </div>
  );
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
  const [detailItem, setDetailItem] = useState(null);
  // Live messaging
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [msgName, setMsgName] = useState('');
  const [msgEmail, setMsgEmail] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    api.getPublicQuote(token)
      .then(data => { setQuote(data); setLoading(false); })
      .catch(err => { setError(err.message || 'Not found'); setLoading(false); });
  }, [token]);

  // Live polling — refresh quote and messages every 8 seconds
  useEffect(() => {
    if (!token) return;
    const poll = () => {
      api.getPublicQuote(token).then(data => setQuote(data)).catch(() => {});
      api.getPublicMessages(token).then(d => setMessages(d.messages || [])).catch(() => {});
    };
    // Initial message load
    api.getPublicMessages(token).then(d => setMessages(d.messages || [])).catch(() => {});
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [token]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setMsgSending(true);
    try {
      await api.sendPublicMessage(token, { body_text: msgText.trim(), from_name: msgName.trim() || undefined, from_email: msgEmail.trim() || undefined });
      setMsgText('');
      setMsgSent(true);
      // Immediately reload messages
      api.getPublicMessages(token).then(d => setMessages(d.messages || [])).catch(() => {});
    } catch (err) {
      // ignore
    } finally {
      setMsgSending(false);
    }
  };

  useEffect(() => {
    if (!detailItem) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setDetailItem(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailItem]);

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

  if (!token) {
    return (
      <div className={s.statePage}>
        <div className={s.stateCard}>
          <div className={s.errorIcon}>&#9888;</div>
          <p className={s.stateTitle}>Invalid quote link</p>
          <p className={s.stateSub}>This link does not appear to be valid.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={s.statePage}>
        <div className={s.stateCard}>
          <div className={s.spinner} />
          <p className={s.stateTitle}>Loading quote&hellip;</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.statePage}>
        <div className={s.stateCard}>
          <div className={s.errorIcon}>&#9888;</div>
          <p className={s.stateTitle}>Could not load quote</p>
          <p className={s.stateSub}>{error}</p>
        </div>
      </div>
    );
  }

  const taxRate = quote.tax_rate != null ? quote.tax_rate : 0;
  const totals = computeTotals(quote.items, quote.customItems, taxRate);
  const equipmentItems = (quote.items || []).filter(it => !isLogistics(it));
  const logisticsItems = (quote.items || []).filter(it => isLogistics(it));
  const customItems = quote.customItems || [];
  const eventDate = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const isApproved = quote.status === 'approved';
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

  return (
    <div className={s.page}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className={s.hero}>
        <div className={s.heroInner}>
          {(companyLogoUrl || quote.company_name) && (
            <div className={s.companyBrand}>
              {companyLogoUrl && (
                <img
                  src={companyLogoUrl}
                  alt={quote.company_name ? `${quote.company_name} logo` : 'Company logo'}
                  className={s.companyLogo}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              {quote.company_name && (
                <span className={s.companyNameText}>{quote.company_name}</span>
              )}
            </div>
          )}
          <div className={s.companyLabel}>Quote</div>
          <h1 className={s.quoteTitle}>{quote.name}</h1>
          <div className={s.heroBadges}>
            <span className={`${s.statusBadge} ${isApproved ? s.approved : s.pending}`}>
              {isApproved ? '✓ Approved' : 'Pending approval'}
            </span>
            {eventDate && <span className={s.heroPill}>&#128197; {eventDate}</span>}
            {quote.guest_count > 0 && <span className={s.heroPill}>&#128101; {quote.guest_count} guests</span>}
          </div>
        </div>
      </div>

      <div className={s.inner}>

        {/* ── Client / Venue ─────────────────────────────── */}
        {(hasClient || hasVenue) && (
          <div className={s.section}>
            <div className={s.infoGrid}>
              {hasClient && (
                <div className={s.infoCard}>
                  <div className={s.infoLabel}>Client</div>
                  {(quote.client_first_name || quote.client_last_name) && (
                    <div className={s.infoName}>
                      {[quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ')}
                    </div>
                  )}
                  {quote.client_email && <div className={s.infoLine}>{quote.client_email}</div>}
                  {quote.client_phone && <div className={s.infoLine}>{quote.client_phone}</div>}
                  {quote.client_address && <div className={s.infoLine}>{quote.client_address}</div>}
                </div>
              )}
              {hasVenue && (
                <div className={s.infoCard}>
                  <div className={s.infoLabel}>Venue</div>
                  {quote.venue_name && <div className={s.infoName}>{quote.venue_name}</div>}
                  {quote.venue_email && <div className={s.infoLine}>{quote.venue_email}</div>}
                  {quote.venue_phone && <div className={s.infoLine}>{quote.venue_phone}</div>}
                  {quote.venue_address && <div className={s.infoLine}>{quote.venue_address}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Line Items ─────────────────────────────────── */}
        {(equipmentItems.length > 0 || logisticsItems.length > 0 || customItems.length > 0) && (
          <div className={s.section}>
            <div className={s.itemsCard}>
              <div className={s.sectionHeader}>Items</div>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th className={s.thImg}></th>
                    <th>Item</th>
                    <th className={s.right}>Qty</th>
                    <th className={s.right}>Unit price</th>
                    <th className={s.right}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentItems.map(item => {
                    const itemImgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
                    return (
                      <tr key={item.qitem_id}>
                        <td className={s.tdImg}>
                          <button type="button" className={s.itemThumbBtn} onClick={() => setDetailItem(item)}>
                            {itemImgUrl ? (
                              <img src={itemImgUrl} alt="" className={s.itemThumb} onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                              <span className={s.itemThumbPlaceholder} aria-hidden>&#128230;</span>
                            )}
                          </button>
                        </td>
                        <td>
                          <button type="button" className={s.itemNameBtn} onClick={() => setDetailItem(item)}>
                            <span className={s.itemName}>{item.label || item.title}</span>
                          </button>
                        </td>
                        <td className={s.right}>{item.quantity ?? 1}</td>
                        <td className={s.right}>{fmt(item.unit_price)}</td>
                        <td className={s.right}>{fmt((item.unit_price || 0) * (item.quantity || 1))}</td>
                      </tr>
                    );
                  })}

                  {logisticsItems.length > 0 && (
                    <>
                      <tr className={s.groupDivider}>
                        <td colSpan={5}>Delivery &amp; Pickup</td>
                      </tr>
                      {logisticsItems.map(item => {
                        const itemImgUrl = resolveImageUrl(item.photo_url, item.signed_photo_url);
                        return (
                          <tr key={item.qitem_id}>
                            <td className={s.tdImg}>
                              <button type="button" className={s.itemThumbBtn} onClick={() => setDetailItem(item)}>
                                {itemImgUrl ? (
                                  <img src={itemImgUrl} alt="" className={s.itemThumb} onError={e => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <span className={s.itemThumbPlaceholder} aria-hidden>&#128230;</span>
                                )}
                              </button>
                            </td>
                            <td>
                              <button type="button" className={s.itemNameBtn} onClick={() => setDetailItem(item)}>
                                <span className={s.itemName}>{item.label || item.title}</span>
                              </button>
                            </td>
                            <td className={s.right}>{item.quantity ?? 1}</td>
                            <td className={s.right}>{fmt(item.unit_price)}</td>
                            <td className={s.right}>{fmt((item.unit_price || 0) * (item.quantity || 1))}</td>
                          </tr>
                        );
                      })}
                    </>
                  )}

                  {customItems.length > 0 && (
                    <>
                      <tr className={s.groupDivider}>
                        <td colSpan={5}>Other</td>
                      </tr>
                      {customItems.map(ci => {
                        const ciImgUrl = resolveImageUrl(ci.photo_url, ci.signed_photo_url);
                        return (
                          <tr key={ci.id}>
                            <td className={s.tdImg}>
                              <button type="button" className={s.itemThumbBtn} onClick={() => setDetailItem(ci)}>
                                {ciImgUrl ? (
                                  <img src={ciImgUrl} alt="" className={s.itemThumb} onError={e => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <span className={s.itemThumbPlaceholder} aria-hidden>&#128230;</span>
                                )}
                              </button>
                            </td>
                            <td>
                              <button type="button" className={s.itemNameBtn} onClick={() => setDetailItem(ci)}>
                                <span className={s.itemName}>{ci.title}</span>
                              </button>
                            </td>
                            <td className={s.right}>{ci.quantity ?? 1}</td>
                            <td className={s.right}>{fmt(ci.unit_price)}</td>
                            <td className={s.right}>{fmt((ci.unit_price || 0) * (ci.quantity || 1))}</td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Totals ─────────────────────────────────────── */}
        <div className={s.section}>
          <div className={s.totalsWrap}>
            <div className={s.totalsCard}>
              {totals.subtotal > 0 && (
                <div className={s.totalsRow}>
                  <span>Equipment subtotal</span>
                  <span>{fmt(totals.subtotal)}</span>
                </div>
              )}
              {totals.deliveryTotal > 0 && (
                <div className={s.totalsRow}>
                  <span>Delivery &amp; pickup</span>
                  <span>{fmt(totals.deliveryTotal)}</span>
                </div>
              )}
              {totals.customSubtotal > 0 && (
                <div className={s.totalsRow}>
                  <span>Other items</span>
                  <span>{fmt(totals.customSubtotal)}</span>
                </div>
              )}
              {totals.rate > 0 && (
                <div className={s.totalsRow}>
                  <span>Tax ({totals.rate}%)</span>
                  <span>{fmt(totals.tax)}</span>
                </div>
              )}
              <hr className={s.totalsDivider} />
              <div className={s.totalRow}>
                <span>Total</span>
                <span>{fmt(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quote notes ────────────────────────────────── */}
        {quote.quote_notes && (
          <div className={s.section}>
            <div className={s.notes}><strong>Notes:&nbsp;</strong>{quote.quote_notes}</div>
          </div>
        )}

        {/* ── Contract ───────────────────────────────────── */}
        {quote.contract && (quote.contract.body_html || quote.contract.signed_at) && (
          <div className={s.section}>
            <div className={s.contractCard}>
              <div className={s.sectionHeader}>Contract</div>

              {quote.contract.body_html && (
                <div
                  className={s.contractBody}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(quote.contract.body_html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'span', 'div'], ALLOWED_ATTR: ['href', 'target', 'rel'] }) }}
                />
              )}

              {quote.contract.signed_at ? (
                <div className={s.signedBanner}>
                  <div className={s.signIcon}>&#10003;</div>
                  <span>
                    Signed {new Date(quote.contract.signed_at).toLocaleString()}
                    {quote.contract.signer_name && ` by ${quote.contract.signer_name}`}.
                  </span>
                </div>
              ) : (
                <div className={s.signForm}>
                  <label className={s.agreeLabel}>
                    <input
                      type="checkbox"
                      checked={agreeChecked}
                      onChange={e => setAgreeChecked(e.target.checked)}
                    />
                    I have read and agree to the terms above
                  </label>
                  <input
                    type="text"
                    className={s.signInput}
                    placeholder="Full name (acts as your signature)"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      type="button"
                      className={s.signBtn}
                      onClick={handleSignContract}
                      disabled={signing || !agreeChecked || !signerName.trim()}
                    >
                      {signing ? 'Signing\u2026' : 'Sign contract'}
                    </button>
                    {signSuccess && <span className={s.signSuccess}>Contract signed. Thank you!</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Approve success banner ──────────────────────── */}
        {approveSuccess && (
          <div className={s.section}>
            <div className={s.approveBanner}>
              <div className={s.signIcon}>&#10003;</div>
              Quote approved — thank you! We look forward to working with you.
            </div>
          </div>
        )}

        {/* ── Live message thread ─────────────────────────── */}
        <div className={s.section}>
          <div className={s.msgCard}>
            <div className={s.sectionHeader}>Messages</div>

            {messages.length > 0 && (
              <div className={s.msgList}>
                {messages.map(m => (
                  <div key={m.id} className={`${s.msgBubble} ${m.direction === 'inbound' ? s.msgIn : s.msgOut}`}>
                    <div className={s.msgBubbleBody}>{m.body_text || m.subject || ''}</div>
                    <div className={s.msgBubbleMeta}>
                      {m.direction === 'inbound' ? (m.from_email || 'You') : 'Your rental company'}
                      {' · '}
                      {m.sent_at ? new Date(m.sent_at.replace(' ', 'T') + 'Z').toLocaleString() : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {msgSent && (
              <div className={s.msgSentNote}>Message sent — we'll be in touch soon.</div>
            )}

            <form onSubmit={handleSendMessage} className={s.msgForm}>
              <div className={s.msgFormTop}>
                <input
                  className={s.msgInput}
                  type="text"
                  placeholder="Your name (optional)"
                  value={msgName}
                  onChange={e => setMsgName(e.target.value)}
                />
                <input
                  className={s.msgInput}
                  type="email"
                  placeholder="Your email (optional)"
                  value={msgEmail}
                  onChange={e => setMsgEmail(e.target.value)}
                />
              </div>
              <textarea
                className={s.msgTextarea}
                rows={3}
                placeholder="Have a question or comment about this quote? Send us a message…"
                value={msgText}
                onChange={e => { setMsgText(e.target.value); setMsgSent(false); }}
                required
              />
              <div className={s.msgFormActions}>
                <button type="submit" className={s.msgSendBtn} disabled={msgSending || !msgText.trim()}>
                  {msgSending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>{/* /inner */}

      {/* ── Sticky action bar ──────────────────────────────── */}
      <div className={s.actionBar}>
        <div className={s.actionBarInner}>
          <button className={s.btnPrint} onClick={() => window.print()}>
            Print / Save PDF
          </button>
          {!isApproved && (
            <button
              className={s.btnApprove}
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? 'Approving\u2026' : 'Approve this Quote'}
            </button>
          )}
        </div>
      </div>

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          resolveImageUrl={resolveImageUrl}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
