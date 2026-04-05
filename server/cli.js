#!/usr/bin/env node
/**
 * BadShuffle CLI admin utilities.
 * Run from repo root: node server/cli.js <subcommand> [options]
 * Or via npm: npm run create-admin -- --email x@y.com --password secret
 */

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const packageJson = require('../package.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  const opts = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2).replace(/-/g, '_');
      if (key === 'no_backup') {
        opts.backup = false;
        continue;
      }
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return { cmd, opts };
}

function usage() {
  console.log(`
BadShuffle CLI — admin utilities

  create-admin    --email <email> --password <password> [--role admin|operator|user]
  reset-password  --email <email> --password <password>
  reset-auth       --yes   (deletes users, login_attempts, reset_tokens, extension_tokens)
  wipe-database    --yes   [--backup]  (default: backup on; use --no-backup to skip)

Safety: reset-auth and wipe-database require --yes. Passwords are never printed.

  rust-compare-quote --quote-id <id> [--item-ids 1,2,3] [--section-id <id>] [--include-items] [--item-limit-per-quote 10]
  rust-compare-batch [--limit 10] [--quote-ids 4,7,8] [--include-items] [--item-limit-per-quote 10]
  rust-parity-report [--limit 5] [--quote-ids 4,7,8] [--include-items] [--item-limit-per-quote 5]

  onyx-detect
  onyx-install
  onyx-start
  onyx-stop
  onyx-restart
`);
}

async function runCreateAdmin(db, opts) {
  const email = opts.email;
  const password = opts.password;
  const role = (opts.role || 'admin').toLowerCase();
  if (!email || !password) {
    console.error('Error: create-admin requires --email and --password');
    return 1;
  }
  if (!['admin', 'operator', 'user'].includes(role)) {
    console.error('Error: --role must be admin, operator, or user');
    return 1;
  }
  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters');
    return 1;
  }
  const hash = await bcrypt.hash(password, 10);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, role = ?, approved = 1 WHERE id = ?')
      .run(hash, role, existing.id);
    console.log('Updated existing user:', email, '(role:', role + ', approved)');
  } else {
    db.prepare(
      "INSERT INTO users (email, password_hash, role, approved) VALUES (?, ?, ?, 1)"
    ).run(email, hash, role);
    console.log('Created admin user:', email, '(role:', role + ')');
  }
  return 0;
}

async function runResetPassword(db, opts) {
  const email = opts.email;
  const password = opts.password;
  if (!email || !password) {
    console.error('Error: reset-password requires --email and --password');
    return 1;
  }
  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters');
    return 1;
  }
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    console.error('Error: no user with email:', email);
    return 1;
  }
  const hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  console.log('Password reset for:', email);
  return 0;
}

function runResetAuth(db, opts) {
  if (opts.yes !== true) {
    console.error('Error: reset-auth is destructive and requires --yes');
    console.error('This will delete all users, login_attempts, reset_tokens, extension_tokens.');
    console.error('Inventory, leads, and quotes are preserved.');
    return 1;
  }
  const loginCount = db.prepare('SELECT COUNT(*) as n FROM login_attempts').get().n;
  const tokenCount = db.prepare('SELECT COUNT(*) as n FROM extension_tokens').get().n;
  const resetCount = db.prepare('SELECT COUNT(*) as n FROM reset_tokens').get().n;
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  console.log('Will delete: users:', userCount, 'login_attempts:', loginCount, 'reset_tokens:', resetCount, 'extension_tokens:', tokenCount);
  db.prepare('DELETE FROM login_attempts').run();
  db.prepare('DELETE FROM extension_tokens').run();
  db.prepare('DELETE FROM reset_tokens').run();
  db.prepare('DELETE FROM users').run();
  console.log('Auth data cleared. Run create-admin to add a user again.');
  return 0;
}

function runWipeDatabase(opts) {
  if (opts.yes !== true) {
    console.error('Error: wipe-database is destructive and requires --yes');
    console.error('This will remove the database file. Use --backup (default) to copy it first.');
    return 1;
  }
  const initDb = require('./db.js');
  const DB_PATH = initDb.DB_PATH || path.join(__dirname, 'badshuffle.db');
  const doBackup = opts.backup !== false;

  console.log('DB path:', DB_PATH);
  if (!fs.existsSync(DB_PATH)) {
    console.log('No database file at', DB_PATH);
    return 0;
  }

  if (doBackup) {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const now = new Date();
    const stamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '-' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    const name = path.basename(DB_PATH, '.db') || 'badshuffle';
    const backupPath = path.join(backupsDir, name + '-' + stamp + '.db');
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('Backup written to:', backupPath);
  }

  const lockSuffixes = ['-journal', '-wal', '-shm'];
  try {
    fs.unlinkSync(DB_PATH);
    console.log('Database removed:', DB_PATH);
    for (const suf of lockSuffixes) {
      const lockPath = DB_PATH + suf;
      if (fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
          console.log('Removed lock file:', lockPath);
        } catch (e) {
          console.warn('Could not remove', lockPath, e.message);
        }
      }
    }
    console.log('On next server start, a fresh database will be created.');
  } catch (e) {
    console.error('Failed to delete database:', e.message);
    console.error('Stop the server and try again if the file is in use.');
    return 1;
  }
  return 0;
}

async function runRustCompareQuote(db, opts) {
  const quoteId = parseInt(String(opts.quote_id || ''), 10);
  if (isNaN(quoteId)) {
    console.error('Error: rust-compare-quote requires --quote-id <id>');
    return 1;
  }
  const itemIds = String(opts.item_ids || '')
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => !isNaN(value));
  const sectionId = opts.section_id != null && opts.section_id !== ''
    ? parseInt(String(opts.section_id), 10)
    : null;
  const includeItems = opts.include_items === true || itemIds.length > 0;
  const itemLimitPerQuote = opts.item_limit_per_quote != null && opts.item_limit_per_quote !== ''
    ? parseInt(String(opts.item_limit_per_quote), 10)
    : null;
  const rustInventoryParityService = require('./services/rustInventoryParityService');
  const result = await rustInventoryParityService.compareQuote(db, quoteId, {
    itemIds,
    sectionId,
    includeItems,
    itemLimitPerQuote,
  });
  console.log(JSON.stringify(result, null, 2));
  return result.summary_match && (result.items_match !== false) ? 0 : 2;
}

async function runRustCompareBatch(db, opts) {
  const quoteIds = String(opts.quote_ids || '')
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => !isNaN(value));
  const limit = opts.limit != null && opts.limit !== ''
    ? parseInt(String(opts.limit), 10)
    : 10;
  const includeItems = opts.include_items === true;
  const itemLimitPerQuote = opts.item_limit_per_quote != null && opts.item_limit_per_quote !== ''
    ? parseInt(String(opts.item_limit_per_quote), 10)
    : null;
  const rustInventoryParityService = require('./services/rustInventoryParityService');
  const result = await rustInventoryParityService.compareQuotes(db, {
    quoteIds,
    limit,
    includeItems,
    itemLimitPerQuote,
  });
  console.log(JSON.stringify(result, null, 2));
  return result.totals.summary_mismatches === 0 && result.totals.item_mismatches === 0 && result.totals.errors === 0 ? 0 : 2;
}

function formatCompactLine(comparison) {
  if (comparison.error) return `- Quote ${comparison.quote_id}: error: ${comparison.error}`;
  const parts = [
    `Quote ${comparison.quote_id}`,
    `summary=${comparison.summary_match ? 'match' : 'mismatch'}`,
  ];
  if (comparison.items_match != null) parts.push(`items=${comparison.items_match ? 'match' : 'mismatch'}`);
  if (comparison.summary_compact?.changed_count) parts.push(`summary_changes=${comparison.summary_compact.changed_count}`);
  if (comparison.items_compact?.changed_count) parts.push(`item_changes=${comparison.items_compact.changed_count}`);
  return `- ${parts.join(' | ')}`;
}

function buildRustParityReport(result, opts) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('# Rust Parity Report');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Version: v${packageJson.version}`);
  lines.push(`Context: ${opts.context || 'manual'}`);
  lines.push('');
  lines.push('## Run Config');
  lines.push('');
  lines.push(`- Quote ids: ${result.quote_ids.join(', ') || 'none'}`);
  lines.push(`- Include items: ${opts.include_items === true ? 'yes' : 'no'}`);
  if (opts.item_limit_per_quote != null && opts.item_limit_per_quote !== '') {
    lines.push(`- Item limit per quote: ${opts.item_limit_per_quote}`);
  }
  if (opts.limit != null && opts.limit !== '') {
    lines.push(`- Batch limit: ${opts.limit}`);
  }
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- Quotes checked: ${result.totals.quotes_checked}`);
  lines.push(`- Summary mismatches: ${result.totals.summary_mismatches}`);
  lines.push(`- Item mismatches: ${result.totals.item_mismatches}`);
  lines.push(`- Errors: ${result.totals.errors}`);
  lines.push('');
  lines.push('## Per Quote');
  lines.push('');
  result.comparisons.forEach((comparison) => {
    lines.push(formatCompactLine(comparison));
  });
  lines.push('');
  if (result.comparisons.some((comparison) => comparison.summary_diff || comparison.items_diff || comparison.error)) {
    lines.push('## Mismatch Details');
    lines.push('');
    result.comparisons.forEach((comparison) => {
      if (!comparison.summary_diff && !comparison.items_diff && !comparison.error) return;
      lines.push(`### Quote ${comparison.quote_id}`);
      lines.push('');
      if (comparison.error) lines.push(`- Error: ${comparison.error}`);
      if (comparison.summary_compact) lines.push(`- Summary compact: ${JSON.stringify(comparison.summary_compact)}`);
      if (comparison.items_compact) lines.push(`- Items compact: ${JSON.stringify(comparison.items_compact)}`);
      lines.push('');
    });
  }
  return lines.join('\n');
}

function buildRustParityJson(result, opts) {
  return {
    generated_at: new Date().toISOString(),
    version: packageJson.version,
    context: opts.context || 'manual',
    run_config: {
      quote_ids: result.quote_ids,
      include_items: opts.include_items === true,
      item_limit_per_quote: opts.item_limit_per_quote != null ? Number(opts.item_limit_per_quote) : null,
      batch_limit: opts.limit != null ? Number(opts.limit) : null,
    },
    totals: result.totals,
    comparisons: result.comparisons.map((comparison) => ({
      quote_id: comparison.quote_id,
      section_id: comparison.section_id ?? null,
      item_ids: comparison.item_ids || [],
      include_items: comparison.include_items === true,
      summary_match: comparison.summary_match,
      items_match: comparison.items_match,
      error: comparison.error || null,
      summary_compact: comparison.summary_compact || null,
      items_compact: comparison.items_compact || null,
    })),
  };
}

async function runRustParityReport(db, opts) {
  const quoteIds = String(opts.quote_ids || '')
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => !isNaN(value));
  const limit = opts.limit != null && opts.limit !== ''
    ? parseInt(String(opts.limit), 10)
    : 5;
  const includeItems = opts.include_items !== false;
  const itemLimitPerQuote = opts.item_limit_per_quote != null && opts.item_limit_per_quote !== ''
    ? parseInt(String(opts.item_limit_per_quote), 10)
    : 5;
  const rustInventoryParityService = require('./services/rustInventoryParityService');
  const result = await rustInventoryParityService.compareQuotes(db, {
    quoteIds,
    limit,
    includeItems,
    itemLimitPerQuote,
  });
  const reportDir = path.join(process.cwd(), 'AI', 'reports');
  const reportPath = path.join(reportDir, 'rust-parity-latest.md');
  const reportJsonPath = path.join(reportDir, 'rust-parity-latest.json');
  const reportOptions = {
    quote_ids: quoteIds,
    limit,
    include_items: includeItems,
    item_limit_per_quote: itemLimitPerQuote,
    context: String(opts.context || process.env.RUST_PARITY_CONTEXT || 'manual'),
  };
  fs.writeFileSync(reportPath, buildRustParityReport(result, reportOptions));
  fs.writeFileSync(reportJsonPath, JSON.stringify(buildRustParityJson(result, reportOptions), null, 2));
  console.log(JSON.stringify({ ok: true, report_path: reportPath, report_json_path: reportJsonPath, totals: result.totals }, null, 2));
  return result.totals.summary_mismatches === 0 && result.totals.item_mismatches === 0 && result.totals.errors === 0 ? 0 : 2;
}


async function runOnyxLifecycle(db, action) {
  const onyxLifecycleService = require('./services/onyxLifecycleService');
  let result;
  switch (action) {
    case 'detect':
      result = await onyxLifecycleService.detect(db);
      break;
    case 'install':
      result = await onyxLifecycleService.install(db);
      break;
    case 'start':
      result = await onyxLifecycleService.start(db);
      break;
    case 'stop':
      result = await onyxLifecycleService.stop(db);
      break;
    case 'restart':
      result = await onyxLifecycleService.restart(db);
      break;
    default:
      throw new Error(`Unknown Onyx lifecycle action: ${action}`);
  }
  console.log(JSON.stringify(result, null, 2));
  return result.ok === false ? 1 : 0;
}

async function main() {
  const { cmd, opts } = parseArgs(process.argv);

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    usage();
    process.exit(0);
  }

  if (cmd === 'wipe-database') {
    const code = runWipeDatabase(opts);
    process.exit(code);
  }

  const initDb = require('./db.js');
  let db;
  try {
    db = await initDb();
  } catch (e) {
    console.error('Failed to open database:', e.message);
    process.exit(1);
  }

  let code = 1;
  try {
    switch (cmd) {
      case 'create-admin':
        code = await runCreateAdmin(db, opts);
        break;
      case 'reset-password':
        code = await runResetPassword(db, opts);
        break;
      case 'reset-auth':
        code = runResetAuth(db, opts);
        break;
      case 'rust-compare-quote':
        code = await runRustCompareQuote(db, opts);
        break;
      case 'rust-compare-batch':
        code = await runRustCompareBatch(db, opts);
        break;
      case 'rust-parity-report':
        code = await runRustParityReport(db, opts);
        break;
      case 'onyx-detect':
        code = await runOnyxLifecycle(db, 'detect');
        break;
      case 'onyx-install':
        code = await runOnyxLifecycle(db, 'install');
        break;
      case 'onyx-start':
        code = await runOnyxLifecycle(db, 'start');
        break;
      case 'onyx-stop':
        code = await runOnyxLifecycle(db, 'stop');
        break;
      case 'onyx-restart':
        code = await runOnyxLifecycle(db, 'restart');
        break;
      default:
        console.error('Unknown command:', cmd);
        usage();
    }
  } catch (e) {
    console.error('Error:', e.message);
    code = 1;
  }

  process.exit(code);
}

main();
