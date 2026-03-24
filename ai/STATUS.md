# STATUS

**Released v0.0.8** (2026-03-24): Navigation + UX polish release. Highlights: grouped collapsible sidebar with hover flyouts, unread/pending badges, and live team presence; new Directory landing page; new Inventory Settings and Message Settings pages; Admin database export/import; ErrorBoundary fallback; skeleton loaders; contextual empty-search states; lazy-loaded inventory thumbnails; toast `aria-live`; PublicQuotePage `document.title`; theme-token cleanup and layout max-width polish.

**Released v0.0.7** (2026-03-24): PRD batch 2 — files list view + bulk delete, billing search/sort/export, single-screen new project creation. PRD batch 1 — rename Quotes→Projects, fix inventory hover, file auth, search bars.

**Released v0.0.6** (2026-03-24): UI foundation/layout redesign shipped. Highlights: softer layered background, derived primary interaction tokens, button/card interaction polish, constrained main content width, improved sidebar states, dashboard/empty-state upgrades, inventory card overlay + 4:3 media treatment, sticky quote totals emphasis, denser readable tables, improved messages empty states, and shared `.skeleton` / `.quoteItemAdded` utility classes.

**Released v0.0.5** (2026-03-23): In-app update flow shipped for packaged builds (`/api/updates` status/list/apply + Settings updates console), plus extension sync hardening (configurable server URL, persisted scraped payload export) and Import-page Extension JSON fallback backed by `POST /api/items/bulk-upsert`.

**Released v0.0.4** (2026-03-19): Startup stability hotfix shipped. Fixed inventory empty-state crash caused by an undefined `search` reference and added graceful `getItems` error handling during sql.js initialization.

**Released v0.0.3** (2026-03-18): Post-v0.0.2 enhancement batch shipped. Highlights: quote line-item discounts, quote expiration, reusable payment/rental terms, item accessories, UI scale, quote card polish, public quote parity fixes, and GitHub/docs cleanup.

**Released v0.0.2** (2026-03-18): Quote-page filters + date-range picker, 2-step quote creation wizard with optional Google Places autocomplete, public quote live messaging thread (`/api/quotes/public/:token/messages`), availability picker endpoint (`/api/availability/quote/:id/items`), UI theme/map settings, robust extension scraping, and item `contract_description` persistence.

## Current Task
Release is complete. Remaining product polish items live in `TODO.md`.

## Post-v0.0.2 Enhancement Batch

### Completed (release batch)

#### Fixes
- **Availability conflicts on all quotes** — `QuotePage.jsx` now loads conflicts via `useCallback`; conflict stop sign displays on all quote cards/list rows regardless of whether they have date ranges.
- **Inventory duplicate search bar** — Removed internal search from `ItemGrid.jsx` (InventoryPage already handles API-level search).
- **UI skin button colors** — `QuoteBuilder.module.css`: replaced all hardcoded `#188ec5` / `#1579ad` hex with `var(--color-primary)` and `color-mix(in srgb, var(--color-primary) 80%, #000)` so active/hover button states honor the active UI theme.
- **Conflict stop sign exclamation** — Replaced invisible `<path d="M12 16h.01">` with `<line>` + `<circle>` SVG elements in `QuoteCard.jsx`, `QuoteBuilder.jsx`, and `QuotePage.jsx` for a visible white ! on the red stop sign.

#### Features
- **Drag-to-reorder quote items** — HTML5 drag handles (⠿) on each line item in `QuoteBuilder.jsx`; drop reorders via `PUT /api/quotes/:id/items/reorder` (bulk `sort_order` update in a DB transaction).
- **Per-item discount** — `quote_items` now has `discount_type` (`none` | `percent` | `fixed`) and `discount_amount`. Inline edit in `QuoteBuilder.jsx` (discount badge, click to edit). Totals in `QuoteDetailPage` and `PublicQuotePage` apply discounts via `effectivePrice()`.
- **Quote expiration** — `quotes.expires_at` (date) + `quotes.expiration_message`. Public quote page shows customizable expired banner and disables contract/signature block when expired. Edit form in `QuoteDetailPage` has date + message fields.
- **Colored tile borders** — `QuoteCard.jsx` / `QuotePage.jsx`: draft=yellow, sent=blue, approved/confirmed/closed=green, conflict or unsigned changes=red left border.
- **"Edit" button on quotes list** — Both tile (QuoteCard) and list row (QuotePage) have an Edit button that navigates to `QuoteDetailPage` with `{ state: { autoEdit: true } }` to auto-open the edit form.
- **View Quote → in Messages** — `MessagesPage.jsx`: when a thread has `quote_id`, a "View Quote →" button appears in the detail header and navigates to that quote.
- **UI Scale setting** — `SettingsPage.jsx`: range slider 75–150% (step 5); applies `document.documentElement.style.fontSize` immediately and persists to `localStorage` (`bs_ui_scale`) on save. `main.jsx` applies saved scale before first render.
- **Payment policies** — New `payment_policies` table (id, name, body_text, is_default). Full CRUD at `GET/POST/PUT/DELETE /api/templates/payment-policies`. Managed in `TemplatesPage.jsx` (new section). Selectable on quotes via `quotes.payment_policy_id` in the edit form. Shown as a section on the public quote page.
- **Rental terms** — New `rental_terms` table (same schema). Full CRUD at `GET/POST/PUT/DELETE /api/templates/rental-terms`. Managed in `TemplatesPage.jsx`. Selectable on quotes via `quotes.rental_terms_id`. Shown on public quote page.
- **Permanent accessories on items** — New `item_accessories` table (item_id → accessory_id, UNIQUE). CRUD at `GET/POST/DELETE /api/items/:id/accessories`. Shown in the Inventory edit form below AssociationList — search to add, remove button per entry. API client methods: `getItemAccessories`, `addItemAccessory`, `removeItemAccessory`.

### Files changed in this batch
- `server/db.js` — migrations: `quote_items.discount_type`, `quote_items.discount_amount`, `quotes.expires_at`, `quotes.expiration_message`, `quotes.payment_policy_id`, `quotes.rental_terms_id`, `item_accessories` table, `payment_policies` table, `rental_terms` table
- `server/routes/quotes.js` — `PUT /:id/items/reorder` (new); `PUT /:id/items/:qitem_id` accepts discount fields; `PUT /:id` now saves `expires_at`, `expiration_message`, `payment_policy_id`, `rental_terms_id`
- `server/routes/items.js` — `GET/POST/DELETE /:id/accessories` (new)
- `server/routes/templates.js` — payment-policies + rental-terms CRUD (new routes)
- `server/api/v1.js` + `server/index.js` — public quote endpoints now check expiration and fetch payment_policy + rental_terms by FK
- `client/src/api.js` — `reorderQuoteItems`, discount fields, payment policy/rental terms CRUD methods, item accessories CRUD methods
- `client/src/components/QuoteBuilder.jsx` — drag handles, drag handlers, per-item discount badge/edit, white ! SVG
- `client/src/components/QuoteBuilder.module.css` — drag styles, discount badge/button styles, CSS variable theme fix
- `client/src/components/QuoteCard.jsx` — colored border logic, Edit button, white ! SVG fix
- `client/src/components/QuoteCard.module.css` — `.borderDraft/Sent/Signed/Conflict` classes
- `client/src/pages/QuotePage.jsx` — colored borders, Edit button, white ! SVG fix, conflict loading via useCallback
- `client/src/pages/QuoteDetailPage.jsx` — discount `effectivePrice()`, expiration fields in edit form, payment_policy_id/rental_terms_id selectors, autoEdit from nav state, load payment policies + rental terms when editing
- `client/src/pages/PublicQuotePage.jsx` — expiration banner, rental terms section, payment policy section, expired placeholder for signature
- `client/src/pages/PublicQuotePage.module.css` — `.expiredBanner` styles
- `client/src/pages/MessagesPage.jsx` — "View Quote →" button
- `client/src/pages/MessagesPage.module.css` — flex layout for detail header
- `client/src/pages/SettingsPage.jsx` — UI scale slider
- `client/src/main.jsx` — apply saved scale before render
- `client/src/pages/TemplatesPage.jsx` — payment policies section, rental terms section
- `client/src/pages/InventoryPage.jsx` — permanent accessories UI, `loadAccessories`, `searchAccessories`
- `client/src/pages/InventoryPage.module.css` — accessories section styles

### Remaining (2/14)
- **Task 13:** Condense client/venue info display on `QuoteDetailPage` (make it more compact in view mode)
- **Task 14:** Mobile version optimization (responsive layout pass across pages)

## Quote Flow + Public Messaging + Theming — v0.0.2

### Quote creation, filtering, and availability UX
- **Quotes page:** `client/src/pages/QuotePage.jsx` now includes:
  - 2-step quote wizard (event details, then client info)
  - filters: search, venue, status, event date range, outstanding balance
  - Google Places address autocomplete (when `google_places_api_key` is configured)
  - conflict stop-sign indicators on quote cards/list rows
- **Quote list API:** `server/routes/quotes.js` `GET /api/quotes` supports query params:
  - `search`, `status`, `event_from`, `event_to`, `has_balance`, `venue`
- **Quote builder availability:** `client/src/components/QuoteBuilder.jsx` now shows stock/booked hints and conflict state in the picker and line items.
- **Availability endpoint:** `server/routes/availability.js` adds `GET /api/availability/quote/:quoteId/items?ids=...`.

### Public quote live thread
- **Server:** `server/index.js` adds:
  - `GET /api/quotes/public/:token/messages`
  - `POST /api/quotes/public/:token/messages`
- **Client:** `client/src/pages/PublicQuotePage.jsx` + CSS adds:
  - message list polling
  - client message composer on public quote page

### Settings, theming, and maps
- **Settings keys:** `server/routes/settings.js` allows `ui_theme`, `google_places_api_key`, `map_default_style`.
- **Settings UI:** `client/src/pages/SettingsPage.jsx` adds theme picker, Google Places key field, and default map style selector.
- **Theme tokens:** `client/src/theme.css` adds theme variable sets (`shadcn`, `material`, `chakra`), and `client/index.html` applies saved theme before React render.
- **Address map modal:** `AddressMapModal` now honors `defaultMapStyle`.

### Item schema and extension sync
- **DB migration:** `server/db.js` adds `items.contract_description`.
- **Items routes:** `server/routes/items.js` accepts/persists `contract_description` in create, update, and upsert flows.
- **Extension:** `extension/content.js` extracts richer item data, including contract-description-style fields; `extension/background.js` sends `contract_description`.

### Runtime/dev behavior
- **Port handling:** `server/index.js` can auto-increment to the next open localhost port when `PORT` is unset.
- **Lockfile metadata:** `server/services/singleInstance.js` can update lock metadata (including active port), and Vite reads the lockfile port (`client/vite.config.js`).
- **Cross-platform env setting:** `server/package.json` uses `cross-env` in `dev` script.

## Public Catalog + Docker + Dev UX — v0.0.1

### Public Catalog
- **Server:** `server/routes/publicCatalog.js` — no-auth router factory. Endpoints:
  - `GET /robots.txt` — SEO robots.txt (allows /catalog, disallows internal routes)
  - `GET /sitemap.xml` — XML sitemap listing /catalog, category pages, and all item detail URLs
  - `GET /api/public/catalog-meta` — company info, categories, counts, total item count
  - `GET /api/public/items` — paginated item list with category/search filters (max 500)
  - `GET /api/public/items/:id` — single public item detail
  - `GET /catalog` — server-rendered HTML catalog page with full SEO (JSON-LD ItemList + LocalBusiness schemas, og: tags, canonical)
  - `GET /catalog/item/:id` — server-rendered HTML item detail page (JSON-LD Product + BreadcrumbList schemas)
  - All public item queries exclude `hidden=1` items; photo_url resolved to signed URL or full URL
  - CSS is embedded inline in the server-rendered HTML for zero extra requests
- **Client:** `PublicCatalogPage.jsx` + `PublicCatalogPage.module.css` (new) — React SPA version at `/catalog`; category sidebar, search bar, item grid, hero stats, CTA band
- **Client:** `PublicItemPage.jsx` + `PublicItemPage.module.css` (new) — React SPA version at `/catalog/item/:id`; breadcrumb, product grid layout, price box, availability badge, CTA band
- **API client:** `api.catalog.getMeta()`, `api.catalog.getItems(params)`, `api.catalog.getItem(id)`
- **`APP_URL` env var:** Used by server-rendered routes for canonical URLs and sitemap. Defaults to `req.protocol + req.get('host')`.

### Docker
- **`Dockerfile`** — Multi-stage build: Stage 1 uses `oven/bun:1-alpine` to build React client; Stage 2 uses `node:20-alpine` for production server. Exposes port 3001. Entrypoint: `docker-entrypoint.sh`.
- **`docker-compose.yml`** — Single service `badshuffle`; mounts named volume `badshuffle_data` at `/data`; DB and uploads persist via `DB_PATH=/data/badshuffle.db` and `UPLOADS_DIR=/data/uploads`. Port `${PORT:-3001}:3001`.
- **`docker-compose.dev.yml`** — Dev compose variant.
- **`docker-entrypoint.sh`** — Creates `/data/uploads` on container start, then execs CMD.
- **`.dockerignore`** — Excludes node_modules, uploads, DB, and build artifacts.

### Dev launch, auth, and runtime wiring
- **Root scripts:** `package.json` adds `dev:host` and `dev:docker`.
- **Server dev mode:** `server/package.json` uses `NODE_ENV=development bun index.js`.
- **Dev-only auth shortcut:** `server/routes/auth.js` adds `POST /api/auth/dev-login`, which seeds `admin@admin.com` / `admin123` locally and is disabled in production.
- **AuthGate behavior:** `client/src/App.jsx` now attempts dev login in Vite development, clears stale tokens more gracefully, and keeps public catalog routes outside the auth wall.
- **Runtime config:** `server/index.js` and `server/db.js` now honor `APP_URL`, `DB_PATH`, and `UPLOADS_DIR`; the server also serves `client/dist` when present.

### Settings / AI controls
- **`server/db.js`** — Seeds AI-related settings defaults (`ai_*_key_enc`, enable flags, model selectors).
- **`server/routes/settings.js`** — Encrypts/decrypts Claude, OpenAI, and Gemini keys and persists the new AI settings keys.
- **`client/src/pages/SettingsPage.jsx`** — Adds AI provider key fields and per-feature enable/model selectors.

### Responsive client polish
- **Sidebar / shell:** `Layout.jsx`, `Sidebar.jsx`, and related CSS add a mobile menu button, overlay, close action, safer spacing, and larger touch targets.
- **Inventory:** `InventoryPage.jsx` adds category chip filtering in the main page flow.
- **Global UI:** Mobile layout cleanup touches Auth, Dashboard, Files, Leads, Messages, Quotes, Settings, and theme tokens.

### Drag-and-drop quote item reordering
- **QuoteBuilder.jsx** — Line items are now `draggable`; drag handle (⠿) shown on each row. `handleDragStart/Enter/Over/End` handlers. On drop, calls `api.reorderQuoteItems(quoteId, orderedIds)` then refreshes via `onItemsChange()`. Drop target highlighted via `quoteItemDragOver` CSS class.
- **api.js** — `reorderQuoteItems(quoteId, ids)` → `PUT /api/quotes/:id/items/reorder`
- **server/routes/quotes.js** — `PUT /:id/items/reorder` accepts `{ ids: [...] }` and updates `sort_order` for each qitem_id in one transaction.

### Files changed
- `server/routes/publicCatalog.js` — new
- `server/index.js` — mount publicCatalogRouter (before auth middleware)
- `client/src/pages/PublicCatalogPage.jsx` — new
- `client/src/pages/PublicCatalogPage.module.css` — new
- `client/src/pages/PublicItemPage.jsx` — new
- `client/src/pages/PublicItemPage.module.css` — new
- `client/src/api.js` — `api.catalog.*` helpers
- `client/src/App.jsx` — `/catalog` and `/catalog/item/:id` routes
- `Dockerfile` — new
- `docker-compose.yml` — new
- `docker-compose.dev.yml` — new
- `docker-entrypoint.sh` — new
- `.dockerignore` — new
- `client/src/pages/SettingsPage.jsx` — AI integration controls
- `server/routes/auth.js` — dev login route
- `server/routes/settings.js` — encrypted AI key support
- `server/db.js` — AI settings defaults + runtime DB path override
- `client/src/components/QuoteBuilder.jsx` — drag handles + reorder
- `server/routes/quotes.js` — `PUT /:id/items/reorder`

---

## Current Task (previous)
Completed: Per-line price overrides + quote-level adjustments; previously: Availability & Conflict Detection (shipped in pre-v0.0.1).

## Per-line Price Overrides & Quote Adjustments — pre-v0.0.1 foundation

### Feature 7 — `unit_price_override` on `quote_items`
- **DB:** `ALTER TABLE quote_items ADD COLUMN unit_price_override REAL` (try/catch migration, nullable; NULL = use items.unit_price).
- **Server:** `quotes.js` GET /:id now includes `qi.unit_price_override` in items SELECT. PUT /:id/items/:qitem_id accepts `unit_price_override` (null clears it; explicit null reverts to base price). GET / (list totals) and GET /summary revenue now use `COALESCE(qi.unit_price_override, i.unit_price)`. Public quote route in `index.js` also includes the field.
- **Effective price helper:** `effectivePrice(it)` in QuoteDetailPage — `unit_price_override ?? unit_price`.
- **Frontend:** `computeTotals` uses `effectivePrice` for all line items. QuoteBuilder renders unit price as a clickable field: click → inline input → Enter/✓ saves override, Esc cancels. Override shown in purple with a ✕ reset button. Logistics display in QuoteDetailPage also uses effective price.

### Feature 8 — `quote_adjustments` (discounts / surcharges)
- **DB:** New `quote_adjustments` table: `id, quote_id, label TEXT, type TEXT (discount|surcharge), value_type TEXT (percent|fixed), amount REAL, sort_order INTEGER, created_at TEXT`.
- **Server:** `quotes.js` GET /:id now includes `adjustments` in response. New routes: `GET/POST/PUT/DELETE /:id/adjustments`. POST validates type, value_type, amount ≥ 0, percent ≤ 100. Public quote route includes adjustments. Adjustment add/remove logs to `quote_activity_log`. Add/remove/update also calls `markUnsignedChangesIfApproved`.
- **Total computation:** `computeAdjustmentsTotal(adjustments, preTaxBase)` — percent adjustments apply to `subtotal + delivery + customSubtotal`; fixed adjustments are flat. Discounts are negative, surcharges positive. Tax is NOT recalculated (remains on raw taxable line items).
- **Frontend:** `computeTotals` now accepts `adjustments` param and returns `adjTotal`. QuoteBuilder has an "Discounts & Surcharges" section below quote items: inline form (label, type dropdown, percent/fixed dropdown, amount), adjustment list with type badge and remove button. QuoteDetailPage Summary card renders each adjustment as a row (green for discounts, amber for surcharges) between delivery and tax lines.
- **api.js:** `getAdjustments`, `addAdjustment`, `updateAdjustment`, `removeAdjustment`.

### Files changed
- `server/db.js` — `unit_price_override` column migration; `quote_adjustments` table
- `server/routes/quotes.js` — override in GET /:id, list, summary; PUT item accepts override; adjustment CRUD routes
- `server/index.js` — public quote includes `unit_price_override` and `adjustments`
- `client/src/api.js` — 4 new adjustment API calls
- `client/src/components/QuoteBuilder.jsx` — override inline edit UI; adjustments section
- `client/src/components/QuoteBuilder.module.css` — override and adjustment styles
- `client/src/pages/QuoteDetailPage.jsx` — `effectivePrice`, `computeAdjustmentsTotal`, `computeTotals` update; adjustments state; adjustment rows in Summary card; logistics display uses effective price
- `client/src/pages/QuoteDetailPage.module.css` — `.totalsRowDiscount`, `.totalsRowSurcharge` color styles

---

## Current Task (previous)
Completed: Availability & Conflict Detection (shipped before v0.0.1); previously: Bun adoption.

## Availability & Conflict Detection — pre-v0.0.1 foundation

### Backend: schema additions (`server/db.js`)
- **`vendors` table**: `id`, `name`, `contact_name`, `contact_email`, `contact_phone`, `notes`
- **`items` columns**: `is_subrental INTEGER DEFAULT 0`, `vendor_id INTEGER REFERENCES vendors(id)`
- **`quotes` columns**: `rental_start TEXT`, `rental_end TEXT`, `delivery_date TEXT`, `pickup_date TEXT`
- **`settings` key**: `count_oos_oversold` (controls whether out-of-stock items count toward conflicts on the dashboard)

### New routes
- **`server/routes/vendors.js`** — full CRUD: `GET /api/vendors`, `POST /api/vendors`, `PUT /api/vendors/:id`, `DELETE /api/vendors/:id`
- **`server/routes/availability.js`** — three endpoints:
  - `GET /api/availability/conflicts` — returns all items with reserved+potential quantities exceeding stock; reserved = quotes where signed contract or has_unsigned_changes; potential = all other active quotes; date range spans delivery→pickup
  - `GET /api/availability/subrental-needs` — items where demand > stock and `is_subrental = 0`, returns shortfall quantities per item per date range
  - `GET /api/availability/quote/:id` — per-quote conflict check: which items in this quote conflict with other reservations

### Other server changes
- **`server/index.js`**: mounted `vendorsRouter` and `availabilityRouter` under auth middleware
- **`server/routes/settings.js`** `ALLOWED_KEYS`: added `count_oos_oversold`
- **`server/routes/items.js`**: `GET /api/items` and `GET /api/items/:id` now return `is_subrental`, `vendor_id`; `POST`/`PUT` accept and persist them
- **`server/routes/quotes.js`**: `POST`/`PUT` accept and persist `rental_start`, `rental_end`, `delivery_date`, `pickup_date`; `GET /:id` returns them

### Frontend
- **`VendorsPage.jsx` + `VendorsPage.module.css`** (new): list of vendors with inline add/edit/delete; linked from Sidebar
- **`DashboardPage.jsx`**: new "Conflicts" panel (items with reservations exceeding stock) and "Subrental Needs" panel (shortfall items); respects `count_oos_oversold` setting
- **`DashboardPage.module.css`**: conflict and subrental panel styles
- **`QuoteDetailPage.jsx`**: rental period fields (rental start/end, delivery date, pickup date) in edit form and view mode
- **`QuoteBuilder.jsx`**: frown icon (☹) on line items that have a conflict with another quote
- **`QuoteBuilder.module.css`**: conflict icon style
- **`SettingsPage.jsx`**: "Count out-of-stock items as conflicts" checkbox bound to `count_oos_oversold`
- **`SettingsPage.module.css`**: checkbox row style
- **`ItemEditModal.jsx`**: is_subrental toggle + vendor_id dropdown (populated from `GET /api/vendors`)
- **`App.jsx`**: `/vendors` route added
- **`Sidebar.jsx`**: Vendors nav link added
- **`api.js`**: `getVendors`, `createVendor`, `updateVendor`, `deleteVendor`, `getConflicts`, `getSubrentalNeeds`, `getQuoteConflicts`

### Files changed
- `server/db.js` — vendors table; items.is_subrental, items.vendor_id; quotes rental period columns
- `server/index.js` — mount vendors + availability routers
- `server/routes/vendors.js` — new
- `server/routes/availability.js` — new
- `server/routes/settings.js` — ALLOWED_KEYS addition
- `server/routes/items.js` — is_subrental, vendor_id fields
- `server/routes/quotes.js` — rental period fields
- `client/src/pages/VendorsPage.jsx` — new
- `client/src/pages/VendorsPage.module.css` — new
- `client/src/pages/DashboardPage.jsx` — conflicts + subrental panels
- `client/src/pages/DashboardPage.module.css` — panel styles
- `client/src/pages/QuoteDetailPage.jsx` — rental period fields
- `client/src/pages/SettingsPage.jsx` — count_oos_oversold checkbox
- `client/src/pages/SettingsPage.module.css` — checkbox row
- `client/src/components/QuoteBuilder.jsx` — conflict frown icons
- `client/src/components/QuoteBuilder.module.css` — conflict icon style
- `client/src/components/ItemEditModal.jsx` — is_subrental + vendor_id
- `client/src/App.jsx` — /vendors route
- `client/src/components/Sidebar.jsx` — Vendors link
- `client/src/api.js` — vendor + availability API calls

---

## Current Task (previous)
Completed: Bun adoption (Phases 0–3); previously: Quote Client Info + Send Flow + Layout.

## Bun Adoption — pre-v0.0.1 prep

### Phase 0 — Baseline inspection
Confirmed stack before touching anything: Node v24.14.0, npm as package manager, no `.nvmrc`, no Bun installed. Three workspaces: root (orchestration only), `server/` (CJS, `node index.js`), `client/` (ESM, Vite). Identified key risks: `sql.js` WASM loading under Bun, `--prefix` vs `--cwd` flag mismatch, `pkg`-based `.exe` packaging left untouched.

### Phase 1 — `bun install`
Installed Bun 1.3.10 globally via `npm install -g bun`. Ran `bun install` in all three workspaces. Bun migrated each `package-lock.json` and wrote `bun.lock` (text format, Bun 1.1+) next to each `package-lock.json`. All original lockfiles preserved. No node_modules changes. All key server deps (`express`, `sql.js`, `bcryptjs`, `jsonwebtoken`) still resolved correctly under Node after install.

### Phase 2 — `bun run` for scripts
Discovered that Bun rewrites `npm run` → `bun run` inside scripts, but npm's `--prefix` flag has no Bun equivalent (`--cwd` is the Bun form). Updated root `package.json` scripts:
- `dev`: `concurrently "npm run dev --prefix server" "npm run dev --prefix client"` → `concurrently "bun run --cwd server dev" "bun run --cwd client dev"`
- `build:client`: `npm run build --prefix client` → `bun run --cwd client build`
- `install:all`: `npm install && npm install --prefix server && npm install --prefix client` → `bun install && bun install --cwd server && bun install --cwd client`

Also discovered `C:\Users\hangu\AppData\Roaming\npm` (npm global bin where `bun.cmd` lives) was missing from the Windows user PATH. Added it permanently via `[Environment]::SetEnvironmentVariable`. **Requires opening a new terminal to take effect.**

### Phase 3 — Bun as server runtime
The anticipated `sql.js` WASM risk did not materialise. `db.js` loads the WASM binary via `fs.readFileSync` and passes raw bytes as `wasmBinary` — no Bun-specific loader path involved. All CJS `require` calls, `__dirname`, `process.pkg`, and `child_process.spawnSync` (used in `singleInstance.js`) worked correctly under Bun.

Updated `server/package.json`:
- `dev`: `node index.js` → `bun index.js`
- `start`: `node index.js` ← kept as `node` (used by pkg-packaged `.exe` context)

Test results under Bun runtime:
- DB initialized (`sql.js` WASM loaded)
- `singleInstance` detected and cleared stale lockfile
- `GET /api/health` → `{"ok":true}`
- `GET /api/auth/status` → `{"setup":true}` (DB query executed)
- `GET /api/items` (no token) → `{"error":"Unauthorized"}` (auth middleware working)

### Files changed
- `package.json` — `dev`, `build:client`, `install:all` scripts
- `server/package.json` — `dev` script
- `bun.lock` (new) — repo root
- `server/bun.lock` (new)
- `client/bun.lock` (new)
- Windows user PATH — `C:\Users\hangu\AppData\Roaming\npm` added

### What's left / not changed
- `pkg`-based packaging scripts (`package:server`, `package:client`, `package:updater`, `package`, `release`) — left untouched; `start` script remains `node index.js` for pkg context
- No architecture changes; no business logic touched

---

## Current Task (previous)
Completed: Quote Client Info + Send Flow + Layout; previously: CLI admin, auth fix, lead import, quotes.

## Quote Client Info + Send Flow + Layout

### A) Quote client info (persist + UI)
- **DB:** `quotes` table: added `client_first_name`, `client_last_name`, `client_email`, `client_phone`, `client_address` (migrations in `server/db.js`).
- **Server:** POST/PUT quotes accept and return these fields. GET quote (and public quote) return them.
- **Client:** Quote detail page: "Client Information" section in edit form; in view mode a two-column row shows Client (left) and Venue (right). Client block shows name, email, phone, address when set.

### B) Quote items: pricing + qty input
- **QuoteBuilder:** Line items show unit price, numeric qty input (primary), line total, and optional "T" (taxable). +/- buttons kept. Qty updates are debounced (400 ms) so typing "12" does not send two requests.

### C) Venue placement + click-to-edit
- Venue Information is in a box to the right of Client Information. Clicking the venue box toggles inline edit mode (form with Save/Cancel). Saving updates quote venue fields via existing API.

### D) Send-to-client: email editor + templates
- **Server:** New table `email_templates` (id, name, subject, body_html, body_text, is_default). Routes: GET/POST /api/templates, GET/PUT/DELETE /api/templates/:id (auth + operator middleware). POST /api/quotes/:id/send accepts body `{ templateId, subject, bodyHtml, bodyText, toEmail }`; still sets status to 'sent' and generates public_token; returns `emailPreview` (stub; no SMTP send yet).
- **Client:** "Send to Client" opens Email Editor modal: To (defaults to quote.client_email), template dropdown, subject, body textarea, Send button. Default template is auto-selected when modal opens. New **Templates** page (sidebar, admin/operator only): CRUD templates, "Set default" per template.

### E) Public quote view layout
- **PublicQuotePage:** Read-only quote layout: title and event date/guests, notes, then two-column Client + Venue summary (if present), then itemized table (equipment then Delivery/Pickup section), then **totals section** (subtotal, delivery, tax, grand total) near the end, then quote_notes. Print / Save PDF button.

### Files changed
- `server/db.js` — client_* columns, email_templates table
- `server/routes/quotes.js` — client_* in POST/PUT, send body + emailPreview
- `server/routes/templates.js` — new (CRUD templates)
- `server/index.js` — public quote items include category; mount /api/templates
- `client/src/api.js` — sendQuote(id, body), templates CRUD
- `client/src/pages/QuoteDetailPage.jsx` — client form + display, client/venue row, venue click-to-edit, QuoteSendModal
- `client/src/pages/QuoteDetailPage.module.css` — clientVenueRow, modal, etc.
- `client/src/components/QuoteBuilder.jsx` — unit price, qty input, line total, tax indicator, debounced qty
- `client/src/components/QuoteBuilder.module.css` — qtyInput, unitPrice, lineTotal, taxDot
- `client/src/pages/PublicQuotePage.jsx` — full layout with client/venue, totals at end
- `client/src/pages/TemplatesPage.jsx` + `.module.css` — new
- `client/src/App.jsx` — route /templates
- `client/src/components/Sidebar.jsx` — Templates link (admin/operator)

### What’s left
- Optional: wire POST /quotes/:id/send to real SMTP when settings configured (currently stub).
- Optional: preview pane in send modal (render body or link to public quote).

---

## CLI admin utilities

### Commands (run from repo root)

| Command | Description |
|--------|--------------|
| `npm run create-admin -- --email <e> --password <p> [--role admin\|operator\|user]` | Create or update admin user (default role: admin). |
| `npm run reset-password -- --email <e> --password <p>` | Set password for existing user. |
| `npm run reset-auth` | Clear all auth data (users, login_attempts, reset_tokens, extension_tokens). Requires `--yes` (included in script). Preserves inventory, leads, quotes. |
| `npm run wipe-database` | Remove DB file; with default `--backup`, copy to `./backups/badshuffle-YYYYMMDD-HHMMSS.db` first. Requires `--yes` (included). Use `--no-backup` to skip backup. |

Direct CLI: `node server/cli.js <cmd> [options]` (e.g. `node server/cli.js create-admin --email a@b.com --password secret`).

### Tables and files touched

| Command | Tables / files |
|--------|-----------------|
| **create-admin** | `users` (INSERT or UPDATE) |
| **reset-password** | `users` (UPDATE password_hash for email) |
| **reset-auth** | `login_attempts`, `extension_tokens`, `reset_tokens`, `users` (DELETE all rows). Does not touch items, quotes, quote_items, leads, settings. |
| **wipe-database** | DB file at `server/badshuffle.db` (or pkg path); optional backup to `./backups/badshuffle-YYYYMMDD-HHMMSS.db`. Removes DB and any `-journal`, `-wal`, `-shm` lock files. |

### Examples (PowerShell)

```powershell
# Create admin
npm run create-admin -- --email admin@local --password "Test123!"
npm run create-admin -- --email op@local --password "OpPass123" --role operator

# Reset password
npm run reset-password -- --email admin@local --password "NewPass456!"

# Clear auth only (npm script adds --yes)
npm run reset-auth

# Wipe DB with backup (default)
npm run wipe-database

# Wipe DB without backup (direct CLI)
node server/cli.js wipe-database --yes --no-backup
```

Help: `node server/cli.js --help`

### Safety

- **reset-auth** and **wipe-database** refuse to run unless `--yes` is provided. npm scripts include `--yes`.
- Both print what will be deleted (e.g. row counts) before executing.
- Plaintext passwords are never printed or logged.
- **wipe-database**: Backup is on by default; use `--no-backup` to skip. Backup path: `./backups/badshuffle-YYYYMMDD-HHMMSS.db`.

### Auth data scope

- **reset-auth** deletes: `users`, `login_attempts`, `reset_tokens`, `extension_tokens`. Inventory, leads, quotes, settings remain.
- **wipe-database** removes the DB file; next server start creates a fresh DB (like first install).

### Files

- `server/cli.js` — single CLI entrypoint; subcommands create-admin, reset-password, reset-auth, wipe-database.
- `server/db.js` — export `DB_PATH` for wipe-database backup/path.
- Root `package.json` — scripts: create-admin, reset-password, reset-auth, wipe-database.

---

## Auth fix (logout loop + incognito)

### Root cause
- **Logout loop:** On any 401, `api.js` did `clearToken()` then `window.location.href = '/login'`, causing a full page reload. After reload, AuthGate ran again, called `auth/me` (no token or invalid), got 401 again → redirect again → infinite loop.
- **Incognito / 401:** Same redirect-on-401 caused reload; plus AuthGate always called `auth/me()` even when there was no token (e.g. on /login), so unauthenticated users triggered 401 and the global redirect.

### Fix
1. **api.js:** On 401, only `clearToken()` and throw. No `window.location` or reload. Callers handle the error; AuthGate handles unauthed state and navigates once via router.
2. **App.jsx AuthGate:** Stable states: `loading` | `authed` | `unauthed`. If no token, do not call `auth/me()` — set `unauthed` and render children (login/setup/public routes show). If token present, call `auth/me()`; on success set `authed`, on 401 set `unauthed` and `navigate('/login', { replace: true })` only once (ref `hasRedirectedToLogin`). If already on `/login`, do not redirect. Reset the ref when pathname is `/login` so a later 401 can redirect again.
3. **API/proxy:** JWT in `Authorization` header (no cookies). Vite proxy already routes `/api` → `http://localhost:3001`; no `credentials: 'include'` needed. Same origin in dev so `/api/auth/me`, login, logout all hit the same server.

### Files changed (auth)
- `client/src/api.js` — remove `window.location.href = '/login'` on 401.
- `client/src/App.jsx` — AuthGate: useLocation, state machine, skip auth.me when no token, single navigate to /login with ref guard.

### How to verify
- Normal tab: login works; logout returns to /login without reload loop; no repeated 401 in console.
- Incognito: login works; after login, auth/me succeeds (no 401 loop).
- After logout, `/api/auth/me` returns 401 and UI stays on /login (no refresh).

---

## Progress (previous)

### 1. Lead import (normalize + scoring + mapping)
- **Server:** Added `server/lib/leadImportMap.js`: `normalizeHeader()` (lowercase, newlines→spaces, collapse whitespace, strip punctuation, trim); keyword/regex scoring to suggest mapping for name, email, phone, event_date, event_type, source_url, notes; `suggestMapping(rawHeaders)` and `rowToLeadWithMapping(row, columnMapping)`.
- **Server:** `server/routes/leads.js`: New `POST /api/leads/preview` — body `{ url }` or `{ filename, data }` (base64); returns `{ columns, suggestedMapping, preview: first 10 rows, totalRows }`. `POST /api/leads/import` now accepts optional `columnMapping: { name: 'Full Name', ... }`; uses `rowToLeadWithMapping` when provided, else `rowToLeadFallback`. Extracted `parseRowsFromBody()` for CSV/XLSX from file.
- **Client:** `api.previewLeadsImport(body)`. Import page Leads tab refactored to 3-step wizard: (0) Enter source (Google Sheet URL or upload CSV/XLSX), (1) Map columns — table with dropdown per target field (full name, email, phone, event date, event type, source URL, notes) and preview rows, (2) Result. Import sends `columnMapping` from chosen mapping.

### 2. Leads page wording
- No "captured from Goodshuffle" references were present in leads UI (LeadsPage already showed "X leads in database"; Import page empty state did not mention Goodshuffle). No change required.

### 3. Quotes: venue, quote notes, logistics, totals, tax_rate, PDF
- **DB:** `server/db.js` — migrations for quotes: `venue_name`, `venue_email`, `venue_phone`, `venue_address`, `venue_contact`, `venue_notes`, `quote_notes`, `tax_rate` (REAL).
- **API:** `server/routes/quotes.js` — GET quote items include `category`; POST/PUT quote accept and persist venue_*, quote_notes, tax_rate.
- **Client QuoteDetailPage:** Edit form: Venue section (Name, Email, Phone, Address, Contact, Notes), Quote notes textarea, Tax rate (%) with fallback to settings. Display: Venue block, Quote notes, Logistics section (items where `category` contains "logistics"), Totals bar: Subtotal (equipment), Delivery total (logistics), Tax, Grand total. `computeTotals()` splits items by logistics; uses `quote.tax_rate` when set else `settings.tax_rate`.
- **QuoteExport:** Venue information block, Quote notes, equipment grid (non-logistics), Logistics section (delivery/pickup items), Totals: Subtotal, Delivery total, Tax, Grand total. PDF: "Print / Save as PDF" (window.print) kept alongside PNG export.

## Files Changed
- `server/lib/leadImportMap.js` — new (normalize, scoring, suggestMapping, rowToLeadWithMapping)
- `server/routes/leads.js` — preview endpoint, import with columnMapping, parseRowsFromBody, rowToLeadFallback
- `client/src/api.js` — previewLeadsImport
- `client/src/pages/ImportPage.jsx` — Leads 3-step wizard with column mapping UI and preview
- `client/src/pages/ImportPage.module.css` — selectSmall, mapLabel for mapping dropdowns
- `server/db.js` — quote columns: venue_*, quote_notes, tax_rate
- `server/routes/quotes.js` — GET items with category; POST/PUT with venue_*, quote_notes, tax_rate
- `client/src/pages/QuoteDetailPage.jsx` — venue form/display, quote_notes, logistics, totals (subtotal, delivery, tax, grand), tax_rate
- `client/src/pages/QuoteDetailPage.module.css` — formSection, venueBlock, logisticsBlock styles
- `client/src/components/QuoteExport.jsx` — venue, quote_notes, logistics section, full totals
- `client/src/components/QuoteExport.module.css` — exportVenue, exportLogistics styles
- `ai/STATUS.md`

## How to test

1. **Lead import**
   - Import → Leads. Step 1: Enter a Google Sheets URL (or upload CSV/XLSX). Click Preview or choose file.
   - Step 2: Confirm suggested column mapping (dropdowns per field); change mappings if needed; check preview table. Click "Import N rows".
   - Step 3: See imported count; "View leads" or "Back to import". Verify leads list and that data matches mapped columns.

2. **Leads wording**
   - Leads page: header shows "X leads in database". No "Goodshuffle" in leads copy.

3. **Quotes**
   - Open a quote → Edit: fill Venue (name, email, phone, address, contact, notes), Quote notes, Tax rate %.
   - Save. View: Venue block, Quote notes, and (if any items have category containing "logistics") Logistics section and Delivery total in totals bar.
   - Export: PNG and "Print / Save as PDF". Printed/PDF view shows venue, quote notes, equipment grid, logistics section, and Subtotal / Delivery total / Tax / Grand total.

## Verification
- Lint on modified files: no errors.

## Known Issues
- None.

## Next Steps
- Optional: add more target fields to lead import (e.g. guest count, delivery address) if sheet columns expand.

