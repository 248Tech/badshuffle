# Phase 4 — Codex Audit Prompt (Backend/Scalability + Frontend/Architecture)

## Context

You are Codex, operating as part of the Badshuffle multi-agent audit system.

Before starting, read these files in full:
- `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` — issue format, audit rules (MANDATORY)
- `AI/HANDOFF.md` — prior phase summaries and remaining work
- `AI/reports/code-audit.md` — existing findings (do not duplicate)

Phase 3 (security fixes) is complete. Your task is Phase 4: audit the **Backend/Scalability** and **Frontend/Architecture** divisions.

---

## Division 1 — Backend / Scalability

Audit these files for the issues listed. Write ALL findings to `AI/reports/code-audit.md` under a `## Backend / Scalability` heading using the strict issue format from `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md`.

### 1a. N+1 queries — `server/routes/quotes.js`

- Read the full file (~960 lines)
- Find every place a query runs inside a loop or per-item
- Flag any case where a single JOIN or subquery could replace multiple round-trips
- Check the main GET quote list endpoint — how many queries per quote row?
- Check the GET /api/quotes/:id detail endpoint — are items, attachments, adjustments, contracts fetched in separate queries?

### 1b. Missing DB indexes — `server/db.js`

- Read the full schema (CREATE TABLE blocks and any CREATE INDEX statements)
- List all foreign keys and high-cardinality filter columns (quote_id, item_id, status, event_date, lead_id, sent_at)
- Flag every column that is used in a WHERE, JOIN ON, or ORDER BY clause across the route files but has no index defined

### 1c. Unbounded list endpoints

- Check `server/routes/items.js` — does GET /api/items apply LIMIT/OFFSET?
- Check `server/routes/quotes.js` — does GET /api/quotes apply LIMIT/OFFSET?
- Check `server/routes/leads.js` — does GET /api/leads apply LIMIT/OFFSET?
- Flag any endpoint that returns an unlimited SELECT on a table that will grow unboundedly

### 1d. Availability conflict query — `server/routes/availability.js`

- Read the full file
- Find the conflict detection query
- Check whether it scans the full table or uses indexed range conditions
- Flag any full table scan or missing date-range index

### 1e. Stats aggregate queries — `server/routes/stats.js`

- Read the full file
- Find any aggregate (SUM, COUNT, AVG) that scans the full table without a date or status constraint
- Flag queries that will degrade as the dataset grows

### 1f. Service layer — `server/routes/quotes.js`

- Flag all business logic that lives inside a route handler and should be in a service module
- Examples: total calculation, status transition logic, email sending orchestration
- Do not flag simple DB reads/writes — only non-trivial orchestration that belongs outside the route layer

---

## Division 2 — Frontend / Architecture

Audit these files. Write ALL findings to `AI/reports/code-audit.md` under a `## Frontend / Architecture` heading.

### 2a. QuoteDetailPage decomposition — `client/src/pages/QuoteDetailPage.jsx`

- Read the full file (~1550 lines)
- Identify distinct UI concerns that are embedded in a single component (e.g. quote header, line items, totals, contract, messages, export, status controls)
- For each: name the concern, estimate the line range, and propose a sub-component name
- Flag state variables that are only used by one concern — these are candidates for local state after extraction
- Flag event handlers that cross concern boundaries

### 2b. QuoteBuilder decomposition — `client/src/components/QuoteBuilder.jsx`

- Read the full file (~1060 lines)
- Same analysis as above: identify extractable concerns, line ranges, proposed component names
- Flag missing `useCallback`/`useMemo` on handlers or computed values passed as props to child components
- Flag any inline object/array literals passed as props (these cause unnecessary re-renders)

### 2c. API error handling — `client/src/api.js`

- Read the full file
- Check whether every `fetch` call handles non-2xx responses (throws or returns error shape)
- Check whether error responses are propagated to callers or silently swallowed
- Flag inconsistencies in the error contract (some calls throw, some return null, some return `{ error }`)

### 2d. Memory leak risks

- Check `client/src/pages/PublicQuotePage.jsx` — the page polls every 8 seconds. Is the interval cleared in the useEffect cleanup?
- Check `client/src/pages/QuoteDetailPage.jsx` — are all intervals, timeouts, and event listeners cleaned up on unmount?
- Flag any useEffect with a timer or subscription that has no cleanup return

### 2e. XSS via dangerouslySetInnerHTML

- Search all JSX files for `dangerouslySetInnerHTML`
- For each use: is the HTML passed through DOMPurify or equivalent before render?
- Flag any use without sanitization

### 2f. Duplicated price calculation logic

- Check whether `computeTotals` (or equivalent) is duplicated between `QuoteDetailPage.jsx` and `PublicQuotePage.jsx`
- If duplicated: describe what is duplicated and propose extraction to a shared utility

---

## Maintainability (quick pass — append to existing report)

While reading the above files, also flag:

- `console.log` calls in server code that should be removed or replaced with structured logging (files: all `server/` files you read)
- Any commented-out code blocks that are not self-explanatory

Write these under a `## Maintainability` heading in `AI/reports/code-audit.md`.

---

## Output requirements

- Append findings to `AI/reports/code-audit.md` — do NOT overwrite existing content
- Use the strict issue format from `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` for every issue
- Include real file paths, line numbers, and code snippets
- Include a concrete fix for every issue
- Set priority: High / Medium / Low per issue

---

## Handoff — when audit is complete

When you have finished writing all findings, append a new section to `AI/HANDOFF.md`:

```
## 2026-MM-DD — Codex → Claude

**Phase completed:** Phase 4 (Backend/Scalability + Frontend/Architecture audit)
**Next phase:** Phase 5 (Architecture refactor planning)
**Next agent:** Claude

### What was done
[list files audited]

### Finding summary
[one line per significant finding, grouped by division]

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
```

---

*Reference: `AI/BADSHUFFLE_AGENTIC_CODE_AUDIT.md` for issue format. `AI/TODO.md` for full task list.*
