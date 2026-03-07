# BadShuffle — Features

All features below are implemented unless marked as stub or partial.

---

## Quote System

- **CRUD:** Create, read, update, delete quotes. Name, guest_count, event_date, notes, venue_* (name, email, phone, address, contact, notes), quote_notes, tax_rate, client_* (first_name, last_name, email, phone, address).
- **Status:** draft → sent → approved; revert (back to draft). POST `/api/quotes/:id/send`, `/approve`, `/revert`. Send generates public_token if missing.
- **List:** GET `/api/quotes` returns quotes with computed total, amount_paid, remaining_balance, overpaid. UI: QuotePage with list/tile view, multi-select, batch duplicate/delete.
- **Detail:** QuoteDetailPage: header (QuoteHeader), client/venue blocks, quote notes, logistics section, totals bar, tabs (Details, Contract, Files, Payments, Activity), Send to Client, Copy Link, AI Suggest, Duplicate, Delete.
- **Logic location:** `server/routes/quotes.js`, `client/src/pages/QuotePage.jsx`, `client/src/pages/QuoteDetailPage.jsx`, `client/src/components/QuoteHeader.jsx`.

## Quote Item Management

- Add/update/remove line items (inventory items) on a quote: quantity, label, sort_order. PATCH for hidden_from_quote.
- **Hide from quote:** `quote_items.hidden_from_quote` — item stays on quote for internal/operations but excluded from client-facing totals and public view. Toggle in QuoteBuilder.
- **Logic location:** `server/routes/quotes.js` (POST/PUT/DELETE quote items), `client/src/components/QuoteBuilder.jsx`.

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
- **Logic location:** `server/index.js` and `server/api/v1.js` (public route), `client/src/pages/PublicQuotePage.jsx`.

## Pull Sheets

- **Not implemented.** No pull_sheets table, no routes, no UI. Operations workflow (order → pull sheet → warehouse → load → delivery) is not in the codebase.

## Other Features

- **Dashboard:** GET `/api/quotes/summary` (byStatus, revenueByStatus, upcoming, byMonth). DashboardPage.
- **Presence:** PUT/GET `/api/presence` — in-memory “who’s online” and path. Client reports path on route change; Sidebar can show team online.
- **AI suggest:** POST `/api/ai/suggest` (OpenAI) for item suggestions; AISuggestModal on quote.
- **Extension:** Download extension ZIP (public); extension tokens for API (admin). ExtensionPage.
- **Import:** Inventory from CSV/XLSX/Sheets (sheets.js); leads from CSV/XLSX/Sheets with column mapping (leads preview/import). ImportPage.
- **Stats:** Item usage (times quoted, etc.); StatsPage, ItemDetailPage.
- **Settings:** Company, tax, currency, SMTP/IMAP. SettingsPage (operator).
- **Admin:** Users, approve/reject, roles, system settings (autokill, update check). AdminPage (admin).

Where a feature is only partially implemented or has known gaps, see **KNOWN_GAPS.md**.
