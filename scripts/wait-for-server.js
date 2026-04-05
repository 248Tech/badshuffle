const fs = require('fs');
const path = require('path');

const LOCK_PATH = path.resolve(__dirname, '../badshuffle.lock');
const DEFAULT_PORT = Number(process.env.PORT) || 3001;
const TIMEOUT_MS = 30_000;
const POLL_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPortFromLock() {
  try {
    const raw = fs.readFileSync(LOCK_PATH, 'utf8');
    const lock = JSON.parse(raw);
    const port = Number(lock && lock.port);
    if (Number.isFinite(port) && port > 0) return port;
  } catch {}
  return null;
}

async function isHealthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const port = getPortFromLock() || DEFAULT_PORT;
    if (await isHealthy(port)) {
      process.stdout.write(`[wait-for-server] API ready on port ${port}\n`);
      return;
    }
    await sleep(POLL_MS);
  }

  process.stderr.write('[wait-for-server] Timed out waiting for API startup\n');
  process.exit(1);
}

main();
