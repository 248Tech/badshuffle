/**
 * Normalize header for matching: lowercase, newlines→spaces, collapse whitespace, strip punctuation, trim.
 */
function normalizeHeader(h) {
  if (h == null) return '';
  return (String(h))
    .toLowerCase()
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/** Target lead fields we map to. */
const TARGET_FIELDS = ['name', 'email', 'phone', 'event_date', 'event_type', 'source_url', 'notes'];

/** Keywords/regex per target (tested against normalized header). */
const SCORE_PATTERNS = {
  name: [/full\s*name/, /^name$/, /contact\s*name/, /your\s*name/],
  email: [/email/, /e\s*mail/, /e-mail/],
  phone: [/phone/, /tel/, /mobile/, /cell/, /telephone/],
  event_date: [/event\s*start\s*date/, /event\s*date/, /start\s*date/, /date\s*time/, /timestamp/, /event\s*end\s*date/],
  event_type: [/event\s*type/, /type\s*of\s*event/],
  source_url: [/source\s*url/, /url/, /link/],
  notes: [/notes/, /rental\s*needs/, /delivery\s*day/, /pickup\s*day/, /obstacles/, /carry\s*distance/, /venue/, /site\s*type/, /delivery\s*address/, /address/, /guest\s*count/, /contact/]
};

function scoreHeader(normalizedHeader, target) {
  const patterns = SCORE_PATTERNS[target];
  if (!patterns) return 0;
  let score = 0;
  for (const p of patterns) {
    if (p.test(normalizedHeader)) score += 1;
  }
  return score;
}

/**
 * Given raw headers (from sheet/CSV), return suggested mapping: { name: 'Full Name', email: 'Email Address', ... }
 * Keys are TARGET_FIELDS; values are original header strings (or null if no match).
 */
function suggestMapping(rawHeaders) {
  const normalized = rawHeaders.map(h => normalizeHeader(h));
  const suggested = {};
  for (const target of TARGET_FIELDS) {
    let bestScore = 0;
    let bestHeader = null;
    for (let i = 0; i < rawHeaders.length; i++) {
      const s = scoreHeader(normalized[i], target);
      if (s > bestScore) {
        bestScore = s;
        bestHeader = rawHeaders[i];
      }
    }
    suggested[target] = bestHeader || null;
  }
  return suggested;
}

/**
 * Build a row into lead object using column mapping.
 * columnMapping: { name: 'Full Name', email: 'Email', ... } (target -> original header)
 * row: { 'Full Name': 'John', 'Email': 'j@x.com', ... }
 */
function rowToLeadWithMapping(row, columnMapping) {
  const get = (target) => {
    const header = columnMapping[target];
    if (!header || row[header] == null) return null;
    const v = String(row[header]).trim();
    return v === '' ? null : v;
  };
  const notesParts = [];
  if (get('notes')) notesParts.push(get('notes'));
  const name = get('name') || null;
  const email = get('email') || null;
  const phone = get('phone') || null;
  const event_date = get('event_date') || null;
  const event_type = get('event_type') || null;
  const source_url = get('source_url') || null;
  const notes = notesParts.length ? notesParts.join('\n') : null;
  return { name, email, phone, event_date, event_type, source_url, notes };
}

module.exports = {
  normalizeHeader,
  TARGET_FIELDS,
  suggestMapping,
  rowToLeadWithMapping
};
