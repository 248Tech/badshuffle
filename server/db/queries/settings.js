function getSettingValue(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value !== undefined ? row.value : fallback;
}

function getAllSettings(db) {
  return db.prepare('SELECT key, value FROM settings').all();
}

function upsertSettingValue(db, key, value) {
  db.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  ).run(key, value);
}

function seedSettingValueIfMissing(db, key, value) {
  db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  ).run(key, value);
}

function upsertSettings(db, entries) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of entries) {
    stmt.run(key, value);
  }
}

module.exports = {
  getSettingValue,
  getAllSettings,
  upsertSettingValue,
  seedSettingValueIfMissing,
  upsertSettings,
};
