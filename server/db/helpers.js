const { seedSettingValueIfMissing } = require('./queries/settings');

function runStatements(db, statements) {
  for (const sql of statements) {
    try {
      db.exec(sql);
    } catch (e) {}
  }
}

function seedSettingsGroups(db, groups) {
  for (const group of groups) {
    for (const [key, value] of Object.entries(group)) {
      seedSettingValueIfMissing(db, key, value);
    }
  }
}

module.exports = {
  runStatements,
  seedSettingsGroups,
};
