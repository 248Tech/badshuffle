const crypto = require('crypto');

function getKey() {
  return crypto.createHash('sha256').update(process.env.JWT_SECRET || 'change-me').digest();
}

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  return iv.toString('hex') + ':' + Buffer.concat([c.update(text, 'utf8'), c.final()]).toString('hex');
}

function decrypt(enc) {
  if (!enc) return '';
  const [ivHex, dataHex] = enc.split(':');
  if (!ivHex || !dataHex) return '';
  const d = crypto.createDecipheriv('aes-256-cbc', getKey(), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([d.update(Buffer.from(dataHex, 'hex')), d.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
