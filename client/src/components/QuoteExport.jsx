import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { api } from '../api';
import { effectivePrice } from '../lib/quoteTotals.js';
import styles from './QuoteExport.module.css';

const QuoteExport = forwardRef(function QuoteExport({ quote, settings = {}, totals = null, customItems = [], visibleItems = null }, fwdRef) {
  const ref = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [, setServeEpoch] = useState(0);
  const itemsForExport = visibleItems ?? quote.items ?? [];
  const sections = (quote.sections && quote.sections.length > 0) ? quote.sections : [{ id: 'default', title: 'Quote Items' }];

  const handleExport = async () => {
    if (!ref.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(ref.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `${quote.name.replace(/[^a-z0-9]/gi, '_')}_quote.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const date = quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString()
    : null;

  const companyName = settings.company_name || '';
  const companyEmail = settings.company_email || '';
  const companyLogo = settings.company_logo;
  const companyLogoUrl = companyLogo
    ? /^\d+$/.test(String(companyLogo))
      ? `${window.location.origin}${api.fileServeUrl(companyLogo)}`
      : String(companyLogo).startsWith('http')
        ? api.proxyImageUrl(companyLogo)
        : companyLogo
    : null;

  const exportPhotoKey =
    (itemsForExport || []).map((i) => i.photo_url).join('|') +
    '::' +
    (customItems || []).map((c) => c.photo_url).join('|');
  useEffect(() => {
    const ids = [];
    if (companyLogo && /^\d+$/.test(String(companyLogo))) ids.push(String(companyLogo));
    for (const it of itemsForExport) {
      const p = it.photo_url;
      if (p != null && /^\d+$/.test(String(p).trim())) ids.push(String(p).trim());
    }
    for (const ci of customItems || []) {
      const p = ci.photo_url;
      if (p != null && /^\d+$/.test(String(p).trim())) ids.push(String(p).trim());
    }
    if (!ids.length) return;
    api.prefetchFileServeUrls(ids).then(() => setServeEpoch((e) => e + 1)).catch(() => {});
  }, [companyLogo, exportPhotoKey]);
  const hasClient = quote.client_first_name || quote.client_last_name || quote.client_email || quote.client_phone || quote.client_address;
  const hasVenue = quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address || quote.venue_contact || quote.venue_notes;
  const showTotals = totals && (totals.subtotal > 0 || totals.deliveryTotal > 0 || (totals.customSubtotal || 0) > 0);
  const formatDateRange = (start, end) => {
    if (!start && !end) return null;
    const formatOne = (value) => new Date(`${value}T00:00:00`).toLocaleDateString();
    if (start && end) return `${formatOne(start)} - ${formatOne(end)}`;
    return formatOne(start || end);
  };

  const sectionGroups = sections
    .map((section, index) => {
      const fallbackSectionId = sections[0]?.id ?? 'default';
      const sectionItems = itemsForExport.filter((item) => String(item.section_id || fallbackSectionId) === String(section.id));
      const sectionCustomItems = customItems.filter((item) => String(item.section_id || fallbackSectionId) === String(section.id));
      const subtotal = sectionItems.reduce((sum, item) => sum + (effectivePrice(item) * (item.quantity || 1)), 0)
        + sectionCustomItems.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 1)), 0);
      return {
        ...section,
        title: section.title || `Quote Items ${index + 1}`,
        dateRangeLabel: formatDateRange(section.rental_start, section.rental_end),
        items: sectionItems,
        customItems: sectionCustomItems,
        subtotal,
      };
    })
    .filter((section) => section.items.length > 0 || section.customItems.length > 0);

  const handlePrint = () => {
    window.print();
  };

  useImperativeHandle(fwdRef, () => ({ handleExport, handlePrint }));

  return (
    <div className={styles.wrapper}>
      <div className={styles.exportActions}>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? <><span className="spinner" /> Exporting…</> : <><span aria-hidden="true">📷</span> Export as PNG</>}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handlePrint}>
          Print / Save as PDF
        </button>
      </div>

      {/* Hidden render target; shown when printing */}
      <div className={`${styles.exportTarget} quote-print-area`} ref={ref}>
        <div className={styles.exportHeader}>
          <div className={styles.exportHeaderTop}>
            {(companyLogoUrl || companyName) && (
              <div className={styles.companyBrand}>
                {companyLogoUrl && (
                  <img
                    src={companyLogoUrl}
                    alt={companyName ? `${companyName} logo` : 'Company logo'}
                    className={styles.companyLogo}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                {companyName && <span className={styles.companyName}>{companyName}</span>}
              </div>
            )}
            {companyEmail && <span className={styles.companyEmail}>{companyEmail}</span>}
          </div>
          <h1 className={styles.exportTitle}>{quote.name}</h1>
          <div className={styles.exportMeta}>
            {date && <span><span aria-hidden="true">📅</span> {date}</span>}
            {quote.guest_count > 0 && <span><span aria-hidden="true">👥</span> {quote.guest_count} guests</span>}
          </div>
          {quote.notes && <p className={styles.exportNotes}>{quote.notes}</p>}
          {hasClient && (
            <div className={styles.exportClient}>
              <h4 className={styles.exportBlockTitle}>Client</h4>
              <div className={styles.exportBlockGrid}>
                {(quote.client_first_name || quote.client_last_name) && (
                  <span><strong>Name:</strong> {[quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ')}</span>
                )}
                {quote.client_email && <span><strong>Email:</strong> {quote.client_email}</span>}
                {quote.client_phone && <span><strong>Phone:</strong> {quote.client_phone}</span>}
                {quote.client_address && <span><strong>Address:</strong> {quote.client_address}</span>}
              </div>
            </div>
          )}
          {hasVenue && (
            <div className={styles.exportVenue}>
              <h4 className={styles.exportVenueTitle}>Venue information</h4>
              <div className={styles.exportVenueGrid}>
                {quote.venue_name && <span><strong>Name:</strong> {quote.venue_name}</span>}
                {quote.venue_email && <span><strong>Email:</strong> {quote.venue_email}</span>}
                {quote.venue_phone && <span><strong>Phone:</strong> {quote.venue_phone}</span>}
                {quote.venue_address && <span><strong>Address:</strong> {quote.venue_address}</span>}
                {quote.venue_contact && <span><strong>Contact:</strong> {quote.venue_contact}</span>}
                {quote.venue_notes && <span><strong>Notes:</strong> {quote.venue_notes}</span>}
              </div>
            </div>
          )}
          {quote.quote_notes && <p className={styles.exportNotes}><strong>Quote notes:</strong> {quote.quote_notes}</p>}
        </div>

        <div className={styles.exportSections}>
          {sectionGroups.map((section) => (
            <section key={section.id} className={styles.exportSection}>
              <div className={styles.exportSectionHeader}>
                <div>
                  <h4 className={styles.exportSectionTitle}>{section.title}</h4>
                  {section.dateRangeLabel && <div className={styles.exportSectionDates}>{section.dateRangeLabel}</div>}
                </div>
              </div>

              <div className={styles.exportGrid}>
                {section.items.map(item => {
                  const unitPrice = effectivePrice(item);
                  return (
                    <div key={item.qitem_id} className={styles.exportItem}>
                      <div className={styles.exportImgWrapper}>
                        {item.photo_url ? (
                          <img
                            src={api.proxyImageUrl(item.photo_url)}
                            alt={item.title}
                            className={styles.exportImg}
                            crossOrigin="anonymous"
                            onError={e => { e.target.src = '/placeholder.png'; }}
                          />
                        ) : (
                          <img src="/placeholder.png" alt="" className={styles.exportImg} aria-hidden="true" />
                        )}
                      </div>
                      <div className={styles.exportItemBody}>
                        <span className={styles.exportItemTitle}>{item.label || item.title}</span>
                        {item.quantity > 1 && <span className={styles.exportQty}>×{item.quantity}</span>}
                      </div>
                      {item.description && <div className={styles.exportItemDescription}>{item.description}</div>}
                      {unitPrice > 0 && (
                        <div className={styles.exportItemPrice}>
                          ${((unitPrice || 0) * (item.quantity || 1)).toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {section.customItems.map(ci => (
                  <div key={`custom-${ci.id}`} className={styles.exportItem}>
                    <div className={styles.exportImgWrapper}>
                      {ci.photo_url ? (
                        <img
                          src={api.proxyImageUrl(ci.photo_url)}
                          alt={ci.title}
                          className={styles.exportImg}
                          crossOrigin="anonymous"
                          onError={e => { e.target.src = '/placeholder.png'; }}
                        />
                      ) : (
                        <img src="/placeholder.png" alt="" className={styles.exportImg} aria-hidden="true" />
                      )}
                    </div>
                    <div className={styles.exportItemBody}>
                      <span className={styles.exportItemTitle}>{ci.title}</span>
                      {(ci.quantity || 1) > 1 && <span className={styles.exportQty}>×{ci.quantity || 1}</span>}
                    </div>
                    {ci.description && <div className={styles.exportItemDescription}>{ci.description}</div>}
                    {(ci.unit_price || 0) > 0 && (
                      <div className={styles.exportItemPrice}>
                        ${((ci.unit_price || 0) * (ci.quantity || 1)).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.exportSectionSubtotal}>
                <span>Section subtotal</span>
                <span>${section.subtotal.toFixed(2)}</span>
              </div>
            </section>
          ))}
        </div>

        {showTotals && (
          <div className={styles.exportTotals}>
            {totals.subtotal > 0 && (
              <div className={styles.exportTotalsRow}>
                <span>Subtotal</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
            )}
            {(totals.customSubtotal || 0) > 0 && (
              <div className={styles.exportTotalsRow}>
                <span>Custom items</span>
                <span>${totals.customSubtotal.toFixed(2)}</span>
              </div>
            )}
            {totals.deliveryTotal > 0 && (
              <div className={styles.exportTotalsRow}>
                <span>Delivery total</span>
                <span>${totals.deliveryTotal.toFixed(2)}</span>
              </div>
            )}
            {totals.rate > 0 && (
              <div className={styles.exportTotalsRow}>
                <span>Tax ({totals.rate}%)</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
            )}
            <div className={`${styles.exportTotalsRow} ${styles.exportTotalsTotal}`}>
              <span>Grand total</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className={styles.exportFooter}>
          Generated by BadShuffle
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .quote-print-area, .quote-print-area * { visibility: visible; }
          .quote-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .exportActions, .exportActions * { display: none !important; }
        }
      `}</style>
    </div>
  );
});

export default QuoteExport;
