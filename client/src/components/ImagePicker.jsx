import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ImagePicker({ onSelect, classNames = {} }) {
  const [open, setOpen] = useState(false);
  const [fileImages, setFileImages] = useState([]);
  const [invImages, setInvImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([api.getFiles().catch(() => ({ files: [] })), api.getItems({ hidden: '0' }).catch(() => ({ items: [] }))])
      .then(async ([filesData, itemsData]) => {
        const fImgs = (filesData.files || []).filter((f) => f.mime_type && f.mime_type.startsWith('image/'));
        const iImgs = (itemsData.items || []).filter((i) => i.photo_url);
        setFileImages(fImgs);
        setInvImages(iImgs);
        const ids = [
          ...fImgs.map((f) => f.id),
          ...iImgs.map((i) => i.photo_url).filter((p) => /^\d+$/.test(String(p).trim())),
        ];
        await api.prefetchFileServeUrls(ids);
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Pick image from library
      </button>
    );
  }

  return (
    <div className={classNames.imagePicker}>
      <div className={classNames.imagePickerHeader}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Pick an image</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className={classNames.imagePickerGrid}>
          {fileImages.map((f) => (
            <button
              key={'f-' + f.id}
              type="button"
              className={classNames.imagePickerThumb}
              onClick={() => {
                onSelect(api.fileServeUrl(f.id, { variant: 'ui' }), null);
                setOpen(false);
              }}
              title={f.original_name}
            >
              <img
                src={api.fileServeUrl(f.id, { variant: 'thumb' })}
                alt={f.original_name}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </button>
          ))}
          {invImages.map((i) => (
            <button
              key={'i-' + i.id}
              type="button"
              className={classNames.imagePickerThumb}
              onClick={() => {
                onSelect(api.proxyImageUrl(i.photo_url, { variant: 'ui' }), i.unit_price || null);
                setOpen(false);
              }}
              title={i.title}
            >
              <img
                src={api.proxyImageUrl(i.photo_url)}
                alt={i.title}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </button>
          ))}
          {fileImages.length === 0 && invImages.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: 12 }}>
              No images found. Upload images to the Files page first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
