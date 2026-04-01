const FILE_MIGRATION_VERSION = '2';

const FILE_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS files (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      stored_name   TEXT NOT NULL UNIQUE,
      mime_type     TEXT,
      size          INTEGER,
      uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS file_variants (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id     INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      variant_key TEXT NOT NULL,
      format      TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      mime_type   TEXT NOT NULL,
      size        INTEGER NOT NULL DEFAULT 0,
      width       INTEGER,
      height      INTEGER,
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE (file_id, variant_key, format)
    )
  `,
];

const FILE_COLUMN_STATEMENTS = [
  'ALTER TABLE files ADD COLUMN is_image INTEGER NOT NULL DEFAULT 0',
  "ALTER TABLE files ADD COLUMN storage_mode TEXT NOT NULL DEFAULT 'legacy_single'",
  'ALTER TABLE files ADD COLUMN source_format TEXT',
  'ALTER TABLE files ADD COLUMN width INTEGER',
  'ALTER TABLE files ADD COLUMN height INTEGER',
];

module.exports = {
  FILE_MIGRATION_VERSION,
  FILE_TABLE_STATEMENTS,
  FILE_COLUMN_STATEMENTS,
};
