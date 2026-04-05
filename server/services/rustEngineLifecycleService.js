const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fetch = require('node-fetch');
const rustEngineClient = require('./rustEngineClient');
const { DB_PATH } = require('../db');
const { getSettingValue } = require('../db/queries/settings');

const ROOT_DIR = path.join(__dirname, '../..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const RUST_ENGINE_LOG = path.join(LOGS_DIR, 'rust-engine.log');
const RUST_ENGINE_START_TIMEOUT_MS = 15000;

let rustEngineChild = null;
let rustEngineLastStart = null;
let rustEngineLastStop = null;
let rustEngineLastError = null;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRustEngineTarget() {
  try {
    const url = new URL(rustEngineClient.getRustEngineUrl());
    return {
      host: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? '443' : '80')),
    };
  } catch (error) {
    return { host: '127.0.0.1', port: 3101 };
  }
}

async function probe(endpointPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(rustEngineClient.getRustEngineTimeoutMs(), 2500));
  try {
    const response = await fetch(`${rustEngineClient.getRustEngineUrl()}${endpointPath}`, {
      method: 'GET',
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: null, error: error?.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeJsonPost(endpointPath, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(rustEngineClient.getRustEngineTimeoutMs(), 2500));
  try {
    const response = await fetch(`${rustEngineClient.getRustEngineUrl()}${endpointPath}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch {}
    return { ok: response.ok, status: response.status, body: parsed };
  } catch (error) {
    return { ok: false, status: null, error: error?.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function getStartCommand() {
  return {
    command: process.platform === 'win32' ? 'cargo.exe' : 'cargo',
    args: ['run', '--manifest-path', 'rust-core/Cargo.toml', '-p', 'api'],
    display: 'cargo run --manifest-path rust-core/Cargo.toml -p api',
  };
}

function isLocalRustHost(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function readProcText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

function readCmdline(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`).toString('utf8').replace(/\u0000/g, ' ').trim();
  } catch (error) {
    return '';
  }
}

function resolveExe(pid) {
  try {
    return fs.readlinkSync(`/proc/${pid}/exe`);
  } catch (error) {
    return '';
  }
}

function parseSsPid(output) {
  const match = String(output || '').match(/pid=(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseLsofPid(output, port) {
  const lines = String(output || '').split('\n').filter(Boolean);
  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && line.includes(`:${port}`)) {
      const pid = Number(parts[1]);
      if (Number.isFinite(pid) && pid > 0) return pid;
    }
  }
  return null;
}

function looksLikeBadShuffleRustPid(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  const cmdline = readCmdline(pid);
  const exe = resolveExe(pid);
  const haystack = `${cmdline} ${exe}`.toLowerCase();
  return haystack.includes('/badshuffle/rust-core/')
    || haystack.includes('rust-core/target/debug/api')
    || haystack.includes('rust-core/target/release/api');
}

function findRustListenerPid() {
  const target = getRustEngineTarget();
  if (!isLocalRustHost(target.host) || !Number.isFinite(target.port) || target.port <= 0) {
    return null;
  }

  let pid = null;
  const ss = spawnSync('ss', ['-lptn', `sport = :${target.port}`], { encoding: 'utf8' });
  if (ss.status === 0) pid = parseSsPid(ss.stdout);
  if (!pid) {
    const lsof = spawnSync('lsof', ['-nP', `-iTCP:${target.port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    if (lsof.status === 0) pid = parseLsofPid(lsof.stdout, target.port);
  }
  if (!pid) return null;
  if (!looksLikeBadShuffleRustPid(pid)) return null;
  return pid;
}

function attachChildLifecycle(child) {
  child.on('error', (error) => {
    rustEngineLastError = error?.message || String(error);
  });
  child.on('exit', (code, signal) => {
    rustEngineLastStop = new Date().toISOString();
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
      rustEngineLastError = `Rust engine exited with code ${code}${signal ? ` signal ${signal}` : ''}`;
    }
    rustEngineChild = null;
  });
}

function startProcess() {
  ensureDir(LOGS_DIR);
  const logFd = fs.openSync(RUST_ENGINE_LOG, 'a');
  const { command, args } = getStartCommand();
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      RUST_ENGINE_DB_PATH: process.env.RUST_ENGINE_DB_PATH || DB_PATH,
    },
  });
  attachChildLifecycle(child);
  child.unref();
  rustEngineChild = child;
  rustEngineLastStart = new Date().toISOString();
  rustEngineLastError = null;
  return child;
}

async function waitForHealth(timeoutMs = RUST_ENGINE_START_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const health = await probe('/health');
    if (health.ok) return health;
    await sleep(500);
  }
  return null;
}

async function start() {
  const health = await probe('/health');
  if (health.ok) {
    return {
      ok: true,
      started: false,
      message: 'Rust engine is already running.',
      tracked_pid: rustEngineChild?.pid || null,
      log_path: path.relative(ROOT_DIR, RUST_ENGINE_LOG),
      health,
    };
  }

  try {
    startProcess();
  } catch (error) {
    rustEngineLastError = error?.message || String(error);
    return {
      ok: false,
      error: `Could not start Rust engine: ${rustEngineLastError}`,
      start_command: getStartCommand().display,
    };
  }

  const startedHealth = await waitForHealth();
  if (!startedHealth?.ok) {
    return {
      ok: false,
      error: 'Rust engine did not become healthy in time.',
      log_path: path.relative(ROOT_DIR, RUST_ENGINE_LOG),
      start_command: getStartCommand().display,
      tracked_pid: rustEngineChild?.pid || null,
    };
  }

  return {
    ok: true,
    started: true,
    tracked_pid: rustEngineChild?.pid || null,
    log_path: path.relative(ROOT_DIR, RUST_ENGINE_LOG),
    health: startedHealth,
  };
}

function stopTrackedProcess(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' });
    return;
  }
  process.kill(pid, 'SIGTERM');
}

async function stop() {
  const trackedPid = rustEngineChild?.pid || null;
  const detectedPid = findRustListenerPid();
  const pid = trackedPid || detectedPid || null;
  const health = await probe('/health');
  if (!pid && !health.ok) {
    return {
      ok: true,
      stopped: false,
      message: 'Rust engine is not running.',
      tracked_pid: null,
    };
  }

  if (pid) {
    try {
      stopTrackedProcess(pid);
    } catch (error) {
      rustEngineLastError = error?.message || String(error);
      return {
        ok: false,
        error: `Could not stop Rust engine: ${rustEngineLastError}`,
      };
    }
  }

  rustEngineLastStop = new Date().toISOString();
  rustEngineChild = null;
  return {
    ok: true,
    stopped: true,
    tracked_pid: pid,
    stop_source: trackedPid ? 'tracked' : 'detected_port_pid',
  };
}

async function restart() {
  const status = await getStatus();
  if (!status.health?.ok) {
    return start();
  }
  const stopResult = await stop();
  if (!stopResult.ok) return stopResult;
  return start();
}

async function getStatus() {
  const [health, ready, inventoryCheck, pricingCheck] = await Promise.all([
    probe('/health'),
    probe('/ready'),
    probeJsonPost('/engine/inventory/check', { action: 'conflicts', quoteId: 0 }),
    probeJsonPost('/engine/pricing/check', { quoteId: 0 }),
  ]);
  const capabilities = {
    inventory_check: {
      available: inventoryCheck.status != null && inventoryCheck.status !== 404,
      status: inventoryCheck.status,
    },
    pricing_check: {
      available: pricingCheck.status != null && pricingCheck.status !== 404,
      status: pricingCheck.status,
    },
  };
  return {
    enabled: rustEngineClient.isRustInventoryEnabled(),
    shadow_mode: rustEngineClient.isRustInventoryShadowMode(),
    pricing_enabled: rustEngineClient.isRustPricingEnabled(),
    pricing_shadow_mode: rustEngineClient.isRustPricingShadowMode(),
    url: rustEngineClient.getRustEngineUrl(),
    timeout_ms: rustEngineClient.getRustEngineTimeoutMs(),
    start_command: getStartCommand().display,
    log_path: path.relative(ROOT_DIR, RUST_ENGINE_LOG),
    last_start_at: rustEngineLastStart,
    last_stop_at: rustEngineLastStop,
    last_error: rustEngineLastError,
    tracked_pid: rustEngineChild?.pid || null,
    detected_pid: findRustListenerPid(),
    capabilities,
    build_state: capabilities.pricing_check.available ? 'current' : 'outdated_or_prepricing',
    health,
    ready,
  };
}

async function autoStartIfEnabled(db) {
  const enabled = getSettingValue(db, 'rust_autostart_enabled', '1') !== '0';
  if (!enabled) return { ok: true, skipped: true, reason: 'disabled' };
  const status = await getStatus();
  if (status.health.ok) return { ok: true, skipped: true, reason: 'already-running' };
  return start();
}

module.exports = {
  autoStartIfEnabled,
  getStatus,
  start,
  stop,
  restart,
  getStartCommand,
  getLogPath: () => path.relative(ROOT_DIR, RUST_ENGINE_LOG),
};
