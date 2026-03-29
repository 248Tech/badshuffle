import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

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
  const navigate = useNavigate();
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('tiles');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [inspectFile, setInspectFile] = useState(null);
  const [inspectQuotes, setInspectQuotes] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);
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

  function openInspect(file) {
    setInspectFile(file);
    setInspectQuotes([]);
    setInspectLoading(true);
    api.getFileQuotes(file.id)
      .then(d => setInspectQuotes(d.quotes || []))
      .catch(() => setInspectQuotes([]))
      .finally(() => setInspectLoading(false));
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

  const filterChipBase = 'px-3.5 py-1 text-[13px] border border-border rounded-full bg-bg text-text-muted cursor-pointer hover:border-primary hover:text-primary transition-colors';
  const filterChipActive = 'px-3.5 py-1 text-[13px] border rounded-full bg-primary border-primary text-white cursor-pointer';

  const thClass = 'px-3 py-2.5 text-left font-semibold text-text-muted text-[13px] border-b border-border bg-bg-elevated';
  const tdClass = 'px-3 py-2.5 border-b border-border text-[14px]';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Files</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Upload images and documents to attach to emails or project items.</p>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 flex items-center justify-center text-[14px] cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted hover:border-primary hover:text-primary'} ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleUpload(e.target.files)}
          aria-hidden="true"
        />
        {uploading ? (
          <span><span className="spinner" /> Uploading…</span>
        ) : (
          <span>{isDragging ? 'Drop files here' : 'Drag & drop files here, or click to pick'}</span>
        )}
      </div>

      {/* Filter / view controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? filterChipActive : filterChipBase}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <span className="text-[13px] text-text-muted">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
        <div className="flex-1" />
        <select
          className="px-2.5 py-1.5 text-[13px] border border-border rounded-md bg-bg text-text cursor-pointer"
          value={viewMode}
          onChange={e => setViewMode(e.target.value)}
          aria-label="View mode"
        >
          <option value="tiles">Tile View</option>
          <option value="list">List View</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-bg-elevated rounded-lg">
          <span className="text-[13px] text-text-muted">{selectedCount} selected</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-danger"
            onClick={() => setConfirmBulkDelete(true)}
          >
            Delete ({selectedCount})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3" aria-busy="true" aria-label="Loading files">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden bg-bg" aria-hidden="true">
              <div className="skeleton h-[110px] rounded-none" />
              <div className="p-2">
                <div className="skeleton h-3 w-3/4 rounded mb-1" />
                <div className="skeleton h-2.5 w-[45%] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No files yet. Upload something above.</div>
      ) : viewMode === 'tiles' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {filtered.map(file => (
            <div
              key={file.id}
              className={`border rounded-lg overflow-hidden bg-bg flex flex-col relative hover:shadow-md transition-shadow ${selectedIds.has(file.id) ? 'ring-2 ring-primary border-primary' : 'border-border'}`}
            >
              <div
                className="absolute top-2 left-2 z-10"
                onClick={e => { e.stopPropagation(); toggleSelect(file.id); }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  aria-label={`Select ${file.original_name}`}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {isImage(file) ? (
                <div className="aspect-[4/3] overflow-hidden bg-surface">
                  <img
                    src={api.fileServeUrl(file.id)}
                    alt={file.original_name}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center bg-surface">
                  <span className="text-[40px]" aria-hidden="true">{mimeIcon(file.mime_type)}</span>
                </div>
              )}
              <div
                className="px-2.5 py-2 flex flex-col gap-0.5 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openInspect(file)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openInspect(file)}
              >
                <span className="text-[12px] font-medium truncate" title={file.original_name}>{file.original_name}</span>
                <span className="text-[11px] text-text-muted">{formatSize(file.size)}</span>
              </div>
              <div className="flex items-center gap-1 px-2 pb-2 flex-wrap">
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
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyUrl(file)}>Copy URL</button>
                <button
                  type="button"
                  className="ml-auto text-text-muted text-[11px] p-1 hover:text-danger cursor-pointer bg-transparent border-none"
                  onClick={() => handleDelete(file)}
                  aria-label={`Delete ${file.original_name}`}
                  title="Delete"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className={`${thClass} w-10`}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={selectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Size</th>
                  <th className={thClass}>Uploaded</th>
                  <th className={`${thClass} whitespace-nowrap`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(file => (
                  <tr key={file.id} className={`hover:bg-hover transition-colors ${selectedIds.has(file.id) ? 'bg-primary/10' : ''}`}>
                    <td className={tdClass}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(file.id)}
                        onChange={() => toggleSelect(file.id)}
                        aria-label={`Select ${file.original_name}`}
                      />
                    </td>
                    <td
                      className={`${tdClass} font-medium cursor-pointer`}
                      onClick={() => openInspect(file)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openInspect(file)}
                      tabIndex={0}
                    >
                      <span className="mr-2" aria-hidden="true">{isImage(file) ? '🖼️' : mimeIcon(file.mime_type)}</span>
                      <span title={file.original_name}>{file.original_name}</span>
                    </td>
                    <td className={`${tdClass} text-[12px] text-text-muted`}>{file.mime_type || '—'}</td>
                    <td className={`${tdClass} text-[12px] text-text-muted`}>{formatSize(file.size)}</td>
                    <td className={`${tdClass} text-[12px] text-text-muted`}>
                      {file.created_at ? new Date(file.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <button type="button" className="btn btn-ghost btn-sm mr-1" onClick={() => copyUrl(file)}>Copy URL</button>
                      {!isImage(file) && (
                        <a href={api.fileServeUrl(file.id)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mr-1">Download</a>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(file)}>Delete</button>
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

      {/* File inspector panel */}
      {inspectFile && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] flex items-end sm:items-center sm:justify-end"
          onClick={() => setInspectFile(null)}
          onKeyDown={e => e.key === 'Escape' && setInspectFile(null)}
        >
          <div
            className="bg-bg border border-border rounded-t-xl sm:rounded-l-xl sm:rounded-r-none shadow-2xl w-full sm:w-[360px] max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-file-name"
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border sticky top-0 bg-bg">
              <span className="text-[24px] shrink-0" aria-hidden="true">{isImage(inspectFile) ? '🖼️' : mimeIcon(inspectFile.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <span id="inspect-file-name" className="text-[14px] font-semibold truncate block" title={inspectFile.original_name}>{inspectFile.original_name}</span>
                <span className="text-[12px] text-text-muted">{formatSize(inspectFile.size)}</span>
              </div>
              <button
                type="button"
                className="ml-auto text-text-muted hover:text-danger cursor-pointer bg-transparent border-none text-[16px]"
                onClick={() => setInspectFile(null)}
                aria-label="Close"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            {isImage(inspectFile) && (
              <div className="p-4 border-b border-border">
                <img src={api.fileServeUrl(inspectFile.id)} alt={inspectFile.original_name} className="w-full rounded" />
              </div>
            )}
            <div className="flex gap-2 px-4 py-3 border-b border-border">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyUrl(inspectFile)}>Copy URL</button>
              {!isImage(inspectFile) && (
                <a href={api.fileServeUrl(inspectFile.id)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Download</a>
              )}
            </div>
            <div className="px-4 py-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Linked projects</h4>
              {inspectLoading ? (
                <div className="text-[13px] text-text-muted py-2"><span className="spinner" /></div>
              ) : inspectQuotes.length === 0 ? (
                <p className="text-[13px] text-text-muted py-2">Not attached to any projects.</p>
              ) : (
                <ul className="list-none p-0 m-0 flex flex-col gap-2">
                  {inspectQuotes.map(q => (
                    <li key={q.id} className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        className="text-primary text-[13px] font-medium hover:underline cursor-pointer bg-transparent border-none text-left p-0"
                        onClick={() => { setInspectFile(null); navigate(`/quotes/${q.id}`); }}
                      >
                        {q.name}
                      </button>
                      <span className="text-[11px] text-text-muted">
                        {[q.client_first_name, q.client_last_name].filter(Boolean).join(' ')}
                        {q.event_date ? ` · ${q.event_date}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
