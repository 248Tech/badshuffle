function listFiles(db, orgId) {
  return db.prepare(
    `SELECT id, original_name, mime_type, size, created_at, is_image, storage_mode, source_format, width, height
     FROM files
     WHERE org_id = ?
     ORDER BY created_at DESC`
  ).all(orgId);
}

function getFileById(db, fileId, orgId = null) {
  if (orgId == null) {
    return db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) || null;
  }
  return db.prepare('SELECT * FROM files WHERE id = ? AND org_id = ?').get(fileId, orgId) || null;
}

function getFileSummaryById(db, fileId) {
  return db.prepare(
    `SELECT id, original_name, mime_type, size, created_at, is_image, storage_mode, source_format, width, height
     FROM files
     WHERE id = ?`
  ).get(fileId) || null;
}

function listFileVariants(db, fileId) {
  return db.prepare(
    `SELECT id, file_id, variant_key, format, stored_name, mime_type, size, width, height, created_at
     FROM file_variants
     WHERE file_id = ?
     ORDER BY variant_key ASC, format ASC`
  ).all(fileId);
}

function listQuotesForFile(db, fileId) {
  return db.prepare(
    `SELECT q.id, q.name, q.status, q.event_date, q.client_first_name, q.client_last_name
     FROM quote_attachments qa
     JOIN quotes q ON q.id = qa.quote_id
     WHERE qa.file_id = ?
     ORDER BY q.created_at DESC`
  ).all(fileId);
}

module.exports = {
  listFiles,
  getFileById,
  getFileSummaryById,
  listFileVariants,
  listQuotesForFile,
};
