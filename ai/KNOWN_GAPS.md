# BadShuffle — Known Gaps

Areas that are incomplete, stubbed, or represent technical debt. Use this to know where to add logic or replace placeholders.

---

## Incomplete or Missing Features

### Pull sheets

- **Status:** Not implemented.
- **Missing:** No `pull_sheets` table, no routes, no UI. No generation of a “pull list” from an approved quote. Operations workflow (pull → load → deliver → return) is not in the app.

### Order as first-class entity

- **Status:** “Order” is an approved quote; there is no separate order table or order-specific lifecycle (e.g. order status, fulfillment stages). All order-level behavior is on the quote (status, payments, activity).

### Warehouse / inventory reservation

- **Status:** Not implemented. `items.quantity_in_stock` is stored but not decremented or reserved when items are added to a quote. No allocation or “quantity going out” enforcement beyond the computed `quantity_going_out` used for display.

### Delivery/return tracking

- **Status:** Partial. Quotes have `delivery_date`, `pickup_date`, `rental_start`, and `rental_end` used for availability overlap detection. Logistics is category-based (display and totals). No delivery/return status workflow (e.g. out/returned) or fulfillment state machine. `quote_damage_charges` table exists for post-event billing on closed quotes but no UI is implemented yet.

---

## Technical Debt / Temporary Implementations

### Email send when SMTP not configured

- **Behavior:** Send endpoint still sets quote to sent and generates public_token; email may not be sent. No clear “SMTP not configured” warning in send modal (depends on Settings and mailer implementation).

### Presence in-memory

- **Behavior:** Presence is in-memory only. Restart clears “who’s online”. No persistence or replication. Acceptable for single-server, single-instance use.

### DB migrations

- **Pattern:** All migrations are in `server/db.js` as ALTER TABLE / CREATE TABLE with try/catch. No versioned migration files. Safe for additive changes; harder to track history of schema changes.

### No test suite

- **Status:** No unit or integration tests in the repo. Verification is manual and via CLI/UI.

---

## UI Placeholders / Missing Validations

- **Send modal:** No inline preview of email body or public quote link; optional improvement per STATUS.md.
- **Role badge:** Role is available but not shown in header (backlog item).
- **Public quote:** Works; no rate limiting or token expiry on public token (by design: token is permanent until quote is deleted).

---

## Assumptions Embedded in Code

- **Single server:** Presence and lockfile assume one server process. No multi-instance coordination.
- **Local/trusted use:** CORS allows localhost and extension; JWT_SECRET must be set in production. Public quote and approve-by-token are unauthenticated by design (token is secret link).
- **File storage:** Files on disk in `uploads/`; no S3 or external storage. photo_url can be external URL (proxied) or file id (served via /api/files/:id/serve with signed URL for public).
- **Bundles:** item_associations represent parent/child; UI can show components but current quote builder does not auto-expand bundles into line items (add parent or children manually).
- **Permanent accessories:** `item_accessories` table exists and is managed in InventoryPage. When a product is added to a quote, its permanent accessories are NOT automatically added — that auto-add behavior is not yet implemented. The data is stored and surfaced on item edit; the quote builder must be updated to query and auto-insert accessories when the parent item is added.

---

## Where Logic Might Be Unfinished

- **Item stats / usage_brackets:** Updated when items are used on quotes (see stats route or quote item handlers); confirm update points if “times quoted” or bracket usage is wrong.
- **Contract body from template:** Contract templates exist; ensure Contract tab (or send flow) applies template to contract body as intended.
- **Refund vs overpaid:** Refund creates negative payment; remaining_balance and overpaid are computed from sum of payments vs total. No separate “overpaid” handling beyond display.

Adding pull sheets, order entity, or inventory reservation would require new tables and routes and should be reflected in DATA_MODELS.md and FEATURES.md when implemented.
