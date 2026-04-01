const MESSAGE_MIGRATION_VERSION = '1';

const MESSAGE_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS email_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      subject     TEXT NOT NULL DEFAULT '',
      body_html   TEXT,
      body_text   TEXT,
      is_default  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
      direction   TEXT NOT NULL,
      from_email  TEXT,
      to_email    TEXT,
      subject     TEXT,
      body_text   TEXT,
      body_html   TEXT,
      message_id  TEXT UNIQUE,
      in_reply_to TEXT,
      status      TEXT DEFAULT 'sent',
      sent_at     TEXT DEFAULT (datetime('now')),
      quote_name  TEXT
    )
  `,
];

const MESSAGE_COLUMN_STATEMENTS = [
  'ALTER TABLE messages ADD COLUMN reply_to_id INTEGER',
  'ALTER TABLE messages ADD COLUMN attachments_json TEXT',
  'ALTER TABLE messages ADD COLUMN links_json TEXT',
  "ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'",
  'ALTER TABLE messages ADD COLUMN rich_payload_json TEXT',
];

module.exports = {
  MESSAGE_MIGRATION_VERSION,
  MESSAGE_TABLE_STATEMENTS,
  MESSAGE_COLUMN_STATEMENTS,
};
