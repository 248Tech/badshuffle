const QUOTE_MIGRATION_VERSION = '3';

const QUOTE_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS payment_policies (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      body_text  TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS rental_terms (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      body_text  TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS contract_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      body_html   TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_custom_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      unit_price  REAL DEFAULT 0,
      quantity    INTEGER DEFAULT 1,
      photo_url   TEXT,
      taxable     INTEGER DEFAULT 1,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_item_sections (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id      INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      title         TEXT NOT NULL DEFAULT 'Quote Items',
      delivery_date TEXT,
      rental_start  TEXT,
      rental_end    TEXT,
      pickup_date   TEXT,
      sort_order    INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS contracts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id       INTEGER NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,
      body_html      TEXT,
      signed_at      TEXT,
      signature_data TEXT,
      signer_name    TEXT,
      signer_ip      TEXT,
      signed_quote_total REAL,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS contract_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      changed_at  TEXT DEFAULT (datetime('now')),
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email  TEXT,
      old_body    TEXT,
      new_body    TEXT
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS contract_signature_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id         INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      contract_id      INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
      signer_name      TEXT,
      signer_ip        TEXT,
      signer_user_agent TEXT,
      signed_at        TEXT DEFAULT (datetime('now')),
      signed_quote_total REAL,
      quote_snapshot_hash TEXT,
      file_id          INTEGER REFERENCES files(id) ON DELETE SET NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS contract_signature_items (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      signature_event_id INTEGER NOT NULL REFERENCES contract_signature_events(id) ON DELETE CASCADE,
      quote_id           INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      qitem_id           INTEGER,
      item_id            INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      section_id         INTEGER REFERENCES quote_item_sections(id) ON DELETE SET NULL,
      quantity           INTEGER NOT NULL DEFAULT 1,
      range_start        TEXT,
      range_end          TEXT,
      created_at         TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_attachments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(quote_id, file_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      amount      REAL NOT NULL,
      method      TEXT,
      status      TEXT DEFAULT 'charged',
      reference   TEXT,
      paid_at     TEXT,
      note        TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS billing_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      event_type  TEXT NOT NULL,
      amount      REAL NOT NULL,
      note        TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      user_email  TEXT
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_activity_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      event_type  TEXT NOT NULL,
      description TEXT,
      old_value   TEXT,
      new_value   TEXT,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_damage_charges (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      amount      REAL NOT NULL DEFAULT 0,
      note        TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_adjustments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      label      TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'discount',
      value_type TEXT NOT NULL DEFAULT 'percent',
      amount     REAL NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_fulfillment_items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id         INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      qitem_id         INTEGER REFERENCES quote_items(id) ON DELETE SET NULL,
      item_id          INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      section_id       INTEGER REFERENCES quote_item_sections(id) ON DELETE SET NULL,
      item_title       TEXT,
      section_title    TEXT,
      range_start      TEXT,
      range_end        TEXT,
      quantity         INTEGER NOT NULL DEFAULT 1,
      checked_in_qty   INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now')),
      UNIQUE(quote_id, qitem_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_fulfillment_notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS quote_fulfillment_events (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id          INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      fulfillment_item_id INTEGER REFERENCES quote_fulfillment_items(id) ON DELETE SET NULL,
      event_type        TEXT NOT NULL,
      quantity          INTEGER DEFAULT 0,
      note              TEXT,
      created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email        TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    )
  `,
];

const QUOTE_COLUMN_STATEMENTS = [
  "ALTER TABLE quotes ADD COLUMN status TEXT DEFAULT 'draft'",
  "ALTER TABLE quotes ADD COLUMN lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL",
  'ALTER TABLE quotes ADD COLUMN public_token TEXT',
  'ALTER TABLE quotes ADD COLUMN event_type TEXT',
  'ALTER TABLE quotes ADD COLUMN venue_name TEXT',
  'ALTER TABLE quotes ADD COLUMN venue_email TEXT',
  'ALTER TABLE quotes ADD COLUMN venue_phone TEXT',
  'ALTER TABLE quotes ADD COLUMN venue_address TEXT',
  'ALTER TABLE quotes ADD COLUMN venue_contact TEXT',
  'ALTER TABLE quotes ADD COLUMN venue_notes TEXT',
  'ALTER TABLE quotes ADD COLUMN quote_notes TEXT',
  'ALTER TABLE quotes ADD COLUMN tax_rate REAL',
  'ALTER TABLE quotes ADD COLUMN has_unsigned_changes INTEGER DEFAULT 0',
  'ALTER TABLE quotes ADD COLUMN client_first_name TEXT',
  'ALTER TABLE quotes ADD COLUMN client_last_name TEXT',
  'ALTER TABLE quotes ADD COLUMN client_email TEXT',
  'ALTER TABLE quotes ADD COLUMN client_phone TEXT',
  'ALTER TABLE quotes ADD COLUMN client_address TEXT',
  'ALTER TABLE quotes ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL',
  'ALTER TABLE quote_items ADD COLUMN hidden_from_quote INTEGER DEFAULT 0',
  "ALTER TABLE quote_items ADD COLUMN discount_type TEXT DEFAULT 'none'",
  'ALTER TABLE quote_items ADD COLUMN discount_amount REAL DEFAULT 0',
  'ALTER TABLE quotes ADD COLUMN expires_at TEXT',
  'ALTER TABLE quotes ADD COLUMN payment_policy_id INTEGER REFERENCES payment_policies(id) ON DELETE SET NULL',
  'ALTER TABLE quotes ADD COLUMN rental_terms_id INTEGER REFERENCES rental_terms(id) ON DELETE SET NULL',
  'ALTER TABLE quotes ADD COLUMN expiration_message TEXT',
  'ALTER TABLE quote_items ADD COLUMN section_id INTEGER REFERENCES quote_item_sections(id) ON DELETE SET NULL',
  'ALTER TABLE quote_custom_items ADD COLUMN section_id INTEGER REFERENCES quote_item_sections(id) ON DELETE SET NULL',
  'ALTER TABLE contracts ADD COLUMN signer_ip TEXT',
  'ALTER TABLE contracts ADD COLUMN signed_quote_total REAL',
  'ALTER TABLE contract_signature_events ADD COLUMN signer_user_agent TEXT',
  'ALTER TABLE contract_signature_events ADD COLUMN quote_snapshot_hash TEXT',
  'ALTER TABLE contract_signature_items ADD COLUMN range_start TEXT',
  'ALTER TABLE contract_signature_items ADD COLUMN range_end TEXT',
  'ALTER TABLE quote_activity_log ADD COLUMN old_value TEXT',
  'ALTER TABLE quote_activity_log ADD COLUMN new_value TEXT',
  'ALTER TABLE quotes ADD COLUMN rental_start TEXT',
  'ALTER TABLE quotes ADD COLUMN rental_end TEXT',
  'ALTER TABLE quotes ADD COLUMN delivery_date TEXT',
  'ALTER TABLE quotes ADD COLUMN pickup_date TEXT',
  'ALTER TABLE quote_items ADD COLUMN unit_price_override REAL',
  'ALTER TABLE quote_items ADD COLUMN description TEXT',
  'ALTER TABLE quote_items ADD COLUMN notes TEXT',
  'ALTER TABLE quotes ADD COLUMN map_address_source TEXT',
  'ALTER TABLE quotes ADD COLUMN map_address_text TEXT',
  'ALTER TABLE quotes ADD COLUMN map_lat REAL',
  'ALTER TABLE quotes ADD COLUMN map_lng REAL',
  'ALTER TABLE quotes ADD COLUMN map_geocoded_at TEXT',
  'ALTER TABLE quotes ADD COLUMN map_geocode_status TEXT',
  "ALTER TABLE quote_fulfillment_items ADD COLUMN checked_in_qty INTEGER DEFAULT 0",
];

const QUOTE_POST_STATEMENTS = [
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token) WHERE public_token IS NOT NULL",
  'CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_quotes_event_date ON quotes(event_date)',
  'CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)',
  'CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by)',
  'CREATE INDEX IF NOT EXISTS idx_quotes_map_geocode_status ON quotes(map_geocode_status)',
  'CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id)',
  'CREATE INDEX IF NOT EXISTS idx_quote_custom_items_quote_id ON quote_custom_items(quote_id)',
  'CREATE INDEX IF NOT EXISTS idx_quote_adjustments_quote_id ON quote_adjustments(quote_id)',
  'CREATE INDEX IF NOT EXISTS idx_quote_payments_quote_id ON quote_payments(quote_id)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_quote_id ON contracts(quote_id)',
  'CREATE INDEX IF NOT EXISTS idx_quote_fulfillment_items_quote_id ON quote_fulfillment_items(quote_id)',
  'CREATE INDEX IF NOT EXISTS idx_quote_fulfillment_items_item_id ON quote_fulfillment_items(item_id)',
  'CREATE INDEX IF NOT EXISTS idx_quote_fulfillment_notes_quote_id ON quote_fulfillment_notes(quote_id)',
];

module.exports = {
  QUOTE_MIGRATION_VERSION,
  QUOTE_TABLE_STATEMENTS,
  QUOTE_COLUMN_STATEMENTS,
  QUOTE_POST_STATEMENTS,
};
