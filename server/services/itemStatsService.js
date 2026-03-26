function upsertItemStats(db, itemId, guestCount) {
  const existing = db.prepare(
    'SELECT id, times_quoted, total_guests FROM item_stats WHERE item_id = ?'
  ).get(itemId);

  if (existing) {
    db.prepare(`
      UPDATE item_stats
      SET times_quoted = times_quoted + 1,
          total_guests = total_guests + ?,
          last_used_at = datetime('now')
      WHERE item_id = ?
    `).run(guestCount, itemId);
  } else {
    db.prepare(
      "INSERT INTO item_stats (item_id, times_quoted, total_guests, last_used_at) VALUES (?, 1, ?, datetime('now'))"
    ).run(itemId, guestCount);
  }

  if (guestCount > 0) {
    const bracketMin = Math.floor(guestCount / 25) * 25;
    const bracketMax = bracketMin + 24;
    const existingBracket = db.prepare(
      'SELECT id FROM usage_brackets WHERE item_id = ? AND bracket_min = ?'
    ).get(itemId, bracketMin);

    if (existingBracket) {
      db.prepare('UPDATE usage_brackets SET times_used = times_used + 1 WHERE id = ?')
        .run(existingBracket.id);
    } else {
      db.prepare(
        'INSERT INTO usage_brackets (item_id, bracket_min, bracket_max, times_used) VALUES (?, ?, ?, 1)'
      ).run(itemId, bracketMin, bracketMax);
    }
  }
}

module.exports = {
  upsertItemStats,
};
