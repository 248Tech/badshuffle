const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getSignedFileServePath } = require('../lib/fileServeAuth');
const { getSettingValue } = require('../db/queries/settings');
const {
  listFiles,
  getFileById,
  getFileSummaryById,
  listFileVariants,
  listQuotesForFile,
} = require('../db/queries/files');
const {
  isImageMime,
  sanitizeQuality,
  flagEnabled,
  processImageUpload,
  cleanupStoredNames,
  chooseImageVariant,
} = require('./imageCompressionService');

const ALLOWED = [
  { mime: 'image/jpeg', sig: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', sig: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif', sig: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', sig: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'image/avif', sig: [0x00, 0x00, 0x00] },
  { mime: 'application/pdf', sig: [0x25, 0x50, 0x44, 0x46] },
];
const ALLOWED_MIMES = new Set(ALLOWED.map((a) => a.mime));
const DEFAULT_ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
  'image/avif',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.pdf',
]);
const IMAGE_VARIANT_KEYS = new Set(['thumb', 'ui', 'large']);

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeTypeToken(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('/')) return raw;
  if (raw.startsWith('.')) return raw;
  return `.${raw}`;
}

function getConfiguredAllowedTypes(db) {
  const configured = new Set();
  for (const token of String(getSettingValue(db, 'allowed_file_types', '') || '').split(/[\s,]+/)) {
    const normalized = normalizeTypeToken(token);
    if (normalized) configured.add(normalized);
  }
  return configured;
}

function getFileExtension(filename) {
  return normalizeTypeToken(path.extname(String(filename || '')));
}

function isAllowedFileType(file, detectedMime, configuredAllowedTypes) {
  const extension = getFileExtension(file.originalname);
  const declaredMime = normalizeTypeToken(file.mimetype);
  if (detectedMime && (ALLOWED_MIMES.has(detectedMime) || configuredAllowedTypes.has(detectedMime) || DEFAULT_ALLOWED_TYPES.has(detectedMime))) {
    return true;
  }
  if (declaredMime && (configuredAllowedTypes.has(declaredMime) || DEFAULT_ALLOWED_TYPES.has(declaredMime))) {
    return true;
  }
  if (extension && (configuredAllowedTypes.has(extension) || DEFAULT_ALLOWED_TYPES.has(extension))) {
    return true;
  }
  return false;
}

function resolveStoredMime(file, detectedMime) {
  return detectedMime || file.mimetype || 'application/octet-stream';
}

function detectMime(filePath) {
  const buf = Buffer.alloc(16);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  for (const { mime, sig } of ALLOWED) {
    if (sig.every((b, i) => buf[i] === b)) return mime;
  }
  if (buf.slice(4, 12).toString('ascii') === 'ftypavif') return 'image/avif';
  return null;
}

function getCompressionSettings(db) {
  return {
    webpQuality: sanitizeQuality(getSettingValue(db, 'image_webp_quality', '68'), 68),
    avifEnabled: flagEnabled(getSettingValue(db, 'image_avif_enabled', '0'), false),
  };
}

function listAllFiles(db, orgId) {
  return { files: listFiles(db, orgId) };
}

function insertImageFile(db, orgId, file, userId, processed) {
  const defaultVariant = processed.defaultVariant;
  const result = db.prepare(
    `INSERT INTO files (
      org_id, original_name, stored_name, mime_type, size, uploaded_by, is_image, storage_mode, source_format, width, height
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 'image_variants', ?, ?, ?)`
  ).run(
    orgId,
    file.originalname,
    defaultVariant.storedName,
    defaultVariant.mimeType,
    processed.totalSize,
    userId,
    processed.metadata.format || file.mimetype || null,
    processed.metadata.width,
    processed.metadata.height
  );
  const fileId = result.lastInsertRowid;
  const variantStmt = db.prepare(
    `INSERT INTO file_variants (
      file_id, variant_key, format, stored_name, mime_type, size, width, height
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const variant of processed.variants) {
    variantStmt.run(
      fileId,
      variant.variantKey,
      variant.format,
      variant.storedName,
      variant.mimeType,
      variant.size,
      variant.width,
      variant.height
    );
  }
  return getFileSummaryById(db, fileId);
}

function insertBinaryFile(db, orgId, file, userId, storedMime) {
  const result = db.prepare(
    `INSERT INTO files (
      org_id, original_name, stored_name, mime_type, size, uploaded_by, is_image, storage_mode, source_format, width, height
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'legacy_single', ?, NULL, NULL)`
  ).run(orgId, file.originalname, file.filename, storedMime, file.size, userId, storedMime);
  return getFileSummaryById(db, result.lastInsertRowid);
}

async function uploadFiles(db, orgId, files, user, uploadsDir) {
  if (!files || files.length === 0) throw createError(400, 'No files provided');
  const userId = user ? (user.id ?? user.sub) : null;
  const configuredAllowedTypes = getConfiguredAllowedTypes(db);
  const inserted = [];
  const createdStoredNames = [];
  const compressionSettings = getCompressionSettings(db);

  try {
    for (const file of files) {
      const detectedMime = detectMime(file.path);
      if (!isAllowedFileType(file, detectedMime, configuredAllowedTypes)) {
        try { fs.unlinkSync(file.path); } catch {}
        throw createError(400, `Unsupported file type: ${file.originalname}`);
      }
      const storedMime = resolveStoredMime(file, detectedMime);
      if (isImageMime(storedMime)) {
        const processed = await processImageUpload(file.path, uploadsDir, compressionSettings);
        createdStoredNames.push(...processed.variants.map((variant) => variant.storedName));
        inserted.push(insertImageFile(db, orgId, file, userId, processed));
        try { fs.unlinkSync(file.path); } catch {}
      } else {
        inserted.push(insertBinaryFile(db, orgId, file, userId, storedMime));
        createdStoredNames.push(file.filename);
      }
    }
  } catch (error) {
    cleanupStoredNames(uploadsDir, createdStoredNames);
    const keptNames = new Set(createdStoredNames);
    for (const file of files) {
      const currentName = path.basename(String(file.filename || ''));
      if (!currentName || keptNames.has(currentName)) continue;
      try { fs.unlinkSync(file.path); } catch {}
    }
    throw error;
  }

  return { files: inserted };
}

function buildServeLinks(db, orgId, ids, basePath) {
  const uniq = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x).trim()).filter((id) => /^\d+$/.test(id)))].slice(0, 200);
  const paths = {};
  for (const id of uniq) {
    const file = getFileById(db, id, orgId);
    if (file) paths[id] = getSignedFileServePath(id, basePath);
  }
  return { paths };
}

function buildServeLink(db, orgId, fileId, basePath) {
  const normalized = String(fileId || '').trim();
  if (!/^\d+$/.test(normalized)) throw createError(400, 'Invalid id');
  const file = getFileById(db, normalized, orgId);
  if (!file) throw createError(404, 'Not found');
  return { path: getSignedFileServePath(normalized, basePath) };
}

function listAttachedQuotes(db, fileId) {
  return { quotes: listQuotesForFile(db, fileId) };
}

function resolveServeAsset(db, fileId, orgId, options = {}) {
  const file = getFileById(db, fileId, orgId);
  if (!file) throw createError(404, 'Not found');

  if (Number(file.is_image) === 1 && file.storage_mode === 'image_variants') {
    const requestedVariant = IMAGE_VARIANT_KEYS.has(options.variant) ? options.variant : 'ui';
    const variants = listFileVariants(db, fileId);
    const selectedVariant = chooseImageVariant(variants, requestedVariant, options.acceptHeader || '');
    if (!selectedVariant) throw createError(404, 'Image variant not found');
    return {
      file,
      variant: selectedVariant,
      storedName: selectedVariant.stored_name,
      mimeType: selectedVariant.mime_type,
    };
  }

  return {
    file,
    variant: null,
    storedName: file.stored_name,
    mimeType: file.mime_type || 'application/octet-stream',
  };
}

function deleteFile(db, orgId, fileId, uploadsDir) {
  const file = getFileById(db, fileId, orgId);
  if (!file) throw createError(404, 'Not found');
  const variants = listFileVariants(db, fileId);
  const namesToDelete = new Set([file.stored_name, ...variants.map((variant) => variant.stored_name)]);
  cleanupStoredNames(uploadsDir, Array.from(namesToDelete));
  db.prepare('DELETE FROM files WHERE id = ? AND org_id = ?').run(fileId, orgId);
  return { deleted: true };
}

function renameFile(db, orgId, fileId, newName) {
  const name = String(newName || '').trim();
  if (!name) throw createError(400, 'Name is required');
  if (name.length > 255) throw createError(400, 'Name too long');
  const file = getFileById(db, fileId, orgId);
  if (!file) throw createError(404, 'Not found');
  db.prepare('UPDATE files SET original_name = ? WHERE id = ? AND org_id = ?').run(name, Number(fileId), orgId);
  return getFileSummaryById(db, fileId);
}

async function compressFile(db, orgId, fileId, uploadsDir) {
  const file = getFileById(db, fileId, orgId);
  if (!file) throw createError(404, 'Not found');
  if (!Number(file.is_image)) throw createError(400, 'Only images can be compressed');
  if (file.storage_mode !== 'image_variants') throw createError(400, 'File format not supported for re-compression');

  const srcPath = path.join(uploadsDir, file.stored_name);
  if (!fs.existsSync(srcPath)) throw createError(404, 'Source file not found on disk');

  // Copy source to a temp path so we can safely overwrite variants
  const tmpName = crypto.randomBytes(16).toString('hex') + path.extname(file.stored_name);
  const tmpPath = path.join(uploadsDir, tmpName);
  fs.copyFileSync(srcPath, tmpPath);

  const compressionSettings = getCompressionSettings(db);
  let processed;
  try {
    processed = await processImageUpload(tmpPath, uploadsDir, compressionSettings);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }

  // Delete old variants from disk (but not the original stored_name — it's our source and
  // will be replaced by the new defaultVariant below)
  const oldVariants = listFileVariants(db, fileId);
  const oldStoredName = file.stored_name;
  cleanupStoredNames(uploadsDir, [oldStoredName, ...oldVariants.map((v) => v.stored_name)]);

  // Update files row with new default variant
  db.prepare(
    'UPDATE files SET stored_name = ?, mime_type = ?, size = ?, width = ?, height = ? WHERE id = ? AND org_id = ?'
  ).run(
    processed.defaultVariant.storedName,
    processed.defaultVariant.mimeType,
    processed.totalSize,
    processed.metadata.width,
    processed.metadata.height,
    Number(fileId),
    orgId
  );

  // Replace variant rows
  db.prepare('DELETE FROM file_variants WHERE file_id = ?').run(Number(fileId));
  const variantStmt = db.prepare(
    `INSERT INTO file_variants (file_id, variant_key, format, stored_name, mime_type, size, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const variant of processed.variants) {
    variantStmt.run(fileId, variant.variantKey, variant.format, variant.storedName, variant.mimeType, variant.size, variant.width, variant.height);
  }

  return getFileSummaryById(db, fileId);
}

module.exports = {
  listAllFiles,
  uploadFiles,
  buildServeLinks,
  buildServeLink,
  listAttachedQuotes,
  resolveServeAsset,
  deleteFile,
  renameFile,
  compressFile,
};
