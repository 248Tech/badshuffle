const ITEM_SCHEMA_VERSION = '1';

const ITEM_SCHEMA_SQL = `
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
`;

module.exports = {
  ITEM_SCHEMA_VERSION,
  ITEM_SCHEMA_SQL,
};
