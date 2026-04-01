const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGE_SIGNATURES = new Map([
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47]],
  ['image/gif', [0x47, 0x49, 0x46]],
  ['image/webp', [0x52, 0x49, 0x46, 0x46]],
  ['image/avif', [0x00, 0x00, 0x00]],
]);

const IMAGE_VARIANTS = [
  { key: 'thumb', width: 240 },
  { key: 'ui', width: 960 },
  { key: 'large', width: 1600 },
];

const IMAGE_MAX_INPUT_PIXELS = 80_000_000;

function isImageMime(mime) {
  return String(mime || '').startsWith('image/');
}

function sanitizeQuality(value, fallback = 68) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(90, Math.max(40, Math.round(parsed)));
}

function flagEnabled(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value) === '1' || value === true || value === 'true';
}

function randomStoredName(extension) {
  return `${crypto.randomBytes(18).toString('hex')}.${extension}`;
}

function buildVariantFilename() {
  return crypto.randomBytes(18).toString('hex');
}

async function getImageMetadata(filePath) {
  const image = sharp(filePath, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, animated: true });
  const metadata = await image.metadata();
  return {
    width: metadata.width || null,
    height: metadata.height || null,
    format: metadata.format || null,
    pages: metadata.pages || 1,
  };
}

async function buildWebpVariant(filePath, width, quality) {
  const pipeline = sharp(filePath, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, animated: false })
    .rotate()
    .resize({ width, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality, effort: 6 })
    .withMetadata({ icc: 'srgb' });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format: 'webp',
    mimeType: 'image/webp',
    width: info.width || null,
    height: info.height || null,
  };
}

async function buildAvifVariant(filePath, width, quality) {
  const pipeline = sharp(filePath, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, animated: false })
    .rotate()
    .resize({ width, withoutEnlargement: true, fit: 'inside' })
    .avif({ quality: Math.max(35, Math.min(80, quality - 6)), effort: 6 })
    .withMetadata({ icc: 'srgb' });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format: 'avif',
    mimeType: 'image/avif',
    width: info.width || null,
    height: info.height || null,
  };
}

function writeVariantBuffer(uploadsDir, buffer, extension) {
  const storedName = randomStoredName(extension);
  const filePath = path.join(uploadsDir, storedName);
  fs.writeFileSync(filePath, buffer);
  return storedName;
}

async function processImageUpload(filePath, uploadsDir, options = {}) {
  const quality = sanitizeQuality(options.webpQuality, 68);
  const avifEnabled = flagEnabled(options.avifEnabled, false);
  const metadata = await getImageMetadata(filePath);
  const baseName = buildVariantFilename();
  const variants = [];
  const createdNames = [];

  try {
    for (const variant of IMAGE_VARIANTS) {
      const webp = await buildWebpVariant(filePath, variant.width, quality);
      const webpStored = `${baseName}-${variant.key}.webp`;
      fs.writeFileSync(path.join(uploadsDir, webpStored), webp.buffer);
      createdNames.push(webpStored);
      variants.push({
        variantKey: variant.key,
        format: 'webp',
        mimeType: webp.mimeType,
        storedName: webpStored,
        size: webp.buffer.length,
        width: webp.width,
        height: webp.height,
      });

      if (avifEnabled) {
        const avif = await buildAvifVariant(filePath, variant.width, quality);
        const avifStored = `${baseName}-${variant.key}.avif`;
        fs.writeFileSync(path.join(uploadsDir, avifStored), avif.buffer);
        createdNames.push(avifStored);
        variants.push({
          variantKey: variant.key,
          format: 'avif',
          mimeType: avif.mimeType,
          storedName: avifStored,
          size: avif.buffer.length,
          width: avif.width,
          height: avif.height,
        });
      }
    }
  } catch (error) {
    cleanupStoredNames(uploadsDir, createdNames);
    throw error;
  }

  const uiVariant = variants.find((variant) => variant.variantKey === 'ui' && variant.format === 'webp');
  return {
    metadata,
    variants,
    defaultVariant: uiVariant || variants[0],
    totalSize: variants.reduce((sum, variant) => sum + variant.size, 0),
    quality,
    avifEnabled,
  };
}

function cleanupStoredNames(uploadsDir, names) {
  for (const name of names) {
    if (!name) continue;
    try {
      fs.unlinkSync(path.join(uploadsDir, name));
    } catch {}
  }
}

function clientAcceptsFormat(acceptHeader, mimeType) {
  const accept = String(acceptHeader || '').toLowerCase();
  if (!accept) return false;
  return accept.includes(mimeType.toLowerCase()) || accept.includes('image/*') || accept.includes('*/*');
}

function chooseImageVariant(variants, requestedVariant, acceptHeader) {
  const byKey = variants.filter((variant) => variant.variant_key === requestedVariant);
  if (!byKey.length) return null;
  const avif = byKey.find((variant) => variant.format === 'avif');
  if (avif && clientAcceptsFormat(acceptHeader, 'image/avif')) return avif;
  return byKey.find((variant) => variant.format === 'webp') || byKey[0] || null;
}

function buildDemoSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067" viewBox="0 0 1600 1067">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0d9488"/>
          <stop offset="45%" stop-color="#155e75"/>
          <stop offset="100%" stop-color="#111827"/>
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.78)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.14)"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.85)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="1600" height="1067" fill="url(#bg)"/>
      <circle cx="1240" cy="230" r="220" fill="url(#glow)"/>
      <rect x="102" y="120" rx="48" ry="48" width="1390" height="827" fill="url(#glass)" stroke="rgba(255,255,255,0.26)" stroke-width="2"/>
      <rect x="180" y="200" width="620" height="420" rx="32" fill="#f8fafc"/>
      <rect x="210" y="230" width="560" height="160" rx="24" fill="#0ea5e9"/>
      <rect x="210" y="416" width="410" height="28" rx="14" fill="#0f172a" opacity="0.9"/>
      <rect x="210" y="468" width="320" height="22" rx="11" fill="#475569" opacity="0.8"/>
      <rect x="210" y="512" width="180" height="74" rx="20" fill="#14b8a6"/>
      <text x="228" y="338" font-family="Arial, sans-serif" font-size="94" font-weight="700" fill="#f8fafc">BadShuffle</text>
      <text x="228" y="560" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#ecfeff">Event Rentals</text>
      <circle cx="1130" cy="480" r="176" fill="#f59e0b"/>
      <circle cx="1210" cy="415" r="116" fill="#fb7185" opacity="0.92"/>
      <circle cx="1000" cy="575" r="122" fill="#38bdf8" opacity="0.94"/>
      <rect x="864" y="650" width="462" height="88" rx="28" fill="rgba(15,23,42,0.78)"/>
      <text x="900" y="706" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#f8fafc">Compression Preview</text>
      <text x="188" y="760" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#f8fafc">Rich gradients, text, and layered edges</text>
      <text x="188" y="826" font-family="Arial, sans-serif" font-size="30" fill="rgba(248,250,252,0.86)">Designed to make quality loss easy to judge before saving.</text>
    </svg>
  `;
}

async function buildDemoOriginalBuffer() {
  const svgBuffer = Buffer.from(buildDemoSvg());
  return sharp(svgBuffer, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS })
    .png()
    .toBuffer();
}

async function buildPreviewBuffer({ quality = 68, format = 'webp', original = false } = {}) {
  const source = await buildDemoOriginalBuffer();
  if (original) {
    return {
      buffer: source,
      mimeType: 'image/png',
    };
  }
  const pipeline = sharp(source, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS }).resize({ width: 960, withoutEnlargement: true, fit: 'inside' });
  if (format === 'avif') {
    const buffer = await pipeline.avif({ quality: Math.max(35, Math.min(80, sanitizeQuality(quality) - 6)), effort: 6 }).toBuffer();
    return { buffer, mimeType: 'image/avif' };
  }
  const buffer = await pipeline.webp({ quality: sanitizeQuality(quality), effort: 6 }).toBuffer();
  return { buffer, mimeType: 'image/webp' };
}

module.exports = {
  IMAGE_SIGNATURES,
  IMAGE_VARIANTS,
  isImageMime,
  sanitizeQuality,
  flagEnabled,
  writeVariantBuffer,
  processImageUpload,
  cleanupStoredNames,
  chooseImageVariant,
  buildPreviewBuffer,
};
