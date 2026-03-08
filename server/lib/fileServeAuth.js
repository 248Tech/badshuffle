/**
 * Signed URL support for file serve — allows unauthenticated access only with valid sig+exp.
 * Used for public quote images so <img> tags work without Bearer token.
 */
const crypto = require('crypto');

const FILE_SERVE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSecret() {
  return process.env.JWT_SECRET || 'change-me';
}

function signFileServe(fileId) {
  const exp = Date.now() + FILE_SERVE_TTL_MS;
  const payload = fileId + ':' + exp;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return { sig, exp };
}

function verifyFileServe(fileId, sig, exp) {
  if (!fileId || !sig || !exp) return false;
  const expNum = parseInt(exp, 10);
  if (isNaN(expNum) || expNum < Date.now()) return false;
  const payload = fileId + ':' + exp;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  try {
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/** Returns query string for signed file serve, e.g. "sig=...&exp=..." */
function getSignedFileServeQuery(fileId) {
  const { sig, exp } = signFileServe(fileId);
  return `sig=${sig}&exp=${exp}`;
}

/** Returns path + query for use in response, e.g. "/api/files/5/serve?sig=...&exp=..." */
function getSignedFileServePath(fileId, basePath) {
  const base = basePath || '/api/files';
  return `${base}/${fileId}/serve?${getSignedFileServeQuery(fileId)}`;
}

module.exports = {
  signFileServe,
  verifyFileServe,
  getSignedFileServeQuery,
  getSignedFileServePath,
};
