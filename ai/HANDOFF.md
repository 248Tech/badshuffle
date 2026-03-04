# HANDOFF — Stability Foundations + Sales Workflow

## Objective

Three phases of work building on the existing codebase. Phases are ordered by dependency: Phase A must land first, Phase B second, Phase C can overlap with B.

**Guardrail (non-negotiable):** Do NOT remove, downgrade, or disable any existing feature, route, UI surface, script, or behavior. Every item below is additive or a targeted fix.

---

## Phase A — Stability Foundations

### A1 — DB Persistence (ALREADY DONE — no changes required)

The sql.js wrapper in `server/db.js` already writes `badshuffle.db` to disk after every mutation via `_save()`. The DB path is already pkg-aware (`process.pkg` check). No changes needed. Document in TODO as verified.

### A2 — Audit Fields (ALREADY DONE — no changes required)

The `items` table already has `created_at` and `updated_at`. The PUT handler in `server/routes/items.js` already sets `updated_at = datetime('now')`. Quotes table already has `updated_at` updated on PUT. No changes needed. Document in TODO as verified.

### A3 — Image Display Fix

**File to investigate first:** `client/src/pages/InventoryPage.jsx` and `client/src/components/ItemCard.jsx` (or wherever item `photo_url` is rendered).

**Root cause (suspected):** Items have a `photo_url` text column. In packaged (pkg) mode, the client exe serves on port 5173. Images from external sources go through `/api/proxy-image?url=...`. The issue is likely one of:
1. `photo_url` values scraped from Goodshuffle are full external URLs that require the proxy but aren't being proxied, OR
2. In pkg mode the client build path or asset path differs

**Fix pattern:**
- In any component that renders `<img src={item.photo_url}>`, replace with:
  ```jsx
  <img src={item.photo_url ? api.proxyImageUrl(item.photo_url) : '/placeholder.png'} ... />
  ```
- `api.proxyImageUrl` is already defined in `client/src/api.js`:
  ```js
  proxyImageUrl: (url) => `/api/proxy-image?url=${encodeURIComponent(url)}`
  ```
- Add a small placeholder image at `client/public/placeholder.png` if one does not already exist (a simple 1×1 gray PNG is fine — or use an inline SVG data URI as a fallback `onError` handler instead)

**Check:** `server/routes/imageProxy.js` or similar — verify the proxy route exists and is registered in `server/index.js`. If the proxy is missing, create it:
```js
// server/routes/imageProxy.js
const express = require('express');
const https = require('https');
const http = require('http');
const router = express.Router();
router.get('/', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const mod = url.startsWith('https') ? https : http;
  mod.get(url, (upstream) => {
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    upstream.pipe(res);
  }).on('error', () => res.status(502).end());
});
module.exports = router;
```
Register in `server/index.js` (public block, no auth):
```js
app.use('/api/proxy-image', require('./routes/imageProxy'));
```

---

## Phase B — Sales Workflow

### B1 — Schema Migrations

**File:** `server/db.js`

Add the following ALTER TABLE calls inside `initDb()`, after the existing table creation, using the try/catch pattern already established:

```js
// quotes — status lifecycle + lead linkage + public share token
const quoteCols = [
  "ALTER TABLE quotes ADD COLUMN status TEXT DEFAULT 'draft'",
  "ALTER TABLE quotes ADD COLUMN lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL",
  "ALTER TABLE quotes ADD COLUMN public_token TEXT"
];
for (const sql of quoteCols) {
  try { db.run(sql); } catch(e) {}
}

// leads — back-reference to quote
try { db.run("ALTER TABLE leads ADD COLUMN quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL"); } catch(e) {}
```

Also create the index for public_token lookups:
```js
try {
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token) WHERE public_token IS NOT NULL");
} catch(e) {}
```

### B2 — Quote Status + Send Endpoint

**File:** `server/routes/quotes.js`

Add to the top of the file, inside `makeRouter`:
```js
const crypto = require('crypto');
```

Add these routes (before `return router`):

```js
// POST /api/quotes/:id/send — set status to 'sent', generate public_token
router.post('/:id/send', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  const token = quote.public_token || crypto.randomBytes(24).toString('hex');
  db.prepare("UPDATE quotes SET status = 'sent', public_token = ?, updated_at = datetime('now') WHERE id = ?")
    .run(token, req.params.id);

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  res.json({ quote: updated });
});

// POST /api/quotes/:id/approve — set status to 'approved'
router.post('/:id/approve', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  db.prepare("UPDATE quotes SET status = 'approved', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  res.json({ quote: updated });
});

// POST /api/quotes/:id/revert — revert approved/sent back to draft
router.post('/:id/revert', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  db.prepare("UPDATE quotes SET status = 'draft', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  res.json({ quote: updated });
});
```

Also update the existing `PUT /api/quotes/:id` to accept `lead_id`:
```js
// change destructure line from:
const { name, guest_count, event_date, notes } = req.body;
// to:
const { name, guest_count, event_date, notes, lead_id } = req.body;
```
And add `lead_id = COALESCE(?, lead_id),` to the UPDATE SET clause, plus `lead_id !== undefined ? lead_id : null` in the `.run()` args (before the existing nulls).

### B3 — Public Quote Endpoint (unauthenticated)

**File:** `server/routes/quotes.js`

Add inside `makeRouter`, before existing routes:
```js
// GET /api/quotes/public/:token — no auth required (registered separately in index.js)
// NOTE: This handler is exported for use in index.js as a standalone route.
```

**File:** `server/index.js`

Add a new public route (in the public block, BEFORE the `auth` middleware chain):
```js
// Public quote view (no auth)
app.get('/api/quotes/public/:token', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(req.params.token);
  if (!quote) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare(`
    SELECT qi.id as qitem_id, qi.quantity, qi.label, qi.sort_order,
           i.id, i.title, i.photo_url, i.unit_price, i.taxable
    FROM quote_items qi
    JOIN items i ON i.id = qi.item_id
    WHERE qi.quote_id = ?
    ORDER BY qi.sort_order ASC, qi.id ASC
  `).all(quote.id);
  res.json({ ...quote, items });
});
```

Note: `db` is accessible at this point in index.js because it is defined at the module scope after `await initDb()`.

### B4 — Lead→Quote Linkage in Leads Route

**File:** `server/routes/leads.js`

Update the POST `/` route to accept and store `quote_id`:
```js
// change destructure from:
const { name, email, phone, event_date, event_type, source_url, notes } = req.body;
// to:
const { name, email, phone, event_date, event_type, source_url, notes, quote_id } = req.body;
```
Include `quote_id` in the INSERT. Also add a new endpoint:
```js
// PUT /api/leads/:id — update quote_id linkage
router.put('/:id', (req, res) => {
  const { quote_id } = req.body;
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE leads SET quote_id = ? WHERE id = ?').run(
    quote_id !== undefined ? quote_id : lead.quote_id,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  res.json({ lead: updated });
});
```

### B5 — Client API additions

**File:** `client/src/api.js`

Add to the Quotes section:
```js
sendQuote:    (id)        => request(`/quotes/${id}/send`,    { method: 'POST' }),
approveQuote: (id)        => request(`/quotes/${id}/approve`, { method: 'POST' }),
revertQuote:  (id)        => request(`/quotes/${id}/revert`,  { method: 'POST' }),
getPublicQuote: (token)   => request(`/quotes/public/${token}`),
```

Add to the Leads section:
```js
updateLead: (id, body) => request(`/leads/${id}`, { method: 'PUT', body }),
```

Note: `getPublicQuote` uses `/quotes/public/:token`, which is a public endpoint — the `request()` helper always attaches the token if present in localStorage (which is fine; the server ignores it for this route).

### B6 — QuotePage — Status Badge + Send Button

**File:** `client/src/pages/QuotePage.jsx` (or equivalent quote detail page — check the filename)

Find the quote detail view and add:
1. A status badge next to the quote name:
   ```jsx
   <span className={`${styles.badge} ${styles['badge_' + quote.status]}`}>
     {quote.status || 'draft'}
   </span>
   ```
2. A "Send to Client" button (shown when status === 'draft'):
   ```jsx
   {quote.status === 'draft' && (
     <button onClick={handleSend} className={styles.btnSend}>Send to Client</button>
   )}
   ```
   `handleSend` calls `api.sendQuote(quote.id)` then refreshes.
3. An "Approve" button shown on the public view only (see B7).
4. A "Copy Link" button when `quote.public_token` is set:
   ```jsx
   {quote.public_token && (
     <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/quote/public/${quote.public_token}`)}>
       Copy Client Link
     </button>
   )}
   ```

**File:** `client/src/pages/QuotePage.module.css` (or equivalent)

Add badge styles:
```css
.badge { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
.badge_draft    { background: #e0e7ff; color: #3730a3; }
.badge_sent     { background: #fef3c7; color: #92400e; }
.badge_approved { background: #d1fae5; color: #065f46; }
```

### B7 — Public Quote View Page

**New file:** `client/src/pages/PublicQuotePage.jsx`

This page is rendered without authentication (public route in App.jsx).

```jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function PublicQuotePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getPublicQuote(token)
      .then(data => { setQuote(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [token]);

  if (loading) return <p>Loading quote…</p>;
  if (error)   return <p>Error: {error}</p>;

  const subtotal = (quote.items || []).reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0);

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', fontFamily: 'sans-serif' }}>
      <h1>{quote.name}</h1>
      <p>Status: <strong>{quote.status}</strong></p>
      {quote.event_date && <p>Event Date: {quote.event_date}</p>}
      {quote.guest_count > 0 && <p>Guests: {quote.guest_count}</p>}
      {quote.notes && <p>{quote.notes}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>Item</th>
            <th style={{ textAlign: 'right' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Unit Price</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(quote.items || []).map(item => (
            <tr key={item.qitem_id}>
              <td style={{ padding: '8px 0' }}>{item.label || item.title}</td>
              <td style={{ textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right' }}>${(item.unit_price || 0).toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>${((item.unit_price || 0) * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 12 }}>Subtotal</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 12 }}>${subtotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Print / Save PDF
        </button>
      </div>

      <style>{`@media print { button { display: none !important; } }`}</style>
    </div>
  );
}
```

**File:** `client/src/App.jsx`

Import and add a public route (outside `ProtectedRoute`):
```jsx
import PublicQuotePage from './pages/PublicQuotePage';
// ...
<Route path="quote/public/:token" element={<PublicQuotePage />} />
```
This route must be inside the `<Routes>` block but NOT wrapped in `ProtectedRoute`.

### B8 — Quote Export (Print-to-PDF)

No new npm packages required. The "Print / Save PDF" button in `PublicQuotePage` (above) calls `window.print()`. Browsers offer native "Save as PDF" in the print dialog. A print CSS rule hides the button.

Optionally add a similar print button to the internal QuotePage detail view.

---

## Phase C — Roles and Permissions

### C1 — requireOperator Middleware

**New file:** `server/lib/operatorMiddleware.js`

```js
module.exports = function requireOperator(db) {
  return function(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'operator')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
```

Pattern matches existing `server/lib/adminMiddleware.js`.

### C2 — Apply Operator Guard to Settings Route

**File:** `server/index.js`

Import the new middleware:
```js
const requireOperator = require('./lib/operatorMiddleware')(db);
```

Change the settings route from:
```js
app.use('/api/settings', auth, require('./routes/settings')(db));
```
to:
```js
app.use('/api/settings', auth, requireOperator, require('./routes/settings')(db));
```

Do NOT change `GET /api/settings` separately — the requireOperator guard applies to all settings verbs, which is intentional (users should not modify settings).

### C3 — GET /api/auth/me Endpoint

**File:** `server/routes/auth.js`

Add inside `makeRouter` (alongside existing GET `/status`):
```js
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, email, role, approved FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, email: user.email, role: user.role });
});
```

Note: `auth` here refers to the auth middleware already imported/used inside `routes/auth.js`. Check if it is already passed in via `makeRouter` or imported at the top. Use whichever pattern the file already uses.

### C4 — Client Role Awareness

**File:** `client/src/App.jsx`

Add a `role` state that is fetched on mount via `api.auth.me()`:
```jsx
const [role, setRole] = useState(null);

useEffect(() => {
  api.auth.me()
    .then(data => setRole(data.role))
    .catch(() => setRole('user'));
}, []);
```

Pass `role` as a prop to `<Sidebar role={role} />` (and any other components that need it).

**File:** `client/src/components/Sidebar.jsx`

Accept `role` prop. In the NAV array or render logic, conditionally hide the Admin link:
```jsx
{NAV.filter(item => item.to !== '/admin' || role === 'admin').map(...)}
```

Do NOT remove the Admin route or its component — only hide the nav link from non-admins. The route itself stays (server protects it with `requireAdmin`).

### C5 — API Token Generator (Admin-Only)

The existing `GET /api/auth/extension-token` already generates an extension/API token. Verify in `server/routes/auth.js` that this endpoint is behind `requireAdmin` (or `requireOperator` at minimum). If it is currently behind only `requireAuth`, upgrade it:

Change:
```js
router.get('/extension-token', auth, (req, res) => {
```
To (if you want admin-only):
```js
router.get('/extension-token', auth, requireAdmin, (req, res) => {
```

Where `requireAdmin` is already imported/used in the file. If `requireAdmin` is not in scope in `routes/auth.js`, pass it in via `makeRouter(db, requireAdmin)` and update the call site in `server/index.js`.

---

## Files Changed Summary

| File | Change |
|---|---|
| `server/db.js` | Add ALTER TABLE for quotes.status, quotes.lead_id, quotes.public_token, leads.quote_id; add unique index |
| `server/routes/quotes.js` | Add /send, /approve, /revert routes; update PUT to accept lead_id; add public token logic |
| `server/routes/leads.js` | Update POST to accept quote_id; add PUT /:id |
| `server/index.js` | Add public /api/quotes/public/:token route; add requireOperator to settings; import operatorMiddleware |
| `server/lib/operatorMiddleware.js` | **NEW** — operator + admin guard |
| `server/routes/auth.js` | Add GET /me endpoint; upgrade extension-token to admin/operator guard |
| `server/routes/imageProxy.js` | **NEW** (if not already present) — image proxy route |
| `client/src/api.js` | Add sendQuote, approveQuote, revertQuote, getPublicQuote, updateLead |
| `client/src/pages/QuotePage.jsx` | Add status badge, Send to Client button, Copy Link button |
| `client/src/pages/QuotePage.module.css` | Add badge styles |
| `client/src/pages/PublicQuotePage.jsx` | **NEW** — public read-only quote view + print button |
| `client/src/App.jsx` | Add /quote/public/:token route; add role state; pass role to Sidebar |
| `client/src/components/Sidebar.jsx` | Accept role prop; hide Admin link for non-admin |

---

## Implementation Notes

- All ALTER TABLE additions use the existing try/catch pattern in `db.js` — they are safe to run on an existing DB with data.
- `crypto` is a Node.js built-in — no new packages needed for token generation.
- `window.print()` with `@media print` CSS is the quote export strategy — no new npm packages needed.
- The public quote endpoint is registered directly in `index.js` (not via a router factory) because it needs access to `db` and must sit in the public block before the `auth` middleware.
- Phase A items A1 and A2 require no code changes — mark them as verified in TODO.

---

## Acceptance Criteria

- [ ] Quotes table has status (default 'draft'), lead_id, public_token columns after server restart
- [ ] Leads table has quote_id column after server restart
- [ ] POST /api/quotes/:id/send returns updated quote with status='sent' and a non-null public_token
- [ ] GET /api/quotes/public/:token returns quote+items without an auth header
- [ ] /quote/public/:token renders the public quote view in the browser without login
- [ ] Print / Save PDF button triggers browser print dialog
- [ ] PUT /api/settings returns 403 for a user with role='user'
- [ ] GET /api/auth/me returns { id, email, role } for the logged-in user
- [ ] Admin nav link is hidden in Sidebar for users with role='user' or role='operator'
- [ ] Admin nav link is visible for role='admin'
- [ ] No existing routes, pages, or behaviors are removed or broken
