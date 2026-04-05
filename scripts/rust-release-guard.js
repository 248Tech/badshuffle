const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HEALTH_URL = `${String(process.env.RUST_ENGINE_URL || 'http://127.0.0.1:3101').replace(/\/+$/, '')}/health`;
const TIMEOUT_MS = 30_000;
const POLL_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthy() {
  try {
    const response = await fetch(HEALTH_URL);
    return response.ok;
  } catch {
    return false;
  }
}

function startRustEngine() {
  const child = spawn('cargo', ['run', '--manifest-path', 'rust-core/Cargo.toml', '-p', 'api'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  return child;
}

async function waitForHealth() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    if (await isHealthy()) return true;
    await sleep(POLL_MS);
  }
  return false;
}

function runParityReport() {
  return new Promise((resolve) => {
    const child = spawn('node', ['server/cli.js', 'rust-parity-report', '--limit', '5', '--include-items', '--item-limit-per-quote', '5', '--context', 'release-guard'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code == null ? 1 : code));
    child.on('error', () => resolve(1));
  });
}

async function main() {
  if (String(process.env.SKIP_RUST_RELEASE_GUARD || '0') === '1') {
    process.stdout.write('[rust-release-guard] Skipped via SKIP_RUST_RELEASE_GUARD=1\n');
    return;
  }

  let rustChild = null;
  let startedLocally = false;

  const cleanup = () => {
    if (startedLocally && rustChild && !rustChild.killed) {
      try { rustChild.kill('SIGINT'); } catch {}
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  if (!(await isHealthy())) {
    process.stdout.write('[rust-release-guard] Rust engine not running, starting local service\n');
    rustChild = startRustEngine();
    startedLocally = true;
    const healthy = await waitForHealth();
    if (!healthy) {
      cleanup();
      process.stderr.write('[rust-release-guard] Timed out waiting for Rust engine health\n');
      process.exit(1);
    }
  } else {
    process.stdout.write('[rust-release-guard] Reusing running Rust engine\n');
  }

  const code = await runParityReport();
  cleanup();
  if (code !== 0) {
    process.stderr.write(`[rust-release-guard] Parity report failed with code ${code}\n`);
    process.exit(code);
  }
  process.stdout.write('[rust-release-guard] Rust parity guard passed\n');
}

main().catch((error) => {
  process.stderr.write(`[rust-release-guard] ${error && error.message ? error.message : String(error)}\n`);
  process.exit(1);
});
