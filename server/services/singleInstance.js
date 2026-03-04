'use strict';
/**
 * singleInstance.js — lockfile-based single-instance guard.
 *
 * Writes a lockfile containing PID + metadata on startup.
 * If a lockfile from a prior run exists and its PID is still alive,
 * optionally force-kills that process before continuing.
 *
 * Safe to use on Windows and in dev mode.
 */
const fs           = require('fs');
const path         = require('path');
const { spawnSync } = require('child_process');

function getLockPath() {
  return typeof process.pkg !== 'undefined'
    ? path.join(path.dirname(process.execPath), 'badshuffle.lock')
    : path.join(__dirname, '../../badshuffle.lock');
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function forceKill(pid) {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {}
}

function writeLock() {
  const lockPath = getLockPath();
  const data = JSON.stringify({ pid: process.pid, name: 'badshuffle-server', startedAt: Date.now() });
  try { fs.writeFileSync(lockPath, data, 'utf8'); } catch (e) {
    console.warn('[single-instance] Could not write lockfile:', e.message);
  }
}

function release() {
  const lockPath = getLockPath();
  try { fs.unlinkSync(lockPath); } catch {}
}

/**
 * Acquire the single-instance lock.
 * @param {boolean} autokillEnabled  When true, forcibly kills a running previous instance.
 * @returns {Promise<void>}
 */
async function acquire(autokillEnabled) {
  const lockPath = getLockPath();

  if (!fs.existsSync(lockPath)) {
    writeLock();
    return;
  }

  let lockData;
  try {
    lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    // Corrupt lockfile — remove and continue
    console.log('[single-instance] Corrupt lockfile removed.');
    release();
    writeLock();
    return;
  }

  const { pid, name } = lockData || {};

  if (pid && isAlive(pid)) {
    if (name !== 'badshuffle-server') {
      console.warn(
        `[single-instance] Lockfile belongs to unknown process "${name}" (PID ${pid}). Skipping autokill — manual cleanup may be needed.`
      );
    } else if (!autokillEnabled) {
      console.warn(`[single-instance] Another instance detected (PID ${pid}). Autokill is disabled.`);
    } else {
      console.log(`[single-instance] Terminating previous instance (PID ${pid})…`);
      forceKill(pid);
      // Give the OS 800 ms to release the port
      await new Promise(function(resolve) { setTimeout(resolve, 800); });
      console.log('[single-instance] Previous instance terminated.');
    }
  } else {
    console.log('[single-instance] Stale lockfile cleared.');
  }

  release();
  writeLock();
}

module.exports = { acquire, release };
