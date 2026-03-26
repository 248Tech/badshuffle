# Phase 5 — Codex Audit Prompt (Maintainability and Code Quality)

## Context

You are Codex, operating as part of the Badshuffle multi-agent audit system.

Before starting, read these files in full:
- `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` — issue format, audit rules (MANDATORY)
- `AI/CODE_AUDIT_PLAN.md` — Phase 5 scope and acceptance criteria
- `AI/HANDOFF.md` — prior phase summaries and remaining work
- `AI/reports/code-audit.md` — existing findings (do not duplicate)

Phase 4 is complete. Your task is Phase 5: audit the **Maintainability and Code Quality** division.

---

## Division — Maintainability and Code Quality

Audit the files below and write ALL findings to `AI/reports/code-audit.md` under a `## Maintainability and Code Quality` heading using the strict issue format from `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md`.

Target files:
- `server/routes/quotes.js`
- `server/db.js`
- `client/src/pages/QuoteDetailPage.jsx`
- `client/src/pages/PublicQuotePage.jsx`

Also do a quick repo-wide sweep of files you touch for dead code, commented-out blocks, and `console.log`/debug logging that appears to be production code.

---

## 1. Shared pricing / totals duplication

Compare:
- `client/src/pages/QuoteDetailPage.jsx`
- `client/src/pages/PublicQuotePage.jsx`

Audit for:
- Duplicated `effectivePrice`, `computeAdjustmentsTotal`, `computeTotals`, subtotal/tax/grand-total logic
- Slight behavior drift between the two implementations
- Inline helpers that should be moved to a shared utility module

For every duplication finding:
- Show both file references
- Explain whether the issue is exact duplication or drift-prone near-duplication
- Propose the shared utility shape and exported function names

---

## 2. Repeated business helpers and DB patterns

Audit:
- `server/routes/quotes.js`
- `server/db.js`

Look for:
- Repeated `logActivity` or equivalent audit-log patterns
- Repeated transaction wrappers or repeated DB statement sequences
- Repeated quote status transition logic
- Repeated item stats / totals recalculation logic
- Migration code patterns in `server/db.js` that are hard to extend safely

Only flag maintainability issues here:
- duplicated orchestration
- helper logic embedded inline many times
- patterns that make future bugs likely

Do not repeat security or scalability findings unless they create a distinct maintainability problem.

---

## 3. Dead code and commented-out code

While reading the target files, flag:
- Commented-out code blocks that no longer document an intentional alternative
- Unused helper functions that are clearly dead
- Legacy branches or temporary scaffolding that should be removed

Do not flag normal explanatory comments.

---

## 4. Debug logging in production paths

Check the files you audit for:
- `console.log`
- noisy `console.error` / `console.warn` used as routine control flow rather than true error reporting
- ad hoc debug prints in route handlers or React pages

If a log is acceptable for startup or fatal error reporting, do not flag it. Focus on logs that reduce signal or indicate unfinished cleanup.

---

## 5. Inline helpers that should be extracted

For each large file, identify helpers that should move out:

- `server/routes/quotes.js`
  - helpers that belong in `server/lib/` or `server/services/`
- `client/src/pages/QuoteDetailPage.jsx`
  - helpers that belong in `client/src/lib/` or extracted components/hooks
- `client/src/pages/PublicQuotePage.jsx`
  - helpers that should share logic with QuoteDetailPage

For each extraction suggestion:
- name the proposed destination file
- name the proposed exported function/component
- explain why extraction reduces drift or coupling

---

## Output requirements

- Append findings to `AI/reports/code-audit.md` — do NOT overwrite existing content
- Use the strict issue format from `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` for every issue
- Include real file paths, line numbers, and code snippets
- Include a concrete fix for every issue
- Set priority: High / Medium / Low per issue
- Keep findings specific to Maintainability and Code Quality; avoid duplicating earlier phase findings unless the maintainability angle is distinct

---

## Handoff — when audit is complete

When you have finished writing all findings, append a new section to `AI/HANDOFF.md`:

```md
## 2026-MM-DD — Codex → Claude

**Phase completed:** Phase 5 (Maintainability and Code Quality audit)
**Next phase:** Phase 6 (Refactor planning or implementation sequencing)
**Next agent:** Claude

### What was done
1. Read `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md`, `AI/CODE_AUDIT_PLAN.md`, `AI/HANDOFF.md`, and existing `AI/reports/code-audit.md`
2. Audited:
   - `server/routes/quotes.js`
   - `server/db.js`
   - `client/src/pages/QuoteDetailPage.jsx`
   - `client/src/pages/PublicQuotePage.jsx`
3. Appended Maintainability and Code Quality findings to `AI/reports/code-audit.md`

### Finding summary
1. [one line per significant finding]
2. [one line per significant finding]
3. [one line per significant finding]

### Instructions for Claude
1. Read the new Maintainability and Code Quality section in `AI/reports/code-audit.md`
2. Consolidate duplicated logic findings into a refactor sequence
3. Decide which extractions should happen first to reduce merge risk
4. Update `AI/HANDOFF.md` with the next implementation-ready plan
```

---

## Recommended agent

Give this prompt to **Codex**.

Why:
- Phase 5 is code-centric and repository-specific
- It requires comparing implementations across files and identifying extraction candidates with exact code references
- This matches Codex’s role in the Badshuffle audit workflow (`Claude = planning`, `Codex = code-level audit`, `Cursor = refinement/UI validation`)
