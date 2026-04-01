# HANDOFF — BadShuffle UI/UX Redesign

---

## 2026-03-31 — Fulfillment / permissions framework handoff

### What was implemented

- Role and permission framework:
  - added `roles` and `role_permissions`
  - permission model is now module-based with `none`, `read`, and `modify`
  - seeded built-in roles:
    - `admin`
    - `operator`
    - `worker`
    - `user`
  - `worker` defaults:
    - dashboard `read`
    - projects `read`
    - fulfillment `modify`
    - files `read`
    - messages `none`
    - billing `none`
    - inventory `none`
    - settings `none`
    - admin `none`
  - `/api/auth/me` now returns effective permissions
  - client route gating and sidebar visibility now use the permission map
  - first permission enforcement pass now covers:
    - projects/quotes
    - files
    - messages
    - billing
    - inventory
    - dashboard
    - maps
    - directory/team/leads
    - settings
    - admin
  - Admin page now includes a first-pass Roles tab:
    - create custom roles
    - edit module permissions with circle selectors
    - assign those roles to users from the Users tab
- Fulfillment framework:
  - added:
    - `quote_fulfillment_items`
    - `quote_fulfillment_notes`
    - `quote_fulfillment_events`
  - confirming a project now snapshots/syncs fulfillment rows from current quote items
  - fulfillment rows track quantity, checked-in quantity, section title, and rental range
  - added project fulfillment API:
    - `GET /api/quotes/:id/fulfillment`
    - `POST /api/quotes/:id/fulfillment/items/:fulfillmentItemId/check-in`
    - `POST /api/quotes/:id/fulfillment/notes`
  - project detail now has a first-pass Fulfillment tab for confirmed/closed projects
  - non-modifier project users now get a read-only item presentation path instead of the normal quote-builder editing flow
  - availability/conflict logic now keeps fulfilled quantities reserved until manual check-in, including after project close

### What is still open

- route/page permission migration is not complete across every legacy domain yet:
  - templates
  - vendors
  - updates
  - any remaining `requireOperator` / `requireAdmin` assumptions
- worker read-only project detail should get a more deliberate dedicated layout; current fallback is functional but not ideal
- fulfillment needs a richer event/history UI and a clearer decision on whether confirmed projects should lock commercial line-item edits by default

---

## 2026-03-27 — Current product/workflow handoff

### What was implemented

- User profile system:
  - `users` now support:
    - `first_name`
    - `last_name`
    - `username`
    - `display_name`
    - `phone`
    - `photo_url`
    - `bio`
  - first + last name are now treated as the primary user identity across the app
  - `username` and `display_name` are now generated server-side from the user’s name, with email fallback and unique username suffixing when needed
  - `GET /api/auth/me` now returns the full current-user profile instead of only id/email/role
  - added `PUT /api/auth/me` so each authenticated user can update first name, last name, phone, email, photo, and bio
  - profile updates now return a fresh JWT so email changes stay aligned with active auth state
  - added protected `/profile` page for self-service account/profile editing
  - profile photos upload through the existing file/image pipeline rather than a separate user-media path
  - sidebar footer now exposes `Profile` directly for all authenticated users
  - Team cards now use profile names/photos, show generated usernames, and also show stored phone/bio when present, instead of remaining email-only
- Team page / staff roster:
  - added protected `GET /api/team`
  - added protected `/team` page under `Directory`
  - team roster shows approved admin/operator users only
  - each member now shows:
    - online/offline status
    - last seen
    - current focus / current page label
    - YTD sales total
    - quote count
    - recent 3 projects
  - `Directory` landing page now links to `Team`
  - sidebar `Directory` group now includes `Team`
- Presence persistence:
  - presence is no longer process-local only
  - new `user_presence` table stores `current_path`, `current_label`, `last_seen_at`, and `updated_at`
  - `PUT /api/presence` now persists presence state instead of only updating an in-memory map
  - `GET /api/presence` now reads from durable presence state and derives `online` from the 2-minute threshold
  - app layout now sends a presence heartbeat every 60 seconds so users remain current even when they stay on one page
- Image upload/compression pipeline:
  - new image uploads now flow through a Sharp-based compression pipeline instead of being stored only as raw uploads
  - uploads are auto-rotated, stripped, converted to WebP, and can optionally generate AVIF variants
  - image assets now persist three variants:
    - `thumb`
    - `ui`
    - `large`
  - `/api/files/:id/serve` now resolves the best stored image variant instead of always serving the original file payload
  - high-density UI surfaces now explicitly request smaller variants where appropriate (file library, image picker, inventory/quote item thumbnails)
  - Settings now include an Image Compression section with:
    - WebP quality slider
    - AVIF enable toggle
    - live server-generated comparison preview
  - existing image uploads remain legacy and continue to work as-is; only new uploads enter the new variant pipeline
- Sales Pipeline Analytics dashboard:
  - added a new authenticated backend endpoint at `/api/sales/analytics`
  - analytics are derived from quotes + contracts + computed totals and classified into three pipeline series:
    - `quoteSent`
    - `contractSigned`
    - `lost`
  - monthly gaps are now normalized client-side so the chart never drops missing months
  - the dashboard was restructured into a clean feature split:
    - service layer: `client/src/features/sales-dashboard/salesAnalytics.service.ts`
    - hooks: `useSalesAnalyticsQuery`, `useSalesAnalyticsViewModel`
    - UI: `SalesDashboard`, `SalesFilters`, `SalesChart`, `KPISection`
  - the new dashboard uses React Query + Recharts, Tailwind utility styling, skeleton loading states, explicit empty states, and a collapsible filter rail with instant filter updates
  - first redesign correction has already landed: the analytics dashboard shell is now driven by app theme tokens instead of hardcoded navy/white slate colors, so it reads correctly across the supported themes
  - chart hover now drives a persistent month breakdown panel rather than hiding all detail inside a tooltip
  - KPI cards now reveal deeper stats on hover instead of using modal flows
- Quote ownership for analytics:
  - added `quotes.created_by`
  - quote creation through `quoteCoreService.createQuote()` now stores `req.user.sub` when available
  - this powers the staff filter in the new sales analytics dashboard and is groundwork for future sales drill-down/reporting features
- Maps workspace:
  - added authenticated `GET /api/maps/quotes`
  - added protected `/maps` route/page with a Mapbox-powered 2D world map
  - quote, booked, and closed projects now render as separate pin groups with clickable project links
  - pins use `venue_address` first, then fall back to `client_address`
  - sidebar/navigation was also reorganized around this addition:
    - `Maps` now sits below `Projects`
    - `Messages` is above `Inventory`
    - `Inventory` is below `Directory`
    - `Billing` is a standalone nav item below `Files`
    - `Extension` was renamed from `Extension / Help` to `Extension` and moved under `Settings`
  - quote records now persist map cache fields:
    - `map_address_source`
    - `map_address_text`
    - `map_lat`
    - `map_lng`
    - `map_geocoded_at`
    - `map_geocode_status`
  - quote create/update now refresh geocode cache, and older quotes lazily geocode when the maps endpoint needs them
- Fixed quote-item drag reorder by moving `PUT /quotes/:id/items/reorder` ahead of `PUT /quotes/:id/items/:qitem_id` in Express route order.
- Added quote item sections:
  - new `quote_item_sections` table
  - `quote_items.section_id` and `quote_custom_items.section_id`
  - default-section backfill for existing quotes
  - section create/update/duplicate/delete endpoints
  - editable section title + per-section rental date range in the builder UI
- Added settings-backed event types:
  - new settings key `quote_event_types`
  - Settings page editor for Sales team
  - project create/edit forms now use event type dropdowns
- Added project-title automation:
  - new settings key `quote_auto_append_city_title`
  - optional city suffix behavior for project create/edit titles
- Public/client quote view changes:
  - product item descriptions now show inline in the item list
  - quote items are grouped by section title
  - client view now shows section titles, section date ranges, inline descriptions, and per-section subtotals
  - public quote reads the latest live quote state after approve/sign actions
  - public contract view now allows re-signing when `has_unsigned_changes = 1`
  - signature block is rendered from stored signature metadata
- Export / print / signed artifact rendering changes:
  - Quote export / print now groups line items by section
  - export output now shows section date ranges, item descriptions, and per-section subtotals
  - signed-contract PDF artifacts now include section-grouped quote content and totals instead of only the contract body + signature metadata
- Signed-balance workflow changes:
  - project list outstanding-balance filter now only includes already-signed projects
  - unsigned-change projects show the last signed total / signed balance, not the current edited total
  - project search boxes were merged into one search covering project, client, venue name, and venue address
- Contract signing artifact generation:
  - contract records now store `signer_ip` and `signed_quote_total`
  - new `contract_signature_events` audit table
  - new `contract_signature_items` snapshot table to preserve signed item quantities/date windows
  - each public signature/re-signature now:
    - records typed name, IP, timestamp, signed total
    - records request user-agent and a quote snapshot hash on the signature event
    - generates a fake handwritten signature SVG
    - creates a signed-contract PDF artifact
    - attaches that PDF to project files
    - preserves prior signed versions as separate attached files
    - locks signed-contract artifacts against removal from the project Files tab/API
- Availability/conflict logic is now section-aware enough to distinguish:
  - committed signed quantities
  - unsigned added quantities as potential conflicts
  - per-section date windows in availability lookups and conflict checks
- Public quote endpoint now normalizes missing section rows for older quotes and backfills orphaned `section_id` values on read so section titles render correctly.
- `/api/v1` public quote routes are now aligned with the legacy `/api` behavior for:
  - section normalization / orphan section backfill
  - quote adjustments in the public payload
  - approval expiration/status guards
  - sign-route audit metadata capture
- Quote detail edit-flow hardening:
  - unsaved-changes warnings now cover both quote-form edits and unsaved contract-body edits
  - canceling edit mode now restores the last saved quote form state instead of only hiding the form
  - canceling client/venue inline edits now restores the saved values instead of leaving stale unsaved input in local state
- Destructive-action confirmation cleanup:
  - quote payment deletion now uses the shared confirm dialog instead of `window.confirm()`
  - replacing a quote contract draft from a template now uses an explicit overwrite confirm dialog
  - admin database import replacement now uses the shared confirm dialog instead of a raw browser prompt
- Inventory card accessibility:
  - keyboard focus on an inventory card now reveals the image action tray
  - overlay actions are grouped and labeled for assistive tech
  - action buttons now have visible `:focus-visible` treatment instead of relying on hover only
- Projects-page performance pass:
  - `GET /api/quotes` now supports `page`, `limit`, `sort_by`, and `sort_dir`
  - default list/tile loads now paginate in SQL before totals work
  - quote totals, payments, and contract metadata for visible rows are now batched through one list-summary pass instead of per-quote N+1 reads
  - quote list indexes were added for created/event/status and quote-related foreign keys
  - the client projects page now uses server-backed pagination instead of loading and sorting the entire quote set in-browser
- Quote-detail performance pass:
  - `QuoteDetailPage` now lazy-loads non-primary tabs and modal-only tooling
  - extracted chunks include billing/files/logs plus AI suggest, send modal, map modal, file picker, logistics rename, item drawer, and image lightbox
  - built quote-detail JS dropped from about `347.20 KiB` to `313.13 KiB`
- Shared request-layer performance pass:
  - `client/src/api.js` now supports opt-in `AbortController` cancellation and dedupe keys
  - quote list, inventory list, leads list, lead suggestions/events, and billing history now cancel stale reads instead of letting older requests race newer state
  - use `isAbortError()` when consuming these paths so aborted requests stay silent
- App-bootstrap performance pass:
  - `AuthGate` no longer returns `null` during auth bootstrap; it now shows the shared `PageSpinner`
  - auth bootstrap no longer keys off every ordinary route change the way it did before
  - unauthenticated visits to `/login`, `/forgot`, and `/reset` now short-circuit without unnecessary bootstrap work
- Route-prefetch performance pass:
  - background route warming is now budget-aware instead of always eagerly warming the same four routes after auth
  - sessions on slow/save-data/low-resource conditions skip background warming entirely
  - warmed route queues are now smaller and chosen by current page context, while hover/focus prefetch remains for explicit navigation intent
- Public-quote performance pass:
  - `PublicQuotePage` now lazy-loads the contract view and item detail modal instead of shipping them in the initial route chunk
  - built public-quote JS dropped from about `81 KiB` to `36.46 KiB`
  - extracted chunks now include `PublicQuoteContractView` (`43.15 KiB`) and `PublicQuoteItemDetailModal` (`3.17 KiB`)
- Heavy-list rendering pass:
  - inventory now window-renders large item sets through `VirtualGrid`
  - files page now window-renders large tile and list views through `VirtualGrid` / `VirtualList`
  - billing history still uses bounded paging rather than full virtualization
- Quote-builder render pass:
  - `QuoteLineItemsPanel` now uses a memoized row component instead of rebuilding the full inline row markup on every panel state change
  - row rerenders are now narrower during price edit, discount edit, qty edit, drag-over, and newly-added item transitions
- Search debounce pass:
  - added shared `useDebouncedValue` hook for server-backed list/search screens
  - quote, inventory, and leads now share the same debounce timing instead of each page hand-rolling different behavior
  - leads suggestions now reuse the debounced search value instead of layering a second custom timeout
  - billing search remains immediate because it filters already-loaded local data rather than fetching
- Architecture split started:
  - `ARCH-1` is now the recommended first architecture initiative
  - quote list/query orchestration has been extracted from `server/routes/quotes.js` into `server/services/quoteListService.js`
  - quote section behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteSectionService.js`
  - quote item mutation behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteItemService.js`
  - quote custom-item mutation behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteCustomItemService.js`
  - quote contract read/write/log behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteContractService.js`
  - quote lifecycle behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteLifecycleService.js`
  - quote payments/refunds/adjustments/damage-charge behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteFinanceService.js`
  - quote detail/activity/create/update/public-token/send/unsigned-change behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteCoreService.js`
  - quote file attachment behavior has been extracted from `server/routes/quotes.js` into `server/services/quoteFileService.js`
  - quote list/summary, detail/activity/create/update, contract read/write/logs, file attachment CRUD, section creation/update/duplication/deletion/bootstrapping, quote item add/reorder/update/delete, quote custom-item add/update/delete, quote approve/revert/confirm/close/delete/duplicate, and quote payment/refund/adjustment/damage-charge routes now flow through dedicated services
  - the quote domain is now functionally split; the remaining `ARCH-1` work is extending the same boundary pattern to other server route domains and, if desired, adding repository-layer extraction under these services
  - the item/inventory domain split has now started:
    - item catalog/detail/category/accessory/association logic now flows through `server/services/itemService.js`
    - shared item read SQL now lives in `server/db/queries/items.js`
    - `server/routes/items.js` is now thinner and delegates the main item-domain flows instead of keeping them inline
  - the files domain split has now started:
    - file upload/list/delete/attachment lookup logic now flows through `server/services/fileService.js`
    - shared file read SQL continues to live in `server/db/queries/files.js`
    - `server/routes/files.js` is now thinner and delegates the main file-domain flows instead of keeping them inline
  - the leads domain split has now started:
    - lead list/event/create/update/import/delete logic now flows through `server/services/leadService.js`
    - shared lead read SQL continues to live in `server/db/queries/leads.js`
    - `server/routes/leads.js` is now thinner and delegates the main lead-domain flows instead of keeping them inline
  - `ARCH-2` has begun in the DB layer:
    - base schema bootstrap now lives in `server/db/schema.js`
    - base schema definitions are now split by domain under `server/db/schema/` (`items`, `users`, `quotes`, `settings`, `leads`)
    - table/column/index bootstrap now lives in `server/db/migrations.js`
    - migration definitions are now split by domain under `server/db/migrations/` (`items`, `users`, `quotes`, `leads`, `files`, `messages`)
    - settings/default seeding and first-user admin promotion now live in `server/db/settings.js`
    - shared DB bootstrap helpers now live in `server/db/helpers.js`
    - raw settings-default payloads now live in `server/db/defaults.js`
    - settings defaults are now further split by domain under `server/db/defaults/` (`app`, `mail`, `inventory`, `ai`, `quotes`)
    - lightweight DB bootstrap metadata now lives in `server/db/meta.js` and records per-domain schema/migration/defaults version markers in `db_bootstrap_meta`
    - those version markers are now exported by the schema/migration/defaults domain modules themselves instead of being hardcoded centrally in `meta.js`
    - small shared DB query utilities now live under `server/db/queries/` (`settings`, `bootstrapMeta`, `quotes`, `users`, `files`, `leads`, `messages`)
    - repeated settings reads/writes in several server routes/services now use the shared settings query helper instead of duplicating raw `settings` table lookups
    - extracted quote services now reuse centralized quote existence / quote fetch / actor-email lookup helpers instead of each carrying local copies
    - leads/files routes now also reuse centralized DB query helpers for common read paths instead of open-coded route SQL
    - the messages route now also uses centralized DB query helpers for its core read/write paths
    - the first narrow repository module now exists at `server/db/repositories/quoteRepository.js`, and `quoteCoreService` / `quoteListService` now use it for the heavier quote detail/activity/list/list-summary read paths
    - `server/db.js` is smaller and now acts as the sql.js wrapper + init orchestrator instead of carrying all schema/default logic inline

### Main files touched

- Server:
  - `server/db.js`
  - `server/db/schema.js`
  - `server/db/schema/*`
  - `server/db/migrations.js`
  - `server/db/migrations/*`
  - `server/db/helpers.js`
  - `server/db/defaults.js`
  - `server/db/defaults/*`
  - `server/db/meta.js`
  - `server/db/queries/*`
  - `server/db/repositories/*`
  - `server/db/settings.js`
  - `server/routes/quotes.js`
  - `server/routes/items.js`
  - `server/routes/files.js`
  - `server/routes/leads.js`
  - `server/services/quoteContractService.js`
  - `server/services/quoteCoreService.js`
  - `server/services/mapboxGeocodeService.js`
  - `server/services/mapService.js`
  - `server/routes/maps.js`
  - `server/services/quoteFileService.js`
  - `server/services/quoteFinanceService.js`
  - `server/services/quoteLifecycleService.js`
  - `server/services/itemService.js`
  - `server/services/fileService.js`
  - `server/services/leadService.js`
  - `server/services/quoteService.js`
  - `server/routes/availability.js`
  - `server/routes/settings.js`
  - `server/api/v1.js`
  - `server/index.js`
- Client:
  - `client/src/api.js`
  - `client/src/hooks/useQuoteDetail.js`
  - `client/src/pages/QuotePage.jsx`
  - `client/src/pages/MapsPage.jsx`
  - `client/src/pages/MapsPage.module.css`
  - `client/src/pages/QuoteDetailPage.jsx`
  - `client/src/pages/PublicQuotePage.jsx`
  - `client/src/pages/PublicQuotePage.module.css`
  - `client/src/pages/SettingsPage.jsx`
  - `client/src/components/QuoteBuilder.jsx`
  - `client/src/components/QuoteBuilder.module.css`
  - `client/src/components/QuoteHeader.jsx`
  - `client/src/components/QuoteCard.jsx`
  - `client/src/components/Sidebar.jsx`
  - `client/src/App.jsx`
  - `client/src/lib/routePrefetch.js`
  - `client/src/components/quote-builder/InventoryPickerPanel.jsx`
  - `client/src/components/quote-builder/QuoteLineItemsPanel.jsx`
  - `client/src/lib/quoteTitle.js`

### Validation run

- `node --check server/routes/quotes.js`
- `node --check server/routes/items.js`
- `node --check server/routes/files.js`
- `node --check server/routes/leads.js`
- `node --check server/services/quoteContractService.js`
- `node --check server/services/quoteCoreService.js`
- `node --check server/services/quoteFileService.js`
- `node --check server/services/quoteFinanceService.js`
- `node --check server/services/quoteLifecycleService.js`
- `node --check server/services/itemService.js`
- `node --check server/services/fileService.js`
- `node --check server/services/leadService.js`
- `node --check server/db.js`
- `node --check server/db/schema.js`
- `node --check server/db/schema/items.js`
- `node --check server/db/schema/users.js`
- `node --check server/db/schema/quotes.js`
- `node --check server/db/schema/settings.js`
- `node --check server/db/schema/leads.js`
- `node --check server/db/migrations.js`
- `node --check server/db/migrations/items.js`
- `node --check server/db/migrations/users.js`
- `node --check server/db/migrations/quotes.js`
- `node --check server/db/migrations/leads.js`
- `node --check server/db/migrations/files.js`
- `node --check server/db/migrations/messages.js`
- `node --check server/db/helpers.js`
- `node --check server/db/defaults.js`
- `node --check server/db/defaults/app.js`
- `node --check server/db/defaults/mail.js`
- `node --check server/db/defaults/inventory.js`
- `node --check server/db/defaults/ai.js`
- `node --check server/db/defaults/quotes.js`
- `node --check server/db/meta.js`
- `node --check server/db/queries/settings.js`
- `node --check server/db/queries/bootstrapMeta.js`
- `node --check server/db/queries/quotes.js`
- `node --check server/db/queries/users.js`
- `node --check server/db/queries/files.js`
- `node --check server/db/queries/leads.js`
- `node --check server/db/queries/messages.js`
- `node --check server/db/queries/items.js`
- `node --check server/db/repositories/quoteRepository.js`
- `node --check server/db/settings.js`
- `node --check server/routes/availability.js`
- `node --check server/api/v1.js`
- `node --check server/services/quoteService.js`
- `node --check server/db.js`
- `node --check server/index.js`
- `npm --prefix client run build`

### What is still left to do

- The generated signed-contract PDF is still a simple server-generated audit artifact.
  - It now has better event metadata and version visibility, but it is not a full e-sign compliance implementation.
  - If legal/compliance requirements matter, this still needs a proper policy/vendor decision.
- Custom-item descriptions are only shown if present in returned data; there is no dedicated custom-item description workflow yet.
- Section reordering is not implemented.
  - Sections can be added/duplicated/deleted and renamed, but not drag-reordered.
- Event type search/reporting surfaces beyond project create/edit/list are still minimal.
- Signed contract versions are labeled in Files UI now, but there is still room for better dedicated version browsing if the product wants a more explicit contract-history surface.

### Recommended next pass

1. Decide whether signed-contract generation should stay internal or move to a formal e-sign provider/compliance workflow.
2. Add section reorder support if the product needs chronological ordering independent of creation order.
3. Add custom-item description editing and improve signed-contract version presentation in Files UI.
4. Expand event type reporting/search surfaces if the product needs broader filtering/analytics support.

### Performance follow-up after PERF-A1

- `PERF-A1` is now done.
- Next highest-value performance items are:
  1. decide whether billing history needs a dedicated virtualized sortable layout or should stay paged
  2. profile `QuoteDetailPage` again if quote-builder interaction still feels heavy after row memoization
  3. tighten repeated settings-load behavior if cold settings fetches still show up in perf traces

**Type:** Cosmetic redesign, non-breaking
**Produced:** 2026-03-23
**Source:** Raw design notes → structured design system memo
**Next Action:** Aider begins Phase 1 implementation

---

## Summary

A full UI/UX redesign memo has been produced for BadShuffle based on raw design notes identifying four core problems: visual flatness, weak hierarchy, no breathing room, and no interaction feedback.

The redesign transforms BadShuffle from a functional internal tool into a product that looks and feels like a polished SaaS. No APIs, business logic, or features change. The entire scope is presentation layer.

**Three artifacts produced:**
1. `ai/UXDesign/BADSHUFFLE_REDESIGN.md` — Complete design spec (12 sections, execution-ready)
2. `ai/TODO.md` — 20 new UX tasks with agent routing, file targets, and priorities
3. `ai/HANDOFF.md` — This document

---

## Key Decisions

### 1. The Background Layer Is the Biggest Single Win
The single highest-leverage change in the entire redesign is one line:
```css
body { background: var(--color-surface); }
```
Currently `body` and `.card` both use `--color-bg` (white). They're indistinguishable. Switching body to `--color-surface` (already defined as light gray in all 4 themes) creates instant visual depth across every page with zero risk.

**Implementation note:** Aider should do this FIRST, before any other change. Cursor then verifies across all themes.

### 2. Two New Derived Tokens Replace All Inline rgba() Calls
The design requires a "primary-light" and "primary-hover" tint throughout (sidebar active, quote summary, inventory overlay). Rather than hardcoding `rgba(26, 143, 193, 0.12)` everywhere and breaking on theme switch, we add two derived tokens using `color-mix()` (already used in the codebase):
```css
--color-primary-subtle: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg));
--color-primary-hover:  color-mix(in srgb, var(--color-primary) 20%, var(--color-bg));
```
These must be added to ALL 5 `:root` blocks in `theme.css` (default + 4 themes).

### 3. Quote Builder Item Cards Replace Table Rows — Most Complex Change
The Quote Builder is the critical path screen. The redesign converts line items from table rows to card components. This is the most complex single change because `QuoteBuilder.jsx` has existing drag-to-reorder logic (HTML5 drag handles), discount badge rendering, and qty controls that must continue working inside the new card layout.

**Implementation note:** Aider must NOT change the drag, discount, or qty logic — only the wrapping layout/styling. Cursor should polish spacing and verify drag still functions after Aider's pass.

### 4. Stepper for Import Flow Is New JSX, Not CSS-Only
The Import flow stepper (UX-16) requires state management (current step) inside `ImportPage.jsx`. This is the only Phase 3 item that touches JSX meaningfully. All other Phase 3 items are CSS changes applied to existing structure. Aider should implement this as a local state pattern inside `ImportPage.jsx` — no new component extraction required unless the same stepper is needed elsewhere (it is not, currently).

### 5. `theme.css` Is the Correct Place for Global Changes
The app uses CSS Modules per-file, but `theme.css` defines global utilities (`.card`, `.btn`, `.badge`, `.empty-state`, `.spinner`). All Phase 1 changes belong in `theme.css` — this ensures they apply everywhere without touching individual files. Phase 2+ changes go into per-file CSS Modules.

### 6. Hover Overlays on Inventory Cards Must Not Break Touch
The inventory card hover overlay (action buttons appear on hover) works cleanly on desktop. On touch devices, hover doesn't trigger. The solution: on touch devices, actions should remain visible (or appear on tap). CSS `@media (hover: none)` can be used to keep buttons visible on touch screens. Cursor should handle this during Phase 4 mobile pass.

### 7. No New npm Packages
Every technique used (CSS transitions, `color-mix()`, `position: sticky`, CSS Grid/Flexbox, keyframe animations) is browser-native. No additional dependencies.

---

## Files Created/Updated

| File | Action | Notes |
|---|---|---|
| `ai/UXDesign/BADSHUFFLE_REDESIGN.md` | Created | Full 12-section design spec |
| `ai/TODO.md` | Updated | Added 20 UX tasks (UX-1 through UX-20), preserved existing backlog |
| `ai/HANDOFF.md` | Updated | This document |

---

## Files Aider Will Touch (by phase)

### Phase 1 (start here)
| File | Change |
|---|---|
| `client/src/theme.css` | body background, derived tokens, btn:active, card hover |
| `client/src/components/Layout.module.css` | content area padding + max-width |
| `client/src/components/Sidebar.module.css` | active pill, hover state, section spacing |

### Phase 2
| File | Change |
|---|---|
| `client/src/pages/DashboardPage.jsx` | KPI card structure, empty states |
| `client/src/pages/DashboardPage.module.css` | .kpiCard, .kpiValue, .kpiLabel styles |
| `client/src/components/ItemCard.jsx` | Add overlay div for hover actions |
| `client/src/components/ItemCard.module.css` | Hover overlay, image aspect-ratio, lift transform |
| `client/src/pages/InventoryPage.module.css` | Filter bar scroll, pill styles |
| `client/src/pages/LeadsPage.module.css` | Row padding, hover, sticky header |
| `client/src/pages/BillingPage.module.css` | Same as LeadsPage |

### Phase 3
| File | Change |
|---|---|
| `client/src/components/QuoteBuilder.jsx` | Item card structure (layout only, keep logic) |
| `client/src/components/QuoteBuilder.module.css` | .quoteItem card styles, addedFlash animation, summary panel |
| `client/src/pages/QuoteDetailPage.module.css` | Summary total emphasis, action grouping |
| `client/src/pages/ImportPage.jsx` | Add stepper state + step navigation |
| `client/src/pages/ImportPage.module.css` | Stepper styles, step card styles |
| `client/src/pages/MessagesPage.jsx` | Empty state JSX, thread list structure |
| `client/src/pages/MessagesPage.module.css` | Thread row styles, bubble styles |

### Phase 4 (Cursor)
| File | Change |
|---|---|
| `client/src/theme.css` | Add .skeleton class |
| All loading components | Replace text/spinner loading with skeleton |
| All relevant files | Mobile/responsive fixes |

---

## Implementation Guidance for Aider

### Order of Execution
1. **`theme.css` first, always.** Every global change must land before per-screen work begins. Otherwise screens look inconsistent mid-implementation.
2. **Layout.module.css second.** Sets the spatial canvas for everything else.
3. **Sidebar.module.css third.** Navigation is the persistent chrome — fix it early.
4. **Then screens in order:** Dashboard → Inventory → Leads/Billing → Quote Builder → Import → Messages.
5. **Quote Builder last** in Aider's scope because it's the most structurally complex.

### How to Read the Design Memo
- Section 5 = tokens/variables to change (theme.css targets)
- Section 6 = layout changes (Layout.module.css, Sidebar.module.css)
- Section 7 = per-screen changes (one subsection per screen)
- Section 8 = interaction patterns (theme.css + per-component)
- Section 10 = phase ordering

### What Aider Should NOT Do
- Do not refactor JSX component hierarchy — change styles and minimal structure only
- Do not change any prop names, state variables, or event handlers
- Do not add TypeScript or PropTypes
- Do not extract new components unless the task explicitly says to (e.g., Stepper for ImportPage)
- Do not touch `server/` — this is frontend-only
- Do not add `!important` to override specificity conflicts — fix the root selector instead

### CSS Module Specificity
The existing codebase uses CSS Modules. When adding new styles, add them to the relevant `.module.css` file and reference them as `styles.className` in the JSX. Never inject style tags or use global class names in component files.

---

## Risks / Watchouts

### Risk 1: theme.css Card Hover + Pages With Dense Card Grids
Adding `card:hover { box-shadow: var(--shadow-md) }` globally will apply to every `.card` instance, including tables, form sections, and modal content. On pages where cards are stacked tightly (Settings page), constant hover shadow changes can feel noisy. **Mitigation:** Add a `.card-static` modifier class for cards that should not have hover elevation (settings form cards, modal bodies). Cursor should audit during Phase 4.

### Risk 2: `body { background: var(--color-surface) }` on Auth/Setup Pages
The auth and setup pages (login, password reset, first-time setup) may look different with a light gray body — some are centered card layouts that rely on white body for full-bleed appearance. **Mitigation:** Aider should check `AuthPage.jsx` and `SetupPage.jsx` after changing body background. These may need `min-height: 100vh; background: var(--color-surface)` on the page wrapper to maintain their centered layout.

### Risk 3: Inventory Hover Overlay on Touch
The hover-based action overlay on ItemCard does not trigger on touch devices (iOS/Android). Users on tablets won't be able to add items. **Mitigation:** Add `@media (hover: none) { .itemCardOverlay { display: flex; } }` to show the overlay permanently on touch devices. Handle in Phase 4 mobile pass.

### Risk 4: Quote Builder Drag-to-Reorder + New Card Layout
`QuoteBuilder.jsx` has HTML5 drag-and-drop reorder logic tied to the current item row structure (dragstart, dragover, drop handlers, visual drag handle). Converting rows to cards changes the DOM structure. The drag handle (⠿) must remain as the first child of each item card and the `draggable` attribute must stay on the item wrapper. **Mitigation:** Aider should preserve the exact draggable structure — only wrap in a card container, do not restructure the interior drag elements.

### Risk 5: Sticky Summary Panel in Quote Builder
`position: sticky` requires the parent container to have `overflow: visible` (not `overflow: auto` or `overflow: hidden`). If the QuoteBuilder's layout container clips overflow, sticky won't work. **Mitigation:** Cursor should verify and fix parent overflow settings after Aider implements sticky.

### Risk 6: color-mix() Browser Support
`color-mix()` is supported in all modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+). The app appears to target desktop/modern browsers given the pkg/Windows EXE packaging. No polyfill needed. However, if the packaged client exe uses an older Chromium version via electron or similar, verify support.

---

## Next Recommended Tool

**Aider** — Begin with Phase 1. Provide the following files as context:
- `ai/UXDesign/BADSHUFFLE_REDESIGN.md` (full spec)
- `client/src/theme.css` (first target)
- `client/src/components/Layout.module.css`
- `client/src/components/Sidebar.module.css`

First prompt to Aider:
> "Implement UX-1 through UX-6 from the design spec in ai/UXDesign/BADSHUFFLE_REDESIGN.md. These are Phase 1 foundation changes to theme.css, Layout.module.css, and Sidebar.module.css. No JSX changes. No API changes. CSS and theme tokens only. See sections 5 and 6 of the design memo for exact values."

After Aider completes Phase 1, hand to **Cursor** for cross-theme visual QA before proceeding to Phase 2.
