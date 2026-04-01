# BadShuffle — Architecture

## System Architecture

- **Monolith:** Single Node.js server (Express) and single React SPA. No microservices.
- **Database:** SQLite via **sql.js** (WASM). `server/db.js` still initializes the DB, but schema, defaults, migrations, and query helpers are now split into `server/db/schema/*`, `server/db/defaults/*`, `server/db/migrations/*`, and `server/db/queries/*`.
- **Auth + permissions:** JWT (Bearer) plus module-level permissions. `GET /api/auth/me` returns the current user profile and effective permissions, and the client gates routes/pages from that permission set.
- **Optional services:** IMAP polling (emailPoller) for inbound replies; startup update check (GitHub releases API). In packaged builds, authenticated update-install routes are also available. All update behavior is designed to fail gracefully.

## Folder Structure

```
badshuffle/
├── server/
│   ├── index.js           # Express app; rate limits, route mounts, public vs protected, diagnostics, startup services
│   ├── db.js              # sql.js init + top-level DB bootstrap/persistence
│   ├── cli.js             # CLI: create-admin, reset-password, reset-auth, wipe-database
│   ├── api/
│   │   ├── v1.js          # Versioned API router (envelope responses); re-exposes some routes
│   │   └── openapi.json   # OpenAPI spec
│   ├── db/
│   │   ├── schema/        # Table definitions grouped by domain
│   │   ├── defaults/      # Default settings/seed values by domain
│   │   ├── migrations/    # Incremental migration helpers by domain
│   │   ├── queries/       # Shared SQL/query helpers
│   │   ├── repositories/  # Repository layer for composite DB access
│   │   ├── permissions.js # Module permission catalog / helpers
│   │   └── settings.js    # Settings helpers used across routes/services
│   ├── routes/
│   │   ├── auth.js        # Login, logout, setup, forgot, reset, /me, extension-token, test-mail
│   │   ├── quotes.js      # Quote CRUD and orchestration entrypoints; delegates much of the domain logic to services
│   │   ├── items.js       # Items CRUD, categories, associations (bundles), is_subrental, vendor_id, contract_description, bulk-upsert
│   │   ├── availability.js # Conflicts, subrental-needs, quote conflict check, picker stock endpoint
│   │   ├── vendors.js     # Vendors CRUD
│   │   ├── updates.js     # Release status/list/apply flow for packaged updater
│   │   ├── leads.js       # Leads CRUD, preview/import (CSV/XLSX/Sheets), events
│   │   ├── templates.js   # Email + contract templates
│   │   ├── files.js       # Upload, list, delete; stored in uploads/
│   │   ├── messages.js   # Outbound log; inbound from emailPoller
│   │   ├── settings.js    # GET/PUT settings (operator)
│   │   ├── admin.js       # Users, roles, system settings (admin)
│   │   ├── billing.js     # GET billing history (operator)
│   │   ├── maps.js        # Map pins / quote geocode surface for operator maps workspace
│   │   ├── sales.js       # Sales analytics API
│   │   ├── stats.js       # Item stats, usage
│   │   ├── team.js        # Team roster, presence, YTD totals, recent project activity
│   │   ├── sheets.js      # Upload/import CSV/XLSX, Google Sheets, PDF
│   │   ├── ai.js          # AI suggest (OpenAI)
│   │   ├── presence.js    # Presence heartbeat + persisted presence reads
│   │   ├── publicCatalog.js # Public catalog endpoints for external/e-commerce surfaces
│   │   └── extension.js   # Extension download (public)
│   ├── lib/
│   │   ├── authMiddleware.js   # requireAuth(db)
│   │   ├── adminMiddleware.js   # requireAdmin(db)
│   │   ├── operatorMiddleware.js # requireOperator(db)
│   │   ├── permissionMiddleware.js # requireModulePermission(db)
│   │   ├── permissions.js    # Shared permission constants/access levels
│   │   ├── fileServeAuth.js    # Signed URL for file serve (public quote images)
│   │   ├── imageProxy.js       # /api/proxy-image?url=...
│   │   ├── apiEnvelope.js      # v1 envelope middleware
│   │   ├── sheetsParser.js    # Fetch CSV from Google Sheets URL
│   │   ├── leadImportMap.js   # Column mapping for lead import
│   │   └── safeFilename.js
│   └── services/
│       ├── quote*.js          # Quote domain split into core/list/item/file/finance/lifecycle/section/contract/fulfillment services
│       ├── mapService.js      # Map pin assembly + cache refresh orchestration
│       ├── mapboxGeocodeService.js # Mapbox geocoding adapter
│       ├── salesAnalyticsService.js # Pipeline analytics aggregation
│       ├── teamService.js     # Team directory/workspace aggregation
│       ├── fileService.js     # File serving helpers and variant resolution
│       ├── imageCompressionService.js # Sharp-based upload variants
│       ├── diagnosticsService.js # Crash/health diagnostics
│       ├── itemService.js     # Inventory domain helpers
│       ├── leadService.js     # Lead import/domain helpers
│       ├── itemStatsService.js # Inventory stats calculations
│       ├── quoteService.js    # Shared quote utilities still used by routes/index
│       ├── singleInstance.js  # Lockfile + PID; optional kill prior server
│       ├── updateCheck.js     # GitHub releases check (throttled)
│       └── emailPoller.js     # IMAP poll for replies
├── client/
│   ├── src/
│   │   ├── App.jsx         # Routes, AuthGate, permission-aware navigation guards
│   │   ├── api.js         # request(), publicRequest(), api.*
│   │   ├── main.jsx
│   │   ├── pages/         # Route-level screens including Maps, Team, Profile, public catalog, quote detail
│   │   ├── components/    # Shared UI plus public-quote, messages, quote-builder, and virtualization subfolders
│   │   ├── features/      # Feature-scoped client domains (currently sales dashboard)
│   │   ├── hooks/         # Shared React hooks
│   │   └── lib/           # Client-side helpers (permissions, totals, sanitizeHtml, prefetch)
│   ├── vite.config.js     # Proxy /api to server
│   └── serve.js           # Production static serve (for pkg)
├── uploads/               # File uploads (created at runtime)
├── .env / .env.example
└── package.json           # Scripts: dev, create-admin, reset-password, wipe-database, package, release
```

## Core Services (Server-Side)

| Service | Role |
|---------|------|
| **db (sql.js)** | Single DB instance; `db.js` boots the DB while schema/defaults/migrations/queries are split into `server/db/*`. Foreign keys ON. |
| **singleInstance** | Writes `badshuffle.lock` (pid, name); can kill previous process (Windows taskkill / SIGKILL); toggled by admin System setting. |
| **updateCheck** | On startup, non-blocking fetch to GitHub releases; throttled by settings; writes update_available, update_check_latest, update_check_last. |
| **emailPoller** | IMAP polling every 5 min; links replies to quotes by message_id/in_reply_to; optional (imapflow dependency). |
| **quote domain services** | Quote lifecycle is being decomposed into focused services for list, finance, file, section, fulfillment, contract, and item flows. |
| **map services** | Geocodes quote addresses and returns map-ready quote pins for the operator Maps page. |
| **team + analytics services** | Aggregate team directory/presence data and sales dashboard metrics. |

## Data Flow Between Major Modules

1. **Leads → Quotes:** Lead can have `quote_id`; quote can have `lead_id`. Set via PUT lead or PUT quote. Lead timeline logs "quote linked".
2. **Items → Quotes:** Quote line items are `quote_items` (quote_id, item_id, quantity, label, hidden_from_quote) plus `quote_custom_items` (one-off lines). Quotes are now section-aware via `quote_item_sections`, and fulfillment rows are derived from quote items on project confirmation.
3. **Quotes → Contract:** One row in `contracts` per quote (body_html, signed_at, signature_data, signer_name). Contract templates are separate (reusable body).
4. **Quotes → Payments:** `quote_payments` and `billing_history`; GET /api/quotes returns computed amount_paid, remaining_balance, overpaid.
5. **Quotes → Files:** `quote_attachments` links quote_id to file_id. Public quote view uses signed URLs for images (photo_url stored as file id when from media library).
6. **Quotes → Messages:** Outbound send logs to `messages`; IMAP poll writes inbound to `messages`; public quote token routes can read/post quote-thread messages.
7. **Quotes → Maps:** Quote venue/client addresses feed persisted map cache fields so the operator maps workspace and geocoding pipeline do not recompute every request.
8. **Users → Presence / Team:** Presence heartbeats update persistent user presence rows; team workspace aggregates that data with YTD quote/sales metrics.
9. **Items → Stats:** `item_stats` (times_quoted, total_guests, last_used_at); `usage_brackets` for bracket usage. Updated when items are used on quotes (stats route or quote item add).

## How Inventory, Quotes, and Operations Connect

- **Inventory:** Items are the catalog; optional is_subrental and vendor_id for subrental sourcing. Quote line items reference items (quote_items.item_id). Item has unit_price, taxable, category (logistics vs equipment), quantity_in_stock, and optional contract_description. Availability engine compares reserved+potential quantities (by quote status and date range delivery→pickup) to stock; conflicts and subrental-needs surfaced on dashboard and in quote builder.
- **Quotes:** Consume items as line items; status draft/sent/approved. Rental date fields: rental_start, rental_end, delivery_date, pickup_date (used for conflict overlap). No separate "order" table; approved quote is the order. Totals: equipment subtotal, logistics/delivery subtotal, tax, grand total.
- **Operations:** Role and permission based. Availability/conflict detection remains central, but the app now also has fulfillment tracking, persistent presence, maps, and team workspace surfaces. There is still no full warehouse pull-sheet/load-out state machine.

For data model details see **DATA_MODELS.md**; for user-facing flows see **WORKFLOWS.md**.
