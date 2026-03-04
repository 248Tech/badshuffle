# STATUS

## Current Task
Completed: auth guard logout loop + incognito login; previously: lead import, quotes venue/totals/PDF.

## Auth fix (logout loop + incognito)

### Root cause
- **Logout loop:** On any 401, `api.js` did `clearToken()` then `window.location.href = '/login'`, causing a full page reload. After reload, AuthGate ran again, called `auth/me` (no token or invalid), got 401 again → redirect again → infinite loop.
- **Incognito / 401:** Same redirect-on-401 caused reload; plus AuthGate always called `auth/me()` even when there was no token (e.g. on /login), so unauthenticated users triggered 401 and the global redirect.

### Fix
1. **api.js:** On 401, only `clearToken()` and throw. No `window.location` or reload. Callers handle the error; AuthGate handles unauthed state and navigates once via router.
2. **App.jsx AuthGate:** Stable states: `loading` | `authed` | `unauthed`. If no token, do not call `auth/me()` — set `unauthed` and render children (login/setup/public routes show). If token present, call `auth/me()`; on success set `authed`, on 401 set `unauthed` and `navigate('/login', { replace: true })` only once (ref `hasRedirectedToLogin`). If already on `/login`, do not redirect. Reset the ref when pathname is `/login` so a later 401 can redirect again.
3. **API/proxy:** JWT in `Authorization` header (no cookies). Vite proxy already routes `/api` → `http://localhost:3001`; no `credentials: 'include'` needed. Same origin in dev so `/api/auth/me`, login, logout all hit the same server.

### Files changed (auth)
- `client/src/api.js` — remove `window.location.href = '/login'` on 401.
- `client/src/App.jsx` — AuthGate: useLocation, state machine, skip auth.me when no token, single navigate to /login with ref guard.

### How to verify
- Normal tab: login works; logout returns to /login without reload loop; no repeated 401 in console.
- Incognito: login works; after login, auth/me succeeds (no 401 loop).
- After logout, `/api/auth/me` returns 401 and UI stays on /login (no refresh).

---

## Progress (previous)

### 1. Lead import (normalize + scoring + mapping)
- **Server:** Added `server/lib/leadImportMap.js`: `normalizeHeader()` (lowercase, newlines→spaces, collapse whitespace, strip punctuation, trim); keyword/regex scoring to suggest mapping for name, email, phone, event_date, event_type, source_url, notes; `suggestMapping(rawHeaders)` and `rowToLeadWithMapping(row, columnMapping)`.
- **Server:** `server/routes/leads.js`: New `POST /api/leads/preview` — body `{ url }` or `{ filename, data }` (base64); returns `{ columns, suggestedMapping, preview: first 10 rows, totalRows }`. `POST /api/leads/import` now accepts optional `columnMapping: { name: 'Full Name', ... }`; uses `rowToLeadWithMapping` when provided, else `rowToLeadFallback`. Extracted `parseRowsFromBody()` for CSV/XLSX from file.
- **Client:** `api.previewLeadsImport(body)`. Import page Leads tab refactored to 3-step wizard: (0) Enter source (Google Sheet URL or upload CSV/XLSX), (1) Map columns — table with dropdown per target field (full name, email, phone, event date, event type, source URL, notes) and preview rows, (2) Result. Import sends `columnMapping` from chosen mapping.

### 2. Leads page wording
- No "captured from Goodshuffle" references were present in leads UI (LeadsPage already showed "X leads in database"; Import page empty state did not mention Goodshuffle). No change required.

### 3. Quotes: venue, quote notes, logistics, totals, tax_rate, PDF
- **DB:** `server/db.js` — migrations for quotes: `venue_name`, `venue_email`, `venue_phone`, `venue_address`, `venue_contact`, `venue_notes`, `quote_notes`, `tax_rate` (REAL).
- **API:** `server/routes/quotes.js` — GET quote items include `category`; POST/PUT quote accept and persist venue_*, quote_notes, tax_rate.
- **Client QuoteDetailPage:** Edit form: Venue section (Name, Email, Phone, Address, Contact, Notes), Quote notes textarea, Tax rate (%) with fallback to settings. Display: Venue block, Quote notes, Logistics section (items where `category` contains "logistics"), Totals bar: Subtotal (equipment), Delivery total (logistics), Tax, Grand total. `computeTotals()` splits items by logistics; uses `quote.tax_rate` when set else `settings.tax_rate`.
- **QuoteExport:** Venue information block, Quote notes, equipment grid (non-logistics), Logistics section (delivery/pickup items), Totals: Subtotal, Delivery total, Tax, Grand total. PDF: "Print / Save as PDF" (window.print) kept alongside PNG export.

## Files Changed
- `server/lib/leadImportMap.js` — new (normalize, scoring, suggestMapping, rowToLeadWithMapping)
- `server/routes/leads.js` — preview endpoint, import with columnMapping, parseRowsFromBody, rowToLeadFallback
- `client/src/api.js` — previewLeadsImport
- `client/src/pages/ImportPage.jsx` — Leads 3-step wizard with column mapping UI and preview
- `client/src/pages/ImportPage.module.css` — selectSmall, mapLabel for mapping dropdowns
- `server/db.js` — quote columns: venue_*, quote_notes, tax_rate
- `server/routes/quotes.js` — GET items with category; POST/PUT with venue_*, quote_notes, tax_rate
- `client/src/pages/QuoteDetailPage.jsx` — venue form/display, quote_notes, logistics, totals (subtotal, delivery, tax, grand), tax_rate
- `client/src/pages/QuoteDetailPage.module.css` — formSection, venueBlock, logisticsBlock styles
- `client/src/components/QuoteExport.jsx` — venue, quote_notes, logistics section, full totals
- `client/src/components/QuoteExport.module.css` — exportVenue, exportLogistics styles
- `ai/STATUS.md`

## How to test

1. **Lead import**
   - Import → Leads. Step 1: Enter a Google Sheets URL (or upload CSV/XLSX). Click Preview or choose file.
   - Step 2: Confirm suggested column mapping (dropdowns per field); change mappings if needed; check preview table. Click "Import N rows".
   - Step 3: See imported count; "View leads" or "Back to import". Verify leads list and that data matches mapped columns.

2. **Leads wording**
   - Leads page: header shows "X leads in database". No "Goodshuffle" in leads copy.

3. **Quotes**
   - Open a quote → Edit: fill Venue (name, email, phone, address, contact, notes), Quote notes, Tax rate %.
   - Save. View: Venue block, Quote notes, and (if any items have category containing "logistics") Logistics section and Delivery total in totals bar.
   - Export: PNG and "Print / Save as PDF". Printed/PDF view shows venue, quote notes, equipment grid, logistics section, and Subtotal / Delivery total / Tax / Grand total.

## Verification
- Lint on modified files: no errors.

## Known Issues
- None.

## Next Steps
- Optional: add more target fields to lead import (e.g. guest count, delivery address) if sheet columns expand.
