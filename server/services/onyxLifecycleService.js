const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fetch = require('node-fetch');
const { getSettingValue } = require('../db/queries/settings');

const ROOT_DIR = path.join(__dirname, '../..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const ONYX_LOG = path.join(LOGS_DIR, 'onyx.log');
const DEFAULT_INSTALL_PATH = path.join(ROOT_DIR, 'onyx-local');
const DEFAULT_LOCAL_PORT = 3000;
const INSTALL_SCRIPT_URL = 'https://onyx.app/install_onyx.sh';
const START_TIMEOUT_MS = 45000;
const DEFAULT_MANAGED_INSTALL_ROOT = 'onyx_data';

let onyxLastStart = null;
let onyxLastStop = null;
let onyxLastError = null;
let onyxLastInstall = null;

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

function getLocalPort(db) {
  const parsed = Number(getSettingValue(db, 'onyx_local_port', String(DEFAULT_LOCAL_PORT)));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_LOCAL_PORT;
}

function getInstallPath(db) {
  return normalizePath(getSettingValue(db, 'onyx_local_install_path', DEFAULT_INSTALL_PATH));
}

function getBaseUrl(db) {
  const installRoot = detectInstallRoot(getInstallPath(db));
  const installedPort = readInstalledPort(installRoot);
  const port = installedPort || getLocalPort(db);
  return `http://127.0.0.1:${port}`;
}

function getMode(db) {
  return String(getSettingValue(db, 'onyx_mode', '') || '').trim();
}

function isEnabled(db) {
  return getSettingValue(db, 'onyx_enabled', '0') !== '0';
}

function isLocalEnabled(db) {
  return getSettingValue(db, 'onyx_local_enabled', '1') !== '0';
}

function isExternalEnabled(db) {
  return getSettingValue(db, 'onyx_external_enabled', '1') !== '0';
}

function isAutoStartEnabled(db) {
  return getSettingValue(db, 'onyx_local_autostart_enabled', '1') !== '0';
}

function getStartCommand(db) {
  const installPath = getInstallPath(db);
  const composeFiles = getComposeFiles(installPath);
  const compose = dockerAvailable();
  if (composeFiles.length) {
    const isStandalone = compose.compose_command === 'docker-compose';
    const command = compose.command || (isStandalone ? 'docker-compose' : 'docker');
    const prefix = Array.isArray(compose.command_prefix) ? compose.command_prefix : [];
    const fileArgs = composeFiles.flatMap((file) => ['-f', file]);
    const subargs = isStandalone
      ? [...fileArgs, 'up', '-d']
      : ['compose', ...fileArgs, 'up', '-d'];
    const args = [...prefix, ...subargs];
    const displayCmd = isStandalone ? 'docker-compose' : 'docker compose';
    const displayFiles = composeFiles.map((file) => `-f ${file}`).join(' ');
    const display = compose.use_sudo ? `sudo ${displayCmd} ${displayFiles} up -d` : `${displayCmd} ${displayFiles} up -d`;
    return {
      command,
      args,
      cwd: path.dirname(composeFiles[0]),
      display,
    };
  }
  return {
    command: 'bash',
    args: ['-lc', `cd ${shellEscape(installPath)} && curl -fsSL ${INSTALL_SCRIPT_URL} | bash -s -- --no-prompt --lite`],
    cwd: ROOT_DIR,
    display: `cd ${installPath} && curl -fsSL ${INSTALL_SCRIPT_URL} | bash -s -- --no-prompt --lite`,
  };
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function dockerAvailable() {
  const docker = spawnSync('docker', ['--version'], { encoding: 'utf8' });
  if (docker.status !== 0) {
    return { ok: false, error: (docker.stderr || docker.stdout || 'docker not found').trim() };
  }
  const compose = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
  const composeStandalone = spawnSync('docker-compose', ['version'], { encoding: 'utf8' });
  const composeCommand = compose.status === 0 ? 'docker' : (composeStandalone.status === 0 ? 'docker-compose' : null);
  if (!composeCommand) {
    return {
      ok: false,
      error: (compose.stderr || compose.stdout || composeStandalone.stderr || composeStandalone.stdout || 'docker compose not found').trim(),
    };
  }
  const directPs = spawnSync('docker', ['ps'], { encoding: 'utf8' });
  if (directPs.status === 0) {
    return { ok: true, compose_command: composeCommand, command: composeCommand === 'docker' ? 'docker' : 'docker-compose', command_prefix: [], use_sudo: false };
  }
  const sudoAvailable = spawnSync('sudo', ['-n', 'true'], { encoding: 'utf8' });
  if (sudoAvailable.status === 0) {
    const sudoPs = spawnSync('sudo', ['-n', 'docker', 'ps'], { encoding: 'utf8' });
    if (sudoPs.status === 0) {
      return {
        ok: true,
        compose_command: composeCommand,
        command: 'sudo',
        command_prefix: ['-n', composeCommand === 'docker' ? 'docker' : 'docker-compose'],
        use_sudo: true,
      };
    }
  }
  return {
    ok: false,
    error: (directPs.stderr || directPs.stdout || 'docker daemon access denied').trim(),
  };
}

function detectInstallRoot(installPath) {
  const nested = path.join(installPath, DEFAULT_MANAGED_INSTALL_ROOT);
  if (fs.existsSync(path.join(nested, 'deployment'))) return nested;
  return installPath;
}

function detectComposeFile(installPath) {
  const installRoot = detectInstallRoot(installPath);
  const candidates = [
    path.join(installPath, 'docker-compose.yml'),
    path.join(installPath, 'docker-compose.yaml'),
    path.join(installPath, 'compose.yml'),
    path.join(installPath, 'compose.yaml'),
    path.join(installPath, 'deployment', 'docker_compose', 'docker-compose.yml'),
    path.join(installPath, 'deployment', 'docker_compose', 'docker-compose.yaml'),
    path.join(installPath, '.onyx', 'docker-compose.yml'),
    path.join(installPath, '.onyx', 'docker-compose.yaml'),
    path.join(installRoot, 'deployment', 'docker-compose.yml'),
    path.join(installRoot, 'deployment', 'docker-compose.yaml'),
    path.join(installRoot, 'deployment', 'compose.yml'),
    path.join(installRoot, 'deployment', 'compose.yaml'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getComposeFiles(installPath) {
  const primary = detectComposeFile(installPath);
  if (!primary) return [];
  const composeFiles = [primary];
  const liteOverlay = path.join(path.dirname(primary), 'docker-compose.onyx-lite.yml');
  if (fs.existsSync(liteOverlay)) composeFiles.push(liteOverlay);
  return composeFiles;
}

function readInstalledPort(installRoot) {
  if (!installRoot) return null;
  const envCandidates = [
    path.join(installRoot, '.env'),
    path.join(installRoot, 'deployment', '.env'),
  ];
  for (const envPath of envCandidates) {
    if (!fs.existsSync(envPath)) continue;
    const text = fs.readFileSync(envPath, 'utf8');
    const match = text.match(/^\s*HOST_PORT\s*=\s*("?)(\d+)\1\s*$/m);
    if (match) {
      const parsed = Number(match[2]);
      if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
    }
  }
  return null;
}

function getDeploymentEnvPath(installPath) {
  const installRoot = detectInstallRoot(installPath);
  const envPath = path.join(installRoot, 'deployment', '.env');
  return fs.existsSync(envPath) ? envPath : null;
}

function readInstalledAuthType(installPath) {
  const envPath = getDeploymentEnvPath(installPath);
  if (!envPath) return null;
  const text = fs.readFileSync(envPath, 'utf8');
  const match = text.match(/^\s*AUTH_TYPE\s*=\s*("?)([^"\n#]+)\1\s*$/m);
  return match ? String(match[2] || '').trim() : null;
}

function upsertEnvValue(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }
  const suffix = text.endsWith('\n') ? '' : '\n';
  return `${text}${suffix}${line}\n`;
}

function ensureManagedLocalConfig(installPath) {
  const envPath = getDeploymentEnvPath(installPath);
  if (!envPath) return { ok: false, changed: false, reason: 'env-missing' };
  const original = fs.readFileSync(envPath, 'utf8');
  const next = upsertEnvValue(original, 'AUTH_TYPE', 'disabled');
  if (next === original) return { ok: true, changed: false, env_path: envPath };
  fs.writeFileSync(envPath, next);
  return { ok: true, changed: true, env_path: envPath };
}

function installDetected(db) {
  const installPath = getInstallPath(db);
  const composeFile = detectComposeFile(installPath);
  const installRoot = detectInstallRoot(installPath);
  const deploymentDir = path.join(installRoot, 'deployment');
  const installDirExists = fs.existsSync(installPath);
  const installRootExists = fs.existsSync(installRoot);
  const deploymentExists = fs.existsSync(deploymentDir);
  const hostPort = readInstalledPort(installRoot) || null;
  const authType = readInstalledAuthType(installPath);
  return {
    install_path: installPath,
    install_root: installRoot,
    install_path_exists: installDirExists,
    install_root_exists: installRootExists,
    deployment_dir: deploymentDir,
    deployment_exists: deploymentExists,
    install_detected: !!composeFile,
    compose_file: composeFile,
    host_port: hostPort,
    auth_type: authType,
    managed_runtime_detected: !!(composeFile || deploymentExists || hostPort),
  };
}

async function probeEndpoint(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
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
  const baseUrl = getBaseUrl(db);
  const probes = ['/api/health', '/health'];
  for (const probePath of probes) {
    const result = await probeEndpoint(`${baseUrl}${probePath}`);
    if (result.ok) {
      return { ...result, path: probePath };
    }
  }
  return { ok: false, status: null, error: 'Onyx did not respond to health probes.' };
}

function findDockerProjectName(cwd, composeFile) {
  const base = path.basename(path.dirname(composeFile || cwd || ROOT_DIR)) || 'onyx';
  return `badshuffle-onyx-${base}`.replace(/[^a-zA-Z0-9_.-]/g, '-').toLowerCase();
}

function runCommand(command, args, options = {}) {
  ensureDir(LOGS_DIR);
  return new Promise((resolve) => {
    const logFd = fs.openSync(ONYX_LOG, 'a');
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT_DIR,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', logFd, logFd],
    });
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };
    const timeoutMs = options.timeoutMs || 10 * 60 * 1000;
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
      finish({ ok: false, error: `${command} timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      finish({ ok: false, error: error?.message || String(error) });
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        finish({ ok: true });
      } else {
        finish({ ok: false, error: `${command} exited with code ${code}${signal ? ` signal ${signal}` : ''}` });
      }
    });
  });
}

async function waitForHealth(db, timeoutMs = START_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const health = await probeHealth(db);
    if (health.ok) return health;
    await sleep(1000);
  }
  return null;
}

async function install(db) {
  const docker = dockerAvailable();
  if (!docker.ok) {
    onyxLastError = docker.error;
    return { ok: false, error: docker.error };
  }
  const installPath = getInstallPath(db);
  ensureDir(installPath);
  const existing = detectComposeFile(installPath);
  if (existing) {
    return {
      ok: true,
      installed: false,
      message: 'Managed Onyx install already detected.',
      install_path: installPath,
      compose_file: existing,
    };
  }
  const installScriptCommand = [
    'tmp=$(mktemp /tmp/onyx-install.XXXXXX.sh)',
    'trap \'rm -f "$tmp"\' EXIT',
    `curl -fsSL https://raw.githubusercontent.com/onyx-dot-app/onyx/main/deployment/docker_compose/install.sh -o "$tmp"`,
    'chmod +x "$tmp"',
    'sg docker -c "bash \"$tmp\" --no-prompt --lite"',
  ].join(' && ');
  const result = await runCommand('bash', ['-lc', installScriptCommand], {
    cwd: installPath,
    timeoutMs: 15 * 60 * 1000,
  });
  if (!result.ok) {
    onyxLastError = result.error;
    return { ok: false, error: `Could not install managed Onyx: ${result.error}` };
  }
  const composeFile = detectComposeFile(installPath);
  const installRoot = detectInstallRoot(installPath);
  ensureManagedLocalConfig(installPath);
  onyxLastInstall = new Date().toISOString();
  onyxLastError = null;
  return {
    ok: true,
    installed: true,
    install_path: installPath,
    install_root: installRoot,
    compose_file: composeFile,
    host_port: readInstalledPort(installRoot) || null,
    message: composeFile ? 'Managed Onyx installed.' : 'Install completed, but no compose file was detected yet.',
  };
}

async function start(db) {
  const docker = dockerAvailable();
  if (!docker.ok) {
    onyxLastError = docker.error;
    return { ok: false, error: docker.error };
  }
  const currentHealth = await probeHealth(db);
  if (currentHealth.ok) {
    return {
      ok: true,
      started: false,
      message: 'Managed Onyx is already running.',
      health: currentHealth,
      log_path: path.relative(ROOT_DIR, ONYX_LOG),
    };
  }
  const installPath = getInstallPath(db);
  ensureDir(installPath);
  let composeFile = detectComposeFile(installPath);
  if (!composeFile) {
    const installResult = await install(db);
    if (!installResult.ok) return installResult;
    composeFile = detectComposeFile(installPath);
  }
  ensureManagedLocalConfig(installPath);
  const command = getStartCommand(db);
  const env = composeFile ? { COMPOSE_PROJECT_NAME: findDockerProjectName(command.cwd, composeFile) } : {};
  const result = await runCommand(command.command, command.args, {
    cwd: command.cwd,
    env,
    timeoutMs: 5 * 60 * 1000,
  });
  if (!result.ok) {
    onyxLastError = result.error;
    return {
      ok: false,
      error: `Could not start managed Onyx: ${result.error}`,
      start_command: command.display,
      log_path: path.relative(ROOT_DIR, ONYX_LOG),
    };
  }
  const health = await waitForHealth(db);
  if (!health?.ok) {
    return {
      ok: false,
      error: 'Managed Onyx did not become healthy in time.',
      start_command: command.display,
      log_path: path.relative(ROOT_DIR, ONYX_LOG),
    };
  }
  onyxLastStart = new Date().toISOString();
  onyxLastError = null;
  return {
    ok: true,
    started: true,
    health,
    start_command: command.display,
    log_path: path.relative(ROOT_DIR, ONYX_LOG),
  };
}

async function stop(db) {
  const docker = dockerAvailable();
  if (!docker.ok) {
    onyxLastError = docker.error;
    return { ok: false, error: docker.error };
  }
  const installPath = getInstallPath(db);
  const composeFiles = getComposeFiles(installPath);
  const composeFile = composeFiles[0] || null;
  const health = await probeHealth(db);
  if (!composeFile && !health.ok) {
    return { ok: true, stopped: false, message: 'Managed Onyx is not running.' };
  }
  if (!composeFile) {
    return { ok: false, error: 'Managed Onyx runtime is running, but no compose file was detected for controlled shutdown.' };
  }
  const cwd = path.dirname(composeFile);
  const env = { COMPOSE_PROJECT_NAME: findDockerProjectName(cwd, composeFile) };
  const isStandalone = docker.compose_command === 'docker-compose';
  const command = docker.command || (isStandalone ? 'docker-compose' : 'docker');
  const prefix = Array.isArray(docker.command_prefix) ? docker.command_prefix : [];
  const fileArgs = composeFiles.flatMap((file) => ['-f', file]);
  const subargs = isStandalone
    ? [...fileArgs, 'down']
    : ['compose', ...fileArgs, 'down'];
  const args = [...prefix, ...subargs];
  const result = await runCommand(command, args, {
    cwd,
    env,
    timeoutMs: 5 * 60 * 1000,
  });
  if (!result.ok) {
    onyxLastError = result.error;
    return { ok: false, error: `Could not stop managed Onyx: ${result.error}` };
  }
  onyxLastStop = new Date().toISOString();
  return { ok: true, stopped: true, compose_file: composeFile };
}

async function restart(db) {
  const stopResult = await stop(db);
  if (!stopResult.ok && !/not running/i.test(stopResult.error || '')) return stopResult;
  return start(db);
}

async function detect(db) {
  const installInfo = installDetected(db);
  const health = await probeHealth(db);
  const docker = dockerAvailable();
  const command = getStartCommand(db);
  const managedInstallDetected = !!(
    installInfo.install_detected
    || installInfo.managed_runtime_detected
    || (health.ok && installInfo.install_root_exists)
  );
  return {
    enabled: isEnabled(db),
    mode: getMode(db) || 'auto',
    local_enabled: isLocalEnabled(db),
    external_enabled: isExternalEnabled(db),
    local_autostart_enabled: isAutoStartEnabled(db),
    base_url: getBaseUrl(db),
    start_command: command.display,
    install_path: installInfo.install_path,
    install_root: installInfo.install_root,
    install_path_exists: installInfo.install_path_exists,
    install_root_exists: installInfo.install_root_exists,
    deployment_dir: installInfo.deployment_dir,
    deployment_exists: installInfo.deployment_exists,
    host_port: installInfo.host_port,
    auth_type: installInfo.auth_type,
    managed_runtime_detected: installInfo.managed_runtime_detected,
    install_detected: managedInstallDetected,
    compose_file: installInfo.compose_file,
    docker,
    health,
    log_path: path.relative(ROOT_DIR, ONYX_LOG),
    last_install_at: onyxLastInstall,
    last_start_at: onyxLastStart,
    last_stop_at: onyxLastStop,
    last_error: onyxLastError,
  };
}

async function autoStartIfEnabled(db) {
  if (!isEnabled(db)) return { ok: true, skipped: true, reason: 'disabled' };
  const mode = getMode(db);
  const localPreferred = !mode || mode === 'managed_local';
  if (!localPreferred) return { ok: true, skipped: true, reason: 'mode-not-managed-local' };
  if (!isLocalEnabled(db)) return { ok: true, skipped: true, reason: 'local-disabled' };
  if (!isAutoStartEnabled(db)) return { ok: true, skipped: true, reason: 'autostart-disabled' };
  const status = await detect(db);
  if (status.health.ok) return { ok: true, skipped: true, reason: 'already-running' };
  return start(db);
}

module.exports = {
  autoStartIfEnabled,
  detect,
  getBaseUrl,
  getInstallPath,
  install,
  restart,
  start,
  stop,
};
