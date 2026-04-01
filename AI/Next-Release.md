# Next Release — Detected Local Changes (vs GitHub `origin/master`)

Generated: 2026-03-31  
Repo: `badshuffle`  
Comparison baseline: **`origin/master`** (fetched from GitHub; default branch **`master`**)

## Draft release notes — v0.0.11 (WIP)

Release date: TBD

### Summary

`0.0.11` is a **visibility + scalability** release: it adds an operator Maps workspace powered by Mapbox (with lazy geocoding + persisted cache fields on quotes), introduces early sales/pipeline analytics, and continues the backend refactor by splitting quote logic into focused services/repositories to reduce route-layer coupling.

### Added

- **Maps workspace (operator UI)**: New protected `/maps` page with a 2D Mapbox world map, clustered pins, theme-aware legend toggles, and direct links into project detail.
- **Maps pins API**: New authenticated `GET /api/maps/quotes` endpoint that returns map-ready quote pins (with `quote|booked|closed` classification) plus `map_default_style` for client rendering.
- **Mapbox geocoding + quote map cache**: Quotes now persist map cache fields (`map_address_source`, `map_address_text`, `map_lat`, `map_lng`, `map_geocoded_at`, `map_geocode_status`) so map rendering is fast and consistent.
- **Lazy geocoding for older quotes**: When the maps endpoint is hit, quotes with addresses but missing/failed map cache will attempt to geocode and persist results.
- **Sales analytics API**: New analytics surface at `GET /api/sales/analytics` for pipeline-style reporting over a date range, with optional staff + status filtering.
- **DB query/repository layering (server)**: New `server/db/*` modules (queries + repositories) to centralize SQL and support service-layer composition.

### Changed

- **Quote backend architecture**: Quote orchestration continues moving out of `server/routes/quotes.js` into smaller services (`quoteCoreService`, `quoteListService`, `quoteFinanceService`, `quoteFileService`, etc.) so the route layer becomes mostly validation + wiring.
- **Geocode lifecycle**: Quote create/update flows sync map cache so maps stay current when venue/client addresses change.

### Notes / migration cues

- **Settings**: Maps requires `mapbox_access_token`; `map_default_style` controls the basemap style used by the Maps UI and pin endpoint.
- **Data**: Quotes geocode from `venue_address` first, falling back to `client_address`. Older quotes may geocode on-demand when `/api/maps/quotes` is requested; quote create/update also refreshes the cache.

## File structure delta — current local tree vs GitHub

Compared against `origin/master`, the local source tree has expanded in a few clear areas that should be treated as part of the `v0.0.11` documentation pass.

### New documentation surfaces

- `AI/Api/README.md`
- `AI/Api/authentication.md`
- `AI/Api/data-models.md`
- `AI/Api/ecommerce-integration.md`
- `AI/Api/inventory-api.md`
- `AI/Api/public-catalog.md`
- `AI/Api/quotes-api.md`
- `AI/Api/webhooks-and-events.md`
- `AI/reports/dashboard-redesign.md`

### New client structure

- `client/src/pages/MapsPage.jsx`
- `client/src/pages/MapsPage.module.css`
- `client/src/pages/ProfilePage.jsx`
- `client/src/pages/ProfilePage.module.css`
- `client/src/pages/TeamPage.jsx`
- `client/src/pages/TeamPage.module.css`
- `client/src/pages/quote-detail/QuoteFulfillmentPanel.jsx`
- `client/src/components/public-quote/PublicQuoteContractView.jsx`
- `client/src/components/public-quote/PublicQuoteItemDetailModal.jsx`
- `client/src/components/virtualization/VirtualGrid.jsx`
- `client/src/components/virtualization/VirtualList.jsx`
- `client/src/features/sales-dashboard/*`
- `client/src/hooks/useDebouncedValue.js`
- `client/src/lib/permissions.js`
- `client/src/lib/sanitizeHtml.js`

### New server structure

- `server/routes/maps.js`
- `server/routes/sales.js`
- `server/routes/team.js`
- `server/lib/permissionMiddleware.js`
- `server/lib/permissions.js`
- `server/db/defaults/*`
- `server/db/migrations/*`
- `server/db/queries/*`
- `server/db/repositories/quoteRepository.js`
- `server/db/schema/*`
- `server/services/diagnosticsService.js`
- `server/services/fileService.js`
- `server/services/imageCompressionService.js`
- `server/services/itemService.js`
- `server/services/leadService.js`
- `server/services/mapService.js`
- `server/services/mapboxGeocodeService.js`
- `server/services/quoteContractService.js`
- `server/services/quoteCoreService.js`
- `server/services/quoteCustomItemService.js`
- `server/services/quoteFileService.js`
- `server/services/quoteFinanceService.js`
- `server/services/quoteFulfillmentService.js`
- `server/services/quoteItemService.js`
- `server/services/quoteLifecycleService.js`
- `server/services/quoteListService.js`
- `server/services/quoteSectionService.js`
- `server/services/salesAnalyticsService.js`
- `server/services/teamService.js`

### Removed from local source tree

No tracked source/docs files from `origin/master` are missing locally. The only baseline-only paths are runtime artifacts excluded from the documentation pass (`backups/badshuffle-20260304-160455.db`, `uploads/dd8655d7a9fe59f9e0ba2ea912c70164.png`).

### Documentation implications

- `ai/ARCHITECTURE.md` needs to describe the new `server/db/*` layering instead of treating `server/db.js` as the only schema/migration home.
- `ai/PROJECT_OVERVIEW.md` needs to reflect Maps, Team, Profile, fulfillment, and permission-aware routing as current product surfaces.
- The new `AI/Api/*` folder should be treated as live API/integration documentation for `v0.0.11`, not an incidental local-only addition.

## Git sync (local ↔ GitHub)

| Item | Value |
|------|--------|
| Local branch | `master` |
| Remote tracking | `origin/master` |
| **`HEAD` commit** | `e928169` — `docs: update README AI references` |
| **`origin/master`** | Same commit as `HEAD` (no unpushed / unpulled commits at time of check) |
| Working tree | **Dirty** — changes below are **uncommitted** vs `origin/master` |

Cross-reference: `git fetch origin`, then `git diff --shortstat origin/master`, `git diff --name-only origin/master`, `git ls-files --others --exclude-standard`.

## Summary

| Metric | Count |
|--------|--------|
| **Modified tracked files** vs `origin/master` | **116** |
| **Untracked files** (new, not yet `git add`) | **21** |
| Diff size | **10528 insertions(+), 6800 deletions(-)** across those 116 files |

---

## Untracked (new) files — full list

| Path |
|------|
| `AI/Next-Release.md` (this file) |
| `AI/reports/redesign-plan.md` |
| `client/postcss.config.js` |
| `client/tailwind.config.js` |
| `client/src/index.css` |
| `client/src/lib/logisticsRename.js` |
| `client/src/lib/quoteTitle.js` |
| `client/src/lib/routePrefetch.js` |
| `client/src/components/ImageLightbox.jsx` |
| `client/src/components/ImageLightbox.module.css` |
| `client/src/components/ItemDetailDrawer.jsx` |
| `client/src/components/ItemDetailDrawer.module.css` |
| `client/src/components/features/logistics/RenameLogisticsModal.jsx` |
| `client/src/components/features/logistics/RenameLogisticsModal.module.css` |
| `client/src/components/messages/MessageBody.jsx` |
| `client/src/components/messages/MessageBody.module.css` |
| `client/src/components/messages/RichMessageRenderer.jsx` |
| `client/src/components/messages/RichMessageRenderer.module.css` |
| `client/src/pages/quote-detail/QuoteBillingPanel.jsx` |
| `client/src/pages/quote-detail/QuoteFilesPanel.jsx` |
| `client/src/pages/quote-detail/QuoteLogsPanel.jsx` |

---

## Modified tracked files — full list (alphabetical)

### Repo root

- `.env.example`
- `package.json`
- `package-lock.json`
- `bun.lock`

### AI / project docs (`AI/` and `ai/`)

- `AI/HANDOFF.md`
- `AI/TODO.md`
- `AI/reports/code-audit.md`
- `ai/DATA_MODELS.md`
- `ai/HANDOFF.md`
- `ai/KNOWN_GAPS.md`
- `ai/STATUS.md`
- `ai/TODO.md`

**Note:** `AI/` and `ai/` are different paths on Linux.

### Client — package metadata & lockfiles

- `client/package.json`
- `client/package-lock.json`
- `client/bun.lock`

### Client — entry, API, theme

- `client/src/main.jsx`
- `client/src/App.jsx`
- `client/src/api.js`
- `client/src/theme.css`

### Client — components (shared)

- `client/src/components/AddressMapModal.jsx`
- `client/src/components/AISuggestModal.jsx`
- `client/src/components/AssociationList.jsx`
- `client/src/components/ConfirmDialog.jsx`
- `client/src/components/ConfirmDialog.module.css`
- `client/src/components/DateRangePicker.jsx`
- `client/src/components/ErrorBoundary.jsx`
- `client/src/components/ItemCard.jsx`
- `client/src/components/ItemCard.module.css`
- `client/src/components/ItemEditModal.jsx`
- `client/src/components/ItemGrid.jsx`
- `client/src/components/Layout.jsx`
- `client/src/components/Layout.module.css`
- `client/src/components/QuoteBuilder.jsx`
- `client/src/components/QuoteBuilder.module.css`
- `client/src/components/QuoteCard.jsx`
- `client/src/components/QuoteCard.module.css`
- `client/src/components/QuoteExport.jsx`
- `client/src/components/QuoteExport.module.css`
- `client/src/components/QuoteFilePicker.jsx`
- `client/src/components/QuoteHeader.jsx`
- `client/src/components/QuoteHeader.module.css`
- `client/src/components/QuoteSendModal.jsx`
- `client/src/components/Sidebar.jsx`
- `client/src/components/Sidebar.module.css`
- `client/src/components/StatsBar.jsx`
- `client/src/components/StatsBar.module.css`
- `client/src/components/Toast.jsx`
- `client/src/components/Toast.module.css`

### Client — quote builder panels

- `client/src/components/quote-builder/InventoryPickerPanel.jsx`
- `client/src/components/quote-builder/QuoteAdjustmentsPanel.jsx`
- `client/src/components/quote-builder/QuoteLineItemsPanel.jsx`

### Client — hooks

- `client/src/hooks/useQuoteDetail.js`

### Client — pages

- `client/src/pages/AdminPage.jsx`
- `client/src/pages/AdminPage.module.css`
- `client/src/pages/AuthPage.module.css`
- `client/src/pages/BillingPage.jsx`
- `client/src/pages/BillingPage.module.css`
- `client/src/pages/DashboardPage.jsx`
- `client/src/pages/DashboardPage.module.css`
- `client/src/pages/DirectoryPage.jsx`
- `client/src/pages/DirectoryPage.module.css`
- `client/src/pages/ExtensionPage.jsx`
- `client/src/pages/ExtensionPage.module.css`
- `client/src/pages/FilesPage.jsx`
- `client/src/pages/FilesPage.module.css`
- `client/src/pages/ForgotPage.jsx`
- `client/src/pages/ImportPage.jsx`
- `client/src/pages/ImportPage.module.css`
- `client/src/pages/InventoryPage.jsx`
- `client/src/pages/InventoryPage.module.css`
- `client/src/pages/InventorySettingsPage.jsx`
- `client/src/pages/InventorySettingsPage.module.css`
- `client/src/pages/ItemDetailPage.jsx`
- `client/src/pages/ItemDetailPage.module.css`
- `client/src/pages/LeadsPage.jsx`
- `client/src/pages/LeadsPage.module.css`
- `client/src/pages/LoginPage.jsx`
- `client/src/pages/MessageSettingsPage.jsx`
- `client/src/pages/MessageSettingsPage.module.css`
- `client/src/pages/MessagesPage.jsx`
- `client/src/pages/MessagesPage.module.css`
- `client/src/pages/PublicCatalogPage.jsx`
- `client/src/pages/PublicCatalogPage.module.css`
- `client/src/pages/PublicItemPage.jsx`
- `client/src/pages/PublicItemPage.module.css`
- `client/src/pages/PublicQuotePage.jsx`
- `client/src/pages/PublicQuotePage.module.css`
- `client/src/pages/QuoteDetailPage.jsx`
- `client/src/pages/QuoteDetailPage.module.css`
- `client/src/pages/QuotePage.jsx`
- `client/src/pages/QuotePage.module.css`
- `client/src/pages/ResetPage.jsx`
- `client/src/pages/SettingsPage.jsx`
- `client/src/pages/SettingsPage.module.css`
- `client/src/pages/SetupPage.jsx`
- `client/src/pages/StatsPage.jsx`
- `client/src/pages/StatsPage.module.css`
- `client/src/pages/TemplatesPage.jsx`
- `client/src/pages/TemplatesPage.module.css`
- `client/src/pages/VendorsPage.jsx`
- `client/src/pages/VendorsPage.module.css`

### Server

- `server/package.json`
- `server/package-lock.json`
- `server/api/v1.js`
- `server/db.js`
- `server/index.js`
- `server/routes/ai.js`
- `server/routes/availability.js`
- `server/routes/files.js`
- `server/routes/messages.js`
- `server/routes/quotes.js`
- `server/routes/settings.js`
- `server/routes/updates.js`
- `server/services/emailPoller.js`
- `server/services/quoteService.js`
- `server/services/updateCheck.js`

---

## Thematic clusters (inferred from paths; confirm in diffs before release)

| Theme | Relevant paths (examples) |
|-------|---------------------------|
| **UI redesign / CSS modules** | Broad `*.module.css` across `components/` and `pages/`; `theme.css`; untracked `AI/reports/redesign-plan.md` |
| **Quote detail / builder** | `QuoteDetailPage*`, `QuoteBuilder*`, `quote-builder/*`, untracked `pages/quote-detail/*` |
| **Inventory & items** | `InventoryPickerPanel`, untracked `ItemDetailDrawer*`, `ImageLightbox*` |
| **Logistics / messaging (untracked)** | `features/logistics/*`, `lib/logisticsRename.js`, `components/messages/*` |
| **Routing / perf** | Untracked `lib/routePrefetch.js`; `App.jsx`, `main.jsx` |
| **Tooling & deps** | Root + client + server lockfiles / `package.json` / `bun.lock`; untracked Tailwind/PostCSS; **`server/package-lock.json`** (e.g. `npm audit fix`–style dependency bumps) |
| **Server API** | `messages`, `quotes`, `availability`, `files`, `ai`, `quoteService`, `db`, `index` |
| **Docs** | `AI/*`, `ai/*`, code audit report |

---

## Release checklist (recommended)

- [ ] Commit **untracked** files intentionally (new components, `quote-detail/` panels, Tailwind/PostCSS, libs, `redesign-plan.md`) or omit if WIP.
- [ ] Reconcile **lockfiles** (`package-lock.json`, `bun.lock`) with your chosen package manager for CI.
- [ ] Decide canonical docs folder: **`AI/`** vs **`ai/`**.
- [ ] Review **`.env.example`** and **server/client `package.json`** for deploy notes.
- [ ] Smoke test after large UI/CSS churn: auth, quotes, inventory, messages, public pages, uploads.

---

## Diff command reference

```bash
git fetch origin
git diff --shortstat origin/master
git diff --name-only origin/master
git ls-files --others --exclude-standard
```
