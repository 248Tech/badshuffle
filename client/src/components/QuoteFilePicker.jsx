import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function QuoteFilePicker({ currentFileIds = [], onSelect, onClose, classNames = {} }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getFiles()
      .then((d) => setFiles(d.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);

  const attached = new Set(currentFileIds);

  return (
    <div className={classNames.modalOverlay} onClick={onClose} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div
        className={classNames.modal}
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qfp-title"
      >
        <div className={classNames.imagePickerHeader}>
          <span id="qfp-title" style={{ fontSize: 13, fontWeight: 600 }}>Add file to quote</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div className="spinner" />
          </div>
        ) : files.length === 0 ? (
          <p className={classNames.emptyHint}>
            No files in library. Upload files on the Files page first.
          </p>
        ) : (
          <ul
            className={classNames.quoteFilesList}
            style={{ maxHeight: 320, overflowY: 'auto' }}
          >
            {files.map((f) => (
              <li key={f.id} className={classNames.quoteFileItem}>
                <span className={classNames.quoteFileName}>
                  {f.original_name || 'File #' + f.id}
                </span>
                {attached.has(f.id) ? (
                  <span className={classNames.quoteFileSize}> (already attached)</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ marginLeft: 8 }}
                    onClick={() => onSelect(f.id)}
                  >
                    Attach
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
