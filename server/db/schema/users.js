const USER_SCHEMA_VERSION = '5';

const USER_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    first_name    TEXT,
    last_name     TEXT,
    username      TEXT    UNIQUE,
    display_name  TEXT,
    phone         TEXT,
    photo_url     TEXT,
    bio           TEXT,
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

  CREATE TABLE IF NOT EXISTS user_presence (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_path  TEXT,
    current_label TEXT,
    last_seen_at  TEXT,
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS roles (
    key         TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    is_system   INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role_key     TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
    module_key   TEXT NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'none',
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (role_key, module_key)
  );
`;

module.exports = {
  USER_SCHEMA_VERSION,
  USER_SCHEMA_SQL,
};
