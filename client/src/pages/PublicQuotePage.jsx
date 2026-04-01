import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import MessageBody from '../components/messages/MessageBody.jsx';
import { computeTotals, effectivePrice } from '../lib/quoteTotals.js';
import { sanitizeContractHtml } from '../lib/sanitizeHtml.js';
import s from './PublicQuotePage.module.css'; // spinner keyframes + detailOverlay animation

const PublicQuoteContractView = lazy(() => import('../components/public-quote/PublicQuoteContractView.jsx'));
const PublicQuoteItemDetailModal = lazy(() => import('../components/public-quote/PublicQuoteItemDetailModal.jsx'));

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
    if (/^\d+$/.test(str)) return null;
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
          <Suspense fallback={<div className="px-4 py-10 sm:px-6 lg:px-8"><div className={s.spinner} /></div>}>
            <PublicQuoteContractView
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
            />
          </Suspense>
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
                      dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(quote.contract.body_html) }}
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
          <Suspense fallback={null}>
            <PublicQuoteItemDetailModal
              item={detailItem}
              resolveImageUrl={resolveImageUrl}
              onClose={() => { setDetailItem(null); detailOpenerRef.current?.focus(); }}
              isDark={isDark}
            />
          </Suspense>
        )}

      </div>
    </div>
  );
}
