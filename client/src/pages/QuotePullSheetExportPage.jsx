import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

function SummaryStat({ label, value }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function useQrUrl(value, label) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (!value) {
      setQrUrl('');
      return undefined;
    }
    let cancelled = false;
    api.getBarcodeSvgData({
      format: 'qrcode',
      value,
      label: label || '',
    }).then((data) => {
      if (cancelled) return;
      const svg = String(data?.svg || '');
      setQrUrl(svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '');
    }).catch(() => {
      if (!cancelled) setQrUrl('');
    });
    return () => {
      cancelled = true;
    };
  }, [label, value]);

  return qrUrl;
}

function PullSheetRows({ rows, showQuotes = false }) {
  return (
    <div style={{ display: 'grid', gap: 1, background: 'var(--color-border)' }}>
      {rows.map((row) => (
        <div key={row.row_key} style={{ background: 'var(--color-surface)', padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'start' }}>
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
            {showQuotes && row.quote_refs?.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {row.quote_refs.map((quoteRef) => (
                  <span key={`${row.row_key}:${quoteRef.quote_id}`} className="badge" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text)' }}>
                    {quoteRef.quote_name} x{quoteRef.quantity}
                  </span>
                ))}
              </div>
            ) : null}
            {row.internal_notes ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6, whiteSpace: 'pre-wrap' }}>
                {row.internal_notes}
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>x{row.quantity}</div>
        </div>
      ))}
    </div>
  );
}

function CombinedPullSheetView({ data }) {
  const qrUrl = useQrUrl(data?.pull_sheet?.href ? `${window.location.origin}${data.pull_sheet.href}` : '', data?.pull_sheet?.scan_code || '');

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280, flex: '1 1 360px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-text-muted)' }}>
              Aggregate Pull Sheet
            </div>
            <h1 style={{ margin: '6px 0 10px', fontSize: 30, lineHeight: 1.05 }}>Combined pull for {data.summary?.total_projects || 0} project(s)</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: 'var(--color-text-muted)', fontSize: 13 }}>
              {(data.quotes || []).map((quote) => (
                <span key={quote.id} className="badge" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text)' }}>
                  {quote.name}
                </span>
              ))}
            </div>
          </div>
          <div style={{ width: 220, maxWidth: '100%', border: '1px solid var(--color-border)', borderRadius: 18, padding: 12, background: '#fff' }}>
            {qrUrl ? (
              <img src={qrUrl} alt="QR code for aggregate pull sheet" style={{ width: '100%', height: 'auto', display: 'block' }} />
            ) : (
              <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                QR unavailable
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <SummaryStat label="Projects" value={data.summary?.total_projects || 0} />
        <SummaryStat label="Rows" value={data.summary?.total_rows || 0} />
        <SummaryStat label="Total qty" value={data.summary?.total_quantity || 0} />
        <SummaryStat label="Quoted" value={data.summary?.quoted || 0} />
        <SummaryStat label="Accessories" value={data.summary?.accessory || 0} />
        <SummaryStat label="Associated" value={data.summary?.associated || 0} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Combined pull</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>All required rows grouped across the selected projects.</div>
        </div>
        <PullSheetRows rows={data.rows || []} showQuotes />
      </div>
    </div>
  );
}

function SinglePullSheetView({ sheet }) {
  const qrUrl = useQrUrl(
    sheet?.pull_sheet?.href ? `${window.location.origin}${sheet.pull_sheet.href}` : '',
    sheet?.pull_sheet?.scan_code || ''
  );

  return (
    <section className="card" style={{ padding: 20, display: 'grid', gap: 16, breakAfter: 'page' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, flex: '1 1 360px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-text-muted)' }}>
            Pull Sheet
          </div>
          <h2 style={{ margin: '6px 0 10px', fontSize: 28, lineHeight: 1.08 }}>{sheet.quote?.name || 'Untitled project'}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: 'var(--color-text-muted)', fontSize: 13 }}>
            {sheet.quote?.event_date ? <span>Event: {sheet.quote.event_date}</span> : null}
            {sheet.quote?.delivery_date ? <span>Delivery: {sheet.quote.delivery_date}</span> : null}
            {sheet.quote?.pickup_date ? <span>Pickup: {sheet.quote.pickup_date}</span> : null}
          </div>
        </div>
        <div style={{ width: 180, maxWidth: '100%', border: '1px solid var(--color-border)', borderRadius: 16, padding: 10, background: '#fff' }}>
          {qrUrl ? (
            <img src={qrUrl} alt={`QR code for ${sheet.pull_sheet?.scan_code || 'pull sheet'}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
          ) : (
            <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              QR unavailable
            </div>
          )}
        </div>
      </div>

      {(sheet.sections || []).map((section) => (
        <div key={`${sheet.quote?.id}:${section.id}`} style={{ display: 'grid', gap: 1, background: 'var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: 'var(--color-bg-elevated)', padding: '12px 16px' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{section.title || 'Quote Items'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{section.rows.length} internal rows</div>
          </div>
          <PullSheetRows rows={section.rows || []} />
        </div>
      ))}
    </section>
  );
}

export default function QuotePullSheetExportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [aggregate, setAggregate] = useState(null);
  const [individualSheets, setIndividualSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ids = useMemo(
    () => String(searchParams.get('ids') || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
    [searchParams]
  );
  const mode = searchParams.get('mode') === 'individual' ? 'individual' : 'aggregate';

  useEffect(() => {
    if (!ids.length) {
      setError('Select at least one project to export pull sheets.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api.getAggregateQuotePullSheet(ids),
      Promise.all(ids.map((id) => api.getQuotePullSheet(id))),
    ]).then(([aggregateResponse, individualResponse]) => {
      if (cancelled) return;
      setAggregate(aggregateResponse);
      setIndividualSheets(individualResponse);
    }).catch((err) => {
      if (!cancelled) setError(err?.message || 'Unable to load pull sheets');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-text-muted)', fontWeight: 700 }}>
            Pull Sheet Export
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Print one combined pull for overlapping jobs or export each selected project pull sheet in sequence.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={`btn btn-sm ${mode === 'aggregate' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSearchParams({ ids: ids.join(','), mode: 'aggregate' })}>
            Combined pull
          </button>
          <button type="button" className={`btn btn-sm ${mode === 'individual' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSearchParams({ ids: ids.join(','), mode: 'individual' })}>
            By project
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/quotes')}>
            Back to projects
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={loading || !!error}>
            Print / Save PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 20, color: 'var(--color-text-muted)' }}>Loading pull sheets…</div>
      ) : null}
      {!loading && error ? (
        <div className="card" style={{ padding: 20, color: 'var(--color-danger)' }}>{error}</div>
      ) : null}
      {!loading && !error && mode === 'aggregate' && aggregate ? <CombinedPullSheetView data={aggregate} /> : null}
      {!loading && !error && mode === 'individual' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {individualSheets.map((sheet) => (
            <SinglePullSheetView key={sheet.quote?.id} sheet={sheet} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
