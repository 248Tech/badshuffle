# BADSHUFFLE FULL-STACK AGENTIC CODE AUDIT SYSTEM

## System Reference

Follow the multi-agent workflow defined in: `AI/AI-System-Setup.md`

You are operating as part of a **collaborative AI system**, not a single assistant.

Agents:
- Claude — Planning, architecture, audit design
- Codex — Code-level audit + fixes
- Cursor — Refinement, validation, UI polish

All communication MUST happen through Markdown files in `/AI`.

---

## AUDIT OVERVIEW

**Project:** Badshuffle
**Repo:** https://github.com/248Tech/badshuffle
**Scope:** Full-stack audit of latest version
**Approach:** Division-based review + mandatory code-level audit

---

## CRITICAL REQUIREMENT: FULL CODE AUDIT (ALL TEAMS)

Every division MUST:

- Read and analyze real source files (NOT just UI behavior)
- Identify real implementation issues (NOT theoretical)
- Reference exact file paths, functions, and lines
- Include real code snippets
- Suggest concrete fixes (with code)
- Flag anti-patterns, inefficiencies, and risks

---

## REQUIRED ISSUE FORMAT (STRICT)

For EVERY issue use this format exactly:

---

### [Issue Title]

**File:** `/path/to/file.js`

```js
// problematic code
```

**Problem:**
Clear explanation of why this is an issue.

**Fix:**

```js
// improved code
```

**Priority:** High / Medium / Low

---

## DIVISION STRUCTURE AND OWNERSHIP

| Division | Ownership |
|---|---|
| Design Team | UI/UX, visual consistency |
| Frontend Team | Layout, responsiveness, usability |
| Backend Team | Security, API, scalability |
| DevOps Team | Observability, monitoring, infra |
| Architecture Team | Maintainability, system design |
| DX Team | Developer experience and onboarding |
| Documentation Team | Docs completeness and clarity |

ALL teams MUST audit relevant code.

---

## DIVISION AUDIT REQUIREMENTS

### 1. Design (UI / Visual System)

- Inspect styling approach (CSS Modules — this project uses CSS Modules + CSS variables)
- Identify hardcoded styles vs theme system variables
- Detect duplicated UI components

### 2. Layout and Responsiveness

- Review Flexbox/Grid usage
- Identify fixed pixel usage where fluid design is needed
- Identify improper breakpoints
- Validate resize logic in code

### 3. UX Quality

- Analyze loading/error state handling
- Analyze conditional rendering
- Detect UI flickering and broken transitions

### 4. Security (CRITICAL)

Audit:
- Auth middleware
- API routes
- Input validation

Identify:
- Missing validation
- Injection vulnerabilities
- Token handling flaws

Example of what to look for:

```js
// File: /server/routes/example.js
db.query(`INSERT INTO events VALUES ('${name}')`);
```

Fix:

```js
db.prepare('INSERT INTO events (name) VALUES (?)').run(name);
```

### 5. Scalability

Evaluate:
- API modularity
- DB query efficiency

Detect:
- N+1 queries
- Missing pagination
- Tight coupling

### 6. Maintainability and Code Quality

Identify:
- Large files (over 300–500 lines)
- Duplicate logic
- Poor naming
- Dead or commented-out code

Require:
- Refactor suggestions with improved structure

### 7. Documentation

Verify:
- Code matches docs
- API docs match implementation

Flag:
- Missing endpoints
- Mismatched request/response formats

### 8. Developer Experience (DX)

Review:
- package.json scripts
- Tooling configs

Identify:
- Missing linting/formatting
- Poor error messages

### 9. Observability and Monitoring

Inspect:
- Logging strategy
- Error handling middleware

Detect:
- console.log instead of structured logs
- Missing logs in critical flows

### 10. Backend and Frontend Standards

**Backend:**
- Validate controller/service separation
- Validate middleware usage

**Frontend:**
- Inspect component structure
- Inspect state management
- Inspect performance patterns

---

## AGENT EXECUTION FLOW

### Phase 1 — Claude (Planner)

Claude MUST:

1. Scan repository
2. Create: `AI/CODE_AUDIT_PLAN.md`
3. Populate: `AI/TODO.md`

Include:
- Division-based audit tasks
- File targets with line estimates
- Acceptance criteria
- Risk areas

Then hand off to Codex.

### Phase 2 — Codex (Code Auditor)

Codex MUST:

1. Read: `AI/CODE_AUDIT_PLAN.md`
2. Read: `AI/TODO.md`
3. Perform deep code audit on all targeted files
4. Write findings to: `AI/reports/code-audit.md`

Include in report:
- All issues in strict format (see above)
- Refactor suggestions
- Anti-pattern detection

5. Update: `AI/HANDOFF.md`

Include in handoff:
- Files reviewed
- Critical findings summary
- Next agent recommendation

### Phase 3 — Cursor (Refinement)

Cursor MUST:

1. Validate Codex findings
2. Improve code clarity, UI issues, structure
3. Update: `AI/HANDOFF.md`

Include:
- Refinements made
- Remaining issues
- UX inconsistencies

---

## REQUIRED FILE OUTPUTS

```
AI/CODE_AUDIT_PLAN.md
AI/TODO.md
AI/reports/code-audit.md
AI/HANDOFF.md
```

---

## AI FOLDER CONTINUATION STRATEGY

Use AI tooling for:
- Automated scanning
- Refactor suggestions
- Anti-pattern detection

**MANDATORY:** Store all findings in `AI/reports/code-audit.md`

---

## FINAL DELIVERABLES

Each division must produce:

1. Findings Report
2. Code Audit Report (MANDATORY) including:
   - File references
   - Code snippets
   - Fix suggestions
   - Priority-tagged issues
   - Refactor recommendations
   - Effort estimation (Low / Medium / High)
   - Dependencies / blockers

---

## DEFINITION OF DONE

Audit is NOT complete unless:

- Code-level issues are documented
- Every issue includes a fix
- High-priority issues are implementation-ready
- Cross-team inconsistencies are identified
- Findings are written to Markdown files

---

## NEXT STEPS

1. Assign reviewers per division
2. Clone repo
3. Begin audit immediately
4. Set deadline (1–2 weeks)
5. Aggregate findings
6. Convert into engineering tickets
7. Execute phased fixes

---

## SYSTEM RULES (CRITICAL)

- DO NOT rely on chat memory
- ALL context must be written to files
- ALWAYS leave clear handoffs
- WRITE for the next AI, not yourself
- FOLLOW the multi-agent workflow strictly

---

## START

**Claude:**

1. Scan repository
2. Generate `AI/CODE_AUDIT_PLAN.md`
3. Populate `AI/TODO.md`
4. Then hand off to Codex
