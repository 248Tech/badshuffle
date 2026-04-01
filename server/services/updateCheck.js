'use strict';
/**
 * updateCheck.js — startup update check against GitHub releases.
 *
 * - Reads update_check_enabled from settings (default: '1').
 * - Throttles to once every 12 hours using update_check_last.
 * - Writes update_check_last, update_check_latest, update_available back to settings.
 * - Fails gracefully on any network or parse error.
 */
const https = require('https');
const { getSettingValue, upsertSettingValue } = require('../db/queries/settings');

const REPO        = '248Tech/badshuffle';
const API_URL     = 'https://api.github.com/repos/' + REPO + '/releases?per_page=20';
const THROTTLE_MS = 12 * 60 * 60 * 1000; // 12 hours

function getVersion() {
  try { return require('../../package.json').version; } catch { return '0.0.0'; }
}

function isNewer(current, latest) {
  const a = current.replace(/^v/, '').split('.').map(Number);
  const b = latest.replace(/^v/, '').split('.').map(Number);
  for (var i = 0; i < 3; i++) {
    if ((b[i] || 0) > (a[i] || 0)) return true;
    if ((b[i] || 0) < (a[i] || 0)) return false;
  }
  return false;
}

function hasInstallAssets(release) {
  var names = new Set((release.assets || []).map(function(a) { return a.name; }));
  return names.has('badshuffle-server.exe') &&
    names.has('badshuffle-client.exe') &&
    names.has('www.zip');
}

function fetchJson(url) {
  return new Promise(function(resolve, reject) {
    var req = https.get(url, { headers: { 'User-Agent': 'badshuffle-server' } }, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchJson(res.headers.location));
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, function() { req.destroy(); reject(new Error('timeout')); });
  });
}

function getSetting(db, key) {
  return getSettingValue(db, key, '');
}

function setSetting(db, key, value) {
  upsertSettingValue(db, key, value);
}

/**
 * Run update check asynchronously. Never throws — all errors are logged.
 * @param {import('../db').DB} db
 */
async function run(db) {
  try {
    var enabled = getSetting(db, 'update_check_enabled');
    if (enabled === '0') return;

    var lastCheck = getSetting(db, 'update_check_last');
    if (lastCheck) {
      var elapsed = Date.now() - new Date(lastCheck).getTime();
      if (!isNaN(elapsed) && elapsed < THROTTLE_MS) {
        console.log('[update-check] Skipped — last check was recent.');
        return;
      }
    }

    console.log('[update-check] Checking for updates…');
    var releases = await fetchJson(API_URL);
    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error('No releases returned');
    }

    var latestRelease = releases.find(function(r) { return hasInstallAssets(r); }) || releases[0];
    var latest = latestRelease && latestRelease.tag_name;
    if (!latest) throw new Error('No tag_name in response');

    var current = getVersion();
    var available = isNewer(current, latest);

    setSetting(db, 'update_check_last',    new Date().toISOString());
    setSetting(db, 'update_check_latest',  latest);
    setSetting(db, 'update_available',     available ? '1' : '0');

    if (available) {
      console.log('[update-check] Update available: v' + current + ' → ' + latest);
    } else {
      console.log('[update-check] Up to date (v' + current + ').');
    }
  } catch (e) {
    console.log('[update-check] Failed (offline or rate-limited):', e.message);
  }
}

module.exports = { run };
