const ITEM_MIGRATION_VERSION = '1';

const ITEM_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS item_accessories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      accessory_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      UNIQUE(item_id, accessory_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS vendors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT,
      phone      TEXT,
      address    TEXT,
      notes      TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
];

const ITEM_COLUMN_STATEMENTS = [
  'ALTER TABLE items ADD COLUMN quantity_in_stock INTEGER DEFAULT 0',
  'ALTER TABLE items ADD COLUMN unit_price REAL DEFAULT 0',
  'ALTER TABLE items ADD COLUMN category TEXT',
  'ALTER TABLE items ADD COLUMN description TEXT',
  'ALTER TABLE items ADD COLUMN taxable INTEGER DEFAULT 1',
  'ALTER TABLE items ADD COLUMN labor_hours REAL DEFAULT 0',
  "ALTER TABLE items ADD COLUMN item_type TEXT DEFAULT 'product'",
  'ALTER TABLE items ADD COLUMN is_subrental INTEGER DEFAULT 0',
  'ALTER TABLE items ADD COLUMN vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL',
  'ALTER TABLE items ADD COLUMN contract_description TEXT',
];

module.exports = {
  ITEM_MIGRATION_VERSION,
  ITEM_TABLE_STATEMENTS,
  ITEM_COLUMN_STATEMENTS,
};
