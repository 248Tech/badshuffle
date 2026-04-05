const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fetch = require('node-fetch');
const { getSettingValue } = require('../db/queries/settings');
const { listCuratedModels } = require('./localModelCatalog');

const ROOT_DIR = path.join(__dirname, '../..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const LOCAL_MODEL_LOG = path.join(LOGS_DIR, 'local-model-runtime.log');
const DEFAULT_INSTALL_PATH = path.join(ROOT_DIR, 'local-model-runtime');
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const START_TIMEOUT_MS = 15000;

let localRuntimeChild = null;
let localRuntimeLastStart = null;
let localRuntimeLastStop = null;
let localRuntimeLastInstall = null;
let localRuntimeLastError = null;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePath(value) {
  const raw = String(value || '').trim();
  return raw ? path.resolve(raw) : DEFAULT_INSTALL_PATH;
}

function getInstallPath(db) {
  return normalizePath(getSettingValue(db, 'ai_local_install_path', DEFAULT_INSTALL_PATH));
}

function getBaseUrl(db) {
  return String(getSettingValue(db, 'ai_local_base_url', DEFAULT_BASE_URL) || DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

function isEnabled(db) {
  return String(getSettingValue(db, 'ai_local_enabled', '0') || '0') === '1';
}

function isAutoStartEnabled(db) {
  return String(getSettingValue(db, 'ai_local_autostart_enabled', '1') || '1') !== '0';
}

function parseBaseUrl(targetUrl) {
  try {
    const url = new URL(targetUrl || DEFAULT_BASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? '443' : '80')),
      href: `${url.protocol}//${url.host}`,
    };
  } catch {
    return { host: '127.0.0.1', port: 11434, href: DEFAULT_BASE_URL };
  }
}

async function probeEndpoint(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: null, error: error?.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeHealth(db) {
  return probeEndpoint(`${getBaseUrl(db)}/api/tags`);
}

function detectBinary() {
  const version = spawnSync('ollama', ['--version'], { encoding: 'utf8' });
  if (version.status !== 0) {
    return {
      ok: false,
      error: (version.stderr || version.stdout || 'ollama binary not found').trim(),
    };
  }
  const output = (version.stdout || version.stderr || '').trim();
  return {
    ok: true,
    version: output,
  };
}

function getStartCommand(db) {
  const base = parseBaseUrl(getBaseUrl(db));
  return {
    command: process.platform === 'win32' ? 'ollama.exe' : 'ollama',
    args: ['serve'],
    cwd: getInstallPath(db),
    env: {
      OLLAMA_HOST: `${base.host}:${base.port}`,
    },
    display: `OLLAMA_HOST=${base.host}:${base.port} ollama serve`,
  };
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

function readCmdline(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`).toString('utf8').replace(/\u0000/g, ' ').trim();
  } catch {
    return '';
  }
}

function resolveExe(pid) {
  try {
    return fs.readlinkSync(`/proc/${pid}/exe`);
  } catch {
    return '';
  }
}

function looksLikeOllamaPid(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  const haystack = `${readCmdline(pid)} ${resolveExe(pid)}`.toLowerCase();
  return haystack.includes('ollama');
}

function findListenerPid(db) {
  const target = parseBaseUrl(getBaseUrl(db));
  if (!Number.isFinite(target.port) || target.port <= 0) return null;

  let pid = null;
  const ss = spawnSync('ss', ['-lptn', `sport = :${target.port}`], { encoding: 'utf8' });
  if (ss.status === 0) pid = parseSsPid(ss.stdout);
  if (!pid) {
    const lsof = spawnSync('lsof', ['-nP', `-iTCP:${target.port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    if (lsof.status === 0) pid = parseLsofPid(lsof.stdout, target.port);
  }
  if (!pid) return null;
  if (process.platform !== 'win32' && !looksLikeOllamaPid(pid)) return null;
  return pid;
}

function attachChildLifecycle(child) {
  child.on('error', (error) => {
    localRuntimeLastError = error?.message || String(error);
  });
  child.on('exit', (code, signal) => {
    localRuntimeLastStop = new Date().toISOString();
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
      localRuntimeLastError = `Local model runtime exited with code ${code}${signal ? ` signal ${signal}` : ''}`;
    }
    localRuntimeChild = null;
  });
}

function startProcess(db) {
  ensureDir(LOGS_DIR);
  ensureDir(getInstallPath(db));
  const logFd = fs.openSync(LOCAL_MODEL_LOG, 'a');
  const { command, args, cwd, env } = getStartCommand(db);
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ...env,
    },
  });
  attachChildLifecycle(child);
  child.unref();
  localRuntimeChild = child;
  localRuntimeLastStart = new Date().toISOString();
  localRuntimeLastError = null;
  return child;
}

async function waitForHealth(db, timeoutMs = START_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const health = await probeHealth(db);
    if (health.ok) return health;
    await sleep(500);
  }
  return null;
}

async function install(db) {
  const binary = detectBinary();
  if (binary.ok) {
    return {
      ok: true,
      installed: false,
      message: 'Ollama is already installed.',
      binary,
      install_path: getInstallPath(db),
    };
  }

  const platform = process.platform;
  let result = null;
  if (platform === 'linux' || platform === 'darwin') {
    result = spawnSync('bash', ['-lc', 'curl -fsSL https://ollama.com/install.sh | sh'], { encoding: 'utf8' });
  } else {
    return {
      ok: false,
      error: 'Automatic Ollama install is not available on this platform. Install Ollama manually, then click Detect.',
      manual_url: 'https://ollama.com/download',
    };
  }

  if (result.status !== 0) {
    localRuntimeLastError = (result.stderr || result.stdout || 'Ollama install failed').trim();
    return {
      ok: false,
      error: localRuntimeLastError,
      manual_url: 'https://ollama.com/download',
    };
  }

  localRuntimeLastInstall = new Date().toISOString();
  return {
    ok: true,
    installed: true,
    binary: detectBinary(),
    install_path: getInstallPath(db),
  };
}

async function start(db) {
  const health = await probeHealth(db);
  if (health.ok) {
    return {
      ok: true,
      started: false,
      message: 'Local model runtime is already running.',
      health,
      tracked_pid: localRuntimeChild?.pid || null,
      log_path: path.relative(ROOT_DIR, LOCAL_MODEL_LOG),
    };
  }

  const binary = detectBinary();
  if (!binary.ok) {
    localRuntimeLastError = binary.error;
    return {
      ok: false,
      error: 'Ollama is not installed. Install it first from Admin > System.',
      binary,
      start_command: getStartCommand(db).display,
    };
  }

  try {
    startProcess(db);
  } catch (error) {
    localRuntimeLastError = error?.message || String(error);
    return {
      ok: false,
      error: `Could not start local model runtime: ${localRuntimeLastError}`,
      start_command: getStartCommand(db).display,
    };
  }

  const startedHealth = await waitForHealth(db);
  if (!startedHealth?.ok) {
    return {
      ok: false,
      error: 'Local model runtime did not become healthy in time.',
      tracked_pid: localRuntimeChild?.pid || null,
      log_path: path.relative(ROOT_DIR, LOCAL_MODEL_LOG),
      start_command: getStartCommand(db).display,
    };
  }

  return {
    ok: true,
    started: true,
    tracked_pid: localRuntimeChild?.pid || null,
    log_path: path.relative(ROOT_DIR, LOCAL_MODEL_LOG),
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

async function stop(db) {
  const trackedPid = localRuntimeChild?.pid || null;
  const detectedPid = findListenerPid(db);
  const pid = trackedPid || detectedPid || null;
  if (!pid) {
    return {
      ok: true,
      stopped: false,
      message: 'Local model runtime is not running.',
      tracked_pid: trackedPid,
      detected_pid: detectedPid,
    };
  }

  try {
    stopTrackedProcess(pid);
  } catch (error) {
    localRuntimeLastError = error?.message || String(error);
    return {
      ok: false,
      error: `Could not stop local model runtime: ${localRuntimeLastError}`,
      tracked_pid: trackedPid,
      detected_pid: detectedPid,
    };
  }

  localRuntimeChild = null;
  localRuntimeLastStop = new Date().toISOString();
  return {
    ok: true,
    stopped: true,
    tracked_pid: trackedPid,
    detected_pid: detectedPid,
  };
}

async function restart(db) {
  const stopped = await stop(db);
  if (!stopped.ok) return stopped;
  return start(db);
}

async function pullModel(db, modelName) {
  const normalized = String(modelName || '').trim();
  if (!normalized) {
    return { ok: false, error: 'Model name is required.' };
  }
  const response = await probeEndpoint(`${getBaseUrl(db)}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { name: normalized, stream: false },
  });
  if (!response.ok) {
    localRuntimeLastError = response.body?.error || response.error || `Model pull failed (${response.status || 'unreachable'})`;
    return { ok: false, error: localRuntimeLastError };
  }
  return {
    ok: true,
    model: normalized,
    result: response.body,
  };
}

async function deleteModel(db, modelName) {
  const normalized = String(modelName || '').trim();
  if (!normalized) return { ok: false, error: 'Model name is required.' };
  const response = await probeEndpoint(`${getBaseUrl(db)}/api/delete`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: { name: normalized },
  });
  if (!response.ok) {
    localRuntimeLastError = response.body?.error || response.error || `Model delete failed (${response.status || 'unreachable'})`;
    return { ok: false, error: localRuntimeLastError };
  }
  return { ok: true, model: normalized };
}

async function detect(db) {
  const binary = detectBinary();
  const health = await probeHealth(db);
  const models = Array.isArray(health.body?.models)
    ? health.body.models.map((entry) => ({
      name: entry.name,
      model: entry.model || entry.name,
      size: entry.size || 0,
      modified_at: entry.modified_at || null,
      digest: entry.digest || null,
    }))
    : [];
  const installedModelNames = new Set(models.map((entry) => entry.name));
  const curated = listCuratedModels().map((entry) => ({
    ...entry,
    installed: installedModelNames.has(entry.id),
  }));
  return {
    enabled: isEnabled(db),
    mode: String(getSettingValue(db, 'ai_local_mode', 'managed_ollama') || 'managed_ollama'),
    autostart_enabled: isAutoStartEnabled(db),
    install_path: getInstallPath(db),
    base_url: getBaseUrl(db),
    binary,
    health,
    models,
    curated_models: curated,
    tracked_pid: localRuntimeChild?.pid || null,
    detected_pid: findListenerPid(db),
    last_install_at: localRuntimeLastInstall,
    last_start_at: localRuntimeLastStart,
    last_stop_at: localRuntimeLastStop,
    last_error: localRuntimeLastError,
    log_path: path.relative(ROOT_DIR, LOCAL_MODEL_LOG),
    start_command: getStartCommand(db).display,
  };
}

async function maybeAutoStart(db) {
  if (!isEnabled(db)) return { ok: true, skipped: true, reason: 'disabled' };
  if (!isAutoStartEnabled(db)) return { ok: true, skipped: true, reason: 'autostart-disabled' };
  const status = await detect(db);
  if (status.health.ok) return { ok: true, skipped: true, reason: 'already-running' };
  return start(db);
}

module.exports = {
  DEFAULT_BASE_URL,
  getBaseUrl,
  detect,
  install,
  start,
  stop,
  restart,
  pullModel,
  deleteModel,
  maybeAutoStart,
};
