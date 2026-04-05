# v0.0.12 Compare To GitHub

Prepared: 2026-04-03  
Repo: `badshuffle`  
GitHub baseline: `origin/master` at `5717987` (`v0.0.11`)

## Current State

- local branch: `master`
- local `HEAD`: `5717987`
- GitHub `origin/master`: `5717987`
- meaning: no release work is committed yet; `v0.0.12` is still entirely local

## Release-Scope Delta

Counts below exclude local runtime/build output in `logs/` and `rust-core/target/`.

- modified tracked files: `72`
- new untracked release-source files: `46`
- total release-scope entries changed or added: `118`

Tracked diff summary vs GitHub:

- `72` files changed
- `4946` insertions
- `775` deletions

## Major Local Additions Not In GitHub

### Product features

- Quote Assistant with transcripts, tools, and Quote Detail UI
- live notification system with inbox, settings, group targeting, and presence timing
- Team Groups
- inventory Set Aside workflow
- inventory AI description writing
- searchable Clients and Venues directory pages with quote-driven auto-creation
- Team Chat and quote-thread AI assist with Onyx integration

### Platform and operations

- Rust engine workspace for availability/conflicts and pricing
- Rust parity tooling, admin diagnostics, lifecycle controls, and release guard
- packaged release-check artifacts
- richer diagnostics and encrypted-settings inspection
- API-ready startup wait flow

## AI Documentation Reconciliation

Docs already aligned:

- `AI/Next-Release.md`
- `AI/FEATURES/V0_0_12_RELEASE_PREP.md`
- `AI/HANDOFF.md`

Docs that define the Rust engine scope and supporting architecture:

- `AI/CURRENT_FOCUS.md`
- `AI/PROJECT_CONTEXT.md`
- `AI/ARCHITECTURE.md`
- `AI/DECISIONS.md`
- `AI/WORKFLOW.md`
- `AI/FEATURES/RUST_ENGINE_CORE_V0_0_12.md`

Docs that remain operational rather than release-blocking:

- `AI/TODO.md`
- `AI/ideas.md`
- `AI/AGENT_ASSISTANT_PLAN.md`

## Before Tagging v0.0.12

1. Remove or ignore `logs/` and `rust-core/target/`.
2. Confirm the live Rust engine is the current build and rerun parity.
3. Run one manual pass for notifications, Team Chat, quote AI, and directory client/venue syncing.
4. Run the guarded package flow.
5. Commit the actual release snapshot, then tag `v0.0.12`.
