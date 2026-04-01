# ai — Project context for AI sessions

This folder holds the **living project-context and handoff docs** for future AI sessions so they can understand the current codebase without re-scanning the repo from scratch.

## Files (read these first)

| File | Purpose |
|------|---------|
| **PROJECT_OVERVIEW.md** | What the app is, major modules, how frontend and backend interact. |
| **ARCHITECTURE.md** | Current folder structure, core services, data flow, and how inventory/quotes/operations connect. |
| **FEATURES.md** | Implemented features (quotes, items, contracts, billing, files, logistics, etc.) and where logic lives. |
| **DATA_MODELS.md** | Main entities (Quote, QuoteItem, Item, Lead, Contract, etc.) and relationships. |
| **WORKFLOWS.md** | Quote flow (inquiry → quote → approval → order); operations flow (conceptual; pull sheets not implemented). |
| **TODO.md** | Aggregated TODO/FIXME and backlog items. |
| **KNOWN_GAPS.md** | Incomplete features, tech debt, UI placeholders, assumptions. |
| **SETUP.md** | How to run: env, install, dev server, DB, CLI. |

## Relation to `AI/` (uppercase)

The repo also has an **`AI/`** folder (uppercase) with higher-level release, audit, agent-routing, and API documentation. That folder is where release-prep notes such as `AI/Next-Release.md`, `AI/HANDOFF.md`, and `AI/Api/*` now live.

Use `ai/` for the current-state system map and handoff context. Use `AI/` for release planning, audits, agent guidance, and integration/API docs. When the system changes, update the relevant file in whichever folder owns that concern so the next session stays in sync.
