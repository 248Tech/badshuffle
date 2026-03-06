import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './FilesPage.module.css';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function mimeIcon(mime) {
  if (!mime) return '📎';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
  if (mime.includes('zip') || mime.includes('archive')) return '🗜️';
  return '📎';
}

const FILTERS = [
  { label: 'All',       value: 'all' },
  { label: 'Images',    value: 'images' },
  { label: 'Documents', value: 'docs' },
];

export default function FilesPage() {
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState('all');
  const fileInputRef = useRef(null);

  function load() {
    api.getFiles()
      .then(d => setFiles(d.files || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of fileList) formData.append('files', f);
      await api.uploadFiles(formData);
      toast.success('Uploaded ' + fileList.length + ' file(s)');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  }

  async function handleDelete(file) {
    if (!window.confirm('Delete "' + file.original_name + '"?')) return;
    try {
      await api.deleteFile(file.id);
      toast.info('Deleted ' + file.original_name);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function copyUrl(file) {
    navigator.clipboard.writeText(window.location.origin + api.fileServeUrl(file.id));
    toast.success('URL copied');
  }

  const isImage = (f) => f.mime_type && f.mime_type.startsWith('image/');

  const filtered = files.filter(f => {
    if (filter === 'images') return isImage(f);
    if (filter === 'docs') return !isImage(f);
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Files</h1>
        <p className={styles.sub}>Upload images and documents to attach to emails or quote items.</p>
      </div>

      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${uploading ? styles.uploading : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleUpload(e.target.files)}
        />
        {uploading ? (
          <span><span className="spinner" /> Uploading…</span>
        ) : (
          <span>{isDragging ? 'Drop files here' : 'Drag & drop files here, or click to pick'}</span>
        )}
      </div>

      <div className={styles.filterRow}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`${styles.filterChip} ${filter === f.value ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <span className={styles.count}>{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No files yet. Upload something above.</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(file => (
            <div key={file.id} className={styles.card}>
              {isImage(file) ? (
                <div className={styles.imgWrapper}>
                  <img
                    src={api.fileServeUrl(file.id)}
                    alt={file.original_name}
                    className={styles.thumb}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className={styles.iconWrapper}>
                  <span className={styles.fileIcon}>{mimeIcon(file.mime_type)}</span>
                </div>
              )}
              <div className={styles.cardBody}>
                <span className={styles.fileName} title={file.original_name}>{file.original_name}</span>
                <span className={styles.fileSize}>{formatSize(file.size)}</span>
              </div>
              <div className={styles.cardActions}>
                {!isImage(file) && (
                  <a
                    href={api.fileServeUrl(file.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                    onClick={e => e.stopPropagation()}
                  >
                    Download
                  </a>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(file)}>Copy URL</button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(file)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
