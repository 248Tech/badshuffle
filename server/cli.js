#!/usr/bin/env node
/**
 * BadShuffle CLI admin utilities.
 * Run from repo root: node server/cli.js <subcommand> [options]
 * Or via npm: npm run create-admin -- --email x@y.com --password secret
 */

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

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

  try {
    fs.unlinkSync(DB_PATH);
    console.log('Database removed:', DB_PATH);
    console.log('On next server start, a fresh database will be created.');
  } catch (e) {
    console.error('Failed to delete database:', e.message);
    console.error('Stop the server and try again if the file is in use.');
    return 1;
  }
  return 0;
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
