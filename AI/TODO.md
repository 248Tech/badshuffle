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

## Done

- [x] Claude scanned repository (2026-03-25)
- [x] `AI/CODE_AUDIT_PLAN.md` created (2026-03-25)
- [x] `AI/TODO.md` populated (2026-03-25)
- [x] `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` written (2026-03-25)
- [x] `AI/AI-System-Setup.md` written (2026-03-25)
