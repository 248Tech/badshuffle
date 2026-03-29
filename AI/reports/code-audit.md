# Code Audit

## Security Division

### [Predictable fallback secret allows forged JWTs and signed file URLs]

**File:** `/server/lib/authMiddleware.js`

```js
const jwt = require('jsonwebtoken');
const SECRET = () => process.env.JWT_SECRET || 'change-me';
```

**Problem:**
Authentication and file-signing both fall back to the hard-coded string `change-me` when `JWT_SECRET` is unset. `server/index.js` only blocks that in `NODE_ENV === 'production'`, so any deployment running with a missing or mis-set environment can still accept forged JWTs and forged signed file URLs. This is especially risky in self-hosted installs where production mode is often inconsistent.

**Fix:**

```js
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change-me') {
    throw new Error('JWT_SECRET must be set to a strong random value');
  }
  return secret;
}
```

**Priority:** High

---

### [Extension token bypass grants broad write access to protected routes]

**File:** `/server/lib/authMiddleware.js`

```js
const extToken = req.headers['x-extension-token'];
if (extToken) {
  const row = db.prepare('SELECT id FROM extension_tokens WHERE token = ?').get(extToken);
  if (row) {
    req.user = { sub: null, byExtension: true };
    return next();
  }
}
```

**Problem:**
Any valid extension token satisfies the general `auth` middleware, which means it can reach nearly every route mounted with `auth` in `server/index.js`, including quotes, files, vendors, availability, and messages. The comment says the token is only scoped away from admin/operator routes, but in practice it is still a broad alternate credential with no expiry, no route scoping, and no attribution. A leaked extension token becomes a long-lived write credential for most of the API.

**Fix:**

```js
module.exports = function requireAuth(db, options = {}) {
  const { allowExtension = false } = options;

  return function(req, res, next) {
    const extToken = req.headers['x-extension-token'];
    if (allowExtension && extToken) {
      const row = db.prepare(
        'SELECT id FROM extension_tokens WHERE token = ? AND revoked_at IS NULL'
      ).get(extToken);
      if (row) {
        req.user = { sub: null, byExtension: true, extensionTokenId: row.id };
        return next();
      }
    }

    // normal Bearer JWT flow...
  };
};

app.use('/api/items/bulk-upsert', requireAuth(db, { allowExtension: true }), bulkUpsertRouter);
app.use('/api/quotes', requireAuth(db), require('./routes/quotes')(db, UPLOADS_DIR));
```

**Priority:** High

---

### [File downloads only require any valid JWT and allow tokens in the query string]

**File:** `/server/index.js`

```js
const authHeader = req.headers.authorization || '';
const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || null);
const secret = process.env.JWT_SECRET || 'change-me';
let allowed = false;
if (bearer) {
  try {
    jwt.verify(bearer, secret);
    allowed = true;
  } catch {}
}
if (!allowed && req.query.sig && req.query.exp) {
  allowed = verifyFileServe(fileId, req.query.sig, req.query.exp);
}
```

**Problem:**
The file-serving endpoint authorizes downloads with any valid JWT, without checking whether the caller is allowed to access that specific file. Any authenticated user can enumerate `/api/files/:id/serve` and read arbitrary uploads. It also accepts JWTs in `req.query.token`, which leaks bearer credentials into logs, browser history, and referrers.

**Fix:**

```js
const auth = requireAuth(db);

app.get('/api/files/:id/serve', auth, (req, res) => {
  const fileId = req.params.id;
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  if (!file) return res.status(404).json({ error: 'Not found' });

  const canAccess = db.prepare(`
    SELECT 1
    FROM quote_attachments qa
    JOIN quotes q ON q.id = qa.quote_id
    WHERE qa.file_id = ?
    LIMIT 1
  `).get(fileId);

  if (!canAccess) return res.status(403).json({ error: 'Forbidden' });

  serveFile(res, file);
});
```

**Priority:** High

---

### [Public quote endpoint returns the full quote row instead of a least-privilege payload]

**File:** `/server/index.js`

```js
const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(req.params.token);

res.json({
  ...quote,
  items,
  customItems,
  contract,
  adjustments,
  company_name,
  company_email,
  company_logo,
  signed_company_logo,
  is_expired: isExpired,
  payment_policy,
  rental_terms,
});
```

**Problem:**
`/api/quotes/public/:token` exposes every column on the `quotes` row to anyone with the public token. That includes fields the public page does not need and that are likely internal or sensitive, such as `lead_id`, internal notes, workflow flags, and the raw `public_token` itself. Public-token endpoints should return a curated response, not `SELECT *` plus object spread.

**Fix:**

```js
const quote = db.prepare(`
  SELECT
    id,
    name,
    event_date,
    guest_count,
    status,
    expires_at,
    expiration_message,
    quote_notes,
    tax_rate,
    client_first_name,
    client_last_name,
    client_email,
    client_phone,
    client_address,
    venue_name,
    venue_email,
    venue_phone,
    venue_address,
    payment_policy_id,
    rental_terms_id
  FROM quotes
  WHERE public_token = ?
`).get(req.params.token);
```

**Priority:** High

---

### [Public quote actions have no abuse controls or state validation]

**File:** `/server/index.js`

```js
app.post('/api/quotes/approve-by-token', (req, res) => {
  const token = (req.body && req.body.token) || '';
  if (!token) return res.status(400).json({ error: 'token required' });
  const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(token);
  if (!quote) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE quotes SET status = 'approved', has_unsigned_changes = 0, updated_at = datetime('now') WHERE id = ?").run(quote.id);
});
```

**Problem:**
The public approve, sign, and message endpoints are unauthenticated token-based mutation paths with no rate limiting, no audit throttling, and weak state checks. For example, approve-by-token updates the quote to `approved` regardless of its current status. A leaked public token can be used for repeated spam or unintended state changes against stale, confirmed, or closed quotes.

**Fix:**

```js
if (!['sent', 'approved'].includes(quote.status)) {
  return res.status(409).json({ error: 'Quote is not in a public approval state' });
}

const ip = req.ip || 'unknown';
if (tooManyPublicActions(db, quote.id, ip)) {
  return res.status(429).json({ error: 'Too many requests' });
}

db.prepare(`
  UPDATE quotes
  SET status = 'approved', has_unsigned_changes = 0, updated_at = datetime('now')
  WHERE id = ? AND status = 'sent'
`).run(quote.id);
```

**Priority:** High

---

### [Upload endpoint stores arbitrary files without MIME or content validation]

**File:** `/server/routes/files.js`

```js
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/upload', upload.array('files', 20), (req, res) => {
  // ...
  db.prepare(
    'INSERT INTO files (original_name, stored_name, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?)'
  ).run(f.originalname, f.filename, f.mimetype, f.size, userId);
});
```

**Problem:**
The upload path trusts the browser-supplied MIME type and file extension, and it does not inspect file signatures or enforce an allowlist. That means authenticated users can upload arbitrary content, including HTML, SVG, or other active files, then serve them back through `/api/files/:id/serve`. This is a classic file-upload security gap.

**Fix:**

```js
const { fileTypeFromFile } = require('file-type');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

router.post('/upload', upload.array('files', 20), async (req, res) => {
  for (const f of req.files || []) {
    const detected = await fileTypeFromFile(f.path);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      fs.unlinkSync(f.path);
      return res.status(400).json({ error: 'Unsupported file type' });
    }
  }

  // persist only validated files...
});
```

**Priority:** High

---

### [Quote send endpoint can attach arbitrary uploaded files to outbound email]

**File:** `/server/routes/quotes.js`

```js
for (const fid of attachmentIds) {
  const f = db.prepare('SELECT * FROM files WHERE id = ?').get(fid);
  if (f && uploadsDir) {
    const filePath = path.join(uploadsDir, f.stored_name);
    mailOptions.attachments.push({ filename: f.original_name, path: filePath });
  }
}
```

**Problem:**
`POST /api/quotes/:id/send` trusts arbitrary `attachmentIds` from the request body and attaches any matching file record, even if that file is unrelated to the quote. Any authenticated user who can send quotes can exfiltrate other uploaded files by guessing or enumerating file IDs.

**Fix:**

```js
for (const fid of attachmentIds) {
  const f = db.prepare(`
    SELECT f.*
    FROM files f
    JOIN quote_attachments qa ON qa.file_id = f.id
    WHERE f.id = ? AND qa.quote_id = ?
  `).get(fid, req.params.id);

  if (!f) {
    return res.status(400).json({ error: `Invalid attachment: ${fid}` });
  }

  mailOptions.attachments.push({
    filename: f.original_name,
    path: path.join(uploadsDir, f.stored_name),
  });
}
```

**Priority:** High

---

### [Quote write endpoints accept unvalidated numeric and enum fields]

**File:** `/server/routes/quotes.js`

```js
db.prepare(`
  UPDATE quote_items SET
    quantity            = COALESCE(?, quantity),
    label               = COALESCE(?, label),
    sort_order          = COALESCE(?, sort_order),
    hidden_from_quote   = COALESCE(?, hidden_from_quote),
    unit_price_override = ?,
    discount_type       = COALESCE(?, discount_type),
    discount_amount     = COALESCE(?, discount_amount),
    description         = COALESCE(?, description),
    notes               = COALESCE(?, notes)
  WHERE id = ? AND quote_id = ?
`).run(
  quantity !== undefined ? quantity : null,
  label !== undefined ? label : null,
  sort_order !== undefined ? sort_order : null,
  hidden_from_quote !== undefined ? (hidden_from_quote ? 1 : 0) : null,
  newOverride !== undefined ? newOverride : null,
  discount_type !== undefined ? discount_type : null,
  discount_amount !== undefined ? parseFloat(discount_amount) : null,
  description !== undefined ? description : null,
  notes !== undefined ? notes : null,
  req.params.qitem_id,
  req.params.id
);
```

**Problem:**
Several quote write paths validate only presence, not type or bounds. `quantity`, `sort_order`, `unit_price_override`, `discount_type`, `discount_amount`, `unit_price`, and similar fields are written directly from the request body. That allows invalid enum values and `NaN`/nonsensical numeric payloads to reach the database, which is exactly the validation gap the security plan called out.

**Fix:**

```js
const allowedDiscountTypes = new Set(['percent', 'fixed', null]);
const qty = quantity === undefined ? oldRow.quantity : Number(quantity);
const override = unit_price_override === undefined ? oldRow.unit_price_override : (
  unit_price_override === null ? null : Number(unit_price_override)
);
const amount = discount_amount === undefined ? null : Number(discount_amount);

if (!Number.isFinite(qty) || qty < 0) {
  return res.status(400).json({ error: 'quantity must be a non-negative number' });
}
if (!allowedDiscountTypes.has(discount_type ?? null)) {
  return res.status(400).json({ error: 'discount_type must be percent or fixed' });
}
if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
  return res.status(400).json({ error: 'discount_amount must be a non-negative number' });
}
```

**Priority:** Medium

---

## Backend / Scalability

### [GET /api/quotes performs N+1 total calculation and returns an unbounded result set]

**File:** `/server/routes/quotes.js`

```js
const sql = `SELECT * FROM quotes ${where} ORDER BY created_at DESC`;
const quotes = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();

let quotesWithTotal = quotes.map(q => {
  let subtotal = 0;
  let taxableAmount = 0;
  try {
    const rows = db.prepare(`
      SELECT qi.quantity, qi.hidden_from_quote, qi.unit_price_override,
             i.unit_price, i.taxable, i.category
      FROM quote_items qi
      JOIN items i ON i.id = qi.item_id
      WHERE qi.quote_id = ?
    `).all(q.id);
    const customRows = db.prepare('SELECT quantity, unit_price, taxable FROM quote_custom_items WHERE quote_id = ?').all(q.id);
```

**Problem:**
At `server/routes/quotes.js:55-97`, the list endpoint loads every matching quote, then runs two more queries per quote to compute totals. On a dataset with 500 quotes, this becomes 1 list query + 1 payment aggregate query + 1,000 per-quote detail queries before the response is built. The same handler also has no `LIMIT/OFFSET`, so the N+1 behavior scales linearly with total quote count instead of the visible page size.

**Fix:**

```js
const page = Math.max(1, Number(req.query.page) || 1);
const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
const offset = (page - 1) * limit;

const quotes = db.prepare(`
  SELECT
    q.*,
    COALESCE(pay.amount_paid, 0) AS amount_paid,
    COALESCE(items.subtotal, 0) + COALESCE(custom.custom_subtotal, 0) AS pretax_total,
    COALESCE(items.taxable_subtotal, 0) + COALESCE(custom.taxable_custom_subtotal, 0) AS taxable_total
  FROM quotes q
  LEFT JOIN (
    SELECT quote_id, SUM(amount) AS amount_paid
    FROM quote_payments
    GROUP BY quote_id
  ) pay ON pay.quote_id = q.id
  LEFT JOIN (
    SELECT
      qi.quote_id,
      SUM((qi.quantity) * COALESCE(qi.unit_price_override, i.unit_price)) AS subtotal,
      SUM(CASE WHEN i.taxable = 1 THEN (qi.quantity) * COALESCE(qi.unit_price_override, i.unit_price) ELSE 0 END) AS taxable_subtotal
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE COALESCE(qi.hidden_from_quote, 0) = 0
    GROUP BY qi.quote_id
  ) items ON items.quote_id = q.id
  LEFT JOIN (
    SELECT
      quote_id,
      SUM(quantity * unit_price) AS custom_subtotal,
      SUM(CASE WHEN taxable = 1 THEN quantity * unit_price ELSE 0 END) AS taxable_custom_subtotal
    FROM quote_custom_items
    GROUP BY quote_id
  ) custom ON custom.quote_id = q.id
  ${where}
  ORDER BY q.created_at DESC
  LIMIT ? OFFSET ?
`).all(...params, limit, offset);
```

**Priority:** High

---

### [Quote summary endpoint loads the full quotes table into JavaScript and aggregates in memory]

**File:** `/server/routes/quotes.js`

```js
const allQuotes = db.prepare('SELECT id, name, status, event_date, guest_count, created_at, has_unsigned_changes FROM quotes').all();

const byStatus = { draft: 0, sent: 0, approved: 0, confirmed: 0, closed: 0 };
allQuotes.forEach(q => {
  const s = q.status || 'draft';
  byStatus[s] = (byStatus[s] || 0) + 1;
});
```

**Problem:**
At `server/routes/quotes.js:105-148`, `/api/quotes/summary` pulls the full `quotes` table into memory and computes status counts, upcoming quotes, and monthly counts in JavaScript. This is acceptable for a toy dataset, but it becomes a full table scan and object allocation spike on every dashboard load as quotes grow.

**Fix:**

```js
const byStatusRows = db.prepare(`
  SELECT COALESCE(status, 'draft') AS status, COUNT(*) AS count
  FROM quotes
  GROUP BY COALESCE(status, 'draft')
`).all();

const upcoming = db.prepare(`
  SELECT id, name, status, event_date, guest_count, created_at, has_unsigned_changes
  FROM quotes
  WHERE event_date BETWEEN ? AND ?
  ORDER BY event_date ASC
  LIMIT 50
`).all(today, in90);

const byMonth = db.prepare(`
  SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS count
  FROM quotes
  WHERE created_at >= datetime('now', '-6 months')
  GROUP BY substr(created_at, 1, 7)
  ORDER BY month ASC
`).all();
```

**Priority:** Medium

---

### [Hot foreign-key and sort columns are missing indexes across the schema]

**File:** `/server/db.js`

```js
CREATE TABLE IF NOT EXISTS quote_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity   INTEGER DEFAULT 1,
  label      TEXT,
  sort_order INTEGER DEFAULT 0
);

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
);
```

**Problem:**
Outside of `idx_quotes_public_token` at `server/db.js:355`, there are effectively no explicit indexes for the columns that dominate route filters and joins. The codebase frequently filters or sorts on `quotes.status`, `quotes.event_date`, `quotes.lead_id`, `quote_items.quote_id`, `quote_items.item_id`, `quote_custom_items.quote_id`, `quote_adjustments.quote_id`, `quote_payments.quote_id`, `messages.quote_id`, `messages.status`, `messages.sent_at`, `lead_events.lead_id`, and `quote_attachments.quote_id/file_id`, but none of those indexes are declared in the schema.

**Fix:**

```js
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_quotes_status_created_at ON quotes(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_quotes_event_date ON quotes(event_date);
  CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON quotes(lead_id);

  CREATE INDEX IF NOT EXISTS idx_quote_items_quote_sort ON quote_items(quote_id, sort_order, id);
  CREATE INDEX IF NOT EXISTS idx_quote_items_item_quote ON quote_items(item_id, quote_id);
  CREATE INDEX IF NOT EXISTS idx_quote_custom_items_quote_sort ON quote_custom_items(quote_id, sort_order, id);
  CREATE INDEX IF NOT EXISTS idx_quote_adjustments_quote_sort ON quote_adjustments(quote_id, sort_order, id);
  CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote_file ON quote_attachments(quote_id, file_id);
  CREATE INDEX IF NOT EXISTS idx_quote_payments_quote_paid_at ON quote_payments(quote_id, paid_at DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_quote_sent_at ON messages(quote_id, sent_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
  CREATE INDEX IF NOT EXISTS idx_lead_events_lead_created_at ON lead_events(lead_id, created_at DESC);
`);
```

**Priority:** High

---

### [Availability conflict detection does full candidate scans and nested in-memory overlap checks]

**File:** `/server/routes/availability.js`

```js
const otherQuotes = db.prepare(`
  SELECT DISTINCT q.id, q.name, q.event_date, q.rental_start, q.rental_end,
         q.delivery_date, q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
  FROM quotes q
  JOIN quote_items qi ON qi.quote_id = q.id
  LEFT JOIN contracts c ON c.quote_id = q.id
  WHERE q.id != ? AND qi.item_id IN (${ph})
    AND COALESCE(q.status, 'draft') != 'closed'
`).all(quoteId, ...itemIds);

const overlapping = otherQuotes.filter(oq => rangesOverlap(targetRange, getQuoteRange(oq)));
```

**Problem:**
At `server/routes/availability.js:67-108`, `:145-198`, and especially `:206-299`, the availability logic fetches a broad set of candidate quotes and then performs overlap detection in JavaScript. `/api/availability/conflicts` is worst-case quadratic: it loads every non-closed quote, all quote_items for those quotes, and then nests `quotesWithRange × items × quotesWithRange` with an inner `.find(...)`. As data grows, this becomes CPU-bound before SQLite even finishes.

**Fix:**

```js
const overlaps = db.prepare(`
  SELECT
    qi.item_id,
    SUM(CASE WHEN q.status = 'confirmed' OR c.signed_at IS NOT NULL OR q.has_unsigned_changes = 1 THEN qi.quantity ELSE 0 END) AS reserved_qty,
    SUM(CASE WHEN q.status NOT IN ('confirmed', 'closed') AND c.signed_at IS NULL AND q.has_unsigned_changes = 0 THEN qi.quantity ELSE 0 END) AS potential_qty
  FROM quote_items qi
  JOIN quotes q ON q.id = qi.quote_id
  LEFT JOIN contracts c ON c.quote_id = q.id
  WHERE qi.item_id IN (${ph})
    AND q.id != ?
    AND COALESCE(q.status, 'draft') != 'closed'
    AND COALESCE(q.delivery_date, q.rental_start, q.event_date) <= ?
    AND COALESCE(q.pickup_date, q.rental_end, q.event_date) >= ?
  GROUP BY qi.item_id
`).all(...itemIds, quoteId, targetRange.end, targetRange.start);
```

**Priority:** High

---

### [Stats endpoints perform unbounded full-table scans and return every item row]

**File:** `/server/routes/stats.js`

```js
const stats = db.prepare(`
  SELECT
    i.id, i.title, i.photo_url, i.source,
    COALESCE(s.times_quoted, 0) as times_quoted,
    COALESCE(s.total_guests, 0) as total_guests,
    s.last_used_at,
    CASE
      WHEN COALESCE(s.total_guests, 0) = 0 THEN 0
      ELSE ROUND(CAST(s.times_quoted AS REAL) / NULLIF(s.total_guests, 0) * 100, 1)
    END as probability_pct
  FROM items i
  LEFT JOIN item_stats s ON s.item_id = i.id
  WHERE i.hidden = 0
  ORDER BY times_quoted DESC, i.title ASC
`).all();
```

**Problem:**
`server/routes/stats.js:7-24` returns every visible item every time the stats page loads. There is no pagination, no limit, and no date or category filter. Even though the aggregate values are precomputed in `item_stats`, the endpoint still scans and sorts the full visible inventory table on every request, which will become a noticeable admin-page bottleneck as inventory grows.

**Fix:**

```js
const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
const offset = Math.max(0, Number(req.query.offset) || 0);

const stats = db.prepare(`
  SELECT
    i.id, i.title, i.photo_url, i.source,
    COALESCE(s.times_quoted, 0) AS times_quoted,
    COALESCE(s.total_guests, 0) AS total_guests,
    s.last_used_at
  FROM items i
  LEFT JOIN item_stats s ON s.item_id = i.id
  WHERE i.hidden = 0
  ORDER BY COALESCE(s.times_quoted, 0) DESC, i.title ASC
  LIMIT ? OFFSET ?
`).all(limit, offset);
```

**Priority:** Medium

---

### [Quote route layer contains orchestration that belongs in services]

**File:** `/server/routes/quotes.js`

```js
router.post('/:id/send', async (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  // ...
  const smtpRows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'").all();
  // ...
  await transporter.sendMail(mailOptions);
  // ...
  db.prepare(`
    INSERT OR IGNORE INTO messages (quote_id, direction, from_email, to_email, subject, body_text, body_html, message_id, status, sent_at, quote_name)
    VALUES (?, 'outbound', ?, ?, ?, ?, ?, ?, 'sent', datetime('now'), ?)
  `).run(req.params.id, fromAddr, toEmail || null, subject || '', bodyText || '', bodyHtml || null, msgId, quote.name || '');
});
```

**Problem:**
Several handlers in `server/routes/quotes.js` now contain multi-step business workflows rather than simple transport logic:
- `:517-600` email sending orchestrates token generation, SMTP config lookup, attachment hydration, send, lead event logging, and message persistence
- `:619-645` and `:761-783` encode status-transition rules inline
- `:794-833` duplicates a quote and all children inline
- `:836-892` mutates quote items and also updates stats/usage brackets

This makes the route file difficult to test in isolation and guarantees that any future reuse will duplicate the same orchestration.

**Fix:**

```js
router.post('/:id/send', async (req, res) => {
  try {
    const result = await quoteService.sendQuote({
      db,
      uploadsDir,
      quoteId: req.params.id,
      actor: req.user,
      input: req.body || {},
    });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
```

**Priority:** Medium

---

## Frontend / Architecture

### [QuoteDetailPage is a monolith with at least nine distinct concerns and tightly coupled state]

**File:** `/client/src/pages/QuoteDetailPage.jsx`

```js
const [quote, setQuote] = useState(null);
const [customItems, setCustomItems] = useState([]);
const [settings, setSettings] = useState({});
const [loading, setLoading] = useState(true);
const [editing, setEditing] = useState(!!(location.state?.autoEdit));
const [form, setForm] = useState({});
const [showAI, setShowAI] = useState(false);
const [showSendModal, setShowSendModal] = useState(false);
const [payments, setPayments] = useState([]);
const [quoteFiles, setQuoteFiles] = useState([]);
const [activity, setActivity] = useState([]);
const [availability, setAvailability] = useState({});
const [adjustments, setAdjustments] = useState([]);
const [quoteMessages, setQuoteMessages] = useState([]);
```

**Problem:**
`client/src/pages/QuoteDetailPage.jsx` is 1,837 lines and owns nearly every quote concern in one component. The concern boundaries are clear in the file, but they are not reflected in component structure:
- `1-52`: pricing helpers
- `54-255`: page bootstrapping, loaders, and shared state
- `267-383`: billing and destructive quote actions
- `385-463`: edit/save/view-quote flows
- `775-956`: full edit form
- `959-1285`: quote overview, client/venue cards, builder, logistics, export, messages, summary
- `1286-1432`: billing tab
- `1434-1493`: files/logs tabs
- `1498-1837`: modal components and inline helper components

Because all of that state lives at the page root, unrelated actions re-render the entire page tree. Handlers also cross concern boundaries, for example `load`, `handleSaveEdit`, `handleDuplicateQuote`, and the inline message form all refresh overlapping pieces of page state from different paths.

**Fix:**

```js
export default function QuoteDetailPage() {
  const controller = useQuoteDetailController();

  return (
    <QuoteDetailLayout>
      <QuoteToolbar {...controller.toolbar} />
      <QuoteOverviewTab {...controller.overview} />
      <QuoteBillingTab {...controller.billing} />
      <QuoteFilesTab {...controller.files} />
      <QuoteActivityTab {...controller.activity} />
      <QuoteModalLayer {...controller.modals} />
    </QuoteDetailLayout>
  );
}
```

**Priority:** High

---

### [QuoteDetailPage keeps concern-local state at the page root instead of colocating it after extraction]

**File:** `/client/src/pages/QuoteDetailPage.jsx`

```js
const [showPaymentModal, setShowPaymentModal] = useState(false);
const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Offline - Check', reference: '', note: '', paid_at: '' });
const [paymentSaving, setPaymentSaving] = useState(false);
const [showFilePicker, setShowFilePicker] = useState(false);
const [showDamageForm, setShowDamageForm] = useState(false);
const [damageForm, setDamageForm] = useState({ title: '', amount: '', note: '' });
const [damageSaving, setDamageSaving] = useState(false);
```

**Problem:**
Many states in `QuoteDetailPage` are only consumed by one isolated UI region, but they are stored at the page root, which increases coupling and makes extraction harder. Examples:
- Billing-local: `payments`, `showPaymentModal`, `paymentForm`, `paymentSaving`, `damageCharges`, `showDamageForm`, `damageForm`, `damageSaving`
- Files-local: `quoteFiles`, `showFilePicker`
- Logs-local: `activity`
- Messaging-local: `quoteMessages`, `msgText`, `msgSending`
- Contract-editor-local: `contract`, `contractBody`, `contractSaving`, `contractLogs`, `contractTemplates`

These states should move with the subcomponents that own them once the page is decomposed.

**Fix:**

```js
function QuoteBillingTab({ quoteId, totals, quoteStatus }) {
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [damageCharges, setDamageCharges] = useState([]);

  // billing-only effects and handlers...
}
```

**Priority:** Medium

---

### [QuoteBuilder combines inventory search, quote-line editing, adjustments, and modal editing in one component]

**File:** `/client/src/components/QuoteBuilder.jsx`

```js
const [inventory, setInventory] = useState([]);
const [inventoryTotal, setInventoryTotal] = useState(0);
const [search, setSearch] = useState('');
const [pickerView, setPickerView] = useState('tile');
const [editingPriceId, setEditingPriceId] = useState(null);
const [editingDiscountId, setEditingDiscountId] = useState(null);
const [showAdjForm, setShowAdjForm] = useState(false);
const [editingQuoteItem, setEditingQuoteItem] = useState(null);
const [quoteItemForm, setQuoteItemForm] = useState({});
```

**Problem:**
`client/src/components/QuoteBuilder.jsx` is 1,062 lines and contains four major concerns:
- `73-242`: inventory query state, category filters, pagination, picker availability
- `244-438`: quote-line mutations, quantity debounce, price and discount editing
- `440-472`: quote-level adjustment management
- `474-1060`: rendering of quote lines, adjustment list, inventory picker, and quote-item modal

That makes the component expensive to reason about and nearly impossible to optimize granularly. For example, opening the quote-item modal, toggling an adjustment form, or changing picker pagination all live in the same render scope as the full quote line list.

**Fix:**

```js
export default function QuoteBuilder(props) {
  return (
    <div className={styles.builder}>
      <QuoteLineItemsPanel {...props.lineItems} />
      <QuoteAdjustmentsPanel {...props.adjustments} />
      <InventoryPickerPanel {...props.inventoryPicker} />
      <QuoteItemEditModal {...props.quoteItemEditor} />
    </div>
  );
}
```

**Priority:** High

---

### [QuoteBuilder has state and handlers that should be localized to extracted subcomponents]

**File:** `/client/src/components/QuoteBuilder.jsx`

```js
const [search, setSearch] = useState('');
const [pickerView, setPickerView] = useState('tile');
const [pickerPage, setPickerPage] = useState(1);
const [pageSize, setPageSize] = useState(50);
const [selectedCategory, setSelectedCategory] = useState(null);
const [pickerAvailability, setPickerAvailability] = useState({});

const [editingPriceId, setEditingPriceId] = useState(null);
const [priceInput, setPriceInput] = useState('');
const [editingDiscountId, setEditingDiscountId] = useState(null);
const [discountForm, setDiscountForm] = useState({ type: 'percent', amount: '' });
```

**Problem:**
Like `QuoteDetailPage`, this component keeps concern-local state at the top level:
- Inventory picker-local: `search`, `pickerView`, `pickerPage`, `pageSize`, `selectedCategory`, `categoryList`, `pickerQty`, `pickerAvailability`
- Quote-line-list-local: `localQty`, `editingPriceId`, `priceInput`, `editingDiscountId`, `discountForm`, drag state
- Adjustment-local: `showAdjForm`, `adjForm`, `adjSaving`
- Modal-local: `editingQuoteItem`, `quoteItemForm`, `quoteItemSaving`

The cross-concern coupling shows up in handlers like `addItem`, `updateQty`, and `handleAddAdjustment`, all of which share the same closure and rerender budget despite touching separate UI areas.

**Fix:**

```js
function InventoryPickerPanel({ quoteId, selectedIds, onAddItem, settings }) {
  const [search, setSearch] = useState('');
  const [pickerPage, setPickerPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [pickerAvailability, setPickerAvailability] = useState({});

  // inventory-only effects...
}
```

**Priority:** Medium

---

### [API client error handling is inconsistent outside the shared request helpers]

**File:** `/client/src/api.js`

```js
async function request(path, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (resp.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
}

export const api = {
  admin: {
    exportDb: () => {
      const token = getToken();
      return fetch(`${BASE}/admin/db/export`, { headers: { Authorization: `Bearer ${token}` } })
        .then(resp => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.blob(); });
    },
```

**Problem:**
`request()` and `publicRequest()` establish one error contract, but several endpoints bypass them and implement ad hoc behavior:
- `admin.exportDb()` does not clear auth on `401` and throws only `HTTP <status>` with no parsed error body
- `uploadPdf()`, `uploadFiles()`, and `admin.importDb()` each duplicate their own fetch/error parsing logic
- `fileServeUrl()` at line `243` still constructs a token-bearing query string URL, which no longer matches the server-side auth change from Phase 3

This means callers cannot rely on one consistent failure mode, and some code paths will leave stale auth in local storage after an unauthorized response.

**Fix:**

```js
async function authedFetch(path, init = {}) {
  const token = getToken();
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (resp.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }

  return resp;
}

async function upload(path, formData) {
  const resp = await authedFetch(path, { method: 'POST', body: formData });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}
```

**Priority:** Medium

---

### [Price and total calculation logic is duplicated across QuoteDetailPage and PublicQuotePage]

**File:** `/client/src/pages/QuoteDetailPage.jsx`

```js
function effectivePrice(it) {
  const base = it.unit_price_override != null ? it.unit_price_override : (it.unit_price || 0);
  if (it.discount_type === 'percent' && it.discount_amount > 0) {
    return base * (1 - it.discount_amount / 100);
  }
  if (it.discount_type === 'fixed' && it.discount_amount > 0) {
    return Math.max(0, base - it.discount_amount);
  }
  return base;
}

function computeTotals(items, customItems, adjustments, taxRate) {
```

**Problem:**
The pricing helpers at `client/src/pages/QuoteDetailPage.jsx:14-52` are materially duplicated in `client/src/pages/PublicQuotePage.jsx:6-45`. Both files implement the same `effectivePrice`, `computeAdjustmentsTotal`, and `computeTotals` flow with only a minor difference around `laborHours`. That duplication will drift over time; a pricing change made in one page can leave the client-facing quote showing different totals than the internal quote view.

**Fix:**

```js
// client/src/lib/quoteTotals.js
export function effectivePrice(item) { /* shared implementation */ }
export function computeAdjustmentsTotal(adjustments, preTaxBase) { /* shared implementation */ }
export function computeTotals({ items, customItems, adjustments, taxRate, includeLabor = false }) {
  /* shared implementation */
}
```

**Priority:** Medium

---

## Maintainability

### [QuoteDetailPage embeds helper components and modal workflows that should live in dedicated modules]

**File:** `/client/src/pages/QuoteDetailPage.jsx`

```js
function QuoteFilePicker({ currentFileIds = [], onSelect, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getFiles().then(d => setFiles(d.files || [])).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);
}

function ImagePicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [fileImages, setFileImages] = useState([]);
}
```

**Problem:**
At `client/src/pages/QuoteDetailPage.jsx:1616-1837`, the page defines `QuoteFilePicker`, `ImagePicker`, and `QuoteSendModal` inline. Those are reusable UI modules with their own effects and state, but they currently live inside the page file, which makes the page longer, couples them to page-level imports, and discourages isolated testing.

**Fix:**

```js
import QuoteFilePicker from '../components/QuoteFilePicker.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import QuoteSendModal from '../components/QuoteSendModal.jsx';
```

**Priority:** Low

---

## Maintainability and Code Quality

### [Quote lifecycle transitions are hand-coded across multiple routes and already drift in side effects]

**File:** `/server/routes/quotes.js`

```js
router.post('/:id/send', async (req, res) => {
  const token = quote.public_token || crypto.randomBytes(24).toString('hex');
  db.prepare("UPDATE quotes SET status = 'sent', public_token = ?, updated_at = datetime('now') WHERE id = ?")
    .run(token, req.params.id);
});

router.post('/:id/confirm', (req, res) => {
  db.prepare("UPDATE quotes SET status = 'confirmed', has_unsigned_changes = 0, updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  logActivity(req.params.id, 'status_changed', 'Quote confirmed — inventory reserved', 'approved', 'confirmed', req);
});

router.post('/:id/approve', (req, res) => {
  db.prepare("UPDATE quotes SET status = 'approved', has_unsigned_changes = 0, updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
});
```

**Problem:**
At `server/routes/quotes.js:516-600` and `server/routes/quotes.js:619-782`, the quote lifecycle is spread across separate route handlers that each perform their own `SELECT`, status checks, `UPDATE`, activity logging, token handling, and response reload. The duplication has already drifted: `confirm` and `close` write activity logs, `approve` and `revert` do not, and `send` bundles status changes with token generation and outbound message persistence. Any future lifecycle change now has to be implemented in at least five places, which makes behavior inconsistent and raises the cost of adding another status or audit requirement.

**Fix:**

```js
const {
  sendQuote,
  transitionQuoteStatus,
} = require('../services/quoteService');

router.post('/:id/approve', async (req, res) => {
  const quote = await transitionQuoteStatus(db, {
    quoteId: req.params.id,
    from: ['draft', 'sent'],
    to: 'approved',
    clearUnsignedChanges: true,
    req,
    description: 'Quote approved',
  });
  res.json({ quote });
});

router.post('/:id/confirm', async (req, res) => {
  const quote = await transitionQuoteStatus(db, {
    quoteId: req.params.id,
    from: ['approved'],
    to: 'confirmed',
    clearUnsignedChanges: true,
    req,
    description: 'Quote confirmed — inventory reserved',
  });
  res.json({ quote });
});

router.post('/:id/send', async (req, res) => {
  const result = await sendQuote(db, {
    quoteId: req.params.id,
    req,
    uploadsDir,
    ...req.body,
  });
  res.json(result);
});
```

**Priority:** Medium

---

### [Line-item mutation auditing is duplicated across item and custom-item handlers]

**File:** `/server/routes/quotes.js`

```js
const newVal = `Title: ${title}, Unit price: $${(item.unit_price || 0).toFixed(2)}, Qty: ${quantity || 1}`;
logActivity(req.params.id, 'item_added', 'Added line item: ' + title, null, newVal, req);

const oldVal = `Title: ${oldTitle}, Unit price: $${(oldRow.unit_price || 0).toFixed(2)}, Qty: ${oldRow.quantity ?? 1}`;
const newVal = `Title: ${newTitle}, Unit price: $${(qitem.unit_price || 0).toFixed(2)}, Qty: ${qitem.quantity ?? 1}`;
if (oldVal !== newVal) {
  logActivity(req.params.id, 'item_updated', 'Updated line item: ' + newTitle, oldVal, newVal, req);
}

const oldVal = `Title: ${oldRow.title || ''}, Unit price: $${(oldRow.unit_price || 0).toFixed(2)}, Qty: ${oldRow.quantity ?? 1}`;
const newVal = `Title: ${newRow.title || ''}, Unit price: $${(newRow.unit_price || 0).toFixed(2)}, Qty: ${newRow.quantity ?? 1}`;
if (oldVal !== newVal) {
  logActivity(req.params.id, 'custom_item_updated', 'Updated custom item: ' + (newRow.title || ''), oldVal, newVal, req);
}
```

**Problem:**
At `server/routes/quotes.js:887-912`, `server/routes/quotes.js:954-980`, and `server/routes/quotes.js:995-1074`, item and custom-item mutations each hand-build their own audit strings and each remember to call `markUnsignedChangesIfApproved`. This is now repeated across add, update, zero-quantity delete, and explicit delete flows. The duplication is already lossy: the summaries omit discount, override, description, and note changes even when those fields are mutated, so any future change to how a quote line should be described in the activity log has to be updated in several branches and two entity types.

**Fix:**

```js
const {
  buildQuoteItemSnapshot,
  buildCustomItemSnapshot,
  recordQuoteLineMutation,
  markUnsignedChangesIfApproved,
} = require('../lib/quoteActivity');

const oldSnapshot = buildQuoteItemSnapshot(oldRow);
const newSnapshot = buildQuoteItemSnapshot(qitemFull);

recordQuoteLineMutation({
  db,
  quoteId: req.params.id,
  eventType: 'item_updated',
  description: `Updated line item: ${newTitle}`,
  oldValue: oldSnapshot,
  newValue: newSnapshot,
  req,
});

markUnsignedChangesIfApproved(db, req.params.id);
```

**Priority:** Medium

---

### [Item analytics side effects are embedded in the quote-item create route instead of a shared service]

**File:** `/server/routes/quotes.js`

```js
const guestCount = quote.guest_count || 0;
const existing = db.prepare('SELECT id, times_quoted, total_guests FROM item_stats WHERE item_id = ?').get(item_id);
if (existing) {
  db.prepare(`
    UPDATE item_stats SET
      times_quoted = times_quoted + 1,
      total_guests = total_guests + ?,
      last_used_at = datetime('now')
    WHERE item_id = ?
  `).run(guestCount, item_id);
} else {
  db.prepare(
    "INSERT INTO item_stats (item_id, times_quoted, total_guests, last_used_at) VALUES (?, 1, ?, datetime('now'))"
  ).run(item_id, guestCount);
}

if (guestCount > 0) {
  const bMin = Math.floor(guestCount / 25) * 25;
  const bMax = bMin + 24;
  const existingBracket = db.prepare(
    'SELECT id FROM usage_brackets WHERE item_id = ? AND bracket_min = ?'
  ).get(item_id, bMin);
  // ...
}
```

**Problem:**
At `server/routes/quotes.js:852-885`, `POST /:id/items` mutates `item_stats` and `usage_brackets` inline as a hidden side effect of adding a quote line. This logic does not belong to the HTTP layer, and because it is not wrapped in a named helper, every future write path that materially adds an item to a quote has to rediscover and reproduce the same analytics bookkeeping. That is exactly the kind of hidden coupling that causes stats drift after refactors, bulk-import paths, or duplication workflows.

**Fix:**

```js
const { upsertItemStats } = require('../services/itemStatsService');

router.post('/:id/items', (req, res) => {
  // quote/item validation and insert...
  upsertItemStats(db, {
    itemId: item_id,
    guestCount: quote.guest_count || 0,
    occurredAt: new Date().toISOString(),
  });
  // response...
});
```

**Priority:** Medium

---

### [Database bootstrap has become an unversioned append-only migration script with silent failures]

**File:** `/server/db.js`

```js
for (const col of [
  'ALTER TABLE items ADD COLUMN quantity_in_stock INTEGER DEFAULT 0',
  'ALTER TABLE items ADD COLUMN unit_price REAL DEFAULT 0',
  'ALTER TABLE items ADD COLUMN category TEXT',
]) {
  try { db.exec(col); } catch {}
}

try { db.exec('ALTER TABLE quotes ADD COLUMN expires_at TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE quotes ADD COLUMN payment_policy_id INTEGER REFERENCES payment_policies(id) ON DELETE SET NULL'); } catch (e) {}
try { db.exec('ALTER TABLE quote_items ADD COLUMN unit_price_override REAL'); } catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_adjustments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      label      TEXT NOT NULL
    )
  `);
} catch (e) {}
```

**Problem:**
At `server/db.js:225-356` and `server/db.js:396-670`, schema evolution is implemented as a long sequence of `ALTER TABLE` and `CREATE TABLE` calls wrapped in broad `try/catch` blocks that intentionally ignore failures. There is no migration version table, no named migration units, and no durable record of which schema changes have run. That makes the file progressively harder to reason about, hides real migration errors behind the same control flow used for "column already exists", and forces every new schema change to be inserted into a fragile startup script instead of an ordered migration history.

**Fix:**

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function runMigration(id, apply) {
  const row = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').get(id);
  if (row) return;
  apply(db);
  db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(id);
}

runMigration('2026-03-18-add-quote-adjustments', (db) => {
  db.exec(`
    CREATE TABLE quote_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'discount',
      value_type TEXT NOT NULL DEFAULT 'percent',
      amount REAL NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
});
```

**Priority:** High

---

### [QuoteDetailPage modals each re-fetch the same file library instead of sharing a file-picker hook]

**File:** `/client/src/pages/QuoteDetailPage.jsx`

```js
function QuoteFilePicker({ currentFileIds = [], onSelect, onClose }) {
  const [files, setFiles] = useState([]);
  useEffect(() => {
    api.getFiles().then(d => setFiles(d.files || [])).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);
}

function ImagePicker({ onSelect }) {
  useEffect(() => {
    Promise.all([
      api.getFiles().catch(() => ({ files: [] })),
      api.getItems({ hidden: '0' }).catch(() => ({ items: [] }))
    ]).then(([filesData, itemsData]) => {
      setFileImages((filesData.files || []).filter(f => f.mime_type && f.mime_type.startsWith('image/')));
    });
  }, [open]);
}

function QuoteSendModal({ quote, onClose, onSent, onError }) {
  useEffect(() => {
    api.getFiles().then(d => setAllFiles(d.files || [])).catch(() => {});
  }, []);
}
```

**Problem:**
At `client/src/pages/QuoteDetailPage.jsx:1617-1747`, three inline modal helpers each load overlapping file-library data for slightly different purposes. `QuoteFilePicker` loads all files, `ImagePicker` loads all files and then filters image MIME types, and `QuoteSendModal` loads all files again for attachments. The duplicated fetching and filtering logic means any change to file response shape, auth behavior, loading states, or media filtering now has to be updated in three different modal implementations within the same page file.

**Fix:**

```js
import { useFileLibrary } from '../hooks/useFileLibrary.js';

function QuoteFilePicker(props) {
  const { files, loading } = useFileLibrary();
  // render
}

function ImagePicker(props) {
  const { imageFiles, loading } = useFileLibrary({ imagesOnly: true });
  // render
}

function QuoteSendModal(props) {
  const { files, loading } = useFileLibrary();
  // render
}
```

**Priority:** Low

---

## Design Division

### [Hardcoded success colors bypass theme system]

**File:** `/client/src/pages/QuoteDetailPage.module.css`

```css
.contractSignedBlock { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 6px; }
.contractSignedLabel { color: #065f46; }
```

**Problem:**
Colors `#d1fae5`, `#6ee7b7`, and `#065f46` are hardcoded. These are not defined as CSS variables in theme.css, so they do not adapt when the user switches themes. The theme system already defines `--color-success` variants for this purpose.

**Fix:**

```css
.contractSignedBlock {
  background: var(--color-success-subtle);
  border: 1px solid var(--color-success-light);
  border-radius: var(--radius-sm);
}
.contractSignedLabel { color: var(--color-success-dark); }
```

**Priority:** High

---

### [Hardcoded danger color duplicated across modules]

**File:** `/client/src/pages/QuoteDetailPage.module.css`

```css
.damageItem { border-left: 3px solid #ef4444; }
.damageAmount { color: #ef4444; }
```

**Problem:**
`#ef4444` is hardcoded instead of `var(--color-danger)` which is already defined in theme.css and varies per theme. The same raw hex appears in at least two rules in the same file.

**Fix:**

```css
.damageItem { border-left: 3px solid var(--color-danger); }
.damageAmount { color: var(--color-danger); }
```

**Priority:** High

---

### [MessagesPage uses hardcoded message direction colors]

**File:** `/client/src/pages/MessagesPage.module.css`

```css
.msg_inbound  { border-left: 3px solid #3b82f6; }
.msg_outbound { border-left: 3px solid #10b981; }
.dir_inbound  { background: #dbeafe; color: #1d4ed8; }
.dir_outbound { background: #d1fae5; color: #065f46; }
```

**Problem:**
Six hardcoded color values for message direction indicators. `QuoteDetailPage.module.css` implements the same pattern correctly using `var(--color-primary)` and `var(--color-accent)`. These are inconsistent and break alternate themes.

**Fix:**

```css
.msg_inbound  { border-left: 3px solid var(--color-primary); }
.msg_outbound { border-left: 3px solid var(--color-accent); }
.dir_inbound  { background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg)); color: var(--color-primary); }
.dir_outbound { background: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg)); color: var(--color-accent); }
```

**Priority:** High

---

### [Unread dot uses color with no theme variable]

**File:** `/client/src/pages/MessagesPage.module.css`

```css
.unreadDot { background: #f97316; }
```

**Problem:**
`#f97316` (orange) is not defined as any CSS variable in theme.css and does not adapt to themes. No `--color-warning` variable exists in the system to map to.

**Fix:**
Add to `theme.css` under all theme blocks:
```css
--color-warning: #f97316;
```
Then:
```css
.unreadDot { background: var(--color-warning); }
```

**Priority:** Medium

---

### [QuoteBuilder subrental badge uses hardcoded blue tints]

**File:** `/client/src/components/QuoteBuilder.module.css`

```css
.subrentalBadge { color: #1d4ed8; background: #dbeafe; border-radius: 3px; }
```

**Problem:**
Two hardcoded blue values and a raw `3px` border-radius instead of using `var(--color-primary)`, a computed tint, and `var(--radius-sm)`.

**Fix:**

```css
.subrentalBadge {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg));
  border-radius: var(--radius-sm);
}
```

**Priority:** High

---

### [Delete button hover states duplicated with inconsistent colors]

**Files:** `/client/src/components/QuoteBuilder.module.css`, `/client/src/pages/QuoteDetailPage.module.css`

```css
/* QuoteBuilder */
.removeBtn:hover { color: var(--color-danger); background: #fee; }

/* QuoteDetailPage */
.logRemoveBtn:hover { background: #fee2e2; color: #dc2626; }
.rowDeleteBtn:hover  { background: #fee2e2; color: #dc2626; }
```

**Problem:**
Three near-identical delete hover rules use different hardcoded values (`#fee` vs `#fee2e2`, and `var(--color-danger)` vs `#dc2626`). The QuoteBuilder variant also hardcodes the background but uses a variable for text color, making it inconsistent even within itself.

**Fix:**

```css
/* In each module, use the same pattern */
.removeBtn:hover,
.logRemoveBtn:hover,
.rowDeleteBtn:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-bg));
}
```

**Priority:** Medium

---

### [index.css badge classes use hardcoded palette colors]

**File:** `/client/src/index.css`

```css
.badge-sheet     { background: #e6f4ea; color: #2d7a4a; }
.badge-extension { background: #fff4e0; color: #8a5a00; }
.badge-manual    { background: #eef2f7; color: #4a5568; }
```

**Problem:**
Global badge utility classes are hardcoded and not theme-aware. They will look correct only in the default light theme.

**Fix:**

```css
.badge-sheet     { background: color-mix(in srgb, var(--color-success)  12%, var(--color-bg)); color: var(--color-success); }
.badge-extension { background: color-mix(in srgb, var(--color-warning)  12%, var(--color-bg)); color: var(--color-warning); }
.badge-manual    { background: color-mix(in srgb, var(--color-primary)   8%, var(--color-bg)); color: var(--color-text-muted); }
```

**Priority:** Medium

---

## Layout and Responsiveness Division

### [FilesPage grid minmax too wide for very small viewports]

**File:** `/client/src/pages/FilesPage.module.css`

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
```

**Problem:**
`minmax(180px, 1fr)` forces at least one 180px column. On viewports below ~400px (small Android phones), this leaves very little room and can cause horizontal overflow. No media query narrows this for small screens.

**Fix:**

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

@media (max-width: 480px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
}
```

**Priority:** Medium

---

### [FilesPage inspect panel has no mobile layout]

**File:** `/client/src/pages/FilesPage.module.css`

```css
.inspectPanel {
  width: 340px;
  max-width: 95vw;
  height: 100%;
  overflow-y: auto;
}
```

**Problem:**
On small screens the panel is `95vw` wide (correct) but still anchored as a side-drawer via the overlay layout. There is no breakpoint that converts it to a bottom sheet or full-screen modal for mobile. The panel becomes awkward and barely readable on narrow screens.

**Fix:**

```css
@media (max-width: 600px) {
  .inspectOverlay { align-items: flex-end; justify-content: center; }
  .inspectPanel {
    width: 100%;
    max-width: 100%;
    height: 85vh;
    border-radius: var(--radius) var(--radius) 0 0;
  }
}
```

**Priority:** Medium

---

## Observability Division

### [Email poller swallows all poll-cycle errors silently]

**File:** `/server/services/emailPoller.js`

```js
_timer = setInterval(function() { pollOnce(db).catch(function() {}); }, intervalMs || 5 * 60 * 1000);
```

**Problem:**
Every error thrown during a poll cycle (IMAP connection failures, DB errors, mail parse errors) is swallowed with no logging. Operators have zero visibility that email ingestion has stopped working. The server continues polling silently.

**Fix:**

```js
_timer = setInterval(function() {
  pollOnce(db).catch(function(err) {
    console.error('[emailPoller] Poll cycle failed:', err);
  });
}, intervalMs || 5 * 60 * 1000);
```

**Priority:** High

---

### [Empty catch blocks throughout emailPoller lose lead event data]

**File:** `/server/services/emailPoller.js`

```js
try {
  db.prepare('INSERT INTO lead_events ...').run(...);
} catch (e) {}
```

**Problem:**
Silent catch on a critical DB write. If this insert fails, lead event tracking data is lost permanently with no log entry.

**Fix:**

```js
try {
  db.prepare('INSERT INTO lead_events ...').run(...);
} catch (e) {
  console.error('[emailPoller] Failed to create lead event for quote', outbound.quote_id, ':', e);
}
```

**Priority:** High

---

### [Public quote endpoint has 4+ empty catch blocks]

**File:** `/server/index.js`

```js
try {
  adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ?...').all(quote.id);
} catch (e) {}

try {
  payment_policy = db.prepare('SELECT * FROM payment_policies WHERE id = ?').get(...);
} catch (e) {}
```

**Problem:**
Multiple empty catches in the public quote view assume errors mean "table doesn't exist yet." But real errors (connection failure, corrupted data) are silently swallowed, causing clients to see incomplete quote data with no server-side trace.

**Fix:**

```js
try {
  adjustments = db.prepare('SELECT * FROM quote_adjustments WHERE quote_id = ?...').all(quote.id);
} catch (e) {
  if (!e.message?.includes('no such table')) {
    console.error('[publicQuote] Failed to fetch adjustments for quote', quote.id, ':', e);
  }
}
```

**Priority:** High

---

### [Quotes route has widespread empty catch blocks on DB writes]

**File:** `/server/routes/quotes.js`

```js
try {
  db.prepare('INSERT INTO contract_logs ...').run(...);
} catch (e) {}

try {
  const rows = db.prepare('SELECT quote_id, COALESCE(SUM(amount),0) AS amount_paid FROM quote_payments...').all();
} catch (e) {}
```

**Problem:**
Contract audit logs and payment totals both fail silently. A contract edit that fails to log leaves a gap in the audit trail. Payment calculation failures return $0 totals without any error indication. These are data-integrity issues that need at minimum an error log.

**Fix:**

```js
try {
  db.prepare('INSERT INTO contract_logs ...').run(...);
} catch (e) {
  console.error('[quotes] Failed to write contract log for quote', req.params.id, ':', e);
}
```

**Priority:** High

---

### [File deletion swallows non-ENOENT errors]

**File:** `/server/routes/files.js`

```js
try { fs.unlinkSync(filePath); } catch (e) { /* already gone */ }
```

**Problem:**
Permission denied, disk I/O errors, and path issues are all masked by the comment "already gone." Real file system problems leave orphaned uploads consuming disk space, with no server log.

**Fix:**

```js
try {
  fs.unlinkSync(filePath);
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.error('[files] Failed to delete file', filePath, ':', e);
  }
}
```

**Priority:** Medium

---

### [Billing history insert in messages route fails silently]

**File:** `/server/routes/messages.js`

```js
try {
  db.prepare('INSERT INTO billing_history ...').run(...);
} catch (e) {}
```

**Problem:**
A payment is recorded but the billing history audit trail write fails silently. Payment and billing records are now out of sync with no log or alert.

**Fix:**

```js
try {
  db.prepare('INSERT INTO billing_history ...').run(...);
} catch (e) {
  console.error('[messages] Failed to record billing history for quote', req.params.id, ':', e);
}
```

**Priority:** Medium

---

### [No request logging middleware]

**File:** `/server/index.js`

**Problem:**
No morgan or equivalent middleware is registered. There is no record of which endpoints are hit, by whom, with what status codes, or at what latency. For an app handling contracts and payments, this is a significant audit trail and debugging gap.

**Fix:**

```js
// npm install morgan
const morgan = require('morgan');
app.use(morgan('combined')); // or structured JSON for production
```

**Priority:** High

---

### [No unhandledRejection / uncaughtException handlers]

**File:** `/server/index.js`

**Problem:**
If any async operation outside a route handler throws, the process crashes with no cleanup — database locks aren't released, the email poller isn't stopped, and the single-instance lock may not be freed, blocking future restarts.

**Fix:**

```js
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err);
  emailPoller.stopPolling();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled rejection:', reason);
});
```

**Priority:** High

---

## UX Quality Division

### [Conflict load failure causes silent false-empty state]

**File:** `/client/src/pages/QuotePage.jsx`

```js
api.getConflicts()
  .then(d => setQuoteIdsWithConflict(new Set((d.conflicts || []).map(c => c.quote_id))))
  .catch(() => {});
```

**Problem:**
If the conflicts API call fails, all conflict badges disappear silently. Users see quotes as conflict-free when the check simply failed to load. This can lead to double-booking.

**Fix:**

```js
api.getConflicts()
  .then(d => setQuoteIdsWithConflict(new Set((d.conflicts || []).map(c => c.quote_id))))
  .catch((err) => {
    console.error('[conflicts] Failed to load:', err);
    // Retain previous conflict data rather than clearing it
  });
```

**Priority:** Medium

---

### [Messages list load failure produces silent false-empty state]

**File:** `/client/src/pages/MessagesPage.jsx`

```js
api.getMessages(params)
  .then((d) => setMessages(d.messages || []))
  .catch(() => {})
  .finally(() => setLoading(false));
```

**Problem:**
On network or server error the page renders as an empty messages list. The spinner stops and the user sees "No messages" with no error indication. There is no way to distinguish "no messages" from "failed to load."

**Fix:**

```js
api.getMessages(params)
  .then((d) => setMessages(d.messages || []))
  .catch((err) => {
    console.error('[messages] Failed to load:', err);
    toast.error('Failed to load messages. Please refresh.');
  })
  .finally(() => setLoading(false));
```

**Priority:** Medium

---

### [Settings load failure silently disables features]

**File:** `/client/src/pages/QuotePage.jsx`

```js
api.getSettings().then(s => {
  if (s.google_places_api_key) setGooglePlacesKey(s.google_places_api_key);
  setEventTypes(String(s.quote_event_types || '').split('\n').map(v => v.trim()).filter(Boolean));
}).catch(() => {});
```

**Problem:**
If settings fail to load, Google Places autocomplete and event type dropdowns silently stop working. Users see missing dropdowns with no explanation.

**Fix:**

```js
api.getSettings()
  .then(s => {
    if (s.google_places_api_key) setGooglePlacesKey(s.google_places_api_key);
    setEventTypes(String(s.quote_event_types || '').split('\n').map(v => v.trim()).filter(Boolean));
  })
  .catch((err) => {
    console.error('[settings] Failed to load:', err);
    toast.error('Failed to load settings');
  });
```

**Priority:** Medium

---

## Developer Experience Division

### [APP_URL in .env.example points to wrong port]

**File:** `/.env.example`

```env
APP_URL=http://localhost:5173
```

**Problem:**
`5173` is the Vite dev server port. `APP_URL` is used for public catalog canonical URLs, signed file URLs, and sitemap output — all of which point to the API server on port `3001`. Developers copying this example get broken public links.

**Fix:**

```env
APP_URL=http://localhost:3001
```

**Priority:** High

---

### [No ESLint configuration]

**File:** Root, `/client`, `/server`

**Problem:**
No `.eslintrc` or `eslint.config.js` exists anywhere in the project. Code quality and style inconsistencies go undetected at development time.

**Fix:**
Create `client/eslint.config.js` with React/JSX rules and `server/.eslintrc.json` with Node.js/CommonJS rules. Add `"lint": "eslint ."` scripts to each `package.json`.

**Priority:** High

---

### [No npm lint/format/test scripts]

**File:** `/package.json`, `/client/package.json`

**Problem:**
Neither root nor client package.json defines `lint`, `format`, or `test` scripts. There is no standard entry point for code quality checks, making CI integration and developer onboarding harder.

**Fix:**

```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx",
    "format": "prettier --write \"**/*.{js,jsx,json}\"",
    "test": "echo 'No tests configured yet'"
  }
}
```

**Priority:** High

---

### [AI route missing return on fallback, causing hanging requests]

**File:** `/server/routes/ai.js`

```js
} catch (e) {
  console.error('AI suggest error:', e.message);
  fallbackSuggest();  // no return
}
```

**Problem:**
When the primary AI provider call fails and falls back to `fallbackSuggest()`, the missing `return` means execution continues past the catch block without sending a response. The request hangs until timeout.

**Fix:**

```js
} catch (e) {
  console.error('AI suggest error:', e.message);
  return fallbackSuggest();
}
```

**Priority:** High

---

### [Undocumented environment variables in .env.example]

**File:** `/.env.example`

**Problem:**
`UPLOADS_DIR`, `DB_PATH`, `ANTHROPIC_API_KEY`, and `GOOGLE_GEMINI_API_KEY` are used in the codebase but absent from `.env.example`. Developers copying the example miss these, leading to confusing runtime failures.

**Fix:**
Add to `.env.example`:
```env
# File storage (defaults to ./uploads or exe directory when packaged)
UPLOADS_DIR=./uploads

# AI providers (optional — can also be set via Settings page)
ANTHROPIC_API_KEY=
GOOGLE_GEMINI_API_KEY=
```

**Priority:** Medium

---
