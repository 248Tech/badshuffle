# HANDOFF — Extension Download Auth, Sheets 400 Error, Leads Wording

## Objective

Three targeted bugfixes identified during runtime testing:

1. Extension ZIP download returns 401 from a browser click because the entire
   `/api/extension` router sits behind `requireAuth` middleware.
2. Google Sheets import returns "Failed to fetch sheet: 400 Bad Request" because
   Google returns HTTP 400 (not 401/403) for sheets that are not publicly accessible,
   and the error handler only catches 401/403.
3. The Leads tab in ImportPage shows "leads scraped from Goodshuffle" — inaccurate
   wording since leads come from Sheets imports, not from Goodshuffle scraping.

All three fixes are small and isolated. No new files are required.

---

## Constraints

- Node 14.15.5 — no `||=` / `&&=` / `??=`.
- No new npm packages.
- Minimal diffs — surgical changes only.

---

## Implementation Plan

### Fix 1 — Make `/api/extension/download` public

**File:** `server/index.js`

**Root cause:** Line 63 registers the entire extension router behind `auth`:
```
app.use('/api/extension', auth, require('./routes/extension'));
```
A browser `<a href="http://localhost:3001/api/extension/download" download>` does not
attach an `Authorization: Bearer` header, so `requireAuth` rejects it with 401.

**Fix:** Move the extension router registration to the public block (alongside
`/api/auth` and `/api/health`), removing the `auth` middleware:
```
app.use('/api/extension', require('./routes/extension'));
```

The extension ZIP is not sensitive — it is a browser extension that any user of
the application needs to install. See DECISIONS.md for rationale.

---

### Fix 2 — Handle Google 400 as an access error in sheetsParser

**File:** `server/lib/sheetsParser.js`

**Root cause:** `sheetUrlToCsvUrl()` already converts any Google Sheets edit/view URL
into the correct `export?format=csv&gid=` URL. The conversion is correct. The problem
is that Google returns HTTP **400** (Bad Request) for sheets that are not publicly
shared — it does not always return 401 or 403. The current check on line 24 only
handles 401 and 403:

```js
if (resp.status === 401 || resp.status === 403) {
```

A 400 response falls through to the generic error on line 27:
```
throw new Error(`Failed to fetch sheet: ${resp.status} ${resp.statusText}`)
```
which produces the unhelpful "Failed to fetch sheet: 400 Bad Request" message seen
in the report.

**Fix:** Extend the condition to include 400:
```js
if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
```
The same human-readable message ("Sheet is not publicly accessible. Make sure it is
published to the web…") is appropriate for 400 as well.

No change to `sheetUrlToCsvUrl` is needed — URL conversion is already correct.

---

### Fix 3 — Correct lead count wording in ImportPage

**File:** `client/src/pages/ImportPage.jsx`

**Root cause:** `LeadsPreview` component, line 312:
```jsx
<span className={styles.info}>{total} leads scraped from Goodshuffle</span>
```
Leads are imported from Sheets or captured by the extension — "scraped from
Goodshuffle" is inaccurate. The `total` value comes from `api.getLeads({ limit: 10 })`
`.total`, which is the actual stored count. The count logic is correct; only the
label text is wrong.

**Fix:** Change the label to:
```jsx
<span className={styles.info}>{total} leads in database</span>
```

Also update the empty-state message on line 318 for consistency. Current:
```
No leads yet. Browse Goodshuffle quote pages with the extension to capture contacts.
```
Updated:
```
No leads yet. Import a sheet on the Inventory Sheet tab or use the extension to capture contacts.
```

---

## Files To Create

None.

## Files To Modify

| File | Change |
|---|---|
| `server/index.js` | Move `/api/extension` to public block (remove `auth` middleware) |
| `server/lib/sheetsParser.js` | Add `400` to the access-error status check |
| `client/src/pages/ImportPage.jsx` | Update lead count label and empty-state text |

---

## Implementation Notes

- The extension router (`routes/extension.js`) has no db dependency and needs no
  factory call — `require('./routes/extension')` is already correct.
- The `sheetUrlToCsvUrl` function handles both `/edit`, `/edit#gid=N`, `/view`,
  and publish URLs. Do not modify it.
- The `total` value in `LeadsPreview` is correct. The API call `api.getLeads({ limit: 10 })`
  returns `{ leads: [...], total: N }` where `total` reflects the full DB count.
  No server changes are needed for Issue 3.

---

## Acceptance Criteria

- [ ] Clicking the Download ZIP button on the Extension page (logged-in browser session)
      returns a ZIP file, not a 401 JSON error
- [ ] Unauthenticated GET `http://localhost:3001/api/extension/download` returns the ZIP
      (no auth required)
- [ ] Pasting a private (non-published) Google Sheet URL into the importer returns the
      message "Sheet is not publicly accessible. Make sure it is published to the web…"
      rather than "Failed to fetch sheet: 400 Bad Request"
- [ ] Pasting a valid public Sheet URL still imports successfully (no regression)
- [ ] ImportPage Leads tab shows "N leads in database" (not "scraped from Goodshuffle")
- [ ] Empty state on Leads tab shows updated message (no "Browse Goodshuffle quote pages")

---

## Test Plan

1. Start dev server (`npm run dev`).
2. Log in; navigate to Extension page → click Download ZIP → browser downloads
   `badshuffle-extension.zip` with no auth error.
3. In a separate terminal: `curl http://localhost:3001/api/extension/download -o test.zip`
   (no auth header) → downloads successfully.
4. In the Import page, paste a private Google Sheets edit URL → error message reads
   "Sheet is not publicly accessible…".
5. Paste a public/published Google Sheets URL → imports successfully, row count shown.
6. Navigate to Import → Leads tab → counter reads "N leads in database"; empty-state
   reads the updated text.
7. Run `git diff` → confirm only the three files listed above are modified.
