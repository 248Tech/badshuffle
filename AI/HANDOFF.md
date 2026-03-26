# HANDOFF

---

## 2026-03-25 — Claude → Codex

**Phase completed:** Phase 1 (Planning)
**Next phase:** Phase 2 (Code Audit)
**Next agent:** Codex

---

### What was done

1. Scanned the full Badshuffle repository structure
2. Created `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` — the audit system prompt (canonical reference)
3. Created `AI/AI-System-Setup.md` — the multi-agent workflow documentation
4. Created `AI/CODE_AUDIT_PLAN.md` — division-based audit plan with real file targets and line estimates
5. Created `AI/TODO.md` — full task list routed to Codex, prioritized by risk

---

### Critical findings to prioritize (from static analysis)

1. `server/routes/quotes.js` is ~960 lines — likely has business logic mixed into route handlers
2. `client/src/pages/QuoteDetailPage.jsx` is ~1550 lines — almost certainly needs decomposition
3. Public routes in `server/index.js` (lines 130–270) have no auth — need validation audit
4. `client/src/pages/PublicQuotePage.jsx` uses DOMPurify — verify all HTML inputs are sanitized
5. sql.js (synchronous WASM SQLite) — check for missing parameterized queries
6. No evidence of DB indexes — check for CREATE INDEX on hot columns

---

### Instructions for Codex

1. Read `AI/CODE_AUDIT_PLAN.md` in full
2. Read `AI/TODO.md` — work through tasks in order (Security first)
3. Write ALL findings to `AI/reports/code-audit.md` using the strict format defined in `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md`
4. When audit is complete, update this file (`AI/HANDOFF.md`) with:
   - Files reviewed
   - Critical findings summary
   - Next recommended agent (Cursor)

---

### Repo structure summary

```
badshuffle/
├── client/src/
│   ├── pages/          — 26 page components (React)
│   ├── components/     — 17 shared components
│   ├── api.js          — API client (fetch-based)
│   ├── theme.css       — Global CSS variables + 4 themes
│   └── App.jsx         — Router setup
├── server/
│   ├── index.js        — Express setup + public routes
│   ├── db.js           — sql.js wrapper + DB migrations
│   ├── routes/         — 15 route modules
│   ├── services/       — emailPoller, singleInstance, updateCheck
│   └── lib/            — authMiddleware, adminMiddleware, imageProxy, safeFilename
├── extension/          — Chrome MV3 extension (out of scope)
└── AI/                 — This folder (agent coordination)
```

---

*This file will be updated by each agent as work progresses.*

---

## 2026-03-25 — Codex → Cursor

**Phase completed:** Phase 2 (Code Audit, Security division)
**Next phase:** Phase 3 (Refinement / validation)
**Next agent:** Cursor

### What was done

1. Read `AI/CODE_AUDIT_PLAN.md`, `AI/TODO.md`, and `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md`
2. Audited the Security division targets in:
   - `server/lib/authMiddleware.js`
   - `server/index.js`
   - `server/routes/auth.js`
   - `server/routes/messages.js`
   - `server/routes/quotes.js`
   - `server/routes/items.js`
   - `server/routes/files.js`
   - `server/lib/fileServeAuth.js`
   - `client/src/pages/PublicQuotePage.jsx`
3. Wrote the Security findings to `AI/reports/code-audit.md` in the required issue format

### Critical findings summary

1. JWT and signed file URLs fall back to the predictable secret `change-me` when `JWT_SECRET` is unset
2. `x-extension-token` currently bypasses normal auth for most protected routes, not just narrowly scoped extension actions
3. `/api/files/:id/serve` grants access with any valid JWT and also accepts bearer tokens in the query string
4. `/api/quotes/public/:token` returns the full quote row, exposing more data than a public endpoint should
5. Public quote mutation routes lack rate limiting and strong state validation
6. The actual upload implementation in `server/routes/files.js` stores arbitrary files without MIME/content validation
7. `POST /api/quotes/:id/send` can attach unrelated uploaded files by arbitrary ID

### Notes for the next agent

1. `server/routes/items.js` no longer contains upload handling; the live upload path is `server/routes/files.js`
2. `client/src/pages/PublicQuotePage.jsx` sanitizes `contract.body_html` with DOMPurify; I did not find an immediate XSS bug there in this pass
3. The next audit pass should continue with Backend/Scalability or validate these security findings before implementation work

---

## 2026-03-25 — Cursor → Next agent

**Phase completed:** Phase 3 (Security fix implementation)
**Next phase:** Phase 4 (Backend/Scalability audit or Frontend audit)
**Next agent:** Codex or Claude

### What was done

All 7 High-priority security findings from `AI/reports/code-audit.md` were validated against source and fixed:

1. **JWT fallback secret** (`server/lib/authMiddleware.js`)
   - Replaced inline `process.env.JWT_SECRET || 'change-me'` with `getSecret()` function
   - Dev: warns once to console, returns fallback; Production: throws immediately
   - `server/index.js` startup check already blocks production with missing secret

2. **Extension token bypass** (`server/lib/authMiddleware.js` + `server/index.js`)
   - `requireAuth` now accepts `options.allowExtension` (default: `false`)
   - Only `/api/items` and `/api/sheets` pass `{ allowExtension: true }` — all other routes are JWT-only

3. **File serve: token in query string** (`server/index.js:110`)
   - Removed `req.query.token` fallback — bearer only accepted via `Authorization` header
   - Signed URL path (`sig` + `exp`) retained for public quote image rendering

4. **Public quote `SELECT *`** (`server/index.js:132`)
   - Replaced with explicit column list: only client-safe fields (no `lead_id`, `public_token`, internal flags)

5. **Approve-by-token: no status guard** (`server/index.js:203`)
   - Added pre-check: returns `409` if `quote.status !== 'sent'`
   - UPDATE now uses `WHERE id = ? AND status = 'sent'` as a double guard

6. **File upload: no MIME/content validation** (`server/routes/files.js`)
   - Added magic-byte detection (no new dependency) for JPEG, PNG, GIF, WebP, PDF
   - Files not matching any signature are deleted and the upload returns `400`
   - Stored `mime_type` now reflects detected type, not browser-supplied header

7. **Quote send: unscoped attachment IDs** (`server/routes/quotes.js:559`)
   - Attachment query now JOINs `quote_attachments` — only files linked to the quote ID are attached
   - Unrecognized IDs are silently skipped (no information leak)

### Remaining issues (not implemented)

- **Rate limiting on public token endpoints** — approve, sign, message routes have no request throttling. Needs a rate-limiting middleware (e.g. `express-rate-limit`). Not implemented: introduces a new dependency and requires deciding on storage (memory vs Redis).
- **Input type/bounds validation on quote write endpoints** — `quantity`, `discount_amount`, `discount_type` etc. accept unvalidated values. Medium priority per audit. Not implemented in this pass.
- **Backend/Scalability division** — N+1 queries in `quotes.js`, missing DB indexes in `db.js`, unbounded list endpoints. Not yet audited.
- **Frontend/Architecture division** — `QuoteDetailPage.jsx` (~1550 lines), `QuoteBuilder.jsx` (~1060 lines) decomposition. Not yet audited.

### Files modified in this phase

- `server/lib/authMiddleware.js`
- `server/index.js`
- `server/routes/files.js`
- `server/routes/quotes.js`

---

## 2026-03-25 — Codex → Claude

**Phase completed:** Phase 4 (Backend/Scalability + Frontend/Architecture audit)
**Next phase:** Phase 5 (Architecture refactor planning)
**Next agent:** Claude

### What was done

1. Read `AI/PHASE4_CODEX_PROMPT.md`, `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md`, `AI/HANDOFF.md`, and the existing `AI/reports/code-audit.md`
2. Audited:
   - `server/routes/quotes.js`
   - `server/db.js`
   - `server/routes/items.js`
   - `server/routes/leads.js`
   - `server/routes/availability.js`
   - `server/routes/stats.js`
   - `client/src/pages/QuoteDetailPage.jsx`
   - `client/src/components/QuoteBuilder.jsx`
   - `client/src/api.js`
   - `client/src/pages/PublicQuotePage.jsx`
3. Appended Backend/Scalability, Frontend/Architecture, and Maintainability findings to `AI/reports/code-audit.md`

### Finding summary

Backend / Scalability:
1. `GET /api/quotes` is both unbounded and N+1 because totals are computed with two extra queries per quote row
2. `GET /api/quotes/summary` loads and aggregates the full quotes table in JavaScript
3. `server/db.js` is missing indexes for the main quote/item/message/payment foreign keys and sort columns
4. `server/routes/availability.js` does candidate scanning and overlap/conflict detection in nested in-memory loops
5. `server/routes/stats.js` returns the full stats table with no pagination or filter window
6. `server/routes/quotes.js` contains multi-step business orchestration that should move to services

Frontend / Architecture:
1. `QuoteDetailPage.jsx` is a 1,837-line monolith with at least nine distinct concerns and root-level state coupling
2. `QuoteBuilder.jsx` is a 1,062-line monolith combining quote lines, adjustments, inventory search/pagination, and modal editing
3. `client/src/api.js` has inconsistent error handling because several endpoints bypass the shared request helpers
4. Price/total calculation logic is duplicated between `QuoteDetailPage.jsx` and `PublicQuotePage.jsx`

Maintainability:
1. `QuoteDetailPage.jsx` embeds reusable modal/helper components inline instead of moving them to dedicated modules

### Instructions for Claude

1. Read `AI/reports/code-audit.md` — Backend/Scalability and Frontend/Architecture sections
2. Write a service layer extraction plan for `server/routes/quotes.js`
   - Identify which logic moves to which service module
   - Define module names, function signatures, and dependency flow
3. Write a component decomposition plan for `client/src/pages/QuoteDetailPage.jsx`
   - Map each concern to a named sub-component
   - Define props interface for each
   - Identify shared state and how it flows
4. Write a component decomposition plan for `client/src/components/QuoteBuilder.jsx`
   - Same structure as above
5. Write all plans to `AI/reports/refactor-plan.md`
6. Update `AI/HANDOFF.md` when done

---

## 2026-03-25 — Claude → Next agent

**Phase completed:** Phase 5 (Architecture refactor planning)
**Next phase:** Phase 6 (Refactor implementation)
**Next agent:** Codex (backend steps 1–3) + Cursor (frontend steps 4–7) — can run in parallel

### What was done

Produced `AI/reports/refactor-plan.md` with four complete refactor plans based on Phase 4 audit findings:

1. **Service layer extraction** (`server/routes/quotes.js`)
   - `server/lib/quoteActivity.js` — extracted `logActivity` inner function (called in ~15 places)
   - `server/services/itemStatsService.js` — `upsertItemStats(db, itemId, guestCount)` with usage bracket logic
   - `server/services/quoteService.js` — `sendQuote`, `duplicateQuote`, `transitionQuoteStatus` with full function signatures

2. **QuoteDetailPage decomposition** (`client/src/pages/QuoteDetailPage.jsx`, 1837 lines → ~180 lines)
   - `hooks/useQuoteDetail.js` — shared state hook with exact state inventory (shared vs. colocated)
   - `QuoteToolbar.jsx`, `QuoteOverviewTab.jsx`, `QuoteBillingTab.jsx`, `QuoteFilesTab.jsx`, `QuoteActivityTab.jsx`
   - Move 3 inline components to `components/`: `QuoteFilePicker`, `ImagePicker`, `QuoteSendModal`
   - Props interfaces defined for every component

3. **QuoteBuilder decomposition** (`client/src/components/QuoteBuilder.jsx`, 1062 lines → ~60 lines)
   - `QuoteLineItemsPanel.jsx`, `QuoteAdjustmentsPanel.jsx`, `InventoryPickerPanel.jsx`
   - Move `QuoteItemEditModal` to `components/` (already discrete block)
   - `useCallback` memoization requirements called out

4. **Shared pricing utility** (`client/src/lib/quoteTotals.js`)
   - Canonical implementation of `effectivePrice`, `computeAdjustmentsTotal`, `computeTotals`
   - Replaces duplicated code in both `QuoteDetailPage.jsx` and `PublicQuotePage.jsx`

### Recommended next steps (from plan section 5)

Backend and frontend work is independent and can run in parallel:

**Codex (backend):**
- Step 1: Extract `quoteActivity.js`
- Step 2: Extract `itemStatsService.js`
- Step 3: Extract `quoteService.js` (sendQuote, duplicateQuote, transitionQuoteStatus)
- Reference: `AI/reports/refactor-plan.md` §1

**Cursor (frontend):**
- Step 1: Create `client/src/lib/quoteTotals.js`, delete duplicated functions from both pages
- Step 2: Extract inline components from QuoteDetailPage (`QuoteFilePicker`, `ImagePicker`, `QuoteSendModal`)
- Step 3: Extract QuoteBuilder subpanels
- Step 4: Build `useQuoteDetail` hook and reduce QuoteDetailPage
- Reference: `AI/reports/refactor-plan.md` §2–4

---

## 2026-03-25 — Codex → Claude

**Phase completed:** Phase 5 (Maintainability and Code Quality audit)
**Next phase:** Phase 6 (Refactor planning or implementation sequencing)
**Next agent:** Claude

### What was done
1. Read `AI/BEGIN-PHASE-5.md`, `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md`, `AI/CODE_AUDIT_PLAN.md`, `AI/HANDOFF.md`, and existing `AI/reports/code-audit.md`
2. Audited:
   - `server/routes/quotes.js`
   - `server/db.js`
   - `client/src/pages/QuoteDetailPage.jsx`
   - `client/src/pages/PublicQuotePage.jsx`
3. Appended Maintainability and Code Quality findings to `AI/reports/code-audit.md`

### Finding summary
1. `server/routes/quotes.js` hand-codes quote lifecycle transitions across multiple routes, and the side effects have already drifted between send/approve/confirm/close/revert
2. `server/routes/quotes.js` duplicates line-item audit-string generation and unsigned-change handling across item and custom-item mutation paths
3. `server/routes/quotes.js` keeps item analytics updates (`item_stats`, `usage_brackets`) inline in the route instead of a shared domain service
4. `server/db.js` has become an unversioned append-only migration script with silent `try/catch` failures
5. `client/src/pages/QuoteDetailPage.jsx` duplicates file-library loading across inline modal helpers

### Instructions for Claude
1. Read the new `## Maintainability and Code Quality` section in `AI/reports/code-audit.md`
2. Consolidate the new maintainability findings with `AI/reports/refactor-plan.md`
3. Decide which extractions should happen first to reduce merge risk:
   - `quoteService` transition flow
   - `quoteActivity`/line-item snapshot helpers
   - `itemStatsService`
   - versioned DB migration runner
   - shared file-library hook for QuoteDetailPage modals
4. Update `AI/HANDOFF.md` with the next implementation-ready sequence

---

## 2026-03-25 — Codex → Cursor

**Phase completed:** Phase 6A (Backend refactor implementation)
**Next phase:** Phase 6B (Frontend refactor implementation)
**Next agent:** Cursor

### What was done
1. Implemented `server/lib/quoteActivity.js`
   - extracted `logActivity`
   - extracted `markUnsignedChangesIfApproved`
   - added `buildQuoteItemSnapshot` and `buildCustomItemSnapshot`
2. Implemented `server/services/itemStatsService.js`
   - moved `item_stats` and `usage_brackets` bookkeeping out of `POST /api/quotes/:id/items`
3. Implemented `server/services/quoteService.js`
   - extracted `sendQuote`
   - extracted `duplicateQuote`
   - extracted `transitionQuoteStatus`
4. Updated `server/routes/quotes.js`
   - route handlers now call the extracted helpers/services
   - preserved existing response shapes and broad approve/revert behavior
   - reused snapshot helpers for item/custom-item activity logs

### Verification
1. Ran syntax checks:
   - `node --check server/routes/quotes.js`
   - `node --check server/lib/quoteActivity.js`
   - `node --check server/services/itemStatsService.js`
   - `node --check server/services/quoteService.js`
2. Ran a require-time smoke check:
   - `node -e "const makeRouter=require('./server/routes/quotes.js'); console.log(typeof makeRouter)"`
3. No automated test suite exists in `server/package.json`

### Remaining work
1. Phase 6B frontend refactor still needs to land:
   - shared `quoteTotals` utility
   - QuoteDetail inline component extraction
   - QuoteBuilder subpanel extraction
   - `useQuoteDetail` hook
2. The versioned DB migration runner discussed in Phase 5 was not implemented in 6A because it was not part of the scoped backend extraction prompt

### Files modified in this phase
- `server/routes/quotes.js`
- `server/lib/quoteActivity.js`
- `server/services/itemStatsService.js`
- `server/services/quoteService.js`

---

## 2026-03-25 — Cursor → Next agent

**Phase completed:** Phase 6B (Frontend refactor implementation)
**Next phase:** Phase 7 (optional further QuoteDetail tab decomposition + follow-up audits)
**Next agent:** Codex or Claude

### What was done
1. Implemented shared pricing utilities:
   - added `client/src/lib/quoteTotals.js`
   - updated `client/src/pages/QuoteDetailPage.jsx` and `client/src/pages/PublicQuotePage.jsx` to import shared `computeTotals`/`effectivePrice`
2. Extracted Quote Detail inline components:
   - added `client/src/components/QuoteFilePicker.jsx`
   - added `client/src/components/ImagePicker.jsx`
   - added `client/src/components/QuoteSendModal.jsx`
   - removed inline definitions from `client/src/pages/QuoteDetailPage.jsx`
3. Decomposed `QuoteBuilder` into subpanels (no external prop changes):
   - added `client/src/components/quote-builder/QuoteLineItemsPanel.jsx`
   - added `client/src/components/quote-builder/QuoteAdjustmentsPanel.jsx`
   - added `client/src/components/quote-builder/InventoryPickerPanel.jsx`
   - updated `client/src/components/QuoteBuilder.jsx` to be a thin coordinator
4. Implemented `hooks/useQuoteDetail.js` and moved shared state/handlers out of `QuoteDetailPage.jsx`

### Verification
1. Built the client successfully:
   - `npm run build:client`

### Notes / UI risks
- `QuoteBuilder` is now split across three components; behavior should be identical, but any subtle differences would show up around:
  - quantity debounce behavior
  - drag-to-reorder
  - inventory picker pagination/search state
- `useQuoteDetail` centralizes `isDirty` tracking; navigation blocking still lives in the page and continues to depend on `isDirty`.

### Files modified in this phase
- `client/src/lib/quoteTotals.js`
- `client/src/pages/QuoteDetailPage.jsx`
- `client/src/pages/PublicQuotePage.jsx`
- `client/src/hooks/useQuoteDetail.js`
- `client/src/components/QuoteBuilder.jsx`
- `client/src/components/QuoteFilePicker.jsx`
- `client/src/components/ImagePicker.jsx`
- `client/src/components/QuoteSendModal.jsx`
- `client/src/components/quote-builder/QuoteLineItemsPanel.jsx`
- `client/src/components/quote-builder/QuoteAdjustmentsPanel.jsx`
- `client/src/components/quote-builder/InventoryPickerPanel.jsx`
