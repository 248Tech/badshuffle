const { requireQuoteById } = require('../db/queries/quotes');
const ORG_ID = 1;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function listQuoteFiles(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  let files = [];
  try {
    files = db.prepare(`
      SELECT qa.id as attachment_id,
             qa.created_at as attached_at,
             f.id as file_id,
             f.original_name,
             f.mime_type,
             f.size,
             cse.id as signature_event_id,
             cse.signed_at as signature_signed_at,
             cse.signer_name as signature_signer_name,
             cse.signer_ip as signature_signer_ip,
             cse.signer_user_agent as signature_signer_user_agent,
             cse.signed_quote_total as signature_signed_quote_total,
             cse.quote_snapshot_hash as signature_quote_snapshot_hash,
             CASE
               WHEN cse.id IS NOT NULL THEN (
                 SELECT COUNT(*)
                 FROM contract_signature_events prev
                 WHERE prev.quote_id = qa.quote_id
                   AND prev.id <= cse.id
               )
               ELSE NULL
             END as signature_version_number
      FROM quote_attachments qa
      JOIN files f ON f.id = qa.file_id
      LEFT JOIN contract_signature_events cse ON cse.file_id = f.id AND cse.quote_id = qa.quote_id
      WHERE qa.quote_id = ?
      ORDER BY qa.created_at DESC
    `).all(quoteId);
  } catch (e) {
    files = [];
  }
  return { files };
}

function attachQuoteFile(db, quoteId, body, deps) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const { file_id } = body || {};
  if (!file_id) throw createError(400, 'file_id required');

  const file = db.prepare('SELECT id, original_name FROM files WHERE id = ? AND org_id = ?').get(file_id, ORG_ID);
  if (!file) throw createError(404, 'File not found');

  try {
    db.prepare('INSERT OR IGNORE INTO quote_attachments (quote_id, file_id) VALUES (?, ?)').run(quoteId, file_id);
    deps.logActivity(db, quoteId, 'file_attached', `Attached file: ${file.original_name || file_id}`, null, null, deps.req);
  } catch (e) {
    throw createError(500, e.message);
  }

  let files = [];
  try {
    files = db.prepare(`
      SELECT qa.id as attachment_id, qa.created_at, f.id as file_id, f.original_name, f.mime_type, f.size
      FROM quote_attachments qa
      JOIN files f ON f.id = qa.file_id
      WHERE qa.quote_id = ?
      ORDER BY qa.created_at DESC
    `).all(quoteId);
  } catch (e) {
    files = [];
  }

  return { files };
}

function deleteQuoteFile(db, quoteId, fileId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  try {
    const signatureEvent = db.prepare(
      'SELECT id FROM contract_signature_events WHERE quote_id = ? AND file_id = ?'
    ).get(quoteId, fileId);
    if (signatureEvent) {
      throw createError(409, 'Signed contract artifacts are locked and cannot be removed from project files');
    }
    db.prepare('DELETE FROM quote_attachments WHERE quote_id = ? AND file_id = ?').run(quoteId, fileId);
  } catch (e) {
    if (e && e.statusCode) throw e;
  }
  return { ok: true };
}

module.exports = {
  listQuoteFiles,
  attachQuoteFile,
  deleteQuoteFile,
};
