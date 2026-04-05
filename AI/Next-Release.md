# Next Release — v0.0.12

Prepared: 2026-04-05  
Repository: `badshuffle`  
GitHub baseline: `origin/master` at `5717987` (`release: v0.0.11`)

## GitHub Comparison

Local `master` and `origin/master` are still the same commit:

- local `HEAD`: `5717987`
- GitHub `origin/master`: `5717987`
- current meaning: `v0.0.12` is still a working-tree release and has not been committed to GitHub yet

Release-scope delta from the current GitHub repo, excluding local runtime/build output:

- modified tracked files: `89`
- new untracked release-source files: `86`
- total release-source paths changed or added: `175`
- diff volume: `9174` insertions, `1212` deletions

Excluded from release scope:

- `logs/`
- `rust-core/target/`
- `onyx-local/`

`onyx-local/` exists locally as managed companion runtime state and should not be treated as release source.

## Release Summary

`v0.0.12` is the operations, AI, and engine release.

Compared with the current GitHub repo, this release turns BadShuffle into a more operationally complete product with:

- a Rust engine layer for availability/conflicts and pricing parity
- built-in quote assistant workflows
- live notifications, team groups, and internal team chat
- managed local and external AI infrastructure
- pull sheets, QR product identity, and aggregate internal pick workflows
- stronger inventory operations, search, stats, and batch editing
- more complete directory, admin, help, and appearance surfaces

## Highlights

### 1. Rust engine core and guarded rollout

- adds the full `rust-core/` workspace with API, config, DB, inventory-engine, pricing-engine, shared-types, telemetry, and docs
- integrates Rust-backed inventory availability/conflict checks behind Node-facing seams
- adds pricing-engine scaffolding plus Node integration hooks and parity-oriented routing
- adds Rust lifecycle, diagnostics, parity reporting, and release gating
- adds startup flow support so the client waits for API readiness instead of throwing avoidable startup connection noise

This remains a guarded rollout, not a full stack replacement. Node/Express remains the transport layer and SQLite remains the system of record.

### 2. Quote assistant and AI platform

- adds quote-scoped assistant UI and backend services
- adds AI provider abstraction work across assistant, item descriptions, and suggestions
- adds managed local model support via Ollama
- adds Onyx lifecycle support, settings, diagnostics, CLI commands, and team-chat integration
- adds team-chat fallback to the configured BadShuffle AI assistant when Onyx is unavailable
- adds richer item-description controls for style, persona, variation, and guidance

This release is the first time AI in BadShuffle is treated as an app-level platform rather than a small isolated prompt feature.

### 3. Notifications, team coordination, and internal communication

- adds a real notifications system with inbox tray, popup cards, dismiss flows, mobile swipe behavior, bulk actions, and per-type targeting
- adds notification settings and group-aware delivery plumbing
- adds Team Groups and deeper Team workspace coordination
- adds Team Chat as a first-pass internal AI-assisted team workspace
- improves presence and team-related query/service wiring

Operationally, this is one of the biggest deltas from GitHub `v0.0.11`.

### 4. Inventory operations and internal fulfillment workflows

- adds Set Aside inventory workflow
- adds richer inventory AI editing, progress UX, redo/revert flows, shortcuts, and mobile-safe controls
- adds multi-select, shift-range selection, denser page controls, mobile one-column view, and product-card interaction cleanup
- adds stronger inventory search with loose/exact behavior and ranking
- adds product identity surfaces including QR-backed scan codes and serial numbers
- adds product sales totals and date-window filtering in stats surfaces
- adds internal pull sheets, aggregate pull export, QR-coded pull-sheet identity, and scan redirects

This release makes inventory much more useful as an internal operations surface, not just a catalog list.

### 5. Quotes, projects, and directory expansion

- adds quote pull-sheet tab and aggregate pull export from the main projects list
- adds stronger quote-detail loading behavior and builder performance improvements
- improves mobile quote-builder add-item behavior
- adds clearer quote-builder conflict messaging
- adds project list column chooser and reordering
- adds Clients and Venues directory pages plus quote-driven relationship syncing

The quote/project side of the app is materially more operator-focused in this release.

### 6. Admin, settings, help, and appearance

- expands Admin > System with Rust, Onyx, and Ollama runtime controls
- adds more complete AI settings, provider/model selectors, and fallback controls
- adds a dedicated Appearance settings page and notification tray placement/icon controls
- adds a much more detailed Help page with guided AI and app setup paths
- extends settings/defaults/migrations coverage for the new product surfaces

## Detailed Change Areas

### AI and local model operations

- managed local Ollama runtime install/detect/start/stop/restart controls
- curated local model catalog and provider wiring
- Onyx managed-local lifecycle service
- Onyx external/local settings support
- item suggestions and descriptions routed through shared provider config
- quote assistant transcript and orchestration services

Key files:

- `server/services/localModelLifecycleService.js`
- `server/services/localModelService.js`
- `server/services/onyxLifecycleService.js`
- `server/services/teamChatService.js`
- `server/services/quoteAssistantService.js`
- `client/src/pages/AdminPage.jsx`
- `client/src/pages/SettingsPage.jsx`
- `client/src/pages/HelpPage.jsx`

### Notifications and team workflows

- notification delivery, dismissal, bulk dismissal, and recipient deletion behavior
- mobile swipe and long-press interactions
- desktop/mobile tray positioning and visibility improvements
- notification settings UI
- Team Chat routes and page
- Team Groups routes and page

Key files:

- `server/routes/notifications.js`
- `server/routes/notificationSettings.js`
- `server/services/notificationService.js`
- `client/src/components/LiveNotifications.jsx`
- `client/src/pages/NotificationSettingsPage.jsx`
- `client/src/pages/TeamChatPage.jsx`
- `client/src/pages/TeamGroupsPage.jsx`

### Inventory, pull sheets, and QR identity

- item stats and sales totals
- serial number and scan code fields
- barcode rendering and scan redirect routes
- pull-sheet generation and aggregate export
- inventory search, batch AI edit, and mobile-grid behavior

Key files:

- `server/services/itemStatsService.js`
- `server/services/quotePullSheetService.js`
- `server/services/barcodeService.js`
- `server/services/scanCodeService.js`
- `server/routes/barcodes.js`
- `server/routes/scan.js`
- `client/src/pages/InventoryPage.jsx`
- `client/src/pages/QuotePullSheetExportPage.jsx`
- `client/src/pages/quote-detail/QuotePullSheetPanel.jsx`

### Rust engine and parity

- Rust workspace and docs
- Node-to-Rust client and lifecycle services
- pricing/inventory parity services
- admin diagnostics and release guard
- packaged release-check support

Key files:

- `rust-core/`
- `server/services/rustEngineClient.js`
- `server/services/rustEngineLifecycleService.js`
- `server/services/rustInventoryParityService.js`
- `server/services/rustPricingParityService.js`
- `scripts/rust-release-guard.js`

## Support Documentation Already In Repo

These documents support the release notes and define scope, architecture, and remaining verification work:

- `AI/FEATURES/V0_0_12_COMPARE_TO_GITHUB.md`
- `AI/FEATURES/V0_0_12_RELEASE_PREP.md`
- `AI/FEATURES/RUST_ENGINE_CORE_V0_0_12.md`
- `AI/HANDOFF.md`
- `AI/CURRENT_FOCUS.md`
- `AI/ARCHITECTURE.md`
- `AI/PROJECT_CONTEXT.md`
- `AI/DECISIONS.md`
- `AI/WORKFLOW.md`

## Release Risks And Verification

Before cutting `v0.0.12`, verify:

1. Rust parity on the live current build, especially availability/conflicts and pricing seams.
2. Notification delivery and dismissal across multiple users and groups.
3. Onyx managed-local behavior, hosted/external mode, and fallback-to-assistant behavior.
4. Ollama managed-local install/start/stop/model pull on the target release environment.
5. Pull-sheet generation on real quotes, including overlapping-project aggregate pull exports.
6. Inventory QR preview and scan resolution on the current server build.
7. Stats date windows and product sales totals on production-like quote data.
8. Mobile inventory, notifications, and quote-builder flows on a real device pass.

## GitHub Release Notes Draft

### Added

- Rust engine workspace and guarded availability/pricing integration
- Quote Assistant with quote-aware internal AI workflows
- Team Chat, Team Groups, notification settings, and live notifications
- managed local Onyx support and managed local Ollama support
- product QR/scan identity, serial numbers, pull sheets, and aggregate pull exports
- Clients and Venues directory pages
- guided Help and Appearance settings pages

### Improved

- inventory search, batch AI edit controls, and mobile inventory layouts
- project list controls, quote-builder conflict visibility, and quote-detail performance
- stats filtering and product sales tracking
- admin diagnostics, startup readiness handling, and packaging guardrails

### Internal

- expanded schema/defaults/migrations for notifications, AI settings, item stats, pull sheets, and product identity
- more route/service separation across quotes, items, settings, admin, team, files, and stats
- richer AI handoff and architecture documentation in `AI/`
