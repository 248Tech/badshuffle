const { upsertSettingValue } = require('./queries/settings');
const { SCHEMA_VERSIONS } = require('./schema');
const { MIGRATION_VERSIONS } = require('./migrations');
const { DEFAULTS_VERSIONS } = require('./defaults');

const BOOTSTRAP_VERSIONS = {
  schema: SCHEMA_VERSIONS,
  migrations: MIGRATION_VERSIONS,
  defaults: DEFAULTS_VERSIONS,
};

function ensureBootstrapMetaTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_bootstrap_meta (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function setBootstrapMeta(db, key, value) {
  db.prepare(
    "INSERT INTO db_bootstrap_meta (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(key, value);
}

function flattenBootstrapVersions(versions) {
  const flattened = {};
  for (const [group, entries] of Object.entries(versions)) {
    for (const [key, value] of Object.entries(entries)) {
      flattened[`${group}.${key}`] = value;
    }
  }
  return flattened;
}

function recordBootstrapVersions(db, versions = BOOTSTRAP_VERSIONS) {
  ensureBootstrapMetaTable(db);
  for (const [key, value] of Object.entries(flattenBootstrapVersions(versions))) {
    setBootstrapMeta(db, key, value);
  }
}

module.exports = {
  BOOTSTRAP_VERSIONS,
  ensureBootstrapMetaTable,
  flattenBootstrapVersions,
  recordBootstrapVersions,
};
