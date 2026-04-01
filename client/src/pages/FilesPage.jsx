import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import VirtualGrid from '../components/virtualization/VirtualGrid.jsx';
import VirtualList from '../components/virtualization/VirtualList.jsx';

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
  const [page, setPage] = useState(1);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [inspectFile, setInspectFile] = useState(null);
  const [inspectQuotes, setInspectQuotes] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [confirmDeleteInspect, setConfirmDeleteInspect] = useState(false);
  const [, setServeEpoch] = useState(0);
  const fileInputRef = useRef(null);

  function load() {
    api.getFiles()
      .then(d => setFiles(d.files || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!files.length) return;
    api.prefetchFileServeUrls(files.map((f) => f.id)).then(() => setServeEpoch((e) => e + 1)).catch(() => {});
  }, [files]);

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
    setRenaming(false);
    setRenameValue('');
    setConfirmDeleteInspect(false);
    api.getFileQuotes(file.id)
      .then(d => setInspectQuotes(d.quotes || []))
      .catch(() => setInspectQuotes([]))
      .finally(() => setInspectLoading(false));
  }

  async function handleRename() {
    const name = renameValue.trim();
    if (!name || !inspectFile) return;
    try {
      const updated = await api.renameFile(inspectFile.id, name);
      setFiles(fs => fs.map(f => f.id === inspectFile.id ? { ...f, original_name: updated.original_name } : f));
      setInspectFile(f => ({ ...f, original_name: updated.original_name }));
      setRenaming(false);
      toast.success('Renamed');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleCompress() {
    if (!inspectFile) return;
    setCompressing(true);
    try {
      const updated = await api.compressFile(inspectFile.id);
      setFiles(fs => fs.map(f => f.id === inspectFile.id ? { ...f, size: updated.size } : f));
      setInspectFile(f => ({ ...f, size: updated.size }));
      // Invalidate cached serve URL so re-fetch picks up new variants
      await api.prefetchFileServeUrls([inspectFile.id]).catch(() => {});
      setServeEpoch(e => e + 1);
      toast.success('Re-compressed');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCompressing(false);
    }
  }

  async function handleDeleteFromInspect() {
    if (!inspectFile) return;
    setInspectFile(null);
    setConfirmDeleteInspect(false);
    await handleDelete(inspectFile);
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
    const pageIds = pagedFiles.map((file) => file.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const isImage = (f) => f.mime_type && f.mime_type.startsWith('image/');

  const filtered = files.filter(f => {
    if (filter === 'images') return isImage(f);
    if (filter === 'docs') return !isImage(f);
    return true;
  });
  const pageSize = viewMode === 'tiles' ? 48 : 25;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedFiles = filtered.slice((page - 1) * pageSize, page * pageSize);
  const shouldVirtualizeTiles = viewMode === 'tiles' && filtered.length > 120;
  const shouldVirtualizeList = viewMode === 'list' && filtered.length > 120;

  const selectedCount = selectedIds.size;

  useEffect(() => {
    setPage(1);
  }, [filter, viewMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
        <span className="text-[13px] text-text-muted">
          {filtered.length === 0
            ? '0 files'
            : `Showing ${((page - 1) * pageSize) + 1}-${Math.min(page * pageSize, filtered.length)} of ${filtered.length} file${filtered.length !== 1 ? 's' : ''}`}
        </span>
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
        shouldVirtualizeTiles ? (
          <VirtualGrid
            items={filtered}
            itemHeight={220}
            minColumnWidth={160}
            gap={12}
            maxHeight="min(72vh, 1000px)"
            className="border border-border rounded-xl p-3 bg-bg"
            renderItem={(file) => (
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
                <div
                  className="aspect-[4/3] overflow-hidden bg-surface cursor-pointer"
                  role="button"
                  tabIndex={-1}
                  onClick={() => openInspect(file)}
                >
                  <img
                    src={api.fileServeUrl(file.id, { variant: 'thumb' })}
                    alt={file.original_name}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div
                  className="aspect-[4/3] flex items-center justify-center bg-surface cursor-pointer"
                  role="button"
                  tabIndex={-1}
                  onClick={() => openInspect(file)}
                >
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
            )}
          />
        ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {pagedFiles.map(file => (
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
                <div
                  className="aspect-[4/3] overflow-hidden bg-surface cursor-pointer"
                  role="button"
                  tabIndex={-1}
                  onClick={() => openInspect(file)}
                >
                  <img
                    src={api.fileServeUrl(file.id, { variant: 'thumb' })}
                    alt={file.original_name}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div
                  className="aspect-[4/3] flex items-center justify-center bg-surface cursor-pointer"
                  role="button"
                  tabIndex={-1}
                  onClick={() => openInspect(file)}
                >
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
        )
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className={`${thClass} w-10`}>
                    <input
                      type="checkbox"
                      checked={pagedFiles.length > 0 && pagedFiles.every((file) => selectedIds.has(file.id))}
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
              {shouldVirtualizeList ? (
                <tbody>
                  <tr>
                    <td colSpan={6} className="p-0 border-b-0">
                      <VirtualList
                        items={filtered}
                        rowHeight={53}
                        maxHeight="min(72vh, 960px)"
                        renderItem={(file) => (
                          <div className={`grid grid-cols-[40px_minmax(220px,1fr)_minmax(160px,0.8fr)_100px_120px_minmax(220px,1fr)] items-center border-b border-border px-0 ${selectedIds.has(file.id) ? 'bg-primary/10' : ''}`}>
                            <div className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(file.id)}
                                onChange={() => toggleSelect(file.id)}
                                aria-label={`Select ${file.original_name}`}
                              />
                            </div>
                            <div
                              className="px-3 py-2.5 font-medium cursor-pointer min-w-0"
                              onClick={() => openInspect(file)}
                              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openInspect(file)}
                              tabIndex={0}
                            >
                              <span className="mr-2" aria-hidden="true">{isImage(file) ? '🖼️' : mimeIcon(file.mime_type)}</span>
                              <span title={file.original_name}>{file.original_name}</span>
                            </div>
                            <div className="px-3 py-2.5 text-[12px] text-text-muted truncate">{file.mime_type || '—'}</div>
                            <div className="px-3 py-2.5 text-[12px] text-text-muted">{formatSize(file.size)}</div>
                            <div className="px-3 py-2.5 text-[12px] text-text-muted">{file.created_at ? new Date(file.created_at).toLocaleDateString() : '—'}</div>
                            <div className="px-3 py-2.5 whitespace-nowrap">
                              <button type="button" className="btn btn-ghost btn-sm mr-1" onClick={() => copyUrl(file)}>Copy URL</button>
                              {!isImage(file) && (
                                <a href={api.fileServeUrl(file.id)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mr-1">Download</a>
                              )}
                              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(file)}>Delete</button>
                            </div>
                          </div>
                        )}
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {pagedFiles.map(file => (
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
              )}
            </table>
          </div>
        </div>
      )}

      {!loading && !shouldVirtualizeTiles && !shouldVirtualizeList && filtered.length > pageSize && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-text-muted">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage(1)} disabled={page === 1}>First</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last</button>
          </div>
        </div>
      )}

      {!loading && (shouldVirtualizeTiles || shouldVirtualizeList) && (
        <div className="text-[12px] text-text-muted">Virtualized {filtered.length} files</div>
      )}

      {confirmBulkDelete && (
        <ConfirmDialog
          title="Delete selected files?"
          message={`Delete ${selectedCount} file(s)? This cannot be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}

      {/* File inspector panel — centered modal */}
      {inspectFile && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] flex items-end sm:items-center sm:justify-center p-0 sm:p-4"
          onKeyDown={e => e.key === 'Escape' && setInspectFile(null)}
        >
          <div
            className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:w-[540px] max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-file-name"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
              <span className="text-[26px] shrink-0" aria-hidden="true">{isImage(inspectFile) ? '🖼️' : mimeIcon(inspectFile.mime_type)}</span>
              <div className="flex-1 min-w-0">
                {renaming ? (
                  <form
                    onSubmit={e => { e.preventDefault(); handleRename(); }}
                    className="flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      className="input text-[13px] py-1 px-2 flex-1 min-w-0"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      aria-label="New file name"
                    />
                    <button type="submit" className="btn btn-primary btn-sm">Save</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      id="inspect-file-name"
                      className="text-[15px] font-semibold block truncate text-left bg-transparent border-none p-0 cursor-text hover:text-primary transition-colors w-full"
                      title="Click to rename"
                      onClick={() => { setRenameValue(inspectFile.original_name); setRenaming(true); }}
                    >
                      {inspectFile.original_name}
                    </button>
                    <span className="text-[12px] text-text-muted">{formatSize(inspectFile.size)}{inspectFile.mime_type ? ` · ${inspectFile.mime_type}` : ''}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-text-muted hover:text-danger cursor-pointer bg-transparent border-none text-[18px] leading-none"
                onClick={() => { setInspectFile(null); setRenaming(false); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Image preview */}
              {isImage(inspectFile) && (
                <div className="p-5 border-b border-border bg-surface/40 flex items-center justify-center">
                  <img
                    src={api.fileServeUrl(inspectFile.id, { variant: 'large' })}
                    alt={inspectFile.original_name}
                    className="max-w-full max-h-[340px] rounded-lg object-contain shadow"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyUrl(inspectFile)}
                >
                  Copy URL
                </button>
                {!isImage(inspectFile) && (
                  <a
                    href={api.fileServeUrl(inspectFile.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Download
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setRenameValue(inspectFile.original_name);
                    setRenaming(true);
                  }}
                >
                  Rename
                </button>
                {isImage(inspectFile) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={compressing}
                    onClick={handleCompress}
                    title="Re-compress image and regenerate WebP variants"
                  >
                    {compressing ? <><span className="spinner" /> Compressing…</> : 'Compress'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger ml-auto"
                  onClick={() => setConfirmDeleteInspect(true)}
                >
                  Delete
                </button>
              </div>

              {/* Confirm delete inside panel */}
              {confirmDeleteInspect && (
                <div className="px-5 py-4 border-b border-border bg-danger/5 flex flex-col gap-3">
                  <p className="text-[13px] font-medium text-danger">Delete this file? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-sm" style={{ background: 'var(--color-danger)', color: '#fff', borderColor: 'var(--color-danger)' }} onClick={handleDeleteFromInspect}>
                      Yes, delete
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteInspect(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Linked projects */}
              <div className="px-5 py-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">Linked Projects</h4>
                {inspectLoading ? (
                  <div className="text-[13px] text-text-muted py-2"><span className="spinner" /></div>
                ) : inspectQuotes.length === 0 ? (
                  <p className="text-[13px] text-text-muted">Not attached to any projects.</p>
                ) : (
                  <ul className="list-none p-0 m-0 flex flex-col gap-3">
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
        </div>
      )}
    </div>
  );
}
