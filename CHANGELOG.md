# Changelog

All notable changes are documented here. The project uses [Semantic Versioning](https://semver.org/). **Until 1.0.0, all releases are pre-release** and the public API may change.

## Version history (canonical)

- **0.1.0** – Initial release
- **0.1.1**, **0.1.2** – Early fixes
- **0.2.0** – Feature release
- **0.3.0**, **0.3.1** – Quote workflow, admin CLI, leads, auth improvements

**Note:** Earlier tags using a 3.x scheme were created on the remote in error. The project version line remains **0.x** until an official 1.0 release. Use **0.4.x** as the current pre-release line.

---

## [0.4.4] - 2026-03-18

### Added
- **Quote filtering API + UI** — `GET /api/quotes` now supports `search`, `status`, `event_from`, `event_to`, `has_balance`, and `venue` filters. Quotes page adds filter controls and a date-range picker.
- **Public quote live thread** — New no-auth endpoints `GET/POST /api/quotes/public/:token/messages` plus public quote UI for live polling and client message submission.
- **Theme + map settings** — New Settings keys `ui_theme`, `google_places_api_key`, and `map_default_style`; new theme picker and Google Places setup UI.
- **Availability picker endpoint** — `GET /api/availability/quote/:quoteId/items?ids=...` returns stock/reserved/potential counts for specific item IDs on the quote date window.
- **Inventory contract description support** — `items.contract_description` column added and wired through item create/update/upsert and extension upsert payloads.

### Changed
- **Quote creation flow** — Quotes page now uses a 2-step wizard (event details then client info) and can auto-complete client addresses with Google Places.
- **Quote builder availability UX** — Line items and inventory picker show explicit stock/booked badges and conflict states; subrental lines are labeled in-editor.
- **Quote item update semantics** — Updating quote or custom item quantity to `0` now removes the line item server-side and logs activity.
- **Runtime port handling** — Server auto-finds a free localhost port when `PORT` is not set; chosen port is written into `badshuffle.lock` and Vite proxy reads it.
- **Cross-platform dev script** — `server/package.json` now uses `cross-env` for `NODE_ENV=development`.
- **Billing labels and visibility rules** — UI copy switched from “Contract total” to “Quote total”; remaining balance is shown only in statuses where it is meaningful.

### Fixed
- **Goodshuffle extension scraping resilience** — Content script extraction now uses layered strategies (label scan, ng-model, CSS/text fallback), improving coverage across catalog and item detail layouts.

---

## [0.4.3] - 2026-03-17

### Added
- **Public catalog** — No-auth catalog at `/catalog` and `/catalog/item/:id`, backed by `server/routes/publicCatalog.js`, `robots.txt`, `sitemap.xml`, and `/api/public/*` JSON endpoints for SEO-friendly browsing.
- **Docker deployment** — `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-entrypoint.sh` for containerized local and production-style runs with persistent `/data` storage.
- **AI integration settings** — Encrypted Claude, OpenAI, and Gemini API key fields plus per-feature enable/model controls in Settings.

### Changed
- **Development launch flow** — Added `npm run dev:host` and `npm run dev:docker`; server dev mode now sets `NODE_ENV=development`, and dev-only `/api/auth/dev-login` can seed a local admin automatically while developing.
- **Runtime configurability** — `DB_PATH`, `UPLOADS_DIR`, and `APP_URL` are now respected so Docker and production builds can use external storage and correct canonical URLs.
- **Operator UX** — Mobile sidebar/overlay, better touch targets, category chips on Inventory, quote item drag-and-drop reordering, and broader responsive layout cleanup across the client.
- **Deployment behavior** — Production server can now serve the built React client from `client/dist`.
- **Docs** — README and AI project docs updated for the `0.4.3` release line and current launch workflows.

---

## [0.4.2] - 2026-03-07

### Added
- **Availability & conflict detection** — `/api/availability/conflicts`, `/api/availability/subrental-needs`, `/api/availability/quote/:id`; considers quote status and rental date ranges (delivery → pickup).
- **Vendor / subrental system** — `vendors` table; CRUD API; items support `is_subrental` and `vendor_id`; Vendors management page; vendor selection in item editor.
- **Rental date fields on quotes** — `rental_start`, `rental_end`, `delivery_date`, `pickup_date`; editable in quote editor.
- **Dashboard** — Conflicts panel (items over-reserved); Subrental Needs panel (items needing external source).
- **Quote builder** — Conflict indicator icon next to line items that overlap with other reservations.
- **Setting** — `count_oos_oversold` (whether out-of-stock items count toward dashboard conflict detection).
- **Client API helpers** — `getVendors`, `createVendor`, `updateVendor`, `deleteVendor`, `getConflicts`, `getSubrentalNeeds`, `getQuoteConflicts**.

### Development
- Initial Bun support testing in dev workflow (non-breaking).

---

## [0.4.1] - (tag exists; features documented in 0.4.2)

---

## [0.4.0] - 2026-03-06

### Added
- **AI folder** — Consolidated documentation for onboarding and extension: PROJECT_OVERVIEW, ARCHITECTURE, FEATURES, DATA_MODELS, WORKFLOWS, TODO, KNOWN_GAPS, SETUP, README.
- **README** — "Coming soon" section: pull sheets, role badge, email on role change, send preview, inventory reservation, delivery/return tracking.

### Changed
- GitHub README updated to v0.4.0; project structure now includes `AI/`.

---

## [0.3.2] - 2026-03-06

### Changed
- Version metadata and CHANGELOG added; canonical version remains 0.x pre-release.

### Added
- Billing page: overpaid quotes list for sales (refund due).
- Quote quickview: remaining balance below contract total (red); overpaid badge and overpaid amount when applicable.

---

## [0.3.1]

- Quote workflow, venue/totals, PDF export, leads import.

## [0.3.0]

- Admin CLI, auth guard fixes, role enforcement.

## [0.2.0]

- Extension, leads, inventory improvements.

## [0.1.x]

- Initial app: inventory, quotes, auth, setup.
