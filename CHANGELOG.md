# Changelog

All notable changes are documented here. The project uses [Semantic Versioning](https://semver.org/). **Until 1.0.0, all releases are pre-release** and the public API may change.

## Version history (canonical)

- **0.0.1** - Initial consolidated public release
- **0.0.2** - Quote flow, public messaging, and theming release
- **0.0.3** - Pricing controls, reusable policies, and UX polish release
- **0.0.4** - Startup stability hotfix release

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
