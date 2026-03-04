# STATUS

## Current Task
Execute HANDOFF per repository protocol. HANDOFF.md has been read; it is currently the **generic template** and does not contain the feature specification (roles/auth, single-instance/autokill, update-check, Admin-only settings GUI, or verification steps).

## Progress
- Read `ai/HANDOFF.md` end-to-end.
- Read `ai/TODO.md` (generic placeholder tasks).
- Reviewed current codebase: server already references `authMiddleware`, `adminMiddleware`, `routes/auth`, `services/singleInstance`, `services/updateCheck`, `routes/settings`, `routes/admin` — implementation may already exist or be partial; will not assume scope until HANDOFF is populated.
- Writing this initial STATUS with execution plan and blocker.

## Files Changed
- `ai/STATUS.md` (this file)

## Commands Used
- None yet (STATUS update only).

## Verification
- N/A (no implementation performed).

## Known Issues / Follow-ups
- `ai/HANDOFF.md` and `ai/TODO.md` are still templates. Until HANDOFF is populated, implementation scope is undefined.

## Blockers / Decision Needed
- **HANDOFF.md is not populated.** The authoritative spec file contains only placeholder sections (“Describe the feature or task”, “path/to/file”, etc.). It does **not** specify:
  - **Objective** for this feature set (roles + single-instance + update-check + Admin GUI).
  - **Constraints** (e.g. local-only, no generic kill-by-port unless verified Badshuffle process).
  - **Current state** of the codebase (e.g. that auth/singleInstance/updateCheck/settings/admin already exist).
  - **Plan**: files to create vs. modify, implementation notes.
  - **Acceptance criteria** and **test plan**.

- **Options for Claude:**
  1. **Populate HANDOFF.md** with the full feature spec (Objective, Constraints, Current State, Plan with concrete file paths, Acceptance Criteria, Test Plan), then commit/push so Cursor can implement or verify per HANDOFF.
  2. **Confirm that existing server code** (auth, singleInstance, updateCheck, settings, admin) is the intended implementation and HANDOFF should be updated to *describe* that as-built, with Cursor only filling gaps (e.g. Admin GUI, verification) per a new HANDOFF section.
  3. **Specify a different scope** (e.g. only Admin GUI, or only update-check) so Cursor does not invent scope.

- **Execution plan (once HANDOFF is populated and blocker cleared):**
  - **A)** Backend foundations: auth/roles, settings persistence, enforcement (middleware/guards on server).
  - **B)** Single-instance/autokill mechanism safely (only target verified Badshuffle-owned process; no generic kill-by-port unless HANDOFF explicitly allows with verification).
  - **C)** Update-check on startup with caching and a settings toggle; never block startup; failures non-fatal.
  - **D)** Admin-only GUI controls for settings.
  - **E)** Verify end-to-end flows and document in STATUS.

- **Safety constraints to be enforced (from coordination instructions):**
  - Autokill: only target verified Badshuffle-owned process/instance.
  - Update check: never block startup; failures non-fatal.
  - Must work in dev and packaged modes.

**Cursor is halting implementation until HANDOFF.md is populated and the above decision is resolved.** No code changes will be made until then.

## Next Steps for Claude
1. Populate `ai/HANDOFF.md` with the full spec for this feature (or confirm scope and update HANDOFF to match existing code).
2. Resolve “Blockers / Decision Needed” above (e.g. confirm whether to implement from scratch, verify existing code, or scope down).
3. After HANDOFF is committed, Cursor will resume: implement per plan A→B→C→D→E, update STATUS continuously, and produce `ai/LAST.patch` and `ai/LAST.status` at end of session.
