'use strict';
/**
 * postpackage.js — assemble release archives without publishing desktop executables.
 * 1. Copies client/dist/ → dist/www/
 * 2. Copies .env.example → dist/.env.example
 * 3. Removes legacy .exe / START.bat artifacts from dist/
 * 4. Creates dist/www.zip
 * 5. Creates dist/badshuffle-extension.zip
 */
const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src,  entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── 1. Copy client build → dist/www/ ────────────────────────────────────────

const clientDist = path.join(ROOT, 'client', 'dist');
const www        = path.join(DIST, 'www');

if (!fs.existsSync(clientDist)) {
  console.error('ERROR: client/dist/ not found. Run `npm run build:client` first.');
  process.exit(1);
}

console.log('Copying client/dist → dist/www …');
copyDirSync(clientDist, www);

// ── 2. Copy .env.example ─────────────────────────────────────────────────────

const envExample = path.join(ROOT, '.env.example');
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, path.join(DIST, '.env.example'));
  console.log('Copied .env.example → dist/.env.example');
}

// ── 3. Remove legacy desktop artifacts ───────────────────────────────────────

for (const legacyFile of ['badshuffle-server.exe', 'badshuffle-client.exe', 'badshuffle-updater.exe', 'START.bat']) {
  const legacyPath = path.join(DIST, legacyFile);
  if (fs.existsSync(legacyPath)) {
    fs.rmSync(legacyPath, { force: true });
    console.log(`Removed dist/${legacyFile}`);
  }
}

// ── 4. Create www.zip (for updater downloads) ────────────────────────────────

const wwwZip      = path.join(DIST, 'www.zip');
const wwwContents = www + '\\*';
console.log('Creating dist/www.zip …');
execSync(`powershell -Command "Compress-Archive -Path '${wwwContents}' -DestinationPath '${wwwZip}' -Force"`);
console.log('Created dist/www.zip');

// ── 5. Create badshuffle-extension.zip (for extension install page) ──────────

const extensionSrc = path.join(ROOT, 'extension');
const extZip       = path.join(DIST, 'badshuffle-extension.zip');

if (fs.existsSync(extensionSrc)) {
  const extContents = extensionSrc + '\\*';
  console.log('Creating dist/badshuffle-extension.zip …');
  // Use a temp dir so files end up under badshuffle-extension/ inside the zip
  const tmpExt = path.join(DIST, '_ext_tmp', 'badshuffle-extension');
  fs.mkdirSync(tmpExt, { recursive: true });
  copyDirSync(extensionSrc, tmpExt);
  const tmpFolder = path.join(DIST, '_ext_tmp', 'badshuffle-extension');
  execSync(`powershell -Command "Compress-Archive -Path '${tmpFolder}' -DestinationPath '${extZip}' -Force"`);
  // Clean up temp dir
  fs.rmSync(path.join(DIST, '_ext_tmp'), { recursive: true, force: true });
  console.log('Created dist/badshuffle-extension.zip');
} else {
  console.warn('WARNING: extension/ folder not found — skipping badshuffle-extension.zip');
}

console.log('\nDone! dist/ contents:');
for (const f of fs.readdirSync(DIST)) {
  console.log('  ' + f);
}
