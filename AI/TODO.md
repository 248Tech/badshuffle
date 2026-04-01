# TODO — Badshuffle Audit

Last updated: 2026-03-25
Current phase: Phase 2 — Code Audit

---

## In Progress

- [ ] Full codebase audit (assigned to Codex — see CODE_AUDIT_PLAN.md)

---

## Ready for Codex

### SECURITY (do first)

- [x] Audit `server/lib/authMiddleware.js`
  - Findings / fixes applied (additive):
    - Enforced JWT algorithm allowlist (`HS256`) during verification.
    - Added bearer token parsing + length guardrail (reject huge tokens early).
    - Ensured verified payload is an object before accepting.
    - Added compatibility: set `req.user.id = req.user.sub` when missing (several routes used `req.user.id`).
  - Follow-ups:
    - Consider adding `aud`/`iss` validation once deployment audience is known.
    - Consider server-side user revocation checks (DB lookup) for sensitive routes (trade-off: perf).
  - Files: `server/lib/authMiddleware.js`, `server/routes/files.js`
  - Priority: High

- [x] Audit public routes in `server/index.js` (lines 130–270)
  - Verify no-auth routes are safe, CORS config is correct
  - Files: `server/index.js`
  - Priority: High
  - Notes / fixes applied:
    - Added lightweight **in-memory rate limiting** for sensitive **public-token** flows:
      - `GET /api/quotes/public/:token`
      - `POST /api/quotes/approve-by-token`
      - `GET/POST /api/quotes/public/:token/messages`
      - `POST /api/quotes/contract/sign`
      - `GET /api/files/:id/serve` (abuse guard)
    - **Update (2026-03-30):** `GET /api/files/:id/serve` no longer accepts JWT via `?token=`; use **`Authorization: Bearer`** or signed `sig`/`exp` query (public quote images). Authenticated UI uses **`POST /api/files/serve-links`** + **`GET /api/files/:id/serve-link`** to obtain signed paths for `<img src>` / links.

- [x] Audit input validation in `server/routes/quotes.js`
  - Files: `server/routes/quotes.js`
  - Priority: High
  - Findings / fixes applied (additive):
    - List `GET`: `status` restricted to known filters; `ORDER BY` uses column whitelist (`sortColumnMap`); queries parameterized.
    - `POST` create: `name` max length, `guest_count` range; inserts use validated values.
    - `PUT` quote: `name` length, `guest_count` range, `lead_id` validated as positive int when provided; `lead_id` bind passes parsed int or `null` (unchanged). **Note:** `COALESCE(?, lead_id)` cannot clear `lead_id` to NULL with SQL NULL alone; clearing remains a product follow-up if needed.
    - Line items / reorder / discount_type: stricter validation (positive IDs, quantity bounds, `discount_type` enum).
  - Follow-ups: object-level authorization (BOLA) across `:id` routes remains a separate checklist item.

- [x] Audit file upload handling in `server/routes/items.js`
  - Files: `server/routes/items.js`, `server/lib/safeFilename.js`, **`server/routes/files.js`** (actual uploads)
  - Priority: High
  - Findings:
    - **`server/routes/items.js` has no multipart/file upload.** Inventory `photo_url` is a string (typically a path to `/api/files/...` after upload elsewhere). POST/PUT use parameterized SQL throughout.
    - **`server/routes/files.js`**: `multer` disk storage, **50MB** cap, **20** files per request; stored names are **random hex + original extension**; magic-byte `detectMime` + allowlist / settings-based types; unsupported files unlinked before response.
    - **`safeFilename`**: used in **`server/index.js`** / **`server/api/v1.js`** for **download** `Content-Disposition`, not in `items.js` (strips control chars, quotes, backslash; length cap).

- [x] Audit `server/routes/auth.js`
  - Files: `server/routes/auth.js`
  - Priority: High
  - Findings / fixes applied:
    - **Passwords**: `bcryptjs` with cost factor 10 on setup/reset/dev-login; min length 8 on setup/reset.
    - **Login**: math challenge + optional reCAPTCHA; **IP-based** brute-force window (5 failures / 15 min) via `login_attempts`; generic 401 on bad password.
    - **Forgot/reset**: 32-byte hex tokens, 1h expiry, single-use (`used`); forgot response does not enumerate accounts.
    - **JWT**: tokens now explicitly **HS256** on sign; **`GET /me`** verifies with **`algorithms: ['HS256']`** to match `authMiddleware`.
    - **test-mail**: behind auth + operator; per-IP rate cap (5/min).
  - Follow-ups: `SECRET()` still mirrors legacy `JWT_SECRET || 'change-me'` (startup should enforce in prod); consider `maxLength` on email/password bodies.

- [x] Audit `server/routes/messages.js`
  - Files: `server/routes/messages.js`
  - Priority: High
  - Findings / fixes applied:
    - **GET list**: now validates `quote_id` as positive int; if omitted, listing *all* messages is restricted to **operator/admin** (prevents broad message exfiltration for non-privileged accounts). Added `limit`/`offset` paging + `direction` allowlist.
    - **POST create**: validates `quote_id`, `reply_to_id`, caps `body_text`/`subject` lengths, validates/sanitizes `links` and `attachments` shape (positive `file_id`, name length), caps `rich_payload` size; SQL remains parameterized.
    - **PUT read / DELETE**: validates `:id` as positive int and returns 404 when not found.
  - Follow-ups: consider object-level authorization checks tying quotes/messages to user accounts if multi-tenant is introduced.

- [x] Audit DOMPurify usage in `client/src/pages/PublicQuotePage.jsx`
  - Files: `client/src/pages/PublicQuotePage.jsx`, `client/src/components/public-quote/PublicQuoteContractView.jsx`, `client/src/lib/sanitizeHtml.js`, `client/src/components/messages/MessageBody.jsx`
  - Priority: High
  - Findings / fixes applied:
    - **Bug fix**: `PublicQuotePage.jsx` used `DOMPurify.sanitize` **without importing DOMPurify** (would throw at runtime when contract HTML rendered). Contract HTML sanitization is now centralized in **`sanitizeContractHtml()`** (`client/src/lib/sanitizeHtml.js`) and used by both standard and contract views.
    - **Message threads**: `MessageBody` previously injected raw `body_html` into an iframe `srcDoc`; it now runs **`sanitizeMessageBodyHtml()`** (DOMPurify with a slightly broader allowlist for email-like content, still no script/style by default).
    - **Rich messages / plain text**: unchanged; `RichMessageRenderer` uses structured React rendering; plain text uses `autoLink` (no raw HTML).
  - Follow-ups: consider tightening `RichMessageRenderer` external URLs (`imageUrl` / `ctaUrl`) if untrusted payloads become possible.

---

## Security Improvements (recommended for next release)

Source references:
- Express “Production Best Practices: Security” (`https://expressjs.com/en/advanced/best-practice-security.html`)
- OWASP API Security Top 10 (2023) (`https://owasp.org/API-Security/editions/2023/en/0x11-t10/`)
- Existing internal audit: `SECURITY_AUDIT.md`, `AI/reports/code-audit.md`

### Audit snapshot (2026-03-29)

Observed dependency findings via `npm audit` (root + client + server):

- **Server**:
  - **Patched by `npm audit fix`** (confirmed resolved): `multer`, `nodemailer`, `path-to-regexp`, `brace-expansion`, `mailparser`, `imapflow` (lockfile updates).
  - **Remaining (no fix available)**: **`xlsx` (high)** — used by `server/routes/sheets.js` and `server/routes/leads.js` for spreadsheet parsing; advisories include prototype pollution and ReDoS.
- **Client**:
  - **`vite` / `esbuild` (moderate)** — dev-server related advisory; fix requires **breaking major upgrade** (`npm audit fix --force` → Vite 8+).
- **Root**:
  - **`pkg` (moderate)** — build-time tooling advisory; no npm fix available.

Implications:
- Prioritize **`xlsx` removal/replacement** or add compensating controls (strict auth + size/rate limits) around spreadsheet upload/parse endpoints.
- Treat Vite/esbuild as **dev-only exposure**; mitigate operationally (don’t browse untrusted sites while dev server runs; don’t expose dev server to LAN) until a planned upgrade.
- Treat `pkg` as **build-time** risk; ensure CI/build runners are locked down.

### P0 — Must do (abuse/compromise prevention)

- [x] **Add API-wide rate limiting + tighter per-route limits**
  - **Why**: Protect against OWASP API4 (Unrestricted Resource Consumption) + API6 (Sensitive business flows).
  - **Where**: `server/index.js` (global), and stricter limits on token-mutation + auth endpoints.
  - **Notes**: Use a production-safe store (Redis) if multi-instance; avoid in-memory only.
  - **Done (baseline)**:
    - **Global**: all `/api/*` requests (except `OPTIONS` and `GET /api/health`, `GET /api/v1/health`) limited per client IP — default **600 requests / 60s** (`API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX`).
    - **Auth POST**: `login`, `forgot`, `reset`, `setup`, `dev-login` on **`/api/auth/*` and `/api/v1/auth/*`** — default **60 / 15 min** per IP per path (`API_AUTH_RATE_LIMIT_WINDOW_MS`, `API_AUTH_RATE_LIMIT_MAX`).
    - Existing per-route limits remain for public-token quote/file flows (see public routes audit above).
  - **Follow-up**: shared store when horizontally scaling; optional tighter caps on upload/parse routes (`/api/sheets`, `/api/admin/db/import`).

- [x] **Remove/forbid bearer tokens in query strings everywhere**
  - **Why**: Prevent credential leakage via logs/referrers/history; aligns with best practices.
  - **Where**: `server/index.js`, `server/api/v1.js` file serve; `client/src/api.js` + call sites.
  - **Done**: Removed `?token=` JWT from file serve; client **`api.fileServeUrl`** now returns cached **signed** paths after **`api.prefetchFileServeUrls`**. New routes: **`POST /api/files/serve-links`**, **`GET /api/files/:id/serve-link`** (also under `/api/v1/files/...` via shared router).
  - **Note**: Password-reset links still use `?token=` on the **SPA route** `/reset?token=…` (opaque DB token, not JWT) — different risk profile.

- [ ] **Enforce object-level authorization checks on all ID-based endpoints**
  - **Why**: OWASP API1 (BOLA) / API5 (Function-level authorization).
  - **Where**: All routes accepting `:id` (quotes/files/items/leads/messages/vendors/templates/etc.).
  - **Output**: Document per-route access rules and add a consistent “canAccessX(user, xId)” pattern.
  - **Progress (2026-03-31)**:
    - **Tenant foundation added** (single-tenant default, enables real BOLA later):
      - New migration `server/db/migrations/orgs.js`: creates `orgs` (default org id=1) and adds `org_id` columns (default 1) to `users`, `quotes`, `items`, `vendors`, `leads`, `files`, `messages`.
    - **Scoped high-risk routes to org_id** (prevents cross-tenant leakage once multi-tenant exists):
      - `server/routes/files.js`: list/upload/delete + signed serve-link endpoints now require `files.org_id = 1`.
      - `server/routes/messages.js`: list/create/unread-count/read/delete now require `messages.org_id = 1`; create also requires `quotes.org_id = 1`.
    - Tightened **function-level access** where UI expects operator/admin:
      - `server/index.js`: `/api/vendors` and `/api/updates` now require **operator/admin**.
  - **More progress (2026-03-31)**:
    - Quotes service layer now enforces `org_id = 1` at read/write boundaries:
      - `server/db/queries/quotes.js`, `server/services/quoteCoreService.js`, `server/services/quoteListService.js`, `server/services/quoteService.js`, plus quote item/section/custom-item services.
    - Leads/items/vendors now scope to `org_id = 1`:
      - `server/db/queries/leads.js`, `server/services/leadService.js`
      - `server/db/queries/items.js`, `server/services/itemService.js`
      - `server/routes/vendors.js`
  - **Remaining**: propagate scoping to remaining routers/services that query by bare `id` (notably `availability`, `templates` groups like `payment_policies`/`rental_terms`/`contract_templates`, and any future multi-tenant admin/user management).

- [ ] **Harden public-token endpoints against automation**
  - **Why**: OWASP API6 + API4. Public approve/sign/message are inherently sensitive flows.
  - **Where**: token-based endpoints in `server/index.js` and any v1 equivalents.
  - **Notes**: Add rate limits per token + per IP, and strong state-transition guards (409 on invalid states).

- [ ] **Remove/replace `xlsx` to eliminate high-severity advisories**
  - **Why**: Current `xlsx` has known prototype pollution + ReDoS advisories with **no fix available** via npm.
  - **Where**: `server/routes/sheets.js`, `server/routes/leads.js`
  - **Approach**:
    - Prefer a maintained library (e.g. `exceljs`) for `.xlsx` reading, or constrain supported formats to `.csv` only.
    - Add strict size limits + row/column caps + timeouts around parsing regardless of library choice.

### P1 — High priority (security posture hardening)

- [ ] **Add security headers with Helmet**
  - **Why**: Express recommends Helmet for baseline header hardening.
  - **Where**: `server/index.js` (install + configure).
  - **Notes**: Include at least `frameguard`, `noSniff`, `referrerPolicy`; add CSP if feasible for your SPA.

- [ ] **Add/verify `app.disable('x-powered-by')`**
  - **Why**: Reduce fingerprinting (Express best practices).
  - **Where**: `server/index.js`

- [ ] **Set `trust proxy` explicitly when deployed behind a reverse proxy**
  - **Why**: Rate limiting and audit IP attribution rely on `req.ip` / `x-forwarded-for`.
  - **Where**: `server/index.js`
  - **Notes**: If enabled, document the proxy topology so spoofing doesn’t bypass controls.

- [ ] **Input validation at API boundaries**
  - **Why**: OWASP API2/API8; prevent type/bounds issues and “mass assignment” style bugs.
  - **Where**: High-value mutation endpoints: `server/routes/quotes.js`, `server/routes/files.js`, `server/routes/messages.js`, `server/routes/settings.js`, `server/routes/auth.js`.
  - **Notes**: Define allowlists for writable fields; reject unknown fields; validate numeric bounds/enums.

- [ ] **Centralize and standardize error handling (no stack traces to clients)**
  - **Why**: OWASP API8 (Security Misconfiguration) + safer operational posture.
  - **Where**: add Express 404 + error middleware in `server/index.js`, ensure consistent JSON envelope.

### P2 — Medium priority (defense-in-depth / operations)

- [ ] **Dependency security process**
  - **Why**: Express best practice: “Ensure your dependencies are secure.”
  - **Where**: root, `server/`, `client/`
  - **Tasks**:
    - add scheduled `npm audit` / `bun audit` checks in CI
    - track/resolve known advisories (server upload stack, parsers, etc.)
    - document exceptions with rationale (e.g. `pkg` build-time only; Vite dev-only; `xlsx` until replaced)

- [ ] **Plan Vite upgrade to clear `esbuild` dev-server advisory**
  - **Why**: `vite` currently pins vulnerable `esbuild` in audit output; fix requires major upgrade.
  - **Where**: `client/package.json`, `client/vite.config.js`, `client/src/*`
  - **Notes**: Do this as a dedicated change with smoke tests; avoid `--force` upgrade without migration.

- [ ] **File upload constraints review**
  - **Why**: Reduce risk of storing/serving dangerous content; OWASP API8.
  - **Where**: `server/routes/files.js` and any other upload paths
  - **Notes**: Enforce allowlisted types + magic-byte checks; cap counts/sizes; quarantine unknown types; consider AV scanning if threat model requires it.

- [ ] **SSRF hardening for proxy routes**
  - **Why**: OWASP API7 (SSRF).
  - **Where**: `server/lib/imageProxy.js`, any future fetch/proxy endpoints
  - **Notes**: Strict hostname allowlist rules, block private IP ranges, and validate URL parsing.

- [ ] **Security logging / audit trail improvements**
  - **Why**: Detect abuse and aid incident response.
  - **Where**: auth endpoints, public-token mutations, file serve, permission failures.
  - **Notes**: Log request ids, actor type (JWT vs extension), and scoped object ids (avoid logging secrets/tokens).

### P3 — Low priority / strategic

- [ ] **Auth token storage strategy review**
  - **Why**: SPA localStorage tokens are vulnerable to XSS; consider httpOnly cookies + CSRF if needed.
  - **Where**: `client/src/api.js`, `server/lib/authMiddleware.js`
  - **Notes**: Only if your deployment threat model requires it; document trade-offs clearly.


### BACKEND — Scalability

- [ ] N+1 query audit in `server/routes/quotes.js`
  - Look for queries inside loops, multiple queries where one JOIN would do
  - Files: `server/routes/quotes.js`
  - Priority: High

- [ ] Check for missing DB indexes in `server/db.js`
  - Look for CREATE INDEX statements. Are quote_id, item_id, status, event_date indexed?
  - Files: `server/db.js`
  - Priority: High

- [ ] Audit pagination in all list endpoints
  - Verify limit/offset is applied before returning results
  - Files: `server/routes/items.js`, `server/routes/quotes.js`, `server/routes/leads.js`
  - Priority: Medium

- [ ] Audit `server/routes/availability.js`
  - Conflict detection query — check for full table scans
  - Files: `server/routes/availability.js`
  - Priority: Medium

- [ ] Audit `server/routes/stats.js`
  - Check for aggregate queries that scan entire tables without date/limit constraints
  - Files: `server/routes/stats.js`
  - Priority: Medium

- [ ] Check service layer separation in `server/routes/quotes.js`
  - Flag business logic that lives in route handlers and should be in a service module
  - Files: `server/routes/quotes.js`
  - Priority: Medium

### FRONTEND — Architecture

- [ ] Audit `client/src/pages/QuoteDetailPage.jsx` (~1550 lines)
  - Flag distinct concerns that should be extracted to sub-components
  - Identify state that could be lifted or simplified
  - Files: `client/src/pages/QuoteDetailPage.jsx`
  - Priority: Medium

- [ ] Audit `client/src/components/QuoteBuilder.jsx` (~1060 lines)
  - Flag extraction opportunities
  - Check for missing useCallback/useMemo on handlers passed as props
  - Files: `client/src/components/QuoteBuilder.jsx`
  - Priority: Medium

- [ ] Audit `client/src/api.js`
  - Error handling consistency — are all errors propagated correctly?
  - Are there any fetch calls without error handling?
  - Files: `client/src/api.js`
  - Priority: Medium

- [ ] Audit memory leak risks
  - Check useEffect cleanups for timers, intervals, polling (PublicQuotePage polls every 8s)
  - Files: `client/src/pages/PublicQuotePage.jsx`, `client/src/pages/QuoteDetailPage.jsx`
  - Priority: Medium

- [ ] Check for XSS via dangerouslySetInnerHTML
  - Any use of innerHTML or dangerouslySetInnerHTML without sanitization?
  - Files: all JSX files
  - Priority: High

### DESIGN — UI System

- [ ] Audit `client/src/theme.css`
  - Are all 4 themes complete? Are there missing variable definitions in some themes?
  - Files: `client/src/theme.css`
  - Priority: Low

- [ ] Scan all `*.module.css` files for hardcoded color/font/spacing values
  - Flag any hex colors, px font sizes, or margin values not using CSS variables
  - Files: `client/src/components/*.module.css`, `client/src/pages/*.module.css`
  - Priority: Low

- [ ] Check z-index consistency across all module files
  - Files: all `*.module.css`
  - Priority: Low

### MAINTAINABILITY

- [ ] Find duplicated price calculation logic
  - `computeTotals` exists in PublicQuotePage — is it duplicated from QuoteDetailPage?
  - Files: `client/src/pages/QuoteDetailPage.jsx`, `client/src/pages/PublicQuotePage.jsx`
  - Priority: Medium

- [ ] Find and flag all `console.log` in server code
  - These should be removed or replaced with structured logging
  - Files: all `server/` files
  - Priority: Low

- [ ] Find commented-out code blocks
  - Flag for removal or documentation
  - Files: all files
  - Priority: Low

### DX / OBSERVABILITY

- [ ] Audit `package.json` scripts across root, client, server
  - Are lint and test scripts present?
  - Files: `package.json`, `client/package.json`, `server/package.json`
  - Priority: Low

- [ ] Check global error handling in `server/index.js`
  - Is there an Express error middleware (4-arg function)?
  - Are `unhandledRejection` and `uncaughtException` handled?
  - Files: `server/index.js`
  - Priority: Medium

- [ ] Audit `server/services/emailPoller.js`
  - Is the background service resilient to network errors and IMAP failures?
  - Files: `server/services/emailPoller.js`
  - Priority: Medium

- [ ] Check `.env` / environment variable documentation
  - Is there a `.env.example` file?
  - Files: root directory
  - Priority: Low

---

## Ready for Claude

- [ ] Architecture recommendation: service layer pattern for server routes
  - After Codex audit, Claude to write refactor plan for extracting service modules
  - Blocked by: Codex completing the audit

- [ ] Refactor plan for QuoteDetailPage.jsx
  - After Codex identifies the sub-components, Claude to write extraction plan
  - Blocked by: Codex completing the audit

---

## Ready for Cursor

- [ ] Apply UI fixes identified in Codex audit
  - Blocked by: Codex completing `AI/reports/code-audit.md`

- [ ] Polish and validate any CSS/layout findings
  - Blocked by: Codex completing `AI/reports/code-audit.md`

---

---

## WCAG Accessibility Overhaul — Remaining Items

*All items completed 2026-03-28.*

---

## UI Redesign — Wave 1 (complete ✅)

> Full plan: `AI/reports/redesign-plan.md`

- [x] Noir (dark) theme added as 5th theme — `data-theme="noir"` (2026-03-28)
- [x] 7 critical `flex-wrap` responsive fixes across action bars (2026-03-28)
- [x] `Layout.module.css` — `max-width: 1400px` on `.mainInner`; `padding: 28px 36px` on ≥1280px (2026-03-28)
- [x] `theme.css` — `.btn` refined: `justify-content: center`, `white-space: nowrap`, `box-shadow` transition, `8px 16px` padding (2026-03-28)
- [x] `theme.css` — typography scale utilities: `.page-title`, `.section-title`, `.card-label`, `.page-sub` (2026-03-28)
- [x] `StatsBar.module.css` — `width: 180px` → `flex: 0 1 180px; min-width: 100px`; value → `min-width: 36px` (2026-03-28)
- [x] `DashboardPage.module.css` — barLabel/barValue fixed widths → min/max-width + ellipsis (2026-03-28)
- [x] `BillingPage.module.css` — search `width: min(220px, 100%)`; table scroll-fade overlay (2026-03-28)

## UI Redesign — Wave 2 (complete ✅)

- [x] Typography pass — `clamp(18px, 2.2vw, 24px)` on all 13 page title rules; `letter-spacing: -0.02em; line-height: 1.2` (2026-03-28)
- [x] ImportPage stepper — 28→32px circles, glow ring on active, CSS variable colors, thicker connecting line (2026-03-28)
- [x] BillingPage — right-edge scroll-fade indicator on `.tableWrapper` (2026-03-28)
- [x] FilesPage — 480px breakpoint: count moves to top, viewSelect right-aligned (2026-03-28)
- [x] QuoteBuilder mobile — already handled (2-col grid, toolbar wrap, pagination stack) — verified (2026-03-28)

## UI Redesign — Wave 3 (complete ✅)

- [ ] QuoteDetailPage component extraction — `QuoteSummaryPanel`, `QuoteContractPanel`, `QuoteFilesPanel`, `QuoteMessagesPanel` (deferred to Wave 5)
- [x] Mobile bottom tab bar for core nav (Home, Projects, Inventory, Messages, More) (2026-03-28)
- [x] Skeleton loaders on QuotePage — 6-card shimmer grid replaces spinner (2026-03-28)
- [x] Empty state upgrade on QuotePage — CTA button + filter-aware messaging (2026-03-28)

## UI Redesign — Wave 4 (complete ✅)

- [x] Skeleton loaders on StatsPage — 8 animated bar rows in card structure (2026-03-28)
- [x] Skeleton loaders on MessagesPage — 7 shimmer thread rows replace spinner (2026-03-28)
- [x] QuotePage header responsiveness — `.header` flex-wrap, `.headerActions` flex-wrap + gap fix (2026-03-28)

## Desktop Full-Screen Layout (complete ✅)

- [x] Removed `max-width: 1400px` from `.mainInner` — content fills full available width (2026-03-28)
- [x] Hidden top bar on desktop (≥769px) — all nav accessible via sidebar, recovers 44px vertical height (2026-03-28)
- [x] Added Extension/Help as top-level sidebar nav item for all users — previously hidden from non-operator users (2026-03-28)
- [x] Reduced 1280px+ main padding: `28px 36px` → `24px 32px` (2026-03-28)

## UI Redesign — Wave 5 (complete ✅)

- [x] QuoteDetailPage full-page loading skeleton — mirrors tab bar + header + two-column layout (2026-03-28)
- [x] BillingPage skeleton — overpaid table (5 rows) + history table (8 rows) replace both spinners (2026-03-28)
- [x] FilesPage skeleton — 12 shimmer tile cards matching grid layout (2026-03-28)
- [x] VendorsPage skeleton — 5 shimmer rows matching card list layout (2026-03-28)
- [x] SettingsPage skeleton — 3 cards each with label + 3 field rows (2026-03-28)
- [x] AdminPage skeleton — 2 cards with system info row structure (2026-03-28)
- [x] VendorsPage title — clamp typography to match system-wide standard (2026-03-28)

## UI Redesign — Wave 6 (complete ✅)

- [x] DashboardPage stat grid — `repeat(4, 1fr)` → `repeat(auto-fill, minmax(160px, 1fr))` — all 5 cards now show in one row on desktop (2026-03-28)
- [x] DashboardPage title — clamp typography to match system-wide standard (2026-03-28)
- [x] TemplatesPage — removed `max-width: 720px` page constraint (2026-03-28)
- [x] MessagesPage thread pane — `280px` → `300px` base, `360px` at ≥1280px (2026-03-28)
- [x] QuoteDetailPage right sidebar — `320px` base, `380px` at ≥1280px, `420px` at ≥1600px (2026-03-28)

## UI Redesign — Wave 7 (complete ✅)

- [x] LeadsPage two-pane desktop layout — table left, sticky activity timeline right (360px→420px) with empty state prompt (2026-03-28)
- [x] LeadsPage eventsLoading — spinner → 4 skeleton timeline rows (2026-03-28)
- [x] ItemDetailPage skeleton — mirrors 300px image col + info col grid (2026-03-28)
- [x] ItemDetailPage title — clamp typography (2026-03-28)
- [x] TemplatesPage skeleton — 2 skeleton cards with header + 3 list rows each (2026-03-28)

---

## API Improvements — E-Commerce Integration Readiness

*Added 2026-03-31. Based on full API audit for customer-facing React site (see `AI/Api/`).*

These are gaps between what the current API provides and what a WooCommerce-style customer site needs. Grouped by impact.

---

### P0 — Blockers (can't ship without these)

- [ ] **Add a public `POST /api/public/leads` endpoint (no auth)**
  - **Why**: The current `POST /api/leads` requires a Bearer JWT (operator role). A customer inquiry form running in a browser cannot safely hold a service token. Either add a no-auth version or add reCAPTCHA protection to the public endpoint.
  - **Where**: `server/routes/leads.js`, `server/routes/publicCatalog.js`
  - **Notes**: Rate-limit per IP (e.g. 10 leads / 10 min). Add honeypot field or reCAPTCHA check (settings already support `recaptcha_site_key`). Mirror the existing lead fields: `name`, `email`, `phone`, `event_date`, `event_type`, `notes`, `source_url`.
  - **Risk**: Without this, every customer site either exposes an operator JWT to the browser or requires a separate middleware proxy.

- [ ] **Outgoing webhooks system**
  - **Why**: No way for the e-commerce site to know when a quote is sent, approved, or confirmed without polling. This breaks any real-time order tracking or notification flow.
  - **Where**: New `server/routes/webhooks.js`, new DB tables (`webhook_endpoints`, `webhook_deliveries`)
  - **Suggested events**: `lead.created`, `quote.created`, `quote.status_changed`, `quote.approved_by_client`, `quote.contract_signed`, `quote.payment_added`, `message.received`
  - **Notes**: Full implementation plan in `AI/Api/webhooks-and-events.md` including schema, payload envelope, HMAC signing, and retry logic.
  - **Priority**: Required for any non-polling integration architecture.

---

### P1 — High impact (ship before launch)

- [ ] **Add `accessories` to `GET /api/public/items/:id` response**
  - **Why**: Product detail pages need "you might also need" / related items. Accessories are already modeled in `item_accessories` but not exposed in the public API.
  - **Where**: `server/routes/publicCatalog.js` — `GET /api/public/items/:id`
  - **Notes**: Return `accessories: [{ id, title, unit_price, photo_url, category }]`. Limit to 6. Only include non-hidden accessories.

- [ ] **Add `slug` field to items for SEO-friendly URLs**
  - **Why**: Customer site URLs like `/shop/item/42` are not SEO-friendly. `/shop/item/gold-chiavari-chair` is. Slugs need to be stable (generated from title, stored in DB).
  - **Where**: `server/db/schema/items.js`, `server/routes/items.js`, `server/routes/publicCatalog.js`
  - **Notes**: Add `slug TEXT UNIQUE` column. Generate on create/update from title (lowercase, hyphens, strip special chars). `GET /api/public/items/:idOrSlug` should resolve both. Add slug to sitemap URLs.

- [ ] **Expose WebP/AVIF variant URLs in public catalog responses**
  - **Why**: The public API returns a single `photo_url` signed URL but doesn't expose the WebP or AVIF variants the server already generates. Customer sites waste bandwidth using original formats.
  - **Where**: `server/routes/publicCatalog.js`
  - **Notes**: Add `photo_variants: { webp: "...", avif: "..." }` alongside `photo_url` (original). Only populate if the variant exists in `file_variants`.

- [ ] **Add public availability check endpoint**
  - **Why**: Customers want to know if items are available before requesting a quote. "Show items available on my date" is a standard e-commerce feature.
  - **Where**: New `GET /api/public/availability?item_id=7&start=2025-09-20&end=2025-09-20`
  - **Notes**: Returns `{ item_id, quantity_in_stock, reserved, available }`. Only count `confirmed` quotes in reserved (not draft/sent). Do not expose quote details. Rate-limit per IP.

- [ ] **Standardize API versioning across all routes**
  - **Why**: Some routes live under `/api/v1/` and some under `/api/`. A customer integration that pins to `/api/quotes` could break silently if routes migrate. The v1 prefix needs to be consistent.
  - **Where**: `server/index.js`, `server/api/v1.js`
  - **Notes**: Audit which routes are on `/api/*` vs `/api/v1/*`. Either commit all public-facing routes to `/api/v1/*` or document the `/api/*` routes as stable. Public catalog should be explicitly versioned.

---

### P2 — Medium impact (quality of life)

- [ ] **Add pagination metadata to `GET /api/public/items` response**
  - **Why**: The response includes `total` and the items array, but no `page`/`limit`/`offset` echo-back or `has_more` flag. Clients must track this themselves.
  - **Where**: `server/routes/publicCatalog.js`
  - **Notes**: Add `{ total, offset, limit, has_more: offset + items.length < total }` to response envelope.

- [ ] **Add `sort` param to `GET /api/public/items`**
  - **Why**: Currently always sorted by `category ASC, title ASC`. Customer sites often want "newest first", "price low→high", or "most popular".
  - **Where**: `server/routes/publicCatalog.js`
  - **Notes**: Allow `sort=price_asc`, `sort=price_desc`, `sort=name_asc`, `sort=newest`. Whitelist these values server-side; never interpolate raw query param into SQL.

- [ ] **Add `GET /api/public/categories` standalone endpoint**
  - **Why**: `/api/public/catalog-meta` returns categories + counts + company info all at once. A site that only needs the category list for nav rendering must over-fetch.
  - **Where**: `server/routes/publicCatalog.js`
  - **Notes**: `GET /api/public/categories` → `{ categories: [{ name, count }] }`. Simple and cacheable.

- [ ] **Support multiple images per item**
  - **Why**: Items currently have a single `photo_url`. A proper product detail page needs a gallery (main image + thumbnails).
  - **Where**: New `item_images` table (`item_id`, `file_id`, `sort_order`, `is_primary`). New endpoints: `GET /api/items/:id/images`, `POST /api/items/:id/images`, `DELETE /api/items/:id/images/:imageId`.
  - **Notes**: `photo_url` on the item becomes the primary image shortcut. Public API returns `images: [{ url, webp_url, sort_order }]`.

- [ ] **Add `featured` flag to items**
  - **Why**: E-commerce landing pages need a "featured items" or "popular rentals" section. Currently no way to curate this without using categories.
  - **Where**: Add `featured INTEGER DEFAULT 0` column to `items`. Add `GET /api/public/items?featured=1`.
  - **Notes**: Low effort, high-value for marketing pages.

- [ ] **Return `quantity_available` (not just `quantity_in_stock`) in public API**
  - **Why**: `quantity_in_stock` is the total physical count. Customers need to see how many are actually free to rent, which requires subtracting confirmed reservations. The current public API exposes raw stock, which could mislead.
  - **Where**: `server/routes/publicCatalog.js`
  - **Notes**: Availability check requires date range to be meaningful. Without a date param, return both fields: `quantity_in_stock` (total) and omit or null `quantity_reserved` to avoid confusion. Document clearly.

- [ ] **Add `GET /api/public/items?ids=1,2,3` batch fetch**
  - **Why**: After cart restoration (localStorage), the customer site needs to validate that all saved items still exist and fetch current prices. Calling `/api/public/items/:id` in a loop creates N requests.
  - **Where**: `server/routes/publicCatalog.js`
  - **Notes**: `?ids=1,2,3` → return array of items for those IDs (skip non-existent). Cap at 50 IDs per request.

---

### P3 — Nice to have (post-launch)

- [ ] **Add `GET /api/public/search` with relevance ranking**
  - **Why**: Current search is basic `LIKE` on title/description. For a large catalog, customers expect ranked results (title match > description match) and possibly typo tolerance.
  - **Where**: `server/routes/publicCatalog.js`
  - **Notes**: SQLite FTS5 full-text search (`CREATE VIRTUAL TABLE items_fts USING fts5(title, description)`) provides ranking. Not worth the added complexity until catalog exceeds ~500 items.

- [ ] **Expose rental term duration as structured data**
  - **Why**: Items are priced "per event" but some are priced per day. There's no machine-readable duration field — this is inferred from `description` text. E-commerce sites can't programmatically show "3-day rental" vs "single event".
  - **Where**: Add `pricing_unit TEXT DEFAULT 'event'` to `items` (`event` | `day` | `week` | `hour`). Expose in public API.

- [ ] **Add lead source tracking fields**
  - **Why**: `source_url` tracks the page, but not the UTM campaign, referrer, or how the customer found the business. Marketing attribution requires this.
  - **Where**: Add `utm_source`, `utm_medium`, `utm_campaign` columns to `leads`. Accept from the public lead form.
  - **Notes**: Pass from `URLSearchParams` on the e-commerce site: `?utm_source=google&utm_medium=cpc`.

- [ ] **Add a public quote status polling endpoint**
  - **Why**: The customer portal calls `GET /api/quotes/public/:token` which returns the entire quote payload on every poll. For a lightweight status indicator, this is heavy.
  - **Where**: New `GET /api/quotes/public/:token/status` → `{ status, updated_at, contract_signed, amount_paid, total }` only.
  - **Notes**: Reduces payload from ~50KB to <1KB for polling use cases. Rate limit: 30 req/min per IP.

---

### Developer Experience

- [ ] **Add `X-Request-ID` header to all API responses**
  - **Why**: Debugging integration issues across distributed logs is painful without a correlation ID.
  - **Where**: `server/index.js` middleware — generate UUID per request, attach to `req`, echo in response header and error bodies.

- [ ] **Standardize error response envelope**
  - **Why**: Current errors return `{ error: "message" }` inconsistently (some routes return different shapes). External integrations need a stable shape to parse.
  - **Where**: `server/index.js` global error handler + all route error responses.
  - **Notes**: Adopt: `{ error: { code: "NOT_FOUND", message: "Quote not found", request_id: "..." } }`. See existing P1 security TODO for centralized error handling.

- [ ] **Document all `event_type` values in `quote_activity_log`**
  - **Why**: `AI/Api/` docs list common values but the server never defines an enum. External integrations polling the activity log need a complete, stable list.
  - **Where**: `server/lib/quoteActivity.js` — define and export a `QUOTE_EVENT_TYPES` const. Reference in docs.

---

*Cross-reference: full API docs at `AI/Api/`. Full webhook architecture at `AI/Api/webhooks-and-events.md`.*

- [x] Claude scanned repository (2026-03-25)
- [x] `AI/CODE_AUDIT_PLAN.md` created (2026-03-25)
- [x] `AI/TODO.md` populated (2026-03-25)
- [x] `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` written (2026-03-25)
- [x] `AI/AI-System-Setup.md` written (2026-03-25)
- [x] WCAG accessibility overhaul — ~80 fixes across 30+ files (2026-03-28)
- [x] CSS theme system — replaced all hardcoded hex colors in module files with CSS vars (2026-03-28)
- [x] WCAG remaining items — arrows, labels, type="button", alt text (2026-03-28)
