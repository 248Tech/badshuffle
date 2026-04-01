const { ITEM_SCHEMA_VERSION, ITEM_SCHEMA_SQL } = require('./schema/items');
const { USER_SCHEMA_VERSION, USER_SCHEMA_SQL } = require('./schema/users');
const { QUOTE_SCHEMA_VERSION, QUOTE_SCHEMA_SQL } = require('./schema/quotes');
const { SETTINGS_SCHEMA_VERSION, SETTINGS_SCHEMA_SQL } = require('./schema/settings');
const { LEAD_SCHEMA_VERSION, LEAD_SCHEMA_SQL } = require('./schema/leads');

const BASE_SCHEMA_SQL = [
  ITEM_SCHEMA_SQL,
  USER_SCHEMA_SQL,
  QUOTE_SCHEMA_SQL,
  SETTINGS_SCHEMA_SQL,
  LEAD_SCHEMA_SQL,
].join('\n');

const SCHEMA_VERSIONS = {
  items: ITEM_SCHEMA_VERSION,
  users: USER_SCHEMA_VERSION,
  quotes: QUOTE_SCHEMA_VERSION,
  settings: SETTINGS_SCHEMA_VERSION,
  leads: LEAD_SCHEMA_VERSION,
};

function applyBaseSchema(db) {
  db.exec(BASE_SCHEMA_SQL);
}

module.exports = {
  applyBaseSchema,
  SCHEMA_VERSIONS,
};
