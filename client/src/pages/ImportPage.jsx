import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './ImportPage.module.css';

const STEPS = ['Enter Source', 'Map Columns', 'Import'];

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// ── Inventory import (existing) ────────────────────────────────────────────

function InventoryImport() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep]               = useState(0);
  const [activeTab, setActiveTab]     = useState('url');
  const [url, setUrl]                 = useState('');
  const [preview, setPreview]         = useState(null);
  const [uploadedRows, setUploadedRows] = useState(null);
  const [titleCol, setTitleCol]       = useState('');
  const [photoCol, setPhotoCol]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [isDragging, setIsDragging]   = useState(false);

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const data = await api.previewSheet(url.trim());
      setPreview(data); setUploadedRows(null);
      setTitleCol(data.columns[0] || ''); setPhotoCol(''); setStep(1);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleFile = async (file) => {
    if (!file) return;
    const filename = file.name;
    const ext = filename.split('.').pop().toLowerCase();
    setLoading(true);
    try {
      if (ext === 'gsheet') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const sheetUrl = parsed.url || parsed.spreadsheetUrl;
        if (!sheetUrl) throw new Error('.gsheet file does not contain a URL');
        setUrl(sheetUrl); setActiveTab('url');
        const data = await api.previewSheet(sheetUrl);
        setPreview(data); setUploadedRows(null);
        setTitleCol(data.columns[0] || ''); setPhotoCol(''); setStep(1);
      } else if (ext === 'csv') {
        const text = await file.text();
        const data = await api.uploadSheet({ filename, data: text });
        setPreview(data); setUploadedRows(data.rows);
        setTitleCol(data.columns[0] || ''); setPhotoCol(''); setStep(1);
      } else {
        const buffer = await file.arrayBuffer();
        const base64 = toBase64(buffer);
        const data = await api.uploadSheet({ filename, data: base64 });
        setPreview(data); setUploadedRows(data.rows);
        setTitleCol(data.columns[0] || ''); setPhotoCol(''); setStep(1);
      }
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const onFileInputChange = (e) => { handleFile(e.target.files[0]); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!titleCol) return toast.error('Select a title column');
    setLoading(true);
    try {
      let data;
      if (uploadedRows) {
        data = await api.importSheetData({ rows: uploadedRows, title_column: titleCol, photo_column: photoCol || null });
      } else {
        data = await api.importSheet({ url: url.trim(), title_column: titleCol, photo_column: photoCol || null });
      }
      setResult(data); setStep(2);
      toast.success(`Import complete: ${data.imported} new, ${data.updated} updated`);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const reset = () => {
    setStep(0); setActiveTab('url'); setUrl(''); setPreview(null);
    setUploadedRows(null); setTitleCol(''); setPhotoCol(''); setResult(null);
  };

  return (
    <>
      <div className={styles.stepper}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className={`${styles.step} ${i <= step ? styles.stepActive : ''}`}>
              <span className={styles.stepNum}>{i + 1}</span>
              <span className={styles.stepLabel}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={styles.stepLine} />}
          </React.Fragment>
        ))}
      </div>

      <div className={`card ${styles.card}`}>
        {step === 0 && (
          <div className={styles.form}>
            <div className={styles.tabs}>
              <button type="button" className={`${styles.tab} ${activeTab === 'url' ? styles.tabActive : ''}`} onClick={() => setActiveTab('url')}>Google Sheet URL</button>
              <button type="button" className={`${styles.tab} ${activeTab === 'file' ? styles.tabActive : ''}`} onClick={() => setActiveTab('file')}>Upload File</button>
            </div>
            {activeTab === 'url' && (
              <form onSubmit={handlePreview} className={styles.tabContent}>
                <div className="form-group">
                  <label>Google Sheets URL</label>
                  <input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                </div>
                <div className={styles.tip}>💡 Tip: In Google Sheets, go to <strong>File → Share → Publish to web</strong>, select CSV format, then copy the spreadsheet URL.</div>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <><span className="spinner" /> Fetching…</> : 'Preview →'}</button>
              </form>
            )}
            {activeTab === 'file' && (
              <div className={styles.tabContent}>
                <label className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
                  {loading ? <><span className="spinner" /> Reading file…</> : (
                    <><span className={styles.dropIcon}>📂</span>
                    <span className={styles.dropText}>Drag &amp; drop a file here, or <strong>click to browse</strong></span>
                    <span className={styles.dropSub}>Supports .csv, .xlsx, .xls, .gsheet</span></>
                  )}
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.gsheet" className={styles.fileInput} onChange={onFileInputChange} />
                </label>
              </div>
            )}
          </div>
        )}

        {step === 1 && preview && (
          <form onSubmit={handleImport} className={styles.form}>
            <p className={styles.info}>Found <strong>{preview.total}</strong> rows with <strong>{preview.columns.length}</strong> columns.</p>
            <div className="form-group">
              <label>Title column *</label>
              <select value={titleCol} onChange={e => setTitleCol(e.target.value)} required>
                <option value="">— select —</option>
                {preview.columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Photo URL column (optional)</label>
              <select value={photoCol} onChange={e => setPhotoCol(e.target.value)}>
                <option value="">— none —</option>
                {preview.columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.previewWrapper}>
              <table className={styles.previewTable}>
                <thead><tr>{preview.columns.map(c => <th key={c} className={c === titleCol ? styles.highlightCol : ''}>{c}{c === titleCol && ' ✓ title'}{c === photoCol && ' ✓ photo'}</th>)}</tr></thead>
                <tbody>{preview.preview.map((row, i) => <tr key={i}>{preview.columns.map(c => <td key={c} className={c === titleCol ? styles.highlightCol : ''}>{String(row[c] || '').slice(0, 60)}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <><span className="spinner" /> Importing…</> : `Import ${preview.total} rows →`}</button>
            </div>
          </form>
        )}

        {step === 2 && result && (
          <div className={styles.resultPane}>
            <div className={styles.resultIcon}>✅</div>
            <h2 className={styles.resultTitle}>Import Complete</h2>
            <div className={styles.resultStats}>
              <div className={styles.stat}><span>{result.imported}</span> New items</div>
              <div className={styles.stat}><span>{result.updated}</span> Updated</div>
              <div className={styles.stat}><span>{result.skipped}</span> Skipped</div>
              <div className={styles.stat}><span>{result.total}</span> Total rows</div>
            </div>
            <button className="btn btn-primary" onClick={reset}>Import Another</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── PDF Quote import ────────────────────────────────────────────────────────

function PdfQuoteImport() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [parsedItems, setParsedItems] = useState(null);
  const [importing, setImporting] = useState(false);
  const [quoteName, setQuoteName] = useState('');
  const [done, setDone] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const { text } = await api.uploadPdf(file);
      const { items } = await api.importPdfQuote(text);
      if (!items.length) throw new Error('No line items found in PDF. Check the format.');
      setParsedItems(items);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!quoteName.trim()) return toast.error('Enter a quote name');
    setImporting(true);
    try {
      const quote = await api.createQuote({ name: quoteName.trim() });
      for (const it of parsedItems) {
        // Try to find matching item, or skip if not found
        const { items } = await api.getItems({ search: it.name });
        const match = items[0];
        if (match) {
          await api.addQuoteItem(quote.quote?.id || quote.id, { item_id: match.id, quantity: it.quantity });
        }
      }
      setDone(true);
      toast.success('Quote created from PDF');
    } catch (e) { toast.error(e.message); } finally { setImporting(false); }
  };

  if (done) return (
    <div className={`card ${styles.card}`}>
      <div className={styles.resultPane}>
        <div className={styles.resultIcon}>✅</div>
        <h2 className={styles.resultTitle}>Quote Created</h2>
        <button className="btn btn-primary" onClick={() => { setParsedItems(null); setDone(false); setQuoteName(''); }}>Import Another</button>
      </div>
    </div>
  );

  return (
    <div className={`card ${styles.card}`}>
      {!parsedItems ? (
        <div className={styles.form}>
          <p className={styles.info}>Upload a PDF quote to extract line items. Lines like "2 Folding Chair $3.50" are parsed automatically.</p>
          <label className={styles.dropZone}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
            {loading ? <><span className="spinner" /> Parsing PDF…</> : (
              <><span className={styles.dropIcon}>📄</span>
              <span className={styles.dropText}>Drag &amp; drop a PDF here, or <strong>click to browse</strong></span>
              <span className={styles.dropSub}>.pdf files only</span></>
            )}
            <input ref={fileRef} type="file" accept=".pdf" className={styles.fileInput}
              onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
        </div>
      ) : (
        <form onSubmit={handleImport} className={styles.form}>
          <p className={styles.info}>Found <strong>{parsedItems.length}</strong> line items. Enter a quote name to import.</p>
          <div className="form-group">
            <label>Quote name *</label>
            <input required value={quoteName} onChange={e => setQuoteName(e.target.value)} placeholder="e.g. Smith Wedding" />
          </div>
          <div className={styles.previewWrapper}>
            <table className={styles.previewTable}>
              <thead><tr><th>Qty</th><th>Name</th><th>Unit Price</th></tr></thead>
              <tbody>
                {parsedItems.map((it, i) => (
                  <tr key={i}>
                    <td>{it.quantity}</td>
                    <td>{it.name}</td>
                    <td>{it.unit_price > 0 ? `$${it.unit_price.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.formActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setParsedItems(null)}>← Back</button>
            <button type="submit" className="btn btn-primary" disabled={importing}>
              {importing ? <><span className="spinner" /> Creating…</> : 'Create Quote →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Leads import + preview ───────────────────────────────────────────────────

const LEADS_STEPS = ['Enter Source', 'Map Columns', 'Import'];
const LEAD_TARGET_FIELDS = [
  { key: 'name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'event_date', label: 'Event date' },
  { key: 'event_type', label: 'Event type' },
  { key: 'source_url', label: 'Source URL' },
  { key: 'notes', label: 'Notes' }
];

function LeadsImport() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [activeTab, setActiveTab] = useState('url');
  const [sheetUrl, setSheetUrl] = useState('');
  const [importPayload, setImportPayload] = useState(null); // { url } or { filename, data }
  const [previewData, setPreviewData] = useState(null);    // { columns, suggestedMapping, preview, totalRows }
  const [mapping, setMapping] = useState({});             // { name: 'Full Name', ... }
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importedCount, setImportedCount] = useState(null);

  const load = () => {
    setLoading(true);
    api.getLeads({ limit: 50 })
      .then(d => { setLeads(d.leads || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handlePreview = async (e) => {
    e?.preventDefault();
    const url = sheetUrl.trim();
    if (activeTab === 'url' && !url) return;
    setImportError('');
    setImporting(true);
    try {
      let body;
      if (activeTab === 'url') {
        body = { url };
        setImportPayload({ url });
      } else {
        const file = fileInputRef.current?.files?.[0];
        if (!file) { setImporting(false); return; }
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(btoa(new Uint8Array(r.result).reduce((acc, b) => acc + String.fromCharCode(b), '')));
          r.onerror = rej;
          r.readAsArrayBuffer(file);
        });
        body = { filename: file.name, data: base64 };
        setImportPayload(body);
      }
      const data = await api.previewLeadsImport(body);
      setPreviewData(data);
      const initial = { ...data.suggestedMapping };
      Object.keys(initial).forEach(k => { if (initial[k] == null) delete initial[k]; });
      setMapping(initial);
      setStep(1);
    } catch (e) {
      setImportError(e.message);
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      toast.error('File must be CSV or XLSX');
      return;
    }
    setImportError('');
    setImporting(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(btoa(new Uint8Array(r.result).reduce((acc, b) => acc + String.fromCharCode(b), '')));
        r.onerror = rej;
        r.readAsArrayBuffer(file);
      });
      const body = { filename: file.name, data: base64 };
      setImportPayload(body);
      const data = await api.previewLeadsImport(body);
      setPreviewData(data);
      const initial = { ...data.suggestedMapping };
      Object.keys(initial).forEach(k => { if (initial[k] == null) delete initial[k]; });
      setMapping(initial);
      setStep(1);
    } catch (err) {
      setImportError(err.message);
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importPayload) return;
    setImportError('');
    setImporting(true);
    try {
      const columnMapping = {};
      LEAD_TARGET_FIELDS.forEach(({ key }) => { if (mapping[key]) columnMapping[key] = mapping[key]; });
      const result = await api.importLeads({ ...importPayload, columnMapping: Object.keys(columnMapping).length ? columnMapping : undefined });
      setImportedCount(result.imported);
      setStep(2);
      toast.success(`Imported ${result.imported} leads`);
      load();
    } catch (e) {
      setImportError(e.message);
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const resetLeadsWizard = () => {
    setStep(0);
    setImportPayload(null);
    setPreviewData(null);
    setMapping({});
    setImportedCount(null);
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.stepper}>
        {LEADS_STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className={`${styles.step} ${i <= step ? styles.stepActive : ''}`}>
              <span className={styles.stepNum}>{i + 1}</span>
              <span className={styles.stepLabel}>{label}</span>
            </div>
            {i < LEADS_STEPS.length - 1 && <div className={styles.stepLine} />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div className={styles.form}>
          <h3 className={styles.leadsImportTitle}>Import leads</h3>
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tab} ${activeTab === 'url' ? styles.tabActive : ''}`} onClick={() => setActiveTab('url')}>Google Sheet URL</button>
            <button type="button" className={`${styles.tab} ${activeTab === 'file' ? styles.tabActive : ''}`} onClick={() => setActiveTab('file')}>Upload file</button>
          </div>
          {activeTab === 'url' && (
            <form onSubmit={handlePreview} className={styles.tabContent}>
              <div className="form-group">
                <input type="url" placeholder="Google Sheets URL…" value={sheetUrl} onChange={e => { setSheetUrl(e.target.value); setImportError(''); }} className={styles.input} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>{importing ? <><span className="spinner" /> Fetching…</> : 'Preview →'}</button>
            </form>
          )}
          {activeTab === 'file' && (
            <div className={styles.tabContent}>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className={styles.fileInput} onChange={handleFileSelect} style={{ display: 'none' }} />
              <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? <><span className="spinner" /> Reading…</> : 'Choose CSV or XLSX →'}
              </button>
            </div>
          )}
          {importError && <p className={styles.importError}>{importError}</p>}
        </div>
      )}

      {step === 1 && previewData && (
        <form onSubmit={handleImport} className={styles.form}>
          <p className={styles.info}>Found <strong>{previewData.totalRows}</strong> rows. Map columns to lead fields (optional).</p>
          <div className={styles.previewWrapper}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  {LEAD_TARGET_FIELDS.map(({ key, label }) => (
                    <th key={key}>
                      <select
                        value={mapping[key] ?? ''}
                        onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value || null }))}
                        className={styles.selectSmall}
                      >
                        <option value="">—</option>
                        {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className={styles.mapLabel}>{label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.preview.map((row, i) => (
                  <tr key={i}>
                    {LEAD_TARGET_FIELDS.map(({ key }) => (
                      <td key={key}>{String(row[mapping[key]] ?? '').slice(0, 40)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.formActions}>
            <button type="button" className="btn btn-ghost" onClick={() => { setStep(0); setPreviewData(null); }}>← Back</button>
            <button type="submit" className="btn btn-primary" disabled={importing}>{importing ? <><span className="spinner" /> Importing…</> : `Import ${previewData.totalRows} rows →`}</button>
          </div>
          {importError && <p className={styles.importError}>{importError}</p>}
        </form>
      )}

      {step === 2 && (
        <div className={styles.resultPane}>
          <div className={styles.resultIcon}>✅</div>
          <h2 className={styles.resultTitle}>Import complete</h2>
          <p className={styles.importSuccess}>Imported {importedCount} leads.</p>
          <div className={styles.formActions}>
            <button type="button" className="btn btn-ghost" onClick={resetLeadsWizard}>← Back to import</button>
            <Link to="/leads" className="btn btn-primary">View leads →</Link>
          </div>
        </div>
      )}

      <div className={styles.leadsHeader}>
        <span className={styles.info}>{total} leads in database</span>
        <Link to="/leads" className="btn btn-primary btn-sm">View all leads →</Link>
      </div>
      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : total === 0 ? (
        <p className={styles.info}>No leads yet. Import a sheet or file above, or use the extension to capture contacts.</p>
      ) : (
        <div className={styles.previewWrapper}>
          <table className={styles.previewTable}>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Event Date</th><th>Added</th></tr></thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id}>
                  <td>{l.name || '—'}</td>
                  <td>{l.email || '—'}</td>
                  <td>{l.phone || '—'}</td>
                  <td>{l.event_date || '—'}</td>
                  <td>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const TOP_TABS = [
  { key: 'inventory', label: 'Inventory Sheet' },
  { key: 'pdf', label: 'PDF Quote' },
  { key: 'leads', label: 'Leads' },
];

export default function ImportPage() {
  const [topTab, setTopTab] = useState('inventory');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Import</h1>
        <p className={styles.sub}>Import inventory from a spreadsheet, parse a PDF quote, or review scraped leads.</p>
      </div>

      <div className={styles.tabs}>
        {TOP_TABS.map(t => (
          <button key={t.key} type="button"
            className={`${styles.tab} ${topTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTopTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {topTab === 'inventory' && <InventoryImport />}
      {topTab === 'pdf'       && <PdfQuoteImport />}
      {topTab === 'leads'     && <LeadsImport />}
    </div>
  );
}
