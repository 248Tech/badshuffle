const bwipjs = require('bwip-js');

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildBwipConfig(format, text, label) {
  const normalizedFormat = String(format || 'qrcode').trim().toLowerCase();
  const isQrCode = normalizedFormat === 'qrcode';
  const config = {
    bcid: normalizedFormat,
    text,
    scale: isQrCode ? 2 : 2,
    backgroundcolor: 'ffffff',
    barcolor: '000000',
  };

  if (isQrCode) {
    // Match the working qr path from barcode-generator-main: keep the config
    // minimal and do not pass width/height keys at all.
    config.padding = 2.5;
    if (label) {
      config.includetext = true;
      config.alttext = label;
    }
    return config;
  }

  config.includetext = Boolean(label);
  if (label) config.alttext = label;
  config.width = 2;
  config.height = 14;
  config.paddingwidth = 6;
  config.paddingheight = 6;
  return config;
}

function renderSvg({ format = 'qrcode', value, label = '' }) {
  const normalizedFormat = String(format || 'qrcode').trim().toLowerCase();
  const text = String(value || '').trim();
  if (!text) throw createError(400, 'Barcode value is required');

  try {
    return bwipjs.toSVG(buildBwipConfig(normalizedFormat, text, String(label || '').trim()));
  } catch (error) {
    throw createError(400, `Invalid barcode value for ${normalizedFormat}`);
  }
}

module.exports = {
  buildBwipConfig,
  renderSvg,
};
