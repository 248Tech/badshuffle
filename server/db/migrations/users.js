const USER_MIGRATION_VERSION = '9';

const USER_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      current_path  TEXT,
      current_label TEXT,
      last_seen_at  TEXT,
      updated_at    TEXT DEFAULT (datetime('now'))
    )
  `,
  `
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
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS notification_recipients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      presented_at    TEXT,
      read_at         TEXT,
      dismissed_at    TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
    ON users(username)
    WHERE username IS NOT NULL AND username != ''
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_recipients_unique
    ON notification_recipients(notification_id, user_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_id
    ON notification_recipients(user_id, id DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS team_groups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS team_group_members (
      group_id    INTEGER NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS notification_type_settings (
      notification_type TEXT PRIMARY KEY,
      enabled           INTEGER DEFAULT 1,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS notification_type_groups (
      notification_type TEXT NOT NULL,
      group_id          INTEGER NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
      created_at        TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (notification_type, group_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS roles (
      key         TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      is_system   INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_key     TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
      module_key   TEXT NOT NULL,
      access_level TEXT NOT NULL DEFAULT 'none',
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (role_key, module_key)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS team_chat_threads (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id                INTEGER NOT NULL DEFAULT 1,
      thread_type           TEXT NOT NULL DEFAULT 'team',
      title                 TEXT NOT NULL,
      quote_id              INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
      onyx_chat_session_id  TEXT,
      onyx_persona_id       INTEGER,
      created_by_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at            TEXT DEFAULT (datetime('now')),
      updated_at            TEXT DEFAULT (datetime('now')),
      last_message_at       TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS team_chat_messages (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id           INTEGER NOT NULL REFERENCES team_chat_threads(id) ON DELETE CASCADE,
      role                TEXT NOT NULL,
      body_text           TEXT NOT NULL,
      message_kind        TEXT NOT NULL DEFAULT 'text',
      source              TEXT NOT NULL DEFAULT 'local',
      onyx_message_id     INTEGER,
      created_by_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by_email    TEXT,
      metadata_json       TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS team_chat_participants (
      thread_id    INTEGER NOT NULL REFERENCES team_chat_threads(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (thread_id, user_id)
    )
  `,
  'CREATE INDEX IF NOT EXISTS idx_team_chat_threads_type_last_message ON team_chat_threads(thread_type, last_message_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_team_chat_threads_quote_id ON team_chat_threads(quote_id)',
  'CREATE INDEX IF NOT EXISTS idx_team_chat_messages_thread_id ON team_chat_messages(thread_id, id ASC)',
  'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
];

const USER_COLUMN_STATEMENTS = [
  "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
  'ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN first_name TEXT',
  'ALTER TABLE users ADD COLUMN last_name TEXT',
  'ALTER TABLE users ADD COLUMN username TEXT',
  'ALTER TABLE users ADD COLUMN display_name TEXT',
  'ALTER TABLE users ADD COLUMN phone TEXT',
  'ALTER TABLE users ADD COLUMN photo_url TEXT',
  'ALTER TABLE users ADD COLUMN bio TEXT',
  'ALTER TABLE users ADD COLUMN live_notifications_enabled INTEGER DEFAULT 1',
  'ALTER TABLE users ADD COLUMN live_notification_sound_enabled INTEGER DEFAULT 0',
  "ALTER TABLE user_presence ADD COLUMN presence_state TEXT DEFAULT 'offline'",
  'ALTER TABLE user_presence ADD COLUMN last_active_at TEXT',
  'ALTER TABLE user_presence ADD COLUMN online_since_at TEXT',
  'ALTER TABLE user_presence ADD COLUMN online_notification_at TEXT',
  'ALTER TABLE notification_recipients ADD COLUMN dismissed_at TEXT',
];

module.exports = {
  USER_MIGRATION_VERSION,
  USER_TABLE_STATEMENTS,
  USER_COLUMN_STATEMENTS,
};
