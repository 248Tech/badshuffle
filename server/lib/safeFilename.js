/**
 * Sanitize filename for Content-Disposition to prevent header injection (CR/LF, etc.).
 */
function safeFilename(name) {
  if (name == null || typeof name !== 'string') return 'download';
  // Strip control chars, double-quote, backslash; limit length
  let out = name.replace(/[\x00-\x1f\x7f"\\]/g, '').trim();
  if (!out) return 'download';
  return out.slice(0, 200);
}

module.exports = { safeFilename };
