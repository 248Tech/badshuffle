const LEAD_MIGRATION_VERSION = '1';

const LEAD_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS lead_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      note       TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
];

const LEAD_COLUMN_STATEMENTS = [
  'ALTER TABLE leads ADD COLUMN quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL',
];

module.exports = {
  LEAD_MIGRATION_VERSION,
  LEAD_TABLE_STATEMENTS,
  LEAD_COLUMN_STATEMENTS,
};
