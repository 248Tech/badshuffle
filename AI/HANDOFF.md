## 2026-04-03 Onyx Managed Install Debug Pass
- Installed host dependencies `docker.io` and `docker-compose`, started the Docker daemon, and verified managed-local Onyx can run on this Debian 13 ARM host.
- Hardened `server/services/onyxLifecycleService.js` so managed installs no longer use the brittle `curl | bash` TTY path. It now downloads the real Onyx installer file, runs it non-interactively in Lite mode, detects the nested `onyx_data/deployment` layout, falls back to `sudo docker` when the current process lacks socket access, and preserves the Lite overlay on stop/start.
- Verified end to end with `node server/cli.js onyx-install`, `onyx-stop`, `onyx-start`, and `onyx-detect`. Current healthy endpoint: `http://127.0.0.1:3000/api/health`.

## 2026-04-03 Onyx Runtime UX + CLI Pass
- Added repo-level Onyx lifecycle CLI commands in `server/cli.js` and root scripts in `package.json`: `onyx:detect`, `onyx:install`, `onyx:start`, `onyx:stop`, `onyx:restart`.
- Team Chat and quote-thread AI now surface clearer inline product errors when Onyx is unavailable instead of only failing through generic request toasts.
- Managed-local Onyx detection is working, but this machine currently reports `docker not found`, so local Onyx install/start remains blocked until Docker is available.

## 2026-04-03 Onyx Managed Runtime

- Added app-managed local Onyx lifecycle support via `server/services/onyxLifecycleService.js`.
- BadShuffle can now detect, install, start, stop, restart, and auto-start a local Onyx companion service.
- External Onyx remains available as a separate selectable mode in Settings.
- Admin System now exposes Onyx runtime diagnostics and controls.
- Settings now include Onyx mode, managed-local install path/port, local autostart, and external enablement.

---

## v0.0.12 Release Prep

- Root and client package versions are now set to `0.0.12`.
- `AI/Next-Release.md` has been rewritten around the real local delta vs GitHub `origin/master`.
- `AI/FEATURES/V0_0_12_RELEASE_PREP.md` is the concise release checklist.
- `AI/FEATURES/V0_0_12_COMPARE_TO_GITHUB.md` now records the exact GitHub baseline, release-scope file counts, and remaining tag blockers.
- Before tagging, do not treat `logs/` or `rust-core/target/` as release-source files.
- Current release-scope comparison, excluding runtime/build output:
  - modified tracked files: `72`
  - new untracked release-source files: `46`
  - total release-scope entries: `118`
- `v0.0.12` scope now explicitly includes the later local work that was missing from the earlier release draft:
  - Clients and Venues directory pages
  - Team Chat and quote-thread AI assist via Onyx

---

# HANDOFF

Current orchestration for BadShuffle work as of 2026-03-31.

---

## Current Focus Update — 2026-04-01

`rust.md` is now being used as the guide for `v0.0.12 Rust Engine Core`, but adapted to the real BadShuffle stack.

State:

- Rust workspace added under `rust-core/`
- Node remains the primary backend
- SQLite remains the system of record
- `/api/availability/quote/:quoteId/items` and `/api/availability/quote/:quoteId` now have a feature-flagged Rust integration seam with fallback and shadow logging

Still required before calling the milestone stable:

- compile and verify the Rust workspace
- widen parity-check coverage beyond one-off quote compares
- build parity fixtures or CI-style gates for `quote items`, `quote summary`, and `conflicts`
- decide whether to surface Rust engine status in the admin UI or keep it API-only for now

Latest parity signal:

- batch compare tooling now exists for live quotes
- local run over quote ids `4`, `8`, and `10` returned:
  - `summary_mismatches: 0`
  - `item_mismatches: 0`
  - `errors: 0`
- item-level compare flags now exist for section-heavy / unsigned-change quotes:
  - `--include-items`
  - `--item-limit-per-quote`
- local item-level run over quote ids `4`, `8`, and `10` with `--include-items --item-limit-per-quote 5` also returned:
  - `summary_mismatches: 0`
  - `item_mismatches: 0`
  - `errors: 0`
- standard parity report command now writes `AI/reports/rust-parity-latest.md`
- latest standard preset run checked quote ids `4`, `8`, `10`, and `12` and returned:
  - `summary_mismatches: 0`
  - `item_mismatches: 0`
  - `errors: 0`
- Admin System tab now shows:
  - Rust engine health/readiness/mode/url
  - a live parity snapshot over the standard batch preset
- local full-stack Rust dev command:
  - `npm run dev:stack`
- release parity guard:
  - `npm run check:rust:release`
  - root `npm run package` now runs the Rust parity guard before packaging
  - root `npm run release` inherits the guard through `package`
  - escape hatch for local override: `SKIP_RUST_RELEASE_GUARD=1`
- parity artifacts:
  - markdown: `AI/reports/rust-parity-latest.md`
  - json: `AI/reports/rust-parity-latest.json`
  - packaged copies: `dist/release-checks/`
  - packaged manifest: `dist/release-checks/manifest.json`

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

- quote assistant foundation:
  - persistent quote-scoped assistant transcripts (`quote_agent_messages`)
  - authenticated `/api/ai/quotes/:id/assistant` read/write endpoints
  - provider abstraction with OpenAI synthesis and non-LLM fallback mode
  - Quote Detail `Assistant` tab for operator-facing, read-only quote help
  - initial tool registry covering quote overview, financials, inventory pressure, recent activity, item recommendations, and follow-up drafting

- first-pass role/page permission framework with `roles` + `role_permissions`
- seeded `worker` role plus first permission-aware route/client gating pass
- Admin Roles tab for creating custom roles and assigning `none/read/modify` module permissions
- fulfillment framework with item check-in state, internal fulfillment notes, and a new project detail Fulfillment tab
- availability now continues reserving fulfilled quantities until manual check-in, even after project close

- self-service user profiles with first/last name, phone, email, photo, and bio
- distinct generated `username` and `display_name` fields, with first/last name now treated as the primary user identity
- protected `/profile` page plus full-profile `GET/PUT /api/auth/me`
- team roster cards upgraded from email-only identity to profile-driven names/photos/usernames/details
- Sharp-based image compression for new uploads with `thumb` / `ui` / `large` variants, optional AVIF mirrors, and settings-driven quality control
- upload processing now skips images under 200 KB to avoid small-file bloat, supports a settings toggle for compression, supports a separate auto-WebP toggle, and uses a faster image-encoding profile during processing
- Team workspace with persistent presence, YTD staff sales totals, quote counts, and recent-project roster cards under `Directory`
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
- server-side pagination and batched totals on the projects list
- lazy-loaded `QuoteDetailPage` and `PublicQuotePage` secondary panels
- abortable/deduped client requests plus budget-aware route prefetching
- inventory/files virtualization and quote-builder row memoization
- sales pipeline analytics dashboard with React Query, Recharts, filter rail, hover breakdown panel, and historical/forecast KPI splits
- Mapbox-powered `/maps` workspace with clustered quote/booked/closed pins and persisted quote geocode cache fields
- sidebar/navigation recently reorganized around the maps rollout: `Maps` below `Projects`, `Messages` above `Inventory`, `Inventory` below `Directory`, standalone `Billing` below `Files`, and `Extension` moved under `Settings`
- quote ownership via `quotes.created_by` for staff-aware analytics filtering
- `ARCH-1` route/service extraction is now materially advanced across quotes, items, files, and leads
- `ARCH-2` DB-layer split is now materially advanced across schema, migrations, defaults, metadata, shared queries, and the first repository boundary

Still genuinely open:

1. formal e-sign / compliance review beyond the current internal audit trail
2. permission-system migration follow-through on the remaining legacy route domains and page actions
3. worker/read-only project-detail polish beyond the current fallback presentation
4. section reordering
5. custom-item description editing workflow
6. richer signed contract history UX beyond the current Files tab labels/locks
7. legacy image-library backfill / optional reprocessing for older pre-variant uploads
8. remaining mobile / cross-theme QA and follow-up polish
9. focus-trap / color-indicator accessibility follow-up
10. deeper architecture follow-through on remaining route domains, client data/cache, and quote-editor state
11. quote assistant settings UI + richer operational tools (availability, fulfillment, message digest)

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
- After a meaningful workflow or architecture change lands, update `ai/STATUS.md`, `ai/HANDOFF.md`, and `ai/DATA_MODELS.md` if schema changed.
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

---

## Latest Implementation Handoff — Quote Assistant

Implemented on 2026-03-31.

Follow-up pass on 2026-04-01:

- assistant context widened so it can see quoted item quantities and stock levels
- recommendation prompt now includes quote/venue/section context plus current quoted quantities
- Quote Assistant panel now shows a quote snapshot and visible item chips
- clear-history action moved onto a dedicated `/api/ai/quotes/:id/assistant/clear` path for reliability

Files added:

- `server/services/agent/itemSuggestionService.js`
- `server/services/agent/agentProviderService.js`
- `server/services/quoteAssistantService.js`
- `client/src/components/QuoteAssistantPanel.jsx`
- `client/src/components/QuoteAssistantPanel.module.css`
- `AI/AGENT_ASSISTANT_PLAN.md`

Files changed:

- `server/routes/ai.js`
- `server/db/migrations/quotes.js`
- `client/src/api.js`
- `client/src/pages/QuoteDetailPage.jsx`
- `AI/TODO.md`
- `AI/HANDOFF.md`

Important notes:

- the assistant is intentionally read-only
- it persists transcript messages per quote, but there is no delete/export UI yet
- only OpenAI is live-wired today; the abstraction is there so more providers can be added cleanly
- the assistant uses domain tools first and LLM synthesis second

Suggested next owner:

- Codex for availability/message/fulfillment tool expansion
- Claude for sharpening assistant UX wording and action-approval design before enabling mutations

---

## Latest Implementation Handoff — Rust Package Traceability

Implemented on 2026-04-02.

- `scripts/postpackage.js` now writes a packaged [RELEASE-CHECKS.md](/home/frosty/workspace/badshuffle/dist/RELEASE-CHECKS.md) summary into `dist/`
- the packaged [manifest.json](/home/frosty/workspace/badshuffle/dist/release-checks/manifest.json) remains the machine-readable source of truth for Rust parity metadata
- packaged outputs now clearly include both human-readable and machine-readable release-check artifacts

Files changed:

- `scripts/postpackage.js`

Verification:

- `node -c scripts/postpackage.js`
- `node scripts/postpackage.js`
- verified `dist/RELEASE-CHECKS.md`
- verified `dist/release-checks/manifest.json`

Suggested next owner:

- Codex for optional installer/about-screen surfacing of release-check metadata

---

## Latest Implementation Handoff — Rust Release Checks In Admin

Implemented on 2026-04-02.

- admin diagnostics now expose packaged Rust release-check artifacts through `/api/admin/diagnostics/rust-engine/release-checks`
- the System tab shows packaged parity metadata, package timestamp/version, artifact paths, and the packaged `RELEASE-CHECKS.md` summary
- when `dist/` has not been built yet, the admin panel falls back to the latest `AI/reports/rust-parity-latest.json` payload instead of showing nothing

Files changed:

- `server/routes/admin.js`
- `client/src/api.js`
- `client/src/pages/AdminPage.jsx`
- `client/src/pages/AdminPage.module.css`

Verification:

- `node -c server/routes/admin.js`
- `npm --prefix client run build`

Suggested next owner:

- Codex for optional release-check download/export actions or About-page surfacing

---

## Latest Implementation Handoff — Rust Admin Actions

Implemented on 2026-04-02.

- the admin System tab can now trigger a fresh Rust parity run without leaving the app
- manual parity runs overwrite the standard `AI/reports/rust-parity-latest.{md,json}` artifacts so admin and CLI share the same "latest" report
- operators can now download the packaged parity JSON and packaged `RELEASE-CHECKS.md` summary directly from the admin UI

Files changed:

- `server/routes/admin.js`
- `client/src/api.js`
- `client/src/pages/AdminPage.jsx`

Verification:

- `node -c server/routes/admin.js`
- `npm --prefix client run build`

Suggested next owner:

- Codex for optional per-quote parity drilldown or a release-check history timeline

---

## Latest Implementation Handoff — Rust Parity Drilldown

Implemented on 2026-04-02.

- the admin Rust parity snapshot now has an `Inspect` action per quote
- quote drilldown loads the full compare payload through the existing quote-compare endpoint and shows summary/item match state, compact diff counts, and raw mismatch payloads when present
- the drilldown is read-only and uses the same quote comparison service already used by CLI and admin diagnostics

Files changed:

- `client/src/pages/AdminPage.jsx`
- `client/src/pages/AdminPage.module.css`

Verification:

- `npm --prefix client run build`

Suggested next owner:

- Codex for adding quote links/item labels inside the drilldown instead of raw ids only

---

## Latest Implementation Handoff — Rust Drilldown Labels

Implemented on 2026-04-02.

- the Rust parity compare payload now includes quote metadata and item titles
- the admin drilldown now shows quote names/status, links directly into `/quotes/:id`, and displays changed item titles instead of only raw ids
- compact diff summaries now carry labeled `changed_items` arrays for both summary and item mismatches

Files changed:

- `server/services/rustInventoryParityService.js`
- `client/src/pages/AdminPage.jsx`
- `client/src/pages/AdminPage.module.css`

Verification:

- `node -c server/services/rustInventoryParityService.js`
- `npm --prefix client run build`

Suggested next owner:

- Codex for linking individual changed items to inventory detail pages or surfacing section labels in compare payloads

---

## Latest Implementation Handoff — Rust Drilldown Context

Implemented on 2026-04-02.

- the Rust parity compare payload now includes optional section metadata and a resolved target date window
- the admin drilldown shows section title, target window, and links changed items directly to `/inventory/:id`
- changed item lists now render as linked item labels instead of plain text

Files changed:

- `server/services/rustInventoryParityService.js`
- `client/src/pages/AdminPage.jsx`
- `client/src/pages/AdminPage.module.css`

Verification:

- `node -c server/services/rustInventoryParityService.js`
- `npm --prefix client run build`

Suggested next owner:

- Codex for surfacing legacy-vs-Rust reservation source details like reserved/potential/set-aside totals per changed item

---

## Latest Implementation Handoff — Rust Engine Start Control

Implemented on 2026-04-02.

- the admin diagnostics API now exposes `POST /api/admin/diagnostics/rust-engine/start`
- the System tab can now start the Rust engine directly, then refresh health/readiness automatically
- Rust diagnostics now show the manual start command, tracked PID, last start timestamp, and the engine log path at `logs/rust-engine.log`

Files changed:

- `server/routes/admin.js`
- `client/src/api.js`
- `client/src/pages/AdminPage.jsx`

Verification:

- `node -c server/routes/admin.js`
- `npm --prefix client run build`

Suggested next owner:

- Codex for optional stop/restart controls or streaming the Rust log into admin diagnostics

---

## Latest Implementation Handoff — Rust Autostart And Stop

Implemented on 2026-04-02.

- Rust engine lifecycle is now handled by a shared `rustEngineLifecycleService`
- the server will auto-start the Rust engine on app boot when `rust_autostart_enabled` is on
- Admin System settings now include a `Auto-start Rust engine on app startup` toggle
- Admin Rust diagnostics now include a `Stop Rust engine` button for debugging
- stop is intentionally limited to Rust processes started by BadShuffle itself; externally started Rust processes are shown as running but cannot be force-stopped from Admin

Files changed:

- `server/services/rustEngineLifecycleService.js`
- `server/index.js`
- `server/routes/admin.js`
- `server/db/defaults/app.js`
- `client/src/api.js`
- `client/src/pages/AdminPage.jsx`

Verification:

- `node -c server/services/rustEngineLifecycleService.js`
- `node -c server/index.js`
- `node -c server/routes/admin.js`
- `npm --prefix client run build`
- live lifecycle smoke test against `rustEngineLifecycleService`

Suggested next owner:

- Codex for optional restart action or external-process attach/detach support

---

## Latest Implementation Handoff — Rust Pricing Engine Pass 1

Implemented on 2026-04-02.

- added a new Rust `pricing-engine` crate for quote totals calculation
- exposed `POST /engine/pricing/check` from the Rust API
- added Node-side pricing parity comparison through `rustPricingParityService`
- added admin diagnostics route `GET /api/admin/diagnostics/rust-engine/pricing/:quoteId`
- updated Node quote totals to expose `taxableAmount` so pricing parity compares the full totals shape

Files changed:

- `rust-core/Cargo.toml`
- `rust-core/crates/api/Cargo.toml`
- `rust-core/crates/api/src/main.rs`
- `rust-core/crates/shared-types/src/lib.rs`
- `rust-core/crates/pricing-engine/Cargo.toml`
- `rust-core/crates/pricing-engine/src/lib.rs`
- `server/services/rustEngineClient.js`
- `server/services/rustPricingParityService.js`
- `server/services/quoteService.js`
- `server/routes/admin.js`
- `AI/TODO.md`
- `AI/Next-Release.md`

Verification:

- `cargo check --manifest-path rust-core/Cargo.toml`
- `node -c server/services/rustPricingParityService.js`
- `node -c server/services/rustEngineClient.js`
- `node -c server/routes/admin.js`
- live smoke test on temporary Rust port `3102`:
  - `POST /engine/pricing/check` for quote `4` returned totals
  - Node parity compare for quote `4` returned `match: true`

Suggested next owner:

- Codex for adding pricing parity visibility to the Admin Rust panel and extending pricing inputs to section-level totals or snapshot signing use cases

---

## Latest Implementation Handoff — Rust Pricing Parity In Admin

Implemented on 2026-04-02.

- the Admin Rust quote drilldown now also loads quote pricing parity for the selected quote
- pricing parity shows match/mismatch state plus subtotal, delivery, custom item, adjustment, taxable amount, tax, and total values from the Rust side
- when pricing mismatches occur, the drilldown now renders both the pricing diff and the full legacy-vs-Rust totals payload

Files changed:

- `client/src/api.js`
- `client/src/pages/AdminPage.jsx`

Verification:

- `npm --prefix client run build`

Suggested next owner:

- Codex for adding a dedicated pricing parity batch snapshot or wiring a feature-flagged Rust totals path into quote detail

---

## Latest Implementation Handoff — Rust Pricing Snapshot

Implemented on 2026-04-02.

- added batch pricing parity comparison support in `rustPricingParityService`
- added `GET /api/admin/diagnostics/rust-engine/pricing` for multi-quote pricing parity snapshots
- the Admin System tab now shows a Rust pricing snapshot card with quotes checked, mismatch count, error count, and per-quote pricing match state
- pricing snapshot rows reuse the existing quote inspect flow so availability and pricing drilldown stay aligned

Files changed:

- `server/services/rustPricingParityService.js`
- `server/routes/admin.js`
- `client/src/api.js`
- `client/src/pages/AdminPage.jsx`

Verification:

- `node -c server/services/rustPricingParityService.js`
- `node -c server/routes/admin.js`
- `npm --prefix client run build`

Suggested next owner:

- Codex for wiring a feature-flagged Rust quote totals path into quote detail or adding a pricing parity report artifact similar to inventory parity
# Rust Pricing Consolidation

- Consolidated Rust scope around the two active engine domains only: inventory availability/conflicts and quote pricing.
- Added `server/services/quotePricingCore.js` so legacy totals math has one reusable core instead of being embedded only in `quoteService`.
- Added `server/services/quotePricingEngineService.js` with:
  - `USE_RUST_PRICING`
  - `RUST_PRICING_SHADOW_MODE`
  - Rust pricing fallback to legacy
  - mismatch/fallback diagnostics via `diagnostics.recordErrorTrail`
- Wired Rust pricing into:
  - public contract signing totals in `quoteService.signPublicContract`
  - quote assistant financials tool
- Updated Rust engine status to expose pricing feature-flag state.
# Rust Engine Capability Detection

- Added Rust engine capability probing in `server/services/rustEngineLifecycleService.js`.
- Admin Rust diagnostics now distinguish:
  - service health
  - inventory route availability
  - pricing route availability
  - `build_state` (`current` vs `outdated_or_prepricing`)
- Added `POST /api/admin/diagnostics/rust-engine/restart` and Admin UI support for `Restart Rust engine`.
- Important current runtime state:
  - the live Rust process on port `3101` is healthy
  - inventory route is present
  - pricing route returns `404`
  - `tracked_pid` is `null`, which means the running Rust process was started externally and cannot be restarted safely from Admin
- Next operational step:
  - stop the external Rust process
  - start/restart Rust on the current build
  - confirm `/engine/pricing/check` is available
  - rerun pricing parity snapshot

## 2026-04-03 Quote Pattern Memory
- Added structured quote-pattern memory records backed by `quote_pattern_memories` and `quote_pattern_memory_tags`.
- Memory sync now runs on quote create/update/send/sign/status transition.
- Assistant now has `similar_quotes` retrieval and pattern-driven recommendation enrichment.
- Admin System now exposes recent memory records and similar-quote inspection, with first-load backfill from historical quotes.

## 2026-04-03 Onyx Team Chat
- Added self-hosted Onyx integration settings and server proxy service.
- Added internal team chat threads plus quote-scoped AI threads backed by `team_chat_threads` and `team_chat_messages`.
- Added `/team-chat` UI and embedded quote-thread AI in Messages.
- Onyx uses curated BadShuffle context only: quote details, recent quote thread messages, pattern memory, and entity references in team chat prompts.
