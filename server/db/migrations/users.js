const USER_MIGRATION_VERSION = '5';

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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
    ON users(username)
    WHERE username IS NOT NULL AND username != ''
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
];

module.exports = {
  USER_MIGRATION_VERSION,
  USER_TABLE_STATEMENTS,
  USER_COLUMN_STATEMENTS,
};
