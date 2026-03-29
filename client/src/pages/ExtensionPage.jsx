import React, { useState, useEffect } from 'react';
import { api } from '../api';
import styles from './ExtensionPage.module.css';

const STEPS = [
  {
    n: 1,
    title: 'Download the extension',
    body: (
      <>
        Click the button below to download <code>badshuffle-extension.zip</code>.
      </>
    ),
  },
  {
    n: 2,
    title: 'Unzip the file',
    body: (
      <>
        Right-click the downloaded zip and choose <strong>Extract All…</strong> (or use 7-Zip).
        You should end up with a folder called <code>badshuffle-extension</code>.
      </>
    ),
  },
  {
    n: 3,
    title: 'Open Chrome Extensions',
    body: (
      <>
        In Chrome, navigate to{' '}
        <code className={styles.copyCode}>chrome://extensions</code>
        {' '}(you must type or paste this — browsers block clickable chrome:// links).
      </>
    ),
  },
  {
    n: 4,
    title: 'Enable Developer mode',
    body: (
      <>
        In the top-right corner of the Extensions page, toggle{' '}
        <strong>Developer mode</strong> on.
      </>
    ),
  },
  {
    n: 5,
    title: 'Load the extension',
    body: (
      <>
        Click <strong>Load unpacked</strong>, then browse to and select the{' '}
        <code>badshuffle-extension</code> folder you extracted in step 2.
      </>
    ),
  },
  {
    n: 6,
    title: 'Pin the extension (optional)',
    body: (
      <>
        Click the puzzle-piece icon (<strong><span aria-hidden="true">⑅</span></strong>) in the Chrome toolbar and pin{' '}
        <strong>BadShuffle</strong> so it's always visible.
      </>
    ),
  },
];

const FEATURES = [
  'Syncs items directly to your BadShuffle inventory while you browse Goodshuffle Pro',
  'One-click item capture without leaving the page',
  'Automatically fills in item title and photo URL',
];

export default function ExtensionPage() {
  const [extToken, setExtToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.auth.extensionToken().then(d => setExtToken(d.token)).catch(() => {});
  }, []);

  function handleCopy() {
    if (!extToken) return;
    navigator.clipboard.writeText(extToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Chrome Extension</h1>
        <p className={styles.sub}>Install the BadShuffle Chrome extension to capture items directly from your browser.</p>
      </div>

      {/* Download bar */}
      <div className={`card ${styles.downloadBar}`}>
        <div className={styles.downloadInfo}>
          <span className={styles.extIcon} aria-hidden="true">🧩</span>
          <div>
            <div className={styles.downloadTitle}>BadShuffle Extension</div>
            <div className={styles.downloadMeta}>Chrome Extension · Manifest V3</div>
          </div>
        </div>
        <a
          href={`${import.meta.env.VITE_API_BASE || ''}/api/extension/download`}
          download
          className={`btn btn-primary ${styles.downloadBtn}`}
        >
          <span aria-hidden="true">⬇</span> Download ZIP
        </a>
      </div>

      {/* Step-by-step guide */}
      <div className={`card ${styles.card}`}>
        <h2 className={styles.sectionTitle}>Installation guide</h2>
        <ol className={styles.stepList}>
          {STEPS.map(s => (
            <li key={s.n} className={styles.stepItem}>
              <div className={styles.stepCircle}>{s.n}</div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>{s.title}</div>
                <div className={styles.stepDesc}>{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Extension API Token */}
      <div className={`card ${styles.card}`}>
        <h2 className={styles.sectionTitle}>Extension API token</h2>
        <p className={styles.tokenDesc}>
          Paste this token into the extension popup to authorise it to sync items.
        </p>
        <div className={styles.tokenRow}>
          <code className={styles.tokenCode}>{extToken || '…'}</code>
          <button type="button" className={`btn btn-ghost ${styles.copyBtn}`} onClick={handleCopy} disabled={!extToken}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* What the extension does */}
      <div className={`card ${styles.card}`}>
        <h2 className={styles.sectionTitle}>What the extension does</h2>
        <ul className={styles.featureList}>
          {FEATURES.map((f, i) => (
            <li key={i} className={styles.featureItem}>
              <span className={styles.featureBullet} aria-hidden="true">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
