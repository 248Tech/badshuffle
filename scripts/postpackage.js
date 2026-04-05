'use strict';
/**
 * postpackage.js — run after `pkg` produces all exes.
 * 1. Copies client/dist/ → dist/www/
 * 2. Copies .env.example → dist/.env.example
 * 3. Copies parity/release-check artifacts → dist/release-checks/
 * 4. Writes dist/START.bat
 * 5. Creates dist/www.zip
 * 6. Creates dist/badshuffle-extension.zip
 */
const fs           = require('fs');
const path         = require('path');
const archiver     = require(path.join(__dirname, '..', 'server', 'node_modules', 'archiver'));

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE_CHECKS = path.join(DIST, 'release-checks');
const PACKAGE_JSON = require(path.join(ROOT, 'package.json'));
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

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function formatMaybe(value, fallback = 'n/a') {
  return value == null || value === '' ? fallback : String(value);
}

function buildReleaseChecksReadme({ manifest, parityPayload }) {
  const lines = [];
  lines.push('# Release Checks');
  lines.push('');
  lines.push(`Packaged: ${formatMaybe(manifest.generated_at)}`);
  lines.push(`Package: ${formatMaybe(manifest.package_name)} v${formatMaybe(manifest.version)}`);
  lines.push('');
  lines.push('## Rust Parity');
  lines.push('');
  if (!parityPayload) {
    lines.push('- Status: no Rust parity report was available at package time');
  } else {
    const totals = parityPayload.totals || {};
    lines.push(`- Report generated: ${formatMaybe(parityPayload.generated_at)}`);
    lines.push(`- Context: ${formatMaybe(parityPayload.context)}`);
    lines.push(`- Quotes checked: ${formatMaybe(totals.quotes_checked, '0')}`);
    lines.push(`- Summary mismatches: ${formatMaybe(totals.summary_mismatches, '0')}`);
    lines.push(`- Item mismatches: ${formatMaybe(totals.item_mismatches, '0')}`);
    lines.push(`- Errors: ${formatMaybe(totals.errors, '0')}`);
  }
  lines.push('');
  lines.push('## Included Files');
  lines.push('');
  lines.push('- `release-checks/manifest.json`: packaged release-check metadata');
  lines.push('- `release-checks/rust-parity-latest.md`: latest parity markdown report');
  lines.push('- `release-checks/rust-parity-latest.json`: latest parity JSON report');
  lines.push('- `www.zip`: packaged client assets');
  if (manifest.packaged_artifacts.extension_zip) {
    lines.push(`- \`${manifest.packaged_artifacts.extension_zip}\`: packaged browser extension`);
  }
  lines.push('');
  lines.push('Review `release-checks/manifest.json` for the machine-readable package summary.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function zipPath(sourcePath, outPath, innerName = null) {
  return new Promise((resolve, reject) => {
    removeIfExists(outPath);
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);

    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      archive.directory(sourcePath, innerName || false);
    } else {
      archive.file(sourcePath, { name: innerName || path.basename(sourcePath) });
    }

    archive.finalize();
  });
}

// ── 1. Copy client build → dist/www/ ────────────────────────────────────────

const clientDist = path.join(ROOT, 'client', 'dist');
const www        = path.join(DIST, 'www');

if (!fs.existsSync(clientDist)) {
  console.error('ERROR: client/dist/ not found. Run `npm run build:client` first.');
  process.exit(1);
}

console.log('Copying client/dist → dist/www …');
removeIfExists(www);
copyDirSync(clientDist, www);

// ── 2. Copy .env.example ─────────────────────────────────────────────────────

const envExample = path.join(ROOT, '.env.example');
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, path.join(DIST, '.env.example'));
  console.log('Copied .env.example → dist/.env.example');
}

// ── 2b. Copy release check artifacts ────────────────────────────────────────

fs.mkdirSync(RELEASE_CHECKS, { recursive: true });
const parityReport = path.join(ROOT, 'AI', 'reports', 'rust-parity-latest.md');
const parityReportJson = path.join(ROOT, 'AI', 'reports', 'rust-parity-latest.json');
if (fs.existsSync(parityReport)) {
  fs.copyFileSync(parityReport, path.join(RELEASE_CHECKS, 'rust-parity-latest.md'));
  console.log('Copied rust parity markdown report → dist/release-checks/');
}
if (fs.existsSync(parityReportJson)) {
  fs.copyFileSync(parityReportJson, path.join(RELEASE_CHECKS, 'rust-parity-latest.json'));
  console.log('Copied rust parity JSON report → dist/release-checks/');
}

const manifestPath = path.join(RELEASE_CHECKS, 'manifest.json');
const parityPayload = fs.existsSync(parityReportJson)
  ? JSON.parse(fs.readFileSync(parityReportJson, 'utf8'))
  : null;
const manifest = {
  generated_at: new Date().toISOString(),
  version: PACKAGE_JSON.version,
  package_name: PACKAGE_JSON.name,
  parity: parityPayload ? {
    generated_at: parityPayload.generated_at || null,
    version: parityPayload.version || null,
    context: parityPayload.context || null,
    totals: parityPayload.totals || null,
    report_markdown: 'release-checks/rust-parity-latest.md',
    report_json: 'release-checks/rust-parity-latest.json',
  } : null,
  packaged_artifacts: {
    env_example: '.env.example',
    start_bat: 'START.bat',
    www_dir: 'www',
    www_zip: 'www.zip',
    extension_zip: fs.existsSync(path.join(ROOT, 'extension')) ? 'badshuffle-extension.zip' : null,
  },
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Wrote dist/release-checks/manifest.json');
fs.writeFileSync(path.join(DIST, 'RELEASE-CHECKS.md'), buildReleaseChecksReadme({ manifest, parityPayload }));
console.log('Wrote dist/RELEASE-CHECKS.md');

// ── 3. Write START.bat ───────────────────────────────────────────────────────

const bat = `@echo off
echo Starting BadShuffle server...
start "" "%~dp0badshuffle-server.exe"
timeout /t 2 /nobreak >nul
echo Starting BadShuffle client...
start "" "%~dp0badshuffle-client.exe"
echo.
echo To check for updates, run badshuffle-updater.exe
`;

fs.writeFileSync(path.join(DIST, 'START.bat'), bat);
console.log('Wrote dist/START.bat');

// ── 4. Create www.zip (for updater downloads) ────────────────────────────────

const wwwZip      = path.join(DIST, 'www.zip');
async function main() {
  console.log('Creating dist/www.zip …');
  await zipPath(www, wwwZip);
  console.log('Created dist/www.zip');

  // ── 5. Create badshuffle-extension.zip (for extension install page) ───────

  const extensionSrc = path.join(ROOT, 'extension');
  const extZip       = path.join(DIST, 'badshuffle-extension.zip');

  if (fs.existsSync(extensionSrc)) {
    console.log('Creating dist/badshuffle-extension.zip …');
    await zipPath(extensionSrc, extZip, 'badshuffle-extension');
    console.log('Created dist/badshuffle-extension.zip');
  } else {
    console.warn('WARNING: extension/ folder not found — skipping badshuffle-extension.zip');
  }

  console.log('\nDone! dist/ contents:');
  for (const f of fs.readdirSync(DIST)) {
    console.log('  ' + f);
  }
}

main().catch((error) => {
  console.error('ERROR:', error && error.message ? error.message : error);
  process.exit(1);
});
