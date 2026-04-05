const USER_SCHEMA_VERSION = '7';

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
    live_notifications_enabled INTEGER DEFAULT 1,
    live_notification_sound_enabled INTEGER DEFAULT 0,
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
    last_active_at TEXT,
    online_since_at TEXT,
    online_notification_at TEXT,
    presence_state TEXT DEFAULT 'offline',
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

  CREATE TABLE IF NOT EXISTS notifications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    type          TEXT NOT NULL,
    title         TEXT NOT NULL,
    body          TEXT,
    href          TEXT,
    entity_type   TEXT,
    entity_id     INTEGER,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_label   TEXT,
    actor_photo_url TEXT,
    metadata_json TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_recipients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    presented_at    TEXT,
    read_at         TEXT,
    dismissed_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_recipients_unique
  ON notification_recipients(notification_id, user_id);

  CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_id
  ON notification_recipients(user_id, id DESC);

  CREATE TABLE IF NOT EXISTS team_groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS team_group_members (
    group_id    INTEGER NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS notification_type_settings (
    notification_type TEXT PRIMARY KEY,
    enabled           INTEGER DEFAULT 1,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_type_groups (
    notification_type TEXT NOT NULL,
    group_id          INTEGER NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
    created_at        TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (notification_type, group_id)
  );
`;

module.exports = {
  USER_SCHEMA_VERSION,
  USER_SCHEMA_SQL,
};
