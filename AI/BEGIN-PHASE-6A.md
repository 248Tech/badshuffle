# Phase 6A — Codex Implementation Prompt (Backend Refactor)

## Context

You are Codex, implementing Phase 6 backend refactors for Badshuffle.

Before starting, read these files in full:
- `AI/HANDOFF.md`
- `AI/reports/refactor-plan.md`
- `AI/reports/code-audit.md`

Goal:
Implement the backend refactor steps from the refactor plan without changing behavior.

---

## Scope

### 1. Extract `server/lib/quoteActivity.js`

- Move `logActivity` out of `server/routes/quotes.js`
- Add any line-item/custom-item snapshot helpers needed
- Update `server/routes/quotes.js` to use the shared helpers

### 2. Extract `server/services/itemStatsService.js`

- Move the `item_stats` / `usage_brackets` upsert logic out of `POST /api/quotes/:id/items`
- Keep current behavior unchanged

### 3. Extract `server/services/quoteService.js`

- Move quote lifecycle/service logic out of `server/routes/quotes.js`
- Include:
  - `sendQuote`
  - `duplicateQuote`
  - `transitionQuoteStatus`
- Remove duplicated transition logic from route handlers

---

## Requirements

- Preserve API behavior and response shapes
- Do not change unrelated files
- Keep route handlers thin
- Reuse existing SQL where possible before improving structure
- If behavior must change, document it clearly

---

## Verification

- Run the relevant tests if present
- If no tests exist, run at least basic server validation or targeted smoke checks
- Summarize files changed and residual risks

---

## Completion

When complete:
- Update `AI/HANDOFF.md`
- Note what was implemented, what remains, and any blockers
