import React, { useEffect, useCallback } from 'react';
import styles from './ImageLightbox.module.css';

export default function ImageLightbox({ images, index, onClose, onNavigate }) {
  const hasMultiple = images.length > 1;

  const prev = useCallback(() => {
    onNavigate((index - 1 + images.length) % images.length);
  }, [index, images.length, onNavigate]);

  const next = useCallback(() => {
    onNavigate((index + 1) % images.length);
  }, [index, images.length, onNavigate]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (hasMultiple && e.key === 'ArrowLeft') prev();
      if (hasMultiple && e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, prev, next, hasMultiple]);

  if (!images.length) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close image viewer">
        ×
      </button>
      <div className={styles.stage} onClick={(e) => e.stopPropagation()}>
        {hasMultiple && (
          <button type="button" className={`${styles.navBtn} ${styles.navPrev}`} onClick={prev} aria-label="Previous image">
            ‹
          </button>
        )}
        <img src={images[index]} alt="" className={styles.img} draggable={false} />
        {hasMultiple && (
          <button type="button" className={`${styles.navBtn} ${styles.navNext}`} onClick={next} aria-label="Next image">
            ›
          </button>
        )}
      </div>
      {hasMultiple && (
        <div className={styles.dots} role="tablist" aria-label="Image navigation">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={(e) => { e.stopPropagation(); onNavigate(i); }}
              aria-label={`Image ${i + 1} of ${images.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
