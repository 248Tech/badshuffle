# Changelog

All notable changes are documented here. The project uses [Semantic Versioning](https://semver.org/). **Until 1.0.0, all releases are pre-release** and the public API may change.

## Version history (canonical)

- **0.0.1** - Initial consolidated public release
- **0.0.2** - Quote flow, public messaging, and theming release
- **0.0.3** - Pricing controls, reusable policies, and UX polish release
- **0.0.4** - Startup stability hotfix release
- **0.0.5** - In-app updater and extension fallback import release
- **0.0.6** - UI foundation and layout redesign release
- **0.0.7** - Projects-first workflow and operations tooling release
- **0.0.8** - Navigation, admin backup, UX polish, and hotfix stabilization release
- **0.0.9** - Security hardening and quote-workflow refactor release
- **0.0.10** - Workflow expansion, public quote polish, and release-readiness release
- **0.0.11** - Visibility, operations surfaces, and architecture-scaling release
- **0.0.12** - Operations, AI platform, and engine release

---

## [0.0.12] - 2026-04-05

### Added
- **Rust engine workspace and rollout guardrails** - Added the full `rust-core/` workspace, Rust lifecycle controls, parity reporting, a release guard, and Node-facing integration seams for availability/conflicts and pricing.
- **Quote Assistant and AI orchestration** - Added quote-scoped assistant workflows, provider/model routing, richer item description controls, and managed local AI support through Ollama and Onyx integration.
- **Notifications, Team Chat, and Team Groups** - Added live notification routes/services/UI, notification settings, internal team chat, and grouped team-targeting workflows.
- **Inventory operations tooling** - Added set-aside workflows, product scan codes, serial numbers, barcode rendering, pull sheets, aggregate pull export, stronger stats, and expanded mobile/desktop inventory controls.
- **Operator support surfaces** - Added Help, Appearance settings, Clients, Venues, notification settings, team chat, aggregate pull export, and scan redirect pages.
- **Release notes for 0.0.12** - Added `RELEASE_NOTES_0.0.12.md` for release publishing and repository-facing version context.

### Changed
- **Public repo presentation** - README, badges, release links, and release-facing docs now reflect the `0.0.12` feature set and shipping story.
- **Inventory UX and search behavior** - Inventory now supports loose/exact search modes, ranked matching, denser control over layout, mobile-safe one-column mode, and more operational AI edit flows.
- **Quote/project operator flow** - Quote detail now includes pull sheets and assistant workflows, the project list has column management and combined pull export, and quote-builder conflict visibility is clearer.
- **Admin/runtime management** - Admin > System now exposes richer runtime controls for Rust, Onyx, and Ollama instead of treating those subsystems as mostly hidden infrastructure.
- **Settings architecture** - Settings now has deeper AI provider/model control, appearance-specific settings, notification placement/icon controls, and team-chat fallback options.

### Fixed
- **Startup and request noise** - Dev startup now waits for API readiness more cleanly, and high-churn client requests were reduced with deduping/abort behavior on key flows.
- **Notification dismissal behavior** - Notification dismissals now persist correctly, mobile swipe interactions are faster, and tray placement/visibility issues were corrected.
- **Inventory usability regressions** - Inventory scrolling, mobile row controls, search filtering, and product-card interaction issues were corrected while keeping the recent performance work.
- **Onyx failure handling** - Team chat and quote-thread AI no longer hard-fail on common Onyx runtime/config errors and can fall back to the configured assistant path when enabled.

---

## [0.0.11] - 2026-03-31

### Added
- **Maps workspace and geocode API** - Added operator-facing maps support with `server/routes/maps.js`, Mapbox-backed geocoding services, and persisted quote map cache fields.
- **Sales analytics foundation** - Added `/api/sales/analytics` plus a dedicated client sales-dashboard feature area for pipeline-style reporting.
- **Team, profile, and fulfillment surfaces** - Added team workspace routes/UI, profile pages, and fulfillment panels/workflows for confirmed projects.
- **Expanded API/integration docs** - Added `AI/Api/*` documentation covering authentication, inventory, quotes, public catalog use, data models, and integration planning.
- **Release notes for 0.0.11** - Added `RELEASE_NOTES_0.0.11.md` for release publishing and repository-facing version context.

### Changed
- **Backend persistence architecture** - `server/db.js` now works alongside dedicated `server/db/schema/*`, `server/db/migrations/*`, `server/db/defaults/*`, and `server/db/queries/*` modules instead of being the only schema/migration home.
- **Quote backend decomposition** - More quote logic has moved out of route handlers and into focused services/repositories for list, finance, files, fulfillment, lifecycle, sections, and contract flows.
- **Public repo presentation** - README, badges, project structure notes, quickstart, and package metadata now reflect the `0.0.11` feature set and setup expectations.

### Fixed
- **Stale architecture docs** - Project-overview and architecture notes now describe the current repo layout instead of older pre-fulfillment/pre-maps assumptions.
- **Release metadata drift** - Package manifests, lockfiles, README release links, and changelog state now align to `0.0.11`.

## [0.0.10] - 2026-03-29

### Added
- **Section-aware quote workflows** - Quote item areas now support editable titles, duplication/deletion, grouped subtotals, and richer public/export rendering aligned to client-visible structure.
- **Settings-backed event and file governance** - Added configurable event types, optional auto-append-city project naming, and a settings-driven extra allowed file type list for uploads.
- **Signed contract artifact lifecycle** - Contract signing now preserves versioned signed PDFs and surfaces stronger audit metadata around signature events/files.
- **Release notes for 0.0.10** - Added `RELEASE_NOTES_0.0.10.md` to support packaging, tagging, and downstream release publishing.

### Changed
- **Public quote experience** - Client quote views now show section titles, section date ranges, item descriptions, and section subtotals instead of flattening everything into one generic item list.
- **Project financial clarity** - Signed projects, unsigned changes, and outstanding balance visibility now follow signed-state rules more closely in list/tile and detail flows.
- **Inventory editing UX** - Inventory item editing can now stay in-context via a right-side slideout instead of forcing a full-page jump from the inventory grid.
- **Route transition performance** - App navigation now warms likely route bundles after auth and prefetches target pages on hover/focus for faster first-hit transitions.
- **GitHub/discoverability metadata** - README, package metadata, release badges, and release-facing copy were refreshed to better communicate product scope and engineering quality.

### Fixed
- **Quote section deletion semantics** - Deleting a quote item group now deletes the items inside it instead of orphaning/moving them unexpectedly.
- **Public quote grouping bugs** - Client-facing quote sections now use their actual configured titles and latest live-state data, including unsigned changes where appropriate.
- **Project tile interaction** - Clicking a project tile now opens the project instead of trapping the user in accidental multi-select behavior.
- **Inventory card navigation** - Clicking inventory card media/title from the inventory page now opens the edit workflow expected for that context.

## [0.0.9] - 2026-03-26

### Added
- **Quote workflow service modules** - Added `server/lib/quoteActivity.js`, `server/services/itemStatsService.js`, and `server/services/quoteService.js` so activity logging, item analytics bookkeeping, quote send, duplication, and status transitions are reusable outside the route layer.
- **Quote UI extraction primitives** - Added `client/src/lib/quoteTotals.js`, `client/src/hooks/useQuoteDetail.js`, extracted quote modals (`ImagePicker`, `QuoteFilePicker`, `QuoteSendModal`), and dedicated `quote-builder/` panel components.
- **Release notes for 0.0.9** - Added a dedicated `RELEASE_NOTES_0.0.9.md` summary for packaging/tagging and downstream release publishing.

### Changed
- **Quote detail architecture** - `QuoteDetailPage.jsx` has been reduced substantially by moving shared state and modal/file-picker concerns into dedicated modules.
- **Quote builder architecture** - `QuoteBuilder.jsx` now delegates line-item editing, adjustment management, and inventory browsing to smaller focused panels.
- **Shared pricing logic** - Public and operator quote totals now derive from the same shared helper instead of duplicating pricing/adjustment math in two pages.
- **Backend route structure** - `server/routes/quotes.js` now routes through extracted quote services/helpers instead of hosting the core orchestration inline.

### Fixed
- **JWT and extension-auth fallback behavior** - Auth middleware no longer leaves broad route access coupled to a generic extension token path.
- **Public file and quote exposure** - File serving and public quote payloads now use tighter access checks and smaller response surfaces.
- **Upload and attachment safety** - File uploads are validated from actual file signatures, and outbound quote mail only attaches files already linked to the quote.
- **Public quote state mutation guardrails** - Public approval/signing-related flows now have stronger state checks and safer backend handling.

## [0.0.8] - 2026-03-24

### Added
- **Admin database backup workflows** - Added `GET /api/admin/db/export` and `POST /api/admin/db/import`, plus Admin UI actions to download and restore SQLite `.db` backups.
- **Directory workspace** - Added a dedicated Directory page that groups Leads and Vendors under one navigation entry.
- **Dedicated settings subpages** - Added Inventory Settings and Message Settings pages with persisted settings scaffolding for inventory display and outbound messaging preferences.
- **Global crash fallback** - Added a top-level React `ErrorBoundary` with a user-facing reload recovery screen.
- **Verbose error diagnostics toggle** - Added the `verbose_errors` setting so operators can temporarily expose detailed server and crash-screen error messages while debugging.

### Changed
- **Sidebar information architecture** - Reworked navigation into grouped sections with collapsible mode, hover flyouts, unread/pending badges, and live team presence context.
- **Inventory and leads loading/search UX** - Replaced spinner-only states with skeleton loaders, added contextual empty-search messages with reset actions, and lazy-loaded inventory thumbnails.
- **Quote builder polish** - Added add-to-project flash feedback and refined line-item spacing/thumbnail treatment.
- **Theme consistency pass** - Replaced remaining hardcoded accent/focus colors with theme tokens, fixed the Files page elevated-surface token mismatch, and added a max-width constraint to the main layout.
- **Dashboard polish** - Updated KPI accent styling to use theme variables and improved loading presentation during data fetches.
- **Route-level bundle loading** - Converted heavy operator and public screens to lazy-loaded routes so the initial client payload is smaller and secondary pages only load when visited.
- **Quote detail editing safety** - Quote detail now tracks dirty form state, blocks in-app navigation when edits are unsaved, and warns on browser reload/close.
- **Messages mobile layout** - The Messages workspace now swaps to a focused single-pane detail flow on smaller screens instead of forcing the desktop split-pane layout.

### Fixed
- **Public quote browser tab title** - Public quote pages now set `document.title` from the active quote name.
- **Toast accessibility** - Toast notifications now announce through `role="status"` and `aria-live`.
- **Inventory card action labels** - Icon-only item card actions now expose accessible names for assistive technologies.
- **Spreadsheet import title validation** - Sheets import now rejects numeric-only item titles, preventing Excel date serials and bare numeric IDs from being imported as inventory names.
- **Item API metadata parity** - Item create/update/bulk upsert flows now preserve `contract_description` consistently while also rejecting numeric-only titles.
- **Quote creation failure handling** - Quote creation now returns a structured API error instead of bubbling an unhandled server failure.

---

## [0.0.7] - 2026-03-24

### Added
- **Projects/files linkage endpoint** - Added `GET /api/files/:id/quotes` so file management surfaces can show where assets are attached.
- **Unsigned-change dismissal endpoint** - Added `DELETE /api/quotes/:id/unsigned-changes` for staff to acknowledge post-signature changes without forcing immediate resend.
- **Contract template editing API** - Added `PUT /api/templates/contract-templates/:id`.
- **Inventory item typing** - Added `items.item_type` (default `product`) with support in item create/update/list filtering.
- **Date range picker presets** - Added quick presets plus month/year selectors in the shared range picker UI.

### Changed
- **Projects-first terminology and UX** - Major UI language shift from “Quotes” to “Projects” across primary operational screens.
- **Project list controls** - Added sorting options and improved search/filter ergonomics in the projects index.
- **Project detail experience** - Improved lifecycle actions, expiration/unsigned-change visibility, payment/file detail handling, and logistics/payment-related workflows.
- **Project creation flow** - Consolidated from a 2-step wizard into a single-screen form.
- **Files page operations** - Added list/tile refinements, richer inspection drawer, linked-project visibility, and bulk action polish.
- **Billing workspace** - Added outstanding balances view and stronger search/sort/export handling.
- **Leads workspace** - Added search suggestions/autocomplete and sortable table columns.
- **Inventory editing model** - Added item type controls, subrental toggles, image-upload flow, and optional source indicator visibility setting.
- **Public project page labels** - Improved naming consistency and policy/terms title display.

### Fixed
- **Image thumbnail auth in Files UI** - File serve URLs now accept token query auth for image-tag compatibility.
- **Upcoming event date normalization** - Dashboard summary now normalizes non-ISO event dates before upcoming-range comparisons.
- **Duplicate project token hygiene** - Duplicated projects now clear inherited `public_token`.
- **Expired signing enforcement** - Expired projects are now consistently blocked from contract signing.

---

## [0.0.6] - 2026-03-24

### Added
- **Derived interactive theme tokens** - Added `--color-primary-subtle` and `--color-primary-hover` across built-in themes for consistent hover/active treatments.
- **Global interaction utilities** - Added reusable `.skeleton` shimmer and `.quoteItemAdded` flash animation classes for loading/feedback UI patterns.

### Changed
- **Foundation visual layer** - Body background now uses a softer surface tone to improve card/page separation and long-session readability.
- **Global interaction feel** - Buttons now include subtle press feedback, and cards get smoother hover elevation transitions.
- **Layout constraints** - Main content now uses stronger side padding plus a max-width cap (`1440px`) to avoid overstretched wide-screen layouts.
- **Sidebar navigation polish** - Nav links have improved spacing, cleaner active indication (left accent), and clearer hover behavior.
- **Dashboard clarity** - Stat cards now use colored left accents by metric, and empty states for Upcoming Events/Inventory Conflicts were upgraded from plain text to illustrated placeholders.
- **Inventory browsing polish** - Category filters now scroll horizontally, item cards use fixed 4:3 media, and action overlays are hover-driven on desktop while remaining visible on touch devices.
- **Quote detail presentation** - Summary/totals panel is sticky, grand total emphasis increased, and quote/custom item row styling now reads as card-based UI.
- **Table readability (Leads/Billing)** - Row density and sticky header behavior were improved for scanability and click targets.
- **Import flow step styling** - Stepper visuals now include explicit completed states (green check progression) in addition to active/inactive styling.
- **Messages empty/thread states** - Thread rows have stronger minimum height and empty states now provide icon + contextual guidance.

---

## [0.0.5] - 2026-03-23

### Added
- **Packaged in-app updater endpoints** - New authenticated routes `GET /api/updates`, `GET /api/updates/releases`, and `POST /api/updates/apply` provide current-version status, GitHub release listing, and package-aware release installation.
- **Settings update console** - Settings now includes an Updates card with version status, release picker, "What's New" body preview, install trigger, and restart health polling.
- **Extension JSON fallback import** - Import page adds an **Extension JSON** tab so scraped extension payloads can be pasted and imported directly.
- **Bulk item ingestion route** - `POST /api/items/bulk-upsert` now supports extension fallback import with create/update counts in one request.

### Changed
- **Extension connectivity model** - Extension popup now stores a configurable server URL, and extension sync requests use that stored target instead of a hardcoded localhost API endpoint.
- **Extension recovery behavior** - Background sync now always saves the last scraped payload so the popup can export JSON even when network sync fails.
- **Extension download URL resolution** - ExtensionPage download action now respects `VITE_API_BASE` instead of relying on a hardcoded absolute localhost URL.

---

## [0.0.4] - 2026-03-19

### Fixed
- **Inventory empty-state crash on fresh startup** - Removed an undefined `search` reference in `ItemGrid` that could throw a `ReferenceError` when items were empty.
- **Unhandled inventory load rejection during sql.js init** - `InventoryPage` now catches failed `getItems` requests so startup fetch failures degrade gracefully instead of cascading into a blank page.

---

## [0.0.3] - 2026-03-18

### Added
- **Per-item quote pricing controls** - Quote lines now support discount metadata (`discount_type`, `discount_amount`) alongside drag-to-reorder for cleaner quote composition.
- **Reusable quote policy content** - New payment policy and rental terms templates can be managed centrally and attached to individual quotes.
- **Item accessory relationships** - Inventory items can now store accessory links for future quote-builder automation.
- **Repo metadata polish** - Added a real `LICENSE` file and refreshed the GitHub-facing README for clearer discovery and evaluation.

### Changed
- **Public quote experience** - Quote expiration is now surfaced consistently, discounted pricing is reflected in public totals, and public approvals/signatures respect expiration state.
- **Operator UX** - Added UI scale controls, direct quote navigation from Messages, clearer quote status borders, and more polished quote-builder pricing affordances.
- **Quickstart and discoverability** - README now leads with product value, deployment options, badges, keywords, and a cleaner getting-started flow.

### Fixed
- **Legacy public quote API parity** - `/api/quotes/public/:token` now returns expiration status, payment policy data, rental terms, and discount fields so the public React page matches the backend feature set.
- **Accessory messaging accuracy** - InventoryPage no longer claims permanent accessories auto-add to quotes before that behavior exists.
- **Local runtime noise** - `.gitignore` now correctly excludes local lockfiles, runtime uploads, and editor-specific config so release diffs stay focused.

---

## [0.0.2] - 2026-03-18

### Added
- **Quote filtering API + UI** - `GET /api/quotes` now supports `search`, `status`, `event_from`, `event_to`, `has_balance`, and `venue` filters. Quotes page adds filter controls and a date-range picker.
- **Public quote live thread** - New no-auth endpoints `GET/POST /api/quotes/public/:token/messages` plus public quote UI for live polling and client message submission.
- **Theme + map settings** - New Settings keys `ui_theme`, `google_places_api_key`, and `map_default_style`; new theme picker and Google Places setup UI.
- **Availability picker endpoint** - `GET /api/availability/quote/:quoteId/items?ids=...` returns stock/reserved/potential counts for specific item IDs on the quote date window.
- **Inventory contract description support** - `items.contract_description` column added and wired through item create/update/upsert and extension upsert payloads.

### Changed
- **Quote creation flow** - Quotes page now uses a 2-step wizard (event details then client info) and can auto-complete client addresses with Google Places.
- **Quote builder availability UX** - Line items and inventory picker show explicit stock/booked badges and conflict states; subrental lines are labeled in-editor.
- **Quote item update semantics** - Updating quote or custom item quantity to `0` now removes the line item server-side and logs activity.
- **Runtime port handling** - Server auto-finds a free localhost port when `PORT` is not set; chosen port is written into `badshuffle.lock` and Vite proxy reads it.
- **Cross-platform dev script** - `server/package.json` now uses `cross-env` for `NODE_ENV=development`.
- **Billing labels and visibility rules** - UI copy switched from "Contract total" to "Quote total"; remaining balance is shown only in statuses where it is meaningful.

### Fixed
- **Goodshuffle extension scraping resilience** - Content script extraction now uses layered strategies (label scan, ng-model, CSS/text fallback), improving coverage across catalog and item detail layouts.

---

## [0.0.1] - 2026-03-17

### Added
- **Public catalog** - No-auth catalog at `/catalog` and `/catalog/item/:id`, backed by `server/routes/publicCatalog.js`, `robots.txt`, `sitemap.xml`, and `/api/public/*` JSON endpoints for SEO-friendly browsing.
- **Docker deployment** - `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-entrypoint.sh` for containerized local and production-style runs with persistent `/data` storage.
- **AI integration settings** - Encrypted Claude, OpenAI, and Gemini API key fields plus per-feature enable/model controls in Settings.
- **Availability and subrental foundation** - Availability conflict endpoints, vendor/subrental support, and rental date fields shipped in the initial consolidated release baseline.

### Changed
- **Development launch flow** - Added `npm run dev:host` and `npm run dev:docker`; server dev mode now sets `NODE_ENV=development`, and dev-only `/api/auth/dev-login` can seed a local admin automatically while developing.
- **Runtime configurability** - `DB_PATH`, `UPLOADS_DIR`, and `APP_URL` are respected so Docker and production builds can use external storage and correct canonical URLs.
- **Operator UX** - Mobile sidebar/overlay, better touch targets, category chips on Inventory, quote item drag-and-drop reordering, and broader responsive layout cleanup across the client.
- **Deployment behavior** - Production server can now serve the built React client from `client/dist`.
- **Docs** - Project docs and onboarding context were refreshed for the consolidated release line.
