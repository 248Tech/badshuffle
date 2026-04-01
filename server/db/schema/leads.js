const LEAD_SCHEMA_VERSION = '1';

const LEAD_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS leads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT,
    email       TEXT,
    phone       TEXT,
    event_date  TEXT,
    event_type  TEXT,
    source_url  TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`;

module.exports = {
  LEAD_SCHEMA_VERSION,
  LEAD_SCHEMA_SQL,
};
