# AI — Project context for AI sessions

This folder holds **consolidated project documentation** so future AI sessions can quickly understand the system without re-scanning the whole repo.

## Files (read these first)

| File | Purpose |
|------|---------|
| **PROJECT_OVERVIEW.md** | What the app is, major modules, how frontend and backend interact. |
| **ARCHITECTURE.md** | Folder structure, core services, data flow, how inventory/quotes/operations connect. |
| **FEATURES.md** | Implemented features (quotes, items, contracts, billing, files, logistics, etc.) and where logic lives. |
| **DATA_MODELS.md** | Main entities (Quote, QuoteItem, Item, Lead, Contract, etc.) and relationships. |
| **WORKFLOWS.md** | Quote flow (inquiry → quote → approval → order); operations flow (conceptual; pull sheets not implemented). |
| **TODO.md** | Aggregated TODO/FIXME and backlog items. |
| **KNOWN_GAPS.md** | Incomplete features, tech debt, UI placeholders, assumptions. |
| **SETUP.md** | How to run: env, install, dev server, DB, CLI. |

## Relation to `ai/` (lowercase)

The repo also has an **`ai/`** folder (lowercase) with coordination docs: HANDOFF.md, STATUS.md, CURSOR_BRIEFING.md, DECISIONS.md, TODO.md, README.md. Those are for agent workflow and task handoff. This **`AI/`** folder is for **system context**: what the app does, how it’s built, and what’s left to do — so any AI (or human) can onboard quickly.

When you change the system (e.g. add pull sheets, new routes, new tables), update the relevant file here (e.g. FEATURES.md, DATA_MODELS.md, ARCHITECTURE.md) so the next session stays in sync.
