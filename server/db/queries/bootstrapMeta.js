function getBootstrapMetaValue(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM db_bootstrap_meta WHERE key = ?').get(key);
  return row && row.value !== undefined ? row.value : fallback;
}

function listBootstrapMeta(db) {
  return db.prepare('SELECT key, value, updated_at FROM db_bootstrap_meta ORDER BY key ASC').all();
}

module.exports = {
  getBootstrapMetaValue,
  listBootstrapMeta,
};
