# Phase 6B — Cursor Implementation Prompt (Frontend Refactor)

## Context

You are Cursor, implementing Phase 6 frontend refactors for Badshuffle.

Before starting, read these files in full:
- `AI/HANDOFF.md`
- `AI/reports/refactor-plan.md`
- `AI/reports/code-audit.md`

Goal:
Implement the frontend refactor steps from the refactor plan without changing UI behavior.

---

## Scope

### 1. Create `client/src/lib/quoteTotals.js`

- Move shared pricing helpers out of:
  - `client/src/pages/QuoteDetailPage.jsx`
  - `client/src/pages/PublicQuotePage.jsx`

### 2. Extract inline components from `QuoteDetailPage.jsx`

- `QuoteFilePicker`
- `ImagePicker`
- `QuoteSendModal`

### 3. Extract QuoteBuilder subpanels

- `QuoteLineItemsPanel.jsx`
- `QuoteAdjustmentsPanel.jsx`
- `InventoryPickerPanel.jsx`

### 4. Build `hooks/useQuoteDetail.js`

- Move shared page state/handlers out of `QuoteDetailPage.jsx`
- Reduce page size while preserving behavior

---

## Requirements

- No visual regressions
- Preserve existing props and page behavior
- Keep extracted components focused and colocate logic where appropriate
- Use the shared utility/hook structure from the refactor plan

---

## Verification

- Run frontend build/tests if available
- Do a quick smoke pass for Quote Detail, Public Quote, and Quote Builder flows
- Summarize files changed and any UI risks

---

## Completion

When complete:
- Update `AI/HANDOFF.md`
- Note what was implemented, what remains, and any blockers
