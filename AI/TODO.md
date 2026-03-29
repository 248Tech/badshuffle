# TODO — Badshuffle Audit

Last updated: 2026-03-25
Current phase: Phase 2 — Code Audit

---

## In Progress

- [ ] Full codebase audit (assigned to Codex — see CODE_AUDIT_PLAN.md)

---

## Ready for Codex

### SECURITY (do first)

- [ ] Audit `server/lib/authMiddleware.js`
  - Check JWT verification logic, token expiry enforcement, error handling
  - Files: `server/lib/authMiddleware.js`
  - Priority: High

- [ ] Audit public routes in `server/index.js` (lines 130–270)
  - Verify no-auth routes are safe, CORS config is correct
  - Files: `server/index.js`
  - Priority: High

- [ ] Audit input validation in `server/routes/quotes.js`
  - Check all POST/PUT handlers: are inputs validated before DB writes?
  - Are parameterized queries used consistently?
  - Files: `server/routes/quotes.js`
  - Priority: High

- [ ] Audit file upload handling in `server/routes/items.js`
  - MIME type validation, size limits, filename sanitization
  - Files: `server/routes/items.js`, `server/lib/safeFilename.js`
  - Priority: High

- [ ] Audit `server/routes/auth.js`
  - Password hashing quality, brute force protection, reset token handling
  - Files: `server/routes/auth.js`
  - Priority: High

- [ ] Audit `server/routes/messages.js`
  - POST body validation, injection risk in new endpoint
  - Files: `server/routes/messages.js`
  - Priority: High

- [ ] Audit DOMPurify usage in `client/src/pages/PublicQuotePage.jsx`
  - Is all HTML content properly sanitized before render?
  - Files: `client/src/pages/PublicQuotePage.jsx`
  - Priority: High

---

## Security Improvements (recommended for next release)

Source references:
- Express “Production Best Practices: Security” (`https://expressjs.com/en/advanced/best-practice-security.html`)
- OWASP API Security Top 10 (2023) (`https://owasp.org/API-Security/editions/2023/en/0x11-t10/`)
- Existing internal audit: `SECURITY_AUDIT.md`, `AI/reports/code-audit.md`

### P0 — Must do (abuse/compromise prevention)

- [ ] **Add API-wide rate limiting + tighter per-route limits**
  - **Why**: Protect against OWASP API4 (Unrestricted Resource Consumption) + API6 (Sensitive business flows).
  - **Where**: `server/index.js` (global), and stricter limits on token-mutation + auth endpoints.
  - **Notes**: Use a production-safe store (Redis) if multi-instance; avoid in-memory only.

- [ ] **Remove/forbid bearer tokens in query strings everywhere**
  - **Why**: Prevent credential leakage via logs/referrers/history; aligns with best practices.
  - **Where**: `server/index.js` file serving currently reads `req.query.token` (verify and eliminate).
  - **Related**: Ensure client helpers never build token-bearing URLs.

- [ ] **Enforce object-level authorization checks on all ID-based endpoints**
  - **Why**: OWASP API1 (BOLA) / API5 (Function-level authorization).
  - **Where**: All routes accepting `:id` (quotes/files/items/leads/messages/vendors/templates/etc.).
  - **Output**: Document per-route access rules and add a consistent “canAccessX(user, xId)” pattern.

- [ ] **Harden public-token endpoints against automation**
  - **Why**: OWASP API6 + API4. Public approve/sign/message are inherently sensitive flows.
  - **Where**: token-based endpoints in `server/index.js` and any v1 equivalents.
  - **Notes**: Add rate limits per token + per IP, and strong state-transition guards (409 on invalid states).

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

## Done

- [x] Claude scanned repository (2026-03-25)
- [x] `AI/CODE_AUDIT_PLAN.md` created (2026-03-25)
- [x] `AI/TODO.md` populated (2026-03-25)
- [x] `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` written (2026-03-25)
- [x] `AI/AI-System-Setup.md` written (2026-03-25)
- [x] WCAG accessibility overhaul — ~80 fixes across 30+ files (2026-03-28)
- [x] CSS theme system — replaced all hardcoded hex colors in module files with CSS vars (2026-03-28)
- [x] WCAG remaining items — arrows, labels, type="button", alt text (2026-03-28)
