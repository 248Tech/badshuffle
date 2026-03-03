import React, { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './ImportPage.module.css';

const STEPS = ['Enter URL', 'Map Columns', 'Import'];

export default function ImportPage() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [titleCol, setTitleCol] = useState('');
  const [photoCol, setPhotoCol] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const data = await api.previewSheet(url.trim());
      setPreview(data);
      setTitleCol(data.columns[0] || '');
      setPhotoCol('');
      setStep(1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!titleCol) return toast.error('Select a title column');
    setLoading(true);
    try {
      const data = await api.importSheet({
        url: url.trim(),
        title_column: titleCol,
        photo_column: photoCol || null
      });
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
    setUrl('');
    setPreview(null);
    setTitleCol('');
    setPhotoCol('');
    setResult(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Import from Google Sheets</h1>
        <p className={styles.sub}>
          The sheet must be published to the web (File → Share → Publish to web → CSV format).
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
        {/* Step 0: URL */}
        {step === 0 && (
          <form onSubmit={handlePreview} className={styles.form}>
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

        {/* Step 1: Map columns */}
        {step === 1 && preview && (
          <form onSubmit={handleImport} className={styles.form}>
            <p className={styles.info}>Found <strong>{preview.total}</strong> rows with <strong>{preview.columns.length}</strong> columns. Map them below.</p>

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
            <button className="btn btn-primary" onClick={reset}>Import Another Sheet</button>
          </div>
        )}
      </div>
    </div>
  );
}
