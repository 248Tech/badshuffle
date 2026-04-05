const ITEM_MIGRATION_VERSION = '6';

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
  `
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
    )
  `,
  `
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
    )
  `,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_items_scan_code ON items(scan_code)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_items_serial_number ON items(serial_number)',
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
  'ALTER TABLE items ADD COLUMN internal_notes TEXT',
  'ALTER TABLE items ADD COLUMN serial_number TEXT',
  'ALTER TABLE items ADD COLUMN scan_code TEXT',
  'ALTER TABLE item_stats ADD COLUMN sales_total REAL DEFAULT 0',
];

module.exports = {
  ITEM_MIGRATION_VERSION,
  ITEM_TABLE_STATEMENTS,
  ITEM_COLUMN_STATEMENTS,
};
