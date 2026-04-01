/**
 * db.js — sql.js wrapper that mimics better-sqlite3's synchronous API.
 *
 * sql.js is pure WASM SQLite (no native compilation needed).
 * Once initialized, all operations are synchronous.
 * Database is persisted to badshuffle.db after every write.
 */
const fs = require('fs');
const path = require('path');
const { applyBaseSchema } = require('./db/schema');
const { applyMigrations } = require('./db/migrations');
const { seedDefaultSettings, promoteFirstUserToAdmin } = require('./db/settings');
const { recordBootstrapVersions } = require('./db/meta');
const { seedRolesAndPermissions } = require('./db/permissions');

const DB_PATH = process.env.DB_PATH || (typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'badshuffle.db')
  : path.join(__dirname, 'badshuffle.db'));

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

  reload(buffer) {
    const newRaw = new this._SQL.Database(buffer);
    this._raw.close();
    this._raw = newRaw;
    this._save();
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
  db._SQL = SQL; // stored for reload() after DB import

  db.pragma('foreign_keys = ON');
  applyBaseSchema(db);
  applyMigrations(db);
  seedRolesAndPermissions(db);
  promoteFirstUserToAdmin(db);
  seedDefaultSettings(db);
  recordBootstrapVersions(db);

  return db;
}

module.exports = initDb;
module.exports.DB = DB;
module.exports.DB_PATH = DB_PATH;
