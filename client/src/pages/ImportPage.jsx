import React, { useState, useRef } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './ImportPage.module.css';

const STEPS = ['Enter Source', 'Map Columns', 'Import'];

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export default function ImportPage() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep]               = useState(0);
  const [activeTab, setActiveTab]     = useState('url');   // 'url' | 'file'
  const [url, setUrl]                 = useState('');
  const [preview, setPreview]         = useState(null);
  const [uploadedRows, setUploadedRows] = useState(null);
  const [titleCol, setTitleCol]       = useState('');
  const [photoCol, setPhotoCol]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [isDragging, setIsDragging]   = useState(false);

  // ── URL tab ────────────────────────────────────────────────────────────────

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const data = await api.previewSheet(url.trim());
      setPreview(data);
      setUploadedRows(null);
      setTitleCol(data.columns[0] || '');
      setPhotoCol('');
      setStep(1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── File tab ───────────────────────────────────────────────────────────────

  const handleFile = async (file) => {
    if (!file) return;
    const filename = file.name;
    const ext = filename.split('.').pop().toLowerCase();
    setLoading(true);
    try {
      if (ext === 'gsheet') {
        // .gsheet is a JSON file — grab the spreadsheet URL from it
        const text = await file.text();
        const parsed = JSON.parse(text);
        const sheetUrl = parsed.url || parsed.spreadsheetUrl;
        if (!sheetUrl) throw new Error('.gsheet file does not contain a URL');
        setUrl(sheetUrl);
        setActiveTab('url');
        // Auto-trigger preview
        const data = await api.previewSheet(sheetUrl);
        setPreview(data);
        setUploadedRows(null);
        setTitleCol(data.columns[0] || '');
        setPhotoCol('');
        setStep(1);
      } else if (ext === 'csv') {
        const text = await file.text();
        const data = await api.uploadSheet({ filename, data: text });
        setPreview(data);
        setUploadedRows(data.rows);
        setTitleCol(data.columns[0] || '');
        setPhotoCol('');
        setStep(1);
      } else {
        // xlsx / xls
        const buffer = await file.arrayBuffer();
        const base64 = toBase64(buffer);
        const data = await api.uploadSheet({ filename, data: base64 });
        setPreview(data);
        setUploadedRows(data.rows);
        setTitleCol(data.columns[0] || '');
        setPhotoCol('');
        setStep(1);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onFileInputChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async (e) => {
    e.preventDefault();
    if (!titleCol) return toast.error('Select a title column');
    setLoading(true);
    try {
      let data;
      if (uploadedRows) {
        data = await api.importSheetData({
          rows: uploadedRows,
          title_column: titleCol,
          photo_column: photoCol || null
        });
      } else {
        data = await api.importSheet({
          url: url.trim(),
          title_column: titleCol,
          photo_column: photoCol || null
        });
      }
      setResult(data);
      setStep(2);
      toast.success(`Import complete: ${data.imported} new, ${data.updated} updated`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setActiveTab('url');
    setUrl('');
    setPreview(null);
    setUploadedRows(null);
    setTitleCol('');
    setPhotoCol('');
    setResult(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Import Items</h1>
        <p className={styles.sub}>
          Import from a Google Sheet URL or upload a CSV / Excel file.
        </p>
      </div>

      {/* Stepper */}
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
        {/* Step 0: Source */}
        {step === 0 && (
          <div className={styles.form}>
            {/* Tab bar */}
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'url' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('url')}
              >
                Google Sheet URL
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'file' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('file')}
              >
                Upload File
              </button>
            </div>

            {activeTab === 'url' && (
              <form onSubmit={handlePreview} className={styles.tabContent}>
                <div className="form-group">
                  <label>Google Sheets URL</label>
                  <input
                    required
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                  />
                </div>
                <div className={styles.tip}>
                  💡 Tip: In Google Sheets, go to <strong>File → Share → Publish to web</strong>, select CSV format, then copy the spreadsheet URL (not the publish URL).
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <><span className="spinner" /> Fetching…</> : 'Preview →'}
                </button>
              </form>
            )}

            {activeTab === 'file' && (
              <div className={styles.tabContent}>
                <label
                  className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                >
                  {loading ? (
                    <><span className="spinner" /> Reading file…</>
                  ) : (
                    <>
                      <span className={styles.dropIcon}>📂</span>
                      <span className={styles.dropText}>
                        Drag &amp; drop a file here, or <strong>click to browse</strong>
                      </span>
                      <span className={styles.dropSub}>Supports .csv, .xlsx, .xls, .gsheet</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.gsheet"
                    className={styles.fileInput}
                    onChange={onFileInputChange}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Map columns */}
        {step === 1 && preview && (
          <form onSubmit={handleImport} className={styles.form}>
            <p className={styles.info}>
              Found <strong>{preview.total}</strong> rows with <strong>{preview.columns.length}</strong> columns. Map them below.
            </p>

            <div className="form-group">
              <label>Title column *</label>
              <select value={titleCol} onChange={e => setTitleCol(e.target.value)} required>
                <option value="">— select —</option>
                {preview.columns.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Photo URL column (optional)</label>
              <select value={photoCol} onChange={e => setPhotoCol(e.target.value)}>
                <option value="">— none —</option>
                {preview.columns.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Preview table */}
            <div className={styles.previewWrapper}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    {preview.columns.map(c => (
                      <th key={c} className={c === titleCol ? styles.highlightCol : ''}>
                        {c}
                        {c === titleCol && ' ✓ title'}
                        {c === photoCol && ' ✓ photo'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map(c => (
                        <td key={c} className={c === titleCol ? styles.highlightCol : ''}>
                          {String(row[c] || '').slice(0, 60)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><span className="spinner" /> Importing…</> : `Import ${preview.total} rows →`}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Done */}
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
    </div>
  );
}
