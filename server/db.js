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
  `);

  return db;
}

module.exports = initDb;
