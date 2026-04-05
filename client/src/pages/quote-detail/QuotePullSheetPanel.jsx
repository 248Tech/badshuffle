import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function SummaryStat({ label, value }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function QuotePullSheetPanel({ pullSheet, onCopyLink }) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (!pullSheet?.pull_sheet?.href) {
      setQrUrl('');
      return undefined;
    }
    let cancelled = false;
    const absoluteHref = `${window.location.origin}${pullSheet.pull_sheet.href}`;
    api.getBarcodeSvgData({
      format: 'qrcode',
      value: absoluteHref,
      label: pullSheet.pull_sheet.scan_code || '',
    }).then((data) => {
      if (cancelled) return;
      const svg = String(data?.svg || '');
      if (!svg) {
        setQrUrl('');
        return;
      }
      setQrUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }).catch(() => {
      if (!cancelled) setQrUrl('');
    });
    return () => {
      cancelled = true;
    };
  }, [pullSheet]);

  if (!pullSheet) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ color: 'var(--color-text-muted)' }}>Loading pull sheet…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260, flex: '1 1 360px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-text-muted)' }}>
              Pull Sheet
            </div>
            <h3 style={{ margin: '6px 0 10px', fontSize: 28, lineHeight: 1.1 }}>{pullSheet.quote?.name || 'Untitled project'}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--color-text-muted)', fontSize: 13 }}>
              {pullSheet.quote?.event_date ? <span>Event: {pullSheet.quote.event_date}</span> : null}
              {pullSheet.quote?.delivery_date ? <span>Delivery: {pullSheet.quote.delivery_date}</span> : null}
              {pullSheet.quote?.pickup_date ? <span>Pickup: {pullSheet.quote.pickup_date}</span> : null}
              <span>Code: {pullSheet.pull_sheet?.scan_code}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                Print / Save PDF
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCopyLink}>
                Copy pull-sheet link
              </button>
            </div>
          </div>
          <div style={{ width: 220, maxWidth: '100%', border: '1px solid var(--color-border)', borderRadius: 18, padding: 12, background: '#fff' }}>
            {qrUrl ? (
              <img src={qrUrl} alt={`QR code for ${pullSheet.pull_sheet?.scan_code || 'pull sheet'}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
            ) : (
              <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                QR unavailable
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <SummaryStat label="Rows" value={pullSheet.summary?.total_rows || 0} />
          <SummaryStat label="Total qty" value={pullSheet.summary?.total_quantity || 0} />
          <SummaryStat label="Quoted" value={pullSheet.summary?.quoted || 0} />
          <SummaryStat label="Accessories" value={pullSheet.summary?.accessory || 0} />
          <SummaryStat label="Associated" value={pullSheet.summary?.associated || 0} />
          <SummaryStat label="Custom" value={pullSheet.summary?.custom || 0} />
        </div>
      </div>

      {pullSheet.sections?.map((section) => (
        <div key={section.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{section.title || 'Quote Items'}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{section.rows.length} internal rows</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 1, background: 'var(--color-border)' }}>
            {section.rows.map((row) => (
              <div key={row.row_key} style={{ background: 'var(--color-surface)', padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>{row.title}</strong>
                    <span className="badge" style={{ textTransform: 'capitalize' }}>{row.source_type}</span>
                    {row.scan_code ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{row.scan_code}</span> : null}
                  </div>
                  {row.parent_title ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Included for: {row.parent_title}
                    </div>
                  ) : null}
                  {row.internal_notes ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6, whiteSpace: 'pre-wrap' }}>
                      {row.internal_notes}
                    </div>
                  ) : null}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>×{row.quantity}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
