'use strict';
/**
 * badshuffle-updater.exe
 * Zero npm deps — built-ins only: https, fs, path, child_process
 *
 * Checks the latest GitHub release against the bundled version.
 * If newer: downloads assets, writes _update.bat, launches it, exits.
 * If up to date: prints message and waits for Enter.
 */
const https        = require('https');
const fs           = require('fs');
const path         = require('path');
const { spawn }    = require('child_process');

// When bundled by pkg, __dirname is the virtual FS. Use execPath for real dir.
const EXE_DIR  = typeof process.pkg !== 'undefined'
  ? path.dirname(process.execPath)
  : path.resolve(__dirname, '..');

const VERSION  = require('../package.json').version;
const REPO     = '248Tech/badshuffle';
const API_URL  = `https://api.github.com/repos/${REPO}/releases/latest`;

// ── helpers ──────────────────────────────────────────────────────────────────

function httpsGet(url, options) {
  return new Promise((resolve, reject) => {
    const opts = Object.assign({ headers: { 'User-Agent': 'badshuffle-updater' } }, options);
    https.get(url, opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpsGet(res.headers.location, options));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'badshuffle-updater' } };
    https.get(url, opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(downloadFile(res.headers.location, destPath));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      const out = fs.createWriteStream(destPath);
      res.pipe(out);
      out.on('finish', () => { out.close(); resolve(); });
      out.on('error', reject);
    }).on('error', reject);
  });
}

/** Compare two semver strings like "1.2.3". Returns true if b > a. */
function isNewer(current, latest) {
  const a = current.replace(/^v/, '').split('.').map(Number);
  const b = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((b[i] || 0) > (a[i] || 0)) return true;
    if ((b[i] || 0) < (a[i] || 0)) return false;
  }
  return false;
}

function pause() {
  return new Promise(resolve => {
    process.stdout.write('\nPress Enter to exit…');
    process.stdin.setRawMode && process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`BadShuffle Updater  (current: v${VERSION})`);
  console.log('Checking for updates…\n');

  let release;
  try {
    const resp = await httpsGet(API_URL);
    if (resp.statusCode !== 200) {
      throw new Error(`GitHub API returned ${resp.statusCode}`);
    }
    release = JSON.parse(resp.body.toString());
  } catch (e) {
    console.error('Could not reach GitHub:', e.message);
    await pause();
    return;
  }

  const latest = release.tag_name;
  console.log(`Latest release: ${latest}`);

  if (!isNewer(VERSION, latest)) {
    console.log('You are already up to date!');
    await pause();
    return;
  }

  console.log(`New version available: ${latest}  (you have v${VERSION})`);
  console.log('Downloading update…\n');

  const assets = release.assets || [];
  const wantedAssets = [
    { name: 'badshuffle-server.exe', dest: 'badshuffle-server.exe.new' },
    { name: 'badshuffle-client.exe', dest: 'badshuffle-client.exe.new' },
    { name: 'www.zip',               dest: 'www.zip' },
  ];

  for (const wanted of wantedAssets) {
    const asset = assets.find(a => a.name === wanted.name);
    if (!asset) {
      console.error(`Asset not found in release: ${wanted.name}`);
      await pause();
      return;
    }
    const destPath = path.join(EXE_DIR, wanted.dest);
    process.stdout.write(`  Downloading ${wanted.name}… `);
    try {
      await downloadFile(asset.browser_download_url, destPath);
      console.log('done');
    } catch (e) {
      console.error(`FAILED: ${e.message}`);
      await pause();
      return;
    }
  }

  // Write the swap batch file
  const batPath = path.join(EXE_DIR, '_update.bat');
  const bat = `@echo off
cd /d %~dp0
timeout /t 1 /nobreak >nul
move /y badshuffle-server.exe.new badshuffle-server.exe
move /y badshuffle-client.exe.new badshuffle-client.exe
powershell -Command "Expand-Archive -Path www.zip -DestinationPath www -Force"
del www.zip
del _update.bat
echo.
echo Update complete! Restart the app.
pause
`;
  fs.writeFileSync(batPath, bat);

  console.log('\nLaunching update script…');
  const child = spawn('cmd.exe', ['/c', batPath], {
    detached: true,
    stdio:    'ignore',
    cwd:      EXE_DIR,
  });
  child.unref();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Unexpected error:', e.message);
  await pause();
});
