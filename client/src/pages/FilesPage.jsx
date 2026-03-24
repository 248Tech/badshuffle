import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
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
  const [viewMode, setViewMode] = useState('tiles');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
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
    try {
      await api.deleteFile(file.id);
      toast.info('Deleted ' + file.original_name);
      setSelectedIds(s => { const n = new Set(s); n.delete(file.id); return n; });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) await api.deleteFile(id);
      toast.info(`Deleted ${ids.length} file(s)`);
      setSelectedIds(new Set());
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmBulkDelete(false);
    }
  }

  function copyUrl(file) {
    navigator.clipboard.writeText(window.location.origin + api.fileServeUrl(file.id));
    toast.success('URL copied');
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(f => f.id)));
  }

  const isImage = (f) => f.mime_type && f.mime_type.startsWith('image/');

  const filtered = files.filter(f => {
    if (filter === 'images') return isImage(f);
    if (filter === 'docs') return !isImage(f);
    return true;
  });

  const selectedCount = selectedIds.size;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Files</h1>
          <p className={styles.sub}>Upload images and documents to attach to emails or project items.</p>
        </div>
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
        <div className={styles.filterSpacer} />
        <select
          className={styles.viewSelect}
          value={viewMode}
          onChange={e => setViewMode(e.target.value)}
          aria-label="View mode"
        >
          <option value="tiles">Tile View</option>
          <option value="list">List View</option>
        </select>
      </div>

      {selectedCount > 0 && (
        <div className={styles.bulkBar}>
          <span>{selectedCount} selected</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-danger)' }}
            onClick={() => setConfirmBulkDelete(true)}
          >
            Delete ({selectedCount})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No files yet. Upload something above.</div>
      ) : viewMode === 'tiles' ? (
        <div className={styles.grid}>
          {filtered.map(file => (
            <div
              key={file.id}
              className={`${styles.card} ${selectedIds.has(file.id) ? styles.cardSelected : ''}`}
            >
              <div className={styles.cardCheckbox} onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  aria-label={`Select ${file.original_name}`}
                  onClick={e => e.stopPropagation()}
                />
              </div>
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
      ) : (
        <div className={`card ${styles.listCard}`}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colCheck}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={selectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th className={styles.colActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(file => (
                  <tr key={file.id} className={selectedIds.has(file.id) ? styles.rowSelected : ''}>
                    <td className={styles.colCheck}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(file.id)}
                        onChange={() => toggleSelect(file.id)}
                        aria-label={`Select ${file.original_name}`}
                      />
                    </td>
                    <td className={styles.listFileName}>
                      <span className={styles.listFileIcon}>{isImage(file) ? '🖼️' : mimeIcon(file.mime_type)}</span>
                      <span title={file.original_name}>{file.original_name}</span>
                    </td>
                    <td className={styles.listMeta}>{file.mime_type || '—'}</td>
                    <td className={styles.listMeta}>{formatSize(file.size)}</td>
                    <td className={styles.listMeta}>
                      {file.created_at ? new Date(file.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className={styles.colActions}>
                      <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(file)}>Copy URL</button>
                      {!isImage(file) && (
                        <a
                          href={api.fileServeUrl(file.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          Download
                        </a>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => handleDelete(file)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <ConfirmDialog
          title="Delete selected files?"
          message={`Delete ${selectedCount} file(s)? This cannot be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}
    </div>
  );
}
