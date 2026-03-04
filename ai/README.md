## AI Collaboration Layer

This folder defines the **persistent AI coordination layer** used by Claude (remote architect/orchestrator) and Cursor (local implementation agent) to collaborate through version-controlled documents.

### Purpose

- **AI coordination layer for Claude + Cursor**
- Provide a stable, repo-local protocol for:
  - Claude to design architecture, plans, and reviews.
  - Cursor to implement changes, record progress, and expose diffs.
  - Git to synchronize shared state between machines and sessions.

### Roles

- **Claude (Architect / Planner / Reviewer)**
  - Owns high-level direction and architecture.
  - Writes and updates:
    - `HANDOFF.md` — authoritative task/feature definition and plan.
    - `TODO.md` — prioritized task list and backlog.
    - `DECISIONS.md` — architecture decisions and rationale.
  - Reviews `STATUS.md`, `LAST.patch`, and `LAST.status` to understand what Cursor implemented.

- **Cursor (Implementation Agent)**
  - Treats `HANDOFF.md` as the **source of truth** for work to perform.
  - Focuses on local implementation details and minimal diffs.
  - Updates:
    - `STATUS.md` — current task, progress, files changed, commands used, verification, and next steps.
    - `LAST.patch` — most recent patch of work for Claude to review.
    - `LAST.status` — snapshot of `git status --porcelain` after work.
  - Must not invent large architectural changes without explicit direction in `HANDOFF.md` or `DECISIONS.md`.

### Communication Protocol

All coordination happens via Markdown and patch files inside `/ai`, synchronized via Git.

- **Claude writes**
  - `HANDOFF.md` — detailed description of the current feature or task, constraints, current state, implementation plan, acceptance criteria, and test plan.
  - `TODO.md` — high-level backlog of upcoming work items.
  - `DECISIONS.md` — running log of architecture and process decisions.

- **Cursor updates**
  - `STATUS.md` — describes what Cursor is currently implementing, progress, changed files, commands used, verification, known issues, and what Claude should do next.
  - `LAST.patch` — generated via `git diff > ai/LAST.patch` at the end of a work session or task.
  - `LAST.status` — generated via `git status --porcelain > ai/LAST.status` at the end of a work session or task.

- **Git as Transport**
  - All `/ai` files are committed to the repository.
  - Claude and Cursor stay in sync by pulling and pushing Git history.
  - No external coordination channel is required; the repository itself is the shared state.

### Workflow Overview

1. **Claude**:
   - Updates `HANDOFF.md` with a clear objective, constraints, current state, plan, acceptance criteria, and test plan.
   - Optionally updates `TODO.md` and `DECISIONS.md`.
   - Commits and pushes changes.

2. **Cursor**:
   - Pulls latest changes.
   - Reads `ai/HANDOFF.md` and treats it as the authoritative specification.
   - Implements the requested changes in the codebase.
   - Updates `ai/STATUS.md` with:
     - Current task
     - Progress
     - Files changed
     - Commands used
     - Verification results
     - Known issues
     - Next steps for Claude
   - Generates:
     - `git diff > ai/LAST.patch`
     - `git status --porcelain > ai/LAST.status`
   - Stages and commits changes (but only pushes when explicitly instructed).

3. **Claude**:
   - Reviews `STATUS.md`, `LAST.patch`, and `LAST.status`.
   - Updates `HANDOFF.md`, `TODO.md`, and `DECISIONS.md` for the next iteration.

### Behavioral Rules for Cursor

- **Follow HANDOFF**: Treat `ai/HANDOFF.md` as the authoritative task definition.
- **Respect Claude’s plan**: Do not overwrite or significantly alter Claude’s plan except as part of executing the described steps.
- **Minimal diffs**: Prefer focused, minimal changes instead of large rewrites.
- **Always update status**: After implementing changes, update `ai/STATUS.md` to reflect what was done and what remains.
- **Always export patches**: After work is complete (before or alongside committing), regenerate:
  - `git diff > ai/LAST.patch`
  - `git status --porcelain > ai/LAST.status`
- **No surprise architecture**: Avoid introducing new architectural patterns or large-scale refactors unless explicitly requested in `HANDOFF.md` or justified by an entry in `DECISIONS.md` authored by Claude.

