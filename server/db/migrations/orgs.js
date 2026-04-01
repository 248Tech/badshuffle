const ORG_MIGRATION_VERSION = '1';

const ORG_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS orgs (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
  // Single-tenant default org
  "INSERT OR IGNORE INTO orgs (id, name) VALUES (1, 'Default')",
];

// Add org_id columns to core tables (single-tenant today; enables real BOLA/tenant scoping later)
const ORG_COLUMN_STATEMENTS = [
  'ALTER TABLE users ADD COLUMN org_id INTEGER DEFAULT 1',
  'ALTER TABLE quotes ADD COLUMN org_id INTEGER DEFAULT 1',
  'ALTER TABLE items ADD COLUMN org_id INTEGER DEFAULT 1',
  'ALTER TABLE vendors ADD COLUMN org_id INTEGER DEFAULT 1',
  'ALTER TABLE leads ADD COLUMN org_id INTEGER DEFAULT 1',
  'ALTER TABLE files ADD COLUMN org_id INTEGER DEFAULT 1',
  'ALTER TABLE messages ADD COLUMN org_id INTEGER DEFAULT 1',
];

module.exports = {
  ORG_MIGRATION_VERSION,
  ORG_TABLE_STATEMENTS,
  ORG_COLUMN_STATEMENTS,
};

