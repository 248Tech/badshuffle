const ITEM_SCHEMA_VERSION = '6';

const ITEM_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    photo_url  TEXT,
    source     TEXT    DEFAULT 'manual',
    serial_number TEXT UNIQUE,
    scan_code  TEXT    UNIQUE,
    hidden     INTEGER DEFAULT 0,
    internal_notes TEXT,
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
    sales_total  REAL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS item_set_asides (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id                INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity               INTEGER NOT NULL,
    reason_code            TEXT NOT NULL,
    reason_note            TEXT,
    related_quote_id       INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
    related_quote_label    TEXT,
    created_by_user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at             TEXT DEFAULT (datetime('now')),
    updated_at             TEXT DEFAULT (datetime('now')),
    resolved_at            TEXT,
    resolved_by_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_reason      TEXT,
    resolution_disposition TEXT,
    resolution_quantity    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS item_set_aside_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    set_aside_id    INTEGER NOT NULL REFERENCES item_set_asides(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    quantity        INTEGER,
    reason_code     TEXT,
    note            TEXT,
    disposition     TEXT,
    actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`;

module.exports = {
  ITEM_SCHEMA_VERSION,
  ITEM_SCHEMA_SQL,
};
