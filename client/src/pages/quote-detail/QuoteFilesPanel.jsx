import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import styles from '../QuoteDetailPage.module.css';

function formatFileSize(size) {
  if (size == null) return null;
  if (size >= 1048576) return `${(size / 1048576).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function formatSignedContractLabel(file) {
  if (!file?.signature_event_id) return null;
  return `Signed Contract v${file.signature_version_number || 1}`;
}

export default function QuoteFilesPanel({ quoteFiles, onDetach, onOpenPicker, canModify = true }) {
  const [, setServeEpoch] = useState(0);
  useEffect(() => {
    const ids = quoteFiles.map((f) => f.file_id).filter((x) => x != null && /^\d+$/.test(String(x)));
    if (!ids.length) return;
    api.prefetchFileServeUrls(ids).then(() => setServeEpoch((e) => e + 1)).catch(() => {});
  }, [quoteFiles]);

  return (
    <div className={`card ${styles.editCard}`}>
      <h3 className={styles.formSectionTitle}>Files</h3>
      <p className={styles.notes}>Files attached to this quote.{canModify ? ' Add from your media library.' : ''}</p>
      {canModify && (
        <div className={styles.formActions} style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenPicker}>
            Add file from library
          </button>
        </div>
      )}
      {quoteFiles.length > 0 ? (
        <ul className={styles.quoteFilesList}>
          {quoteFiles.map(f => {
            const mime = f.mime_type || '';
            const fileIcon = mime.startsWith('image/') ? '🖼' : mime === 'application/pdf' ? '📄' : mime.startsWith('video/') ? '🎬' : '📎';
            const attachedAt = f.attached_at || f.created_at;
            const signatureLabel = formatSignedContractLabel(f);
            const signedAt = f.signature_signed_at ? new Date(f.signature_signed_at).toLocaleString() : null;
            const canRemove = !f.signature_event_id;
            return (
              <li key={f.attachment_id || f.file_id} className={styles.quoteFileItem}>
                <span className={styles.quoteFileIcon}>{fileIcon}</span>
                <div className={styles.quoteFileBody}>
                  <div className={styles.quoteFileHeader}>
                    <a href={api.fileServeUrl(f.file_id)} target="_blank" rel="noopener noreferrer" className={styles.quoteFileName}>
                      {f.original_name || 'File #' + f.file_id}
                    </a>
                    {signatureLabel && <span className={styles.quoteFileBadge}>{signatureLabel}</span>}
                  </div>
                  <div className={styles.quoteFileMetaRow}>
                    {formatFileSize(f.size) && <span className={styles.quoteFileSize}>{formatFileSize(f.size)}</span>}
                    {attachedAt && <span className={styles.quoteFileMeta}>Attached {new Date(attachedAt).toLocaleDateString()}</span>}
                    {signedAt && <span className={styles.quoteFileMeta}>Signed {signedAt}</span>}
                    {f.signature_signer_name && <span className={styles.quoteFileMeta}>Signer {f.signature_signer_name}</span>}
                    {f.signature_signed_quote_total != null && <span className={styles.quoteFileMeta}>Total ${Number(f.signature_signed_quote_total).toFixed(2)}</span>}
                  </div>
                </div>
                {canRemove && canModify ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDetach(f.file_id)}>Remove</button>
                ) : (
                  <span className={styles.quoteFileLocked}>{canRemove ? 'View only' : 'Locked audit file'}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyHint}>No files attached to this quote.</p>
      )}
    </div>
  );
}
