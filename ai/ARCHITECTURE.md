# BadShuffle — Architecture

## System Architecture

- **Monolith:** Single Node.js server (Express) and single React SPA. No microservices.
- **Database:** SQLite via **sql.js** (WASM). Synchronous API; DB persisted to `badshuffle.db` after every write (see `db.js` `_save()`). Path is pkg-aware (next to exe when packaged).
- **Auth:** JWT (Bearer). Role stored in DB and fetched via `GET /api/auth/me`; not embedded in JWT so role changes take effect on next page load.
- **Optional services:** IMAP polling (emailPoller) for inbound replies; startup update check (GitHub releases API). Both are optional and fail gracefully.

## Folder Structure

```
badshuffle/
├── server/
│   ├── index.js           # Express app; mounts routes; public vs protected; single-instance + update check + emailPoller
│   ├── db.js              # sql.js init, all CREATE TABLE and ALTER TABLE (migrations)
│   ├── cli.js             # CLI: create-admin, reset-password, reset-auth, wipe-database
│   ├── api/
│   │   ├── v1.js          # Versioned API router (envelope responses); re-exposes some routes
│   │   └── openapi.json   # OpenAPI spec
│   ├── routes/
│   │   ├── auth.js        # Login, logout, setup, forgot, reset, /me, extension-token, test-mail
│   │   ├── quotes.js      # Quote CRUD, send/approve/revert, contract, files, payments, activity, custom items, filtered quote list
│   │   ├── items.js       # Items CRUD, categories, associations (bundles), is_subrental, vendor_id, contract_description
│   │   ├── availability.js # Conflicts, subrental-needs, quote conflict check, picker stock endpoint
│   │   ├── vendors.js     # Vendors CRUD
│   │   ├── leads.js       # Leads CRUD, preview/import (CSV/XLSX/Sheets), events
│   │   ├── templates.js   # Email + contract templates
│   │   ├── files.js       # Upload, list, delete; stored in uploads/
│   │   ├── messages.js   # Outbound log; inbound from emailPoller
│   │   ├── settings.js    # GET/PUT settings (operator)
│   │   ├── admin.js       # Users, roles, system settings (admin)
│   │   ├── billing.js     # GET billing history (operator)
│   │   ├── stats.js       # Item stats, usage
│   │   ├── sheets.js      # Upload/import CSV/XLSX, Google Sheets, PDF
│   │   ├── ai.js          # AI suggest (OpenAI)
│   │   ├── presence.js    # In-memory presence (PUT/GET)
│   │   └── extension.js   # Extension download (public)
│   ├── lib/
│   │   ├── authMiddleware.js   # requireAuth(db)
│   │   ├── adminMiddleware.js   # requireAdmin(db)
│   │   ├── operatorMiddleware.js # requireOperator(db)
│   │   ├── fileServeAuth.js    # Signed URL for file serve (public quote images)
│   │   ├── imageProxy.js       # /api/proxy-image?url=...
│   │   ├── apiEnvelope.js      # v1 envelope middleware
│   │   ├── sheetsParser.js    # Fetch CSV from Google Sheets URL
│   │   ├── leadImportMap.js   # Column mapping for lead import
│   │   └── safeFilename.js
│   └── services/
│       ├── singleInstance.js   # Lockfile + PID; optional kill prior server
│       ├── updateCheck.js     # GitHub releases check (throttled)
│       └── emailPoller.js     # IMAP poll for replies
├── client/
│   ├── src/
│   │   ├── App.jsx         # Routes, AuthGate, role state, ProtectedRoute
│   │   ├── api.js         # request(), publicRequest(), api.*
│   │   ├── main.jsx
│   │   ├── pages/         # One component per route (Dashboard, Inventory, QuotePage, QuoteDetailPage, etc.)
│   │   └── components/    # QuoteBuilder, QuoteHeader, QuoteExport, Sidebar, Layout, ItemCard, etc.
│   ├── vite.config.js     # Proxy /api to server
│   └── serve.js           # Production static serve (for pkg)
├── uploads/               # File uploads (created at runtime)
├── .env / .env.example
└── package.json           # Scripts: dev, create-admin, reset-password, wipe-database, package, release
```

## Core Services (Server-Side)

| Service | Role |
|---------|------|
| **db (sql.js)** | Single DB instance; all tables and migrations in `db.js`. Foreign keys ON. |
| **singleInstance** | Writes `badshuffle.lock` (pid, name); can kill previous process (Windows taskkill / SIGKILL); toggled by admin System setting. |
| **updateCheck** | On startup, non-blocking fetch to GitHub releases; throttled by settings; writes update_available, update_check_latest, update_check_last. |
| **emailPoller** | IMAP polling every 5 min; links replies to quotes by message_id/in_reply_to; optional (imapflow dependency). |

## Data Flow Between Major Modules

1. **Leads → Quotes:** Lead can have `quote_id`; quote can have `lead_id`. Set via PUT lead or PUT quote. Lead timeline logs "quote linked".
2. **Items → Quotes:** Quote line items are `quote_items` (quote_id, item_id, quantity, label, hidden_from_quote) plus `quote_custom_items` (one-off lines). Totals computed from items + custom; logistics are items where `category` contains "logistics".
3. **Quotes → Contract:** One row in `contracts` per quote (body_html, signed_at, signature_data, signer_name). Contract templates are separate (reusable body).
4. **Quotes → Payments:** `quote_payments` and `billing_history`; GET /api/quotes returns computed amount_paid, remaining_balance, overpaid.
5. **Quotes → Files:** `quote_attachments` links quote_id to file_id. Public quote view uses signed URLs for images (photo_url stored as file id when from media library).
6. **Quotes → Messages:** Outbound send logs to `messages`; IMAP poll writes inbound to `messages`; public quote token routes can read/post quote-thread messages.
7. **Items → Stats:** `item_stats` (times_quoted, total_guests, last_used_at); `usage_brackets` for bracket usage. Updated when items are used on quotes (stats route or quote item add).

## How Inventory, Quotes, and Operations Connect

- **Inventory:** Items are the catalog; optional is_subrental and vendor_id for subrental sourcing. Quote line items reference items (quote_items.item_id). Item has unit_price, taxable, category (logistics vs equipment), quantity_in_stock, and optional contract_description. Availability engine compares reserved+potential quantities (by quote status and date range delivery→pickup) to stock; conflicts and subrental-needs surfaced on dashboard and in quote builder.
- **Quotes:** Consume items as line items; status draft/sent/approved. Rental date fields: rental_start, rental_end, delivery_date, pickup_date (used for conflict overlap). No separate "order" table; approved quote is the order. Totals: equipment subtotal, logistics/delivery subtotal, tax, grand total.
- **Operations:** Role-based (admin/operator/user) and presence. Availability/conflict detection (no pull sheet). No warehouse steps or load/delivery/return state machine. Logistics is a category filter for display and totals.

For data model details see **DATA_MODELS.md**; for user-facing flows see **WORKFLOWS.md**.
