/**
 * db.js — sql.js wrapper that mimics better-sqlite3's synchronous API.
 *
 * sql.js is pure WASM SQLite (no native compilation needed).
 * Once initialized, all operations are synchronous.
 * Database is persisted to badshuffle.db after every write.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'badshuffle.db')
  : path.join(__dirname, 'badshuffle.db');

function normalizeParams(args) {
  return args.map(v => (v === undefined ? null : v));
}

class Statement {
  constructor(dbWrapper, sql) {
    this._dw = dbWrapper;
    this._sql = sql;
  }

  run(...args) {
    const params = normalizeParams(args);
    try {
      this._dw._raw.run(this._sql, params);
    } catch (e) {
      throw new Error(e.message + '\nSQL: ' + this._sql);
    }
    const res = this._dw._raw.exec('SELECT last_insert_rowid(), changes()');
    const [rowid, changes] = res.length ? res[0].values[0] : [0, 0];
    if (!this._dw._inTx) this._dw._save();
    return { lastInsertRowid: rowid, changes };
  }

  get(...args) {
    const params = normalizeParams(args);
    const stmt = this._dw._raw.prepare(this._sql);
    if (params.length > 0) stmt.bind(params);
    let row;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  all(...args) {
    const params = normalizeParams(args);
    const stmt = this._dw._raw.prepare(this._sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
}

class DB {
  constructor(raw) {
    this._raw = raw;
    this._inTx = false;
  }

  _save() {
    const data = this._raw.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  prepare(sql) { return new Statement(this, sql); }

  exec(sql) {
    this._raw.exec(sql);
    if (!this._inTx) this._save();
    return this;
  }

  pragma(str) {
    try { this._raw.run(`PRAGMA ${str}`); } catch (e) { /* ignore */ }
  }

  transaction(fn) {
    return (...args) => {
      this._raw.run('BEGIN');
      this._inTx = true;
      try {
        fn(...args);
        this._raw.run('COMMIT');
      } catch (e) {
        this._raw.run('ROLLBACK');
        throw e;
      } finally {
        this._inTx = false;
        this._save();
      }
    };
  }
}

async function initDb() {
  const initSqlJs = require('sql.js');
  const wasmPath = path.join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });

  let raw;
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    raw = new SQL.Database(buf);
  } else {
    raw = new SQL.Database();
  }

  const db = new DB(raw);

  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      photo_url  TEXT,
      source     TEXT    DEFAULT 'manual',
      hidden     INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS item_associations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      child_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      UNIQUE(parent_id, child_id)
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      guest_count INTEGER DEFAULT 0,
      event_date  TEXT,
      notes       TEXT,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quote_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      quantity   INTEGER DEFAULT 1,
      label      TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item_stats (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id      INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
      times_quoted INTEGER DEFAULT 0,
      total_guests INTEGER DEFAULT 0,
      last_used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_brackets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      bracket_min INTEGER NOT NULL,
      bracket_max INTEGER NOT NULL,
      times_used  INTEGER DEFAULT 0,
      UNIQUE(item_id, bracket_min)
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      ip           TEXT    NOT NULL,
      attempted_at TEXT    DEFAULT (datetime('now')),
      success      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      used       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS extension_tokens (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT,
      email       TEXT,
      phone       TEXT,
      event_date  TEXT,
      event_type  TEXT,
      source_url  TEXT,
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add new columns to items (safe — ignore if already exist)
  for (const col of [
    'ALTER TABLE items ADD COLUMN quantity_in_stock INTEGER DEFAULT 0',
    'ALTER TABLE items ADD COLUMN unit_price REAL DEFAULT 0',
    'ALTER TABLE items ADD COLUMN category TEXT',
    'ALTER TABLE items ADD COLUMN description TEXT',
    'ALTER TABLE items ADD COLUMN taxable INTEGER DEFAULT 1',
    'ALTER TABLE items ADD COLUMN labor_hours REAL DEFAULT 0',
  ]) {
    try { db.exec(col); } catch {}
  }

  // Add role + approved to users (idempotent)
  for (const col of [
    "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
    'ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0',
  ]) {
    try { db.exec(col); } catch {}
  }

  // quotes — status lifecycle + lead linkage + public share token
  const quoteCols = [
    "ALTER TABLE quotes ADD COLUMN status TEXT DEFAULT 'draft'",
    "ALTER TABLE quotes ADD COLUMN lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL",
    "ALTER TABLE quotes ADD COLUMN public_token TEXT"
  ];
  for (const sql of quoteCols) {
    try { db.exec(sql); } catch (e) {}
  }
  // Venue, quote notes, tax_rate
  const quoteCols2 = [
    'ALTER TABLE quotes ADD COLUMN venue_name TEXT',
    'ALTER TABLE quotes ADD COLUMN venue_email TEXT',
    'ALTER TABLE quotes ADD COLUMN venue_phone TEXT',
    'ALTER TABLE quotes ADD COLUMN venue_address TEXT',
    'ALTER TABLE quotes ADD COLUMN venue_contact TEXT',
    'ALTER TABLE quotes ADD COLUMN venue_notes TEXT',
    'ALTER TABLE quotes ADD COLUMN quote_notes TEXT',
    'ALTER TABLE quotes ADD COLUMN tax_rate REAL'
  ];
  for (const sql of quoteCols2) {
    try { db.exec(sql); } catch (e) {}
  }
  try { db.exec("ALTER TABLE quotes ADD COLUMN has_unsigned_changes INTEGER DEFAULT 0"); } catch (e) {}
  // Quote client info
  const quoteClientCols = [
    'ALTER TABLE quotes ADD COLUMN client_first_name TEXT',
    'ALTER TABLE quotes ADD COLUMN client_last_name TEXT',
    'ALTER TABLE quotes ADD COLUMN client_email TEXT',
    'ALTER TABLE quotes ADD COLUMN client_phone TEXT',
    'ALTER TABLE quotes ADD COLUMN client_address TEXT'
  ];
  for (const sql of quoteClientCols) {
    try { db.exec(sql); } catch (e) {}
  }
  try { db.exec('ALTER TABLE quote_items ADD COLUMN hidden_from_quote INTEGER DEFAULT 0'); } catch (e) {}
  // Email templates (admin/operator)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        subject     TEXT NOT NULL DEFAULT '',
        body_html   TEXT,
        body_text   TEXT,
        is_default  INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {}
  // Contract templates (reusable contract body for quotes)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS contract_templates (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        body_html   TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {}
  // leads — back-reference to quote
  try { db.exec("ALTER TABLE leads ADD COLUMN quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL"); } catch (e) {}
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token) WHERE public_token IS NOT NULL");
  } catch (e) {}

  // Promote first-ever user to admin/approved (safe to run every start)
  db.prepare(
    "UPDATE users SET role='admin', approved=1 WHERE id=(SELECT MIN(id) FROM users)"
  ).run();

  // Seed default settings
  const defaults = { tax_rate: '0', currency: 'USD', company_name: '', company_email: '', company_logo: '', company_address: '', mapbox_access_token: '' };
  for (const [k, v] of Object.entries(defaults)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }

  // Seed system/startup settings
  const systemDefaults = {
    autokill_enabled:      '1',
    update_check_enabled:  '1',
    update_check_last:     '',
    update_check_latest:   '',
    update_available:      '0',
  };
  for (const [k, v] of Object.entries(systemDefaults)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }

  // Seed SMTP settings
  const smtpDefaults = {
    smtp_host: '', smtp_port: '587', smtp_secure: 'false',
    smtp_user: '', smtp_pass_enc: '', smtp_from: '',
  };
  for (const [k, v] of Object.entries(smtpDefaults)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }

  // Login protection: math question always on; reCAPTCHA v2 optional
  const recaptchaDefaults = { recaptcha_enabled: '0', recaptcha_site_key: '', recaptcha_secret_key: '' };
  for (const [k, v] of Object.entries(recaptchaDefaults)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }

  // Files table (media library)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT NOT NULL,
        stored_name   TEXT NOT NULL UNIQUE,
        mime_type     TEXT,
        size          INTEGER,
        uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at    TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch(e) {}

  // Custom line items on quotes
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quote_custom_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        unit_price  REAL DEFAULT 0,
        quantity    INTEGER DEFAULT 1,
        photo_url   TEXT,
        taxable     INTEGER DEFAULT 1,
        sort_order  INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch(e) {}

  // Lead timeline / activity log
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lead_events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        note       TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {}

  // Contracts (one per quote: body + client signature)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS contracts (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id       INTEGER NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,
        body_html      TEXT,
        signed_at      TEXT,
        signature_data TEXT,
        signer_name    TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {}

  // Contract change logs (who changed what and when)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS contract_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        changed_at  TEXT DEFAULT (datetime('now')),
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_email  TEXT,
        old_body    TEXT,
        new_body    TEXT
      )
    `);
  } catch (e) {}

  // Quote-level file attachments (files attached to this quote)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quote_attachments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(quote_id, file_id)
      )
    `);
  } catch (e) {}

  // Quote payments (billing / applied payments)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quote_payments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        amount      REAL NOT NULL,
        method      TEXT,
        status      TEXT DEFAULT 'charged',
        reference   TEXT,
        paid_at     TEXT,
        note        TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
      )
    `);
  } catch (e) {}

  // Billing history (payments received, removed, refunded) for Billing page
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS billing_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        event_type  TEXT NOT NULL,
        amount      REAL NOT NULL,
        note        TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        user_email  TEXT
      )
    `);
  } catch (e) {}

  // Quote activity log (unified log for contract, payments, files, items, send)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quote_activity_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        event_type  TEXT NOT NULL,
        description TEXT,
        old_value   TEXT,
        new_value   TEXT,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_email  TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {}
  try { db.exec('ALTER TABLE quote_activity_log ADD COLUMN old_value TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE quote_activity_log ADD COLUMN new_value TEXT'); } catch (e) {}

  // Messages (outbound emails + inbound replies)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id    INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
        direction   TEXT NOT NULL,
        from_email  TEXT,
        to_email    TEXT,
        subject     TEXT,
        body_text   TEXT,
        body_html   TEXT,
        message_id  TEXT UNIQUE,
        in_reply_to TEXT,
        status      TEXT DEFAULT 'sent',
        sent_at     TEXT DEFAULT (datetime('now')),
        quote_name  TEXT
      )
    `);
  } catch(e) {}

  // Seed IMAP settings
  const imapDefaults = {
    imap_host: '', imap_port: '993', imap_secure: 'true',
    imap_user: '', imap_pass_enc: '', imap_poll_enabled: '0'
  };
  for (const [k, v] of Object.entries(imapDefaults)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }

  return db;
}

module.exports = initDb;
module.exports.DB = DB;
module.exports.DB_PATH = DB_PATH;
