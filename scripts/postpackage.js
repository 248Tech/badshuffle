'use strict';
/**
 * postpackage.js — run after `pkg` produces both exes.
 * 1. Copies client/dist/ → dist/www/
 * 2. Copies .env.example → dist/.env.example
 * 3. Writes dist/START.bat
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

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

// ── 3. Write START.bat ───────────────────────────────────────────────────────

const bat = `@echo off
echo Starting BadShuffle server...
start "" "%~dp0badshuffle-server.exe"
timeout /t 2 /nobreak >nul
echo Starting BadShuffle client...
start "" "%~dp0badshuffle-client.exe"
`;

fs.writeFileSync(path.join(DIST, 'START.bat'), bat);
console.log('Wrote dist/START.bat');

console.log('\nDone! dist/ contents:');
for (const f of fs.readdirSync(DIST)) {
  console.log('  ' + f);
}
