const { SETTINGS_DEFAULT_GROUPS } = require('./defaults');
const { seedSettingsGroups } = require('./helpers');

function seedDefaultSettings(db) {
  seedSettingsGroups(db, SETTINGS_DEFAULT_GROUPS);
}

function promoteFirstUserToAdmin(db) {
  db.prepare("UPDATE users SET role='admin', approved=1 WHERE id=(SELECT MIN(id) FROM users)").run();
}

module.exports = {
  seedDefaultSettings,
  promoteFirstUserToAdmin,
};
