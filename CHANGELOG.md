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
