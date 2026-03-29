# HANDOFF

Current orchestration for BadShuffle work as of 2026-03-27.

---

## Mission

Use the AI agents as a coordinated team, not as independent parallel streams.
The goal is to keep shipping small, correct changes quickly while preserving product/design quality.

---

## Agent Roles

### Codex — primary workhorse

Codex is the default starting agent for almost all tasks.

Use Codex for:
- small edits and tweaks
- bug fixing
- route / schema / UI wiring
- feature implementation
- debugging and verification
- keeping momentum on concrete problems

Codex is the main problem solver for this repo.

### Claude — designer and reviewer

Use Claude for:
- product/design judgment
- UI/UX direction
- reviewing implementation quality
- rewriting specs, flows, and handoff docs
- planning larger changes before implementation
- sanity-checking whether a solution is clean, coherent, and user-friendly

Claude should usually not be the first stop for small code edits. Claude is best used to define the shape of the work or review what Codex produced.

### Cursor — alternate implementer / second pass

Use Cursor for:
- implementation when Codex gets stuck
- alternate execution on bugs that resist one agent
- polishing UI behavior after a plan or review exists
- fast code pass after Claude defines design direction

Cursor is the best “change the approach and try again” agent when the first implementation path stalls.

---

## Default Workflow

1. Start with Codex.
2. If the task is mostly design/product judgment, ask Claude first for direction, then send implementation back to Codex.
3. If the same bug has been prompted to one AI more than 2 times without landing cleanly, switch agents.
4. If Codex ships a change but the result feels visually or product-wise weak, send it to Claude for review.
5. If Claude gives a plan/spec, use Codex to execute it unless Cursor is clearly a better fit for the specific code pass.

---

## Escalation Rules

Switch away from the current AI when:
- the same bug has been attempted more than 2 times with no clean fix
- the agent is looping on the same diagnosis
- the change is technically correct but product quality is questionable
- the requested task is better matched to another role

Preferred escalation order:

- Codex stuck on implementation:
  Move to Cursor for an alternate implementation pass.
- Codex solution works but looks/feels wrong:
  Send to Claude for design review, then back to Codex for execution.
- Claude plan is vague or too abstract:
  Return to Codex with a narrower concrete implementation target.
- Cursor patch works but needs product cleanup:
  Send to Claude for review.

---

## Current Product State Snapshot

Recently landed and now considered current:

- quote item sections with titled multi-area quote builders
- per-section rental date ranges
- section-aware availability windows with signed item snapshots
- public quote grouping by section with titles, date ranges, descriptions, and subtotals
- section-aware export / print / signed PDF rendering
- latest-live-state public quote reload after approve/sign actions
- settings-backed event types
- optional project title city suffix setting
- unsigned-change balance handling using signed totals/balances
- signed contract PDF artifacts with signature event history
- signature audit hardening: signer user-agent, quote snapshot hash, immutable signed artifact attachments, and `/api` + `/api/v1` parity on public approval/signing rules

Still genuinely open:

1. formal e-sign / compliance review beyond the current internal audit trail
2. section reordering
3. custom-item description editing workflow
4. richer signed contract history UX beyond the current Files tab labels/locks
6. mobile / cross-theme QA and follow-up polish
7. unsaved-changes / confirmation UX polish

For the detailed product state, see:
- `ai/HANDOFF.md`
- `ai/STATUS.md`
- `ai/TODO.md`
- `ai/KNOWN_GAPS.md`
- `ai/DATA_MODELS.md`

---

## Task Routing Guide

### Start with Codex when

- the task changes 1-5 files
- the bug is concrete
- the request is a feature tweak
- the request is “debug this”, “fix this”, “move this”, “wire this up”
- the task needs terminal verification

### Start with Claude when

- the task is “how should this work?”
- the user wants redesign, UX thinking, or product tradeoffs
- the feature needs naming, structure, or workflow definition before coding
- the work needs a review memo before implementation

### Start with Cursor when

- Codex already failed twice
- the code path is awkward and needs a fresh implementation attempt
- the task is mostly UI polish with an already-known target

---

## Execution Discipline

- Keep `ai/TODO.md` in true priority order.
- After a meaningful workflow change lands, update `ai/STATUS.md`, `ai/HANDOFF.md`, and `ai/DATA_MODELS.md` if schema changed.
- Remove stale notes instead of stacking contradictory history on top of them.
- Treat Codex as the default engine unless there is a clear reason not to.

---

## Code Audit Status (2026-03-28)

`AI/reports/code-audit.md` is now complete — 2016 lines covering all divisions:

| Division | Status | High-Priority Issues |
|---|---|---|
| Security | ✅ Complete | JWT fallback secret, extension token over-permissioning, BOLA on ID routes, bearer tokens in query strings |
| Backend / Scalability | ✅ Complete | N+1 queries in quote listing, missing pagination, delivery fee calculation in loops |
| Frontend / Architecture | ✅ Complete | QuoteDetailPage 1550-line God component, duplicated file-fetch hooks, missing useCallback on prop handlers |
| Maintainability | ✅ Complete | Duplicate price logic, scattered totals calculation, inline modal helpers |
| Design | ✅ Complete | Hardcoded colors in 5+ module files bypassing CSS variable theme system |
| Layout / Responsiveness | ✅ Complete | FilesPage grid overflow on small screens, inspect panel has no mobile layout |
| Observability | ✅ Complete | **8 empty catch blocks** on critical DB ops, no request logging middleware, no uncaughtException handlers |
| UX Quality | ✅ Complete | Silent false-empty states on conflict/messages/settings load failures |
| Developer Experience | ✅ Complete | Missing return in ai.js route (hanging requests), no ESLint, no lint scripts, wrong APP_URL in .env.example |
| Documentation | ✅ Complete | Undocumented env vars, missing API response shape docs |

**Top actionable items for Codex/Cursor:**

1. [x] **`server/routes/ai.js`** — Added `return` before `fallbackSuggest()` in catch block to prevent hanging requests.
2. [x] **`server/services/emailPoller.js`** — Added `console.error` logging to the previously silent catch paths.
3. [x] **`server/routes/quotes.js`** — Added `console.error` for contract-log write failures and quote-list payment-total aggregation failures.
4. [x] **`server/index.js`** — Added `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers.
5. [x] **`/.env.example`** — Fixed `APP_URL` port to `3001` and added current runtime override vars.
6. [x] **CSS modules** — Replaced the remaining audit-target hardcoded status/action colors with theme-aware variables and derived semantic tokens.
7. [x] **`client/src/pages/QuotePage.jsx`** — Conflict load catch now logs the failure and explicitly preserves previous state.

---

## UI Redesign Status (2026-03-28)

Full plan in `AI/reports/redesign-plan.md`.

**Wave 1 completed:**
- Noir dark theme added as 5th theme (`data-theme="noir"`) — deep blue-black palette, glow shadows, vibrant pastels, Inter font, 10px radius
- 7 critical `flex-wrap` fixes applied to action bars (AdminPage, SettingsPage, VendorsPage, InventorySettingsPage, MessageSettingsPage, QuoteDetailPage, QuoteCard)

**Wave 1 remaining (hand to Codex or continue here):**
- `Layout.module.css` → max-width 1400px on `.mainInner`
- `theme.css` `.btn` → `white-space: nowrap`, `justify-content: center`, refined sm padding
- `StatsBar.module.css`, `DashboardPage.module.css` → fixed-width elements to min/max-width
- `BillingPage.module.css` → search width responsive
- `AuthPage.module.css` → login card max-width constraint

**Wave 2–3:** typography system, QuoteBuilder mobile, component extraction — see redesign-plan.md §7–8.

---

## Current Recommendation

If there is no special context, start with **Codex**.
