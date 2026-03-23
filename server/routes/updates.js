'use strict';
const https      = require('https');
const fs         = require('fs');
const path       = require('path');
const { spawn }  = require('child_process');
const express    = require('express');

const REPO         = '248Tech/badshuffle';
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases`;

const EXE_DIR = typeof process.pkg !== 'undefined'
  ? path.dirname(process.execPath)
  : path.resolve(__dirname, '../..');

function getVersion() {
  try { return require('../../package.json').version; } catch { return '0.0.0'; }
}

function isNewer(current, latest) {
  const a = current.replace(/^v/, '').split('.').map(Number);
  const b = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((b[i] || 0) > (a[i] || 0)) return true;
    if ((b[i] || 0) < (a[i] || 0)) return false;
  }
  return false;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'badshuffle-server' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchJson(res.headers.location));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
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

module.exports = function makeRouter(db) {
  const router = express.Router();

  // GET /api/updates — current version + cached update status
  router.get('/', (req, res) => {
    const current = getVersion();
    const isPkg   = typeof process.pkg !== 'undefined';
    const latest  = (db.prepare("SELECT value FROM settings WHERE key = 'update_check_latest'").get() || {}).value || null;
    const avail   = (db.prepare("SELECT value FROM settings WHERE key = 'update_available'").get() || {}).value || '0';
    res.json({ current, latest, update_available: avail === '1', is_pkg: isPkg });
  });

  // GET /api/updates/releases — fetch release list from GitHub
  router.get('/releases', async (req, res) => {
    try {
      const releases = await fetchJson(RELEASES_URL + '?per_page=20');
      const current  = getVersion();
      const result   = releases.map(r => ({
        tag:          r.tag_name,
        name:         r.name || r.tag_name,
        body:         r.body || '',
        published_at: r.published_at,
        is_newer:     isNewer(current, r.tag_name),
        assets:       (r.assets || []).map(a => a.name),
      }));
      res.json({ releases: result, current });
    } catch (e) {
      res.status(502).json({ error: 'Could not reach GitHub: ' + e.message });
    }
  });

  // POST /api/updates/apply — download a specific release, write swap script, reboot
  router.post('/apply', async (req, res) => {
    const { tag } = req.body || {};
    if (!tag) return res.status(400).json({ error: 'tag is required' });

    const isPkg = typeof process.pkg !== 'undefined';
    if (!isPkg) {
      return res.status(400).json({
        error: 'Auto-update is only available in the packaged .exe build. In dev mode, update manually via git pull.'
      });
    }

    try {
      const release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`);
      const assets  = release.assets || [];

      const wantedAssets = [
        { name: 'badshuffle-server.exe', dest: 'badshuffle-server.exe.new' },
        { name: 'badshuffle-client.exe', dest: 'badshuffle-client.exe.new' },
        { name: 'www.zip',               dest: 'www.zip'                    },
      ];

      for (const wanted of wantedAssets) {
        const asset = assets.find(a => a.name === wanted.name);
        if (!asset) {
          return res.status(400).json({ error: `Asset not found in release ${tag}: ${wanted.name}` });
        }
        await downloadFile(asset.browser_download_url, path.join(EXE_DIR, wanted.dest));
      }

      // Batch: wait for server to exit, swap files, expand www.zip, restart server
      const batPath = path.join(EXE_DIR, '_update.bat');
      const bat = [
        '@echo off',
        'cd /d %~dp0',
        'timeout /t 2 /nobreak >nul',
        'move /y badshuffle-server.exe.new badshuffle-server.exe',
        'move /y badshuffle-client.exe.new badshuffle-client.exe',
        'powershell -Command "Expand-Archive -Path www.zip -DestinationPath www -Force"',
        'del www.zip',
        'del _update.bat',
        'start "" badshuffle-server.exe',
        '',
      ].join('\r\n');
      fs.writeFileSync(batPath, bat);

      // Respond first, then exit after a short delay so the response is flushed
      res.json({ ok: true, message: 'Update downloaded. Restarting server…' });

      setTimeout(() => {
        const child = spawn('cmd.exe', ['/c', batPath], {
          detached: true,
          stdio:    'ignore',
          cwd:      EXE_DIR,
        });
        child.unref();
        process.exit(0);
      }, 600);

    } catch (e) {
      res.status(500).json({ error: 'Update failed: ' + e.message });
    }
  });

  return router;
};
