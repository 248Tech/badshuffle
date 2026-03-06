import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { api } from '../api';
import styles from './QuoteExport.module.css';

export default function QuoteExport({ quote, settings = {}, totals = null, customItems = [] }) {
  const ref = useRef(null);
  const [exporting, setExporting] = useState(false);

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
  const hasVenue = quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address || quote.venue_contact || quote.venue_notes;
  const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');
  const equipmentItems = (quote.items || []).filter(it => !isLogistics(it));
  const logisticsItems = (quote.items || []).filter(it => isLogistics(it));
  const showTotals = totals && (totals.subtotal > 0 || totals.deliveryTotal > 0 || (totals.customSubtotal || 0) > 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.exportActions}>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? <><span className="spinner" /> Exporting…</> : '📷 Export as PNG'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handlePrint}>
          Print / Save as PDF
        </button>
      </div>

      {/* Hidden render target; shown when printing */}
      <div className={`${styles.exportTarget} quote-print-area`} ref={ref}>
        <div className={styles.exportHeader}>
          {companyName && (
            <div className={styles.companyInfo}>
              <span className={styles.companyName}>{companyName}</span>
              {companyEmail && <span className={styles.companyEmail}>{companyEmail}</span>}
            </div>
          )}
          <h1 className={styles.exportTitle}>{quote.name}</h1>
          <div className={styles.exportMeta}>
            {date && <span>📅 {date}</span>}
            {quote.guest_count > 0 && <span>👥 {quote.guest_count} guests</span>}
          </div>
          {quote.notes && <p className={styles.exportNotes}>{quote.notes}</p>}
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

        <div className={styles.exportGrid}>
          {equipmentItems.map(item => (
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
                  <img src="/placeholder.png" alt="" className={styles.exportImg} aria-hidden />
                )}
              </div>
              <div className={styles.exportItemBody}>
                <span className={styles.exportItemTitle}>
                  {item.label || item.title}
                </span>
                {item.quantity > 1 && (
                  <span className={styles.exportQty}>×{item.quantity}</span>
                )}
              </div>
              {item.unit_price > 0 && (
                <div className={styles.exportItemPrice}>
                  ${(item.unit_price * item.quantity).toFixed(2)}
                </div>
              )}
            </div>
          ))}
        </div>

        {customItems.length > 0 && (
          <div className={styles.exportLogistics}>
            <h4 className={styles.exportLogisticsTitle}>Custom Items</h4>
            <div className={styles.exportLogisticsList}>
              {customItems.map(ci => (
                <div key={ci.id} className={styles.exportLogisticsItem}>
                  <span>{ci.title} ×{ci.quantity || 1}</span>
                  {ci.unit_price > 0 && <span>${((ci.unit_price || 0) * (ci.quantity || 1)).toFixed(2)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {logisticsItems.length > 0 && (
          <div className={styles.exportLogistics}>
            <h4 className={styles.exportLogisticsTitle}>Logistics (delivery / pickup)</h4>
            <div className={styles.exportLogisticsList}>
              {logisticsItems.map(item => (
                <div key={item.qitem_id} className={styles.exportLogisticsItem}>
                  <span>{item.label || item.title} ×{item.quantity || 1}</span>
                  {item.unit_price > 0 && <span>${(item.unit_price * (item.quantity || 1)).toFixed(2)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

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
}
