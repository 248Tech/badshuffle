const QUOTE_SCHEMA_VERSION = '1';

const QUOTE_SCHEMA_SQL = `
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
`;

module.exports = {
  QUOTE_SCHEMA_VERSION,
  QUOTE_SCHEMA_SQL,
};
