import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './RichMessageRenderer.module.css';

/**
 * Renders structured rich payloads stored on messages (message_type === 'rich').
 * Unknown kinds fall back to a JSON preview for debugging.
 */
export default function RichMessageRenderer({ payload }) {
  const navigate = useNavigate();
  if (!payload || typeof payload !== 'object') {
    return <p className={styles.fallback}>(Invalid rich message)</p>;
  }

  const kind = payload.kind;

  if (kind === 'product_card') {
    return (
      <div className={styles.card}>
        {payload.imageUrl && (
          <img src={payload.imageUrl} alt={payload.title || 'Product image'} className={styles.cardImg} />
        )}
        <div className={styles.cardBody}>
          <div className={styles.cardTitle}>{payload.title || 'Product'}</div>
          {payload.subtitle && <div className={styles.cardSub}>{payload.subtitle}</div>}
          {payload.priceLabel && <div className={styles.price}>{payload.priceLabel}</div>}
          {payload.quoteId && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/quotes/${payload.quoteId}`)}
            >
              {payload.ctaLabel || 'Add to Quote'}
            </button>
          )}
          {!payload.quoteId && payload.ctaUrl && (
            <a className="btn btn-primary btn-sm" href={payload.ctaUrl}>
              {payload.ctaLabel || 'Open'}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (kind === 'portfolio_block') {
    return (
      <div className={styles.portfolio}>
        <div className={styles.portfolioTitle}>{payload.title || 'Portfolio'}</div>
        {payload.body && <p className={styles.portfolioBody}>{payload.body}</p>}
        {payload.ctaUrl && (
          <a className="btn btn-primary btn-sm" href={payload.ctaUrl} target="_blank" rel="noopener noreferrer">
            {payload.ctaLabel || 'View'}
          </a>
        )}
      </div>
    );
  }

  return (
    <pre className={styles.jsonPreview}>{JSON.stringify(payload, null, 2)}</pre>
  );
}
