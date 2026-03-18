# BadShuffle — Features

All features below are implemented unless marked as stub or partial.

---

## Quote System

- **CRUD:** Create, read, update, delete quotes. Name, guest_count, event_date, notes, venue_* (name, email, phone, address, contact, notes), quote_notes, tax_rate, client_* (first_name, last_name, email, phone, address).
- **Status:** draft → sent → approved → confirmed → closed; revert (back to draft from draft/sent/approved/confirmed; closed is irreversible). POST `/api/quotes/:id/send`, `/approve`, `/revert`. New: `confirmed` = hard inventory reservation; `closed` = post-event, releases inventory, unlocks damage charges. Send generates public_token if missing.
- **List + filters:** GET `/api/quotes` returns quotes with computed total, amount_paid, remaining_balance, overpaid, with optional filters (`search`, `status`, `event_from`, `event_to`, `has_balance`, `venue`). UI: QuotePage supports list/tile view, multi-select, batch duplicate/delete, and filter controls.
- **Create wizard:** QuotePage uses a 2-step quote creation flow (event details, then client info); optional Google Places autocomplete can fill client address.
- **Detail:** QuoteDetailPage: header (QuoteHeader), client/venue blocks, quote notes, logistics section, totals bar, tabs (Details, Contract, Files, Payments, Activity), Send to Client, Copy Link, AI Suggest, Duplicate, Delete.
- **Logic location:** `server/routes/quotes.js`, `client/src/pages/QuotePage.jsx`, `client/src/pages/QuoteDetailPage.jsx`, `client/src/components/QuoteHeader.jsx`.

## Quote Item Management

- Add/update/remove line items (inventory items) on a quote: quantity, label, sort_order. PATCH for hidden_from_quote.
- **Hide from quote:** `quote_items.hidden_from_quote` — item stays on quote for internal/operations but excluded from client-facing totals and public view. Toggle in QuoteBuilder.
- **Zero-quantity removal behavior:** Updating a quote item or custom item with `quantity = 0` removes the line and logs activity.
- **Logic location:** `server/routes/quotes.js` (POST/PUT/DELETE quote items and custom items), `client/src/components/QuoteBuilder.jsx`.

## Price Overrides

- **Per-line price override:** `quote_items.unit_price_override` (REAL, nullable). NULL = use inventory unit_price. Set inline in QuoteBuilder (click price → input → Enter/Esc to confirm/cancel). Override shown in purple with ✕ reset button.
- **Per-item discount:** `quote_items.discount_type` (`none` | `percent` | `fixed`) + `quote_items.discount_amount` (REAL). Inline edit in QuoteBuilder (discount badge click → popover). Applied in `effectivePrice()` in QuoteDetailPage and PublicQuotePage.
- **Effective price:** `effectivePrice(it)` — applies `unit_price_override` then discount. Used in all total computations (QuoteDetailPage, PublicQuotePage, QuoteExport).
- **Logic location:** `server/routes/quotes.js` (PUT /:id/items/:qitem_id accepts `unit_price_override`, `discount_type`, `discount_amount`; GET /:id returns them), QuoteBuilder (inline edit UI), QuoteDetailPage (`effectivePrice`, `computeTotals`).

## Quote Adjustments (Discounts & Surcharges)

- **Table:** `quote_adjustments` (id, quote_id, label, type, value_type, amount, sort_order).
- **Types:** `discount` (green, negative) or `surcharge` (amber, positive). Value type: `percent` or `fixed`. Percent applies to pre-tax base (subtotal + delivery + custom subtotal); fixed is flat.
- **Tax:** NOT recalculated on adjustments; tax remains on raw taxable line items.
- **Routes:** `GET/POST/PUT/DELETE /api/quotes/:id/adjustments`. POST validates type, value_type, amount ≥ 0, percent ≤ 100. Add/remove/update logs to `quote_activity_log` and calls `markUnsignedChangesIfApproved`.
- **UI:** "Discounts & Surcharges" section in QuoteBuilder (inline form + list with type badge and remove button). Adjustment rows in QuoteDetailPage summary card between delivery and tax lines.
- **Logic location:** `server/routes/quotes.js`, QuoteBuilder, QuoteDetailPage (`computeAdjustmentsTotal`), `client/src/api.js` (`getAdjustments`, `addAdjustment`, `updateAdjustment`, `removeAdjustment`).

## Custom Items (Quote-Level)

- One-off line items: title, unit_price, quantity, photo_url (file id), taxable, sort_order. Stored in `quote_custom_items`. No link to inventory.
- **Logic location:** `server/routes/quotes.js` (custom-items sub-routes), QuoteBuilder and quote totals in QuoteDetailPage/PublicQuotePage/QuoteExport.

## Logistics / Delivery

- **Category-based:** Items with `category` containing "logistics" are grouped as delivery/pickup in quote detail (Logistics section), in totals (delivery total), and in export. No separate logistics entity.
- **Logic location:** QuoteDetailPage (computeTotals, logistics block), QuoteExport, PublicQuotePage; server quote GET returns item category.

## Contracts

- One contract per quote: body (HTML), optional client signature (signed_at, signature_data, signer_name). Contract tab on QuoteDetailPage; staff edit body; client signs on public page (approve flow).
- **Contract templates:** Reusable body snippets; CRUD at `/api/templates/contract-templates`. Used to populate contract body.
- **Change logs:** contract_logs table stores each body change (user, old/new body). Shown in Contract tab.
- **Logic location:** `server/routes/quotes.js` (contract, contract/logs), `server/index.js` (public POST contract/sign), `client/src/pages/QuoteDetailPage.jsx` (Contract tab), `client/src/pages/PublicQuotePage.jsx` (sign).

## Quote Expiration

- **Fields:** `quotes.expires_at` (TEXT date, YYYY-MM-DD) + `quotes.expiration_message` (TEXT). Set in QuoteDetailPage edit form.
- **Public quote behavior:** If `expires_at < today`, `is_expired = true` is returned by the public quote API. PublicQuotePage shows a customizable expiration banner and hides the contract signature block (replaced with an "expired" placeholder). If the contract was already signed, it remains visible.
- **Logic location:** `server/api/v1.js` (expiration check, injects `is_expired`), `server/routes/quotes.js` (`PUT /:id` saves `expires_at`, `expiration_message`), `client/src/pages/QuoteDetailPage.jsx` (form fields), `client/src/pages/PublicQuotePage.jsx` + `PublicQuotePage.module.css` (banner + expired state).

## Payment Policies

- **Table:** `payment_policies` (id, name, body_text, is_default, created_at).
- **Routes:** `GET/POST/PUT/DELETE /api/templates/payment-policies` (operator+).
- **Quote linkage:** `quotes.payment_policy_id` (nullable FK). Selectable in QuoteDetailPage edit form. Shown as a "Payment Policy" section on the public quote page when set.
- **Logic location:** `server/routes/templates.js`, `server/api/v1.js` (fetches linked policy for public quote), `client/src/pages/TemplatesPage.jsx` (CRUD section), `client/src/pages/QuoteDetailPage.jsx` (selector), `client/src/pages/PublicQuotePage.jsx` (display).

## Rental Terms

- **Table:** `rental_terms` (id, name, body_text, is_default, created_at).
- **Routes:** `GET/POST/PUT/DELETE /api/templates/rental-terms` (operator+).
- **Quote linkage:** `quotes.rental_terms_id` (nullable FK). Selectable in QuoteDetailPage edit form. Shown as a "Rental Terms" section on the public quote page when set.
- **Logic location:** `server/routes/templates.js`, `server/api/v1.js` (fetches linked terms for public quote), `client/src/pages/TemplatesPage.jsx` (CRUD section), `client/src/pages/QuoteDetailPage.jsx` (selector), `client/src/pages/PublicQuotePage.jsx` (display).

## Billing

- **Payments:** Add/remove payments on a quote (amount, method, reference, note, paid_at). Stored in quote_payments; billing_history records payment_received, payment_removed, refunded.
- **Refund:** POST `/api/quotes/:id/refund` adds negative payment and billing_history event.
- **Billing page:** Lists billing_history (all quotes, last 500). Operator-only.
- **Logic location:** `server/routes/quotes.js` (payments, refund), `server/routes/billing.js`, `client/src/pages/BillingPage.jsx`, QuoteDetailPage Payments tab.

## File Attachments

- **Media library:** Upload/list/delete files (uploads/). Files table: original_name, stored_name, mime_type, size, uploaded_by.
- **Quote attachments:** Link files to a quote (quote_attachments). Shown in Quote detail Files tab.
- **Public quote images:** Item/custom item photo_url can be file id; public quote API returns signed_photo_url for those. Serve at `/api/files/:id/serve` with Bearer or signed query (sig, exp).
- **Logic location:** `server/routes/files.js`, `server/lib/fileServeAuth.js`, `server/routes/quotes.js` (/:id/files), client FilesPage, QuoteDetailPage Files tab.

## Logs

- **Quote activity log:** Unified log (contract changes, payment applied, file attached, items changed, send). GET `/api/quotes/:id/activity`. Merges contract_logs and quote_activity_log. Shown in Activity tab.
- **Lead events:** lead_events table (event_type, note). GET `/api/leads/:id/events`. Shown on LeadsPage when selecting a lead.
- **Logic location:** `server/routes/quotes.js` (logActivity, GET activity), `server/routes/leads.js` (events), QuoteDetailPage Activity tab, LeadsPage.

## Send to Client / Email

- **Send:** Modal with To, template, subject, body. POST `/api/quotes/:id/send` with templateId, subject, bodyHtml, bodyText, toEmail. Uses SMTP if configured; logs message. Sets status to sent, ensures public_token.
- **Templates:** Email templates CRUD; default template. Templates page (operator+).
- **Messages:** Thread view per quote (outbound + inbound from IMAP). MessagesPage.
- **Logic location:** `server/routes/quotes.js` (send), `server/routes/templates.js`, `server/services/emailPoller.js`, `server/routes/messages.js`, client QuoteDetailPage (send modal), TemplatesPage, MessagesPage.

## Public Quote View

- **View:** GET `/api/quotes/public/:token` (no auth). Returns quote, items (excluding hidden_from_quote), customItems, contract, company settings; signed_photo_url for file-based images.
- **Approve:** Button on public page → POST `/api/quotes/approve-by-token` (no auth) → status = approved.
- **Contract sign:** POST `/api/quotes/contract/sign` with token, signature_data, signer_name.
- **Public message thread:** GET/POST `/api/quotes/public/:token/messages` for client-visible conversation history and message posting from the public quote page.
- **Logic location:** `server/index.js` and `server/api/v1.js` (public route), `client/src/pages/PublicQuotePage.jsx`.

## Pull Sheets

- **Not implemented.** No pull_sheets table, no routes, no UI. Operations workflow (order → pull sheet → warehouse → load → delivery) is not in the codebase.

## Availability & Conflict Detection

- **Conflicts:** GET `/api/availability/conflicts` — items where reserved quantities exceed stock; considers quote status and rental date ranges (delivery_date → pickup_date, or rental_start → rental_end).
- **Subrental needs:** GET `/api/availability/subrental-needs` — items requiring subrental (demand > stock, `is_subrental = 0`).
- **Per-quote conflict:** GET `/api/availability/quote/:id` — which items on this quote conflict with other reservations.
- **Per-quote picker stock view:** GET `/api/availability/quote/:id/items?ids=...` — stock, reserved_qty, potential_qty for selected item IDs on that quote's date window.
- **Dashboard:** Conflicts panel and Subrental Needs panel; respect setting `count_oos_oversold`.
- **Quote builder:** Shows conflict/available state and stock-vs-booked badges in both quote lines and inventory picker.
- **Logic location:** `server/routes/availability.js`, DashboardPage (panels), QuoteBuilder (icon), SettingsPage (`count_oos_oversold`).

## Vendors / Subrental

- **Vendors table:** id, name, contact_name, contact_email, contact_phone, notes. CRUD: GET/POST/PUT/DELETE `/api/vendors`.
- **Items:** `is_subrental` (integer), `vendor_id` (FK to vendors). Item editor: subrental toggle and vendor dropdown.
- **Vendors page:** List, add, edit, delete vendors; linked from Sidebar.
- **Logic location:** `server/routes/vendors.js`, `server/db.js` (vendors table, items columns), VendorsPage, ItemEditModal, `client/src/api.js` (getVendors, createVendor, updateVendor, deleteVendor).

## Quote Rental Dates

- **Fields on quotes:** `rental_start`, `rental_end`, `delivery_date`, `pickup_date` (all TEXT). Editable and visible in quote editor (QuoteDetailPage). Used by availability engine for date-range overlap.
- **Logic location:** `server/routes/quotes.js` (accept/return in GET/PUT), QuoteDetailPage (form and display).

## Public Catalog

- **Purpose:** Public-facing, no-auth browsable inventory catalog for customers (SEO-optimized). Separate from the internal app and the private `/quote/public/:token` route.
- **Server-rendered pages (SEO):**
  - `GET /catalog` — HTML catalog page with JSON-LD (ItemList + LocalBusiness), og: tags, canonical link; category sidebar; item grid.
  - `GET /catalog/item/:id` — HTML item detail page with JSON-LD (Product + BreadcrumbList), og: tags; price box, availability badge, CTA.
  - `GET /robots.txt` — Allows /catalog, disallows internal routes; links to sitemap.
  - `GET /sitemap.xml` — XML sitemap: /catalog, category filter pages, all item detail URLs.
- **JSON API (no auth):**
  - `GET /api/public/catalog-meta` — company info, categories, counts, total.
  - `GET /api/public/items` — item list with category/search filters, pagination (max 500).
  - `GET /api/public/items/:id` — single item detail.
  - All queries exclude `hidden=1` items. `photo_url` resolved to signed URL or absolute URL via `APP_URL` env var.
- **React SPA pages:** `PublicCatalogPage.jsx` (/catalog) and `PublicItemPage.jsx` (/catalog/item/:id) — same data as server-rendered but client-side for SPA navigation within the app shell.
- **Logic location:** `server/routes/publicCatalog.js`, `client/src/pages/PublicCatalogPage.jsx`, `client/src/pages/PublicItemPage.jsx`, `client/src/api.js` (`api.catalog.*`).

## Docker Deployment

- **Dockerfile:** Multi-stage; Stage 1: `oven/bun:1-alpine` builds React client. Stage 2: `node:20-alpine` runs Express server with built client. Exposes port 3001.
- **docker-compose.yml:** Single service; named volume `badshuffle_data` at `/data`; DB at `/data/badshuffle.db`; uploads at `/data/uploads`. Port `${PORT:-3001}:3001`.
- **docker-entrypoint.sh:** Creates `/data/uploads` on start, then execs CMD.
- **Logic location:** `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, `docker-entrypoint.sh`, `.dockerignore`.

## Other Features

- **Dashboard:** GET `/api/quotes/summary` (byStatus, revenueByStatus, upcoming, byMonth). DashboardPage. Also Conflicts and Subrental Needs panels (see Availability & Conflict Detection).
- **Presence:** PUT/GET `/api/presence` — in-memory “who’s online” and path. Client reports path on route change; Sidebar can show team online.
- **AI suggest:** POST `/api/ai/suggest` (OpenAI) for item suggestions; AISuggestModal on quote.
- **Extension:** Download extension ZIP (public); extension tokens for API (admin). ExtensionPage.
- **Import:** Inventory from CSV/XLSX/Sheets (sheets.js); leads from CSV/XLSX/Sheets with column mapping (leads preview/import). ImportPage.
- **Stats:** Item usage (times quoted, etc.); StatsPage, ItemDetailPage.
- **Settings:** Company, tax, currency, SMTP/IMAP; `count_oos_oversold`; AI provider keys (Claude, OpenAI, Gemini) and per-feature enable/model settings; `ui_theme`, `google_places_api_key`, `map_default_style`; `ui_scale` (75–150%, applied as root font-size). SettingsPage (operator).
- **UI Scale:** Range slider 75–150% (step 5) in SettingsPage. Applies immediately via `document.documentElement.style.fontSize = (scale/100)*14 + 'px'`. Persisted to `localStorage` (`bs_ui_scale`) and loaded by `main.jsx` before first render.
- **Quote tile borders:** `QuoteCard.jsx` shows colored left border by status — draft=yellow, sent=blue, approved/confirmed/closed=green, conflict or unsigned changes=red.
- **Conflict stop sign:** SVG uses `<line>` + `<circle>` for a visible white ! on the red octagon. Present in QuoteCard, QuoteBuilder, QuotePage.
- **Drag-to-reorder quote items:** HTML5 drag handles (⠿) per line item in QuoteBuilder. On drop calls `PUT /api/quotes/:id/items/reorder` with ordered IDs; server updates `sort_order` in a single DB transaction.
- **Item accessories (permanent):** `item_accessories` table (item_id → accessory_id, UNIQUE, ON DELETE CASCADE). CRUD at `GET/POST/DELETE /api/items/:id/accessories`. InventoryPage edit form shows current accessories list and search-to-add. These permanent accessories are data-only — the quote builder does not yet auto-add them when the parent item is added (future enhancement).
- **Admin:** Users, approve/reject, roles, system settings (autokill, update check). AdminPage (admin).

Where a feature is only partially implemented or has known gaps, see **KNOWN_GAPS.md**.
