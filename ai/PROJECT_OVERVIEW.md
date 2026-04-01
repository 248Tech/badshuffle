# BadShuffle — Project Overview

## Purpose

BadShuffle is a **self-hosted inventory and quoting application** for event rental businesses. It manages:

- **Inventory** — rental items (equipment), with categories, pricing, stock, and optional bundle/component associations
- **Quotes** — client quotes with line items (inventory + custom items), venue/client info, status lifecycle (draft → sent → approved), and totals (subtotal, delivery/logistics, tax, grand total)
- **Leads** — contact/lead records with optional link to a quote; import from CSV/XLSX/Google Sheets with column mapping
- **Contracts** — one contract per quote (HTML body, client signature on public page), with change logs
- **Billing** — payments on quotes, billing history, refunds
- **Communications** — send quote to client via email (SMTP), templates, message thread (outbound + IMAP inbound replies)
- **Files** — media library; attach files to quotes; signed URLs for public quote images
- **Operations** — roles plus module-level permissions, fulfillment tracking, persistent presence, maps, team workspace, settings (SMTP/IMAP, company, tax), availability/conflict detection (reserved vs stock, subrental needs), vendors for subrental sourcing, and rental date fields on quotes (rental_start/end, delivery_date, pickup_date)

There is still **no full pull-sheet / warehouse execution system** in the codebase, but there is now a real fulfillment layer for confirmed projects: fulfillment items, check-in flow, and internal fulfillment notes/events.

## Major Modules

| Module        | Purpose |
|---------------|---------|
| **Quotes**    | Create/edit quotes, add items (inventory + custom), venue/client info, status (draft/sent/approved), send to client, public view, contract, payments, activity log |
| **Projects / fulfillment** | Not a separate order table, but approved/confirmed quotes now drive fulfillment items, fulfillment notes, check-in actions, and project detail workflow |
| **Orders**    | Still not a separate entity — operationally an approved/confirmed quote |
| **Pull sheets** | Not implemented; no dedicated pull-sheet table or route set |
| **Inventory**  | Items CRUD, categories, associations (parent/child bundles), import from sheets/PDF, stats (times quoted, usage) |
| **Logistics**  | Implemented as **category-based**: items whose `category` contains “logistics” are grouped as delivery/pickup in quote totals and in export |
| **Leads**      | CRUD, link to quote, import wizard (preview + column mapping), lead events/timeline |
| **Contracts**  | One contract per quote (body_html, signature); client signs on public page; contract change logs |
| **Billing**    | Quote payments (add/remove), refunds, billing_history; Billing page shows history |
| **Files**      | Upload/list/delete files; attach to quotes; serve with auth or signed URL |
| **Messages**   | Outbound emails logged; inbound replies via IMAP poll; thread view per quote |
| **Templates**  | Email templates (CRUD, default); contract templates (reusable contract body) |
| **Settings**   | Company, tax, currency, SMTP/IMAP, count_oos_oversold, packaged update controls (operator-only) |
| **Availability** | Conflicts (reserved > stock), subrental-needs, per-quote conflict check; dashboard panels; quote builder conflict icons |
| **Maps**       | Operator-only map workspace backed by Mapbox and quote-level geocode cache fields |
| **Sales analytics** | Dashboard pipeline metrics and filters served by `/api/sales/analytics` |
| **Vendors**    | CRUD vendors; items can have is_subrental and vendor_id; Vendors page |
| **Updates**    | Authenticated packaged updater routes for release status/list/install (`/api/updates*`) |
| **Admin**      | Users, roles, approval, custom role permissions, system settings (autokill, update check) (admin-only) |
| **Directory / team** | Staff directory, profile-driven team roster, live presence, recent project activity, YTD sales totals |
| **Presence**   | Persisted “who’s online” and current path/label heartbeat data (PUT/GET `/api/presence`) |
| **Profile**    | Self-service user profile editing for name, photo, username/display name, phone, and bio |

## How the System Is Structured

- **Backend:** Node.js + Express. Database: SQLite via **sql.js** (WASM, synchronous API similar to better-sqlite3). DB file: `server/badshuffle.db` (or next to exe when packaged). `server/db.js` now works with `server/db/schema/*`, `server/db/migrations/*`, `server/db/defaults/*`, and `server/db/queries/*` rather than owning the entire persistence layer alone.
- **Frontend:** React 18 + Vite. Mostly JS + CSS Modules, with a small typed sales-dashboard feature slice in `client/src/features/sales-dashboard/*.ts`.
- **Auth:** JWT in `Authorization: Bearer` (stored in `localStorage` as `bs_token`). Public routes include health, auth, extension download, public quote view, public catalog, approve-by-token, and contract sign. Protected routes now layer module permissions on top of authentication.
- **Packaging:** Two Windows executables (server + client) plus updater and extension; built with `pkg` and scripts in root `package.json`.

## Frontend ↔ Backend Interaction

- **Client** uses `client/src/api.js`: `request()` and `publicRequest()` to `/api/...`. Token attached for protected calls; 401 clears token and throws (no redirect; AuthGate in `App.jsx` handles unauthed state and navigates to login once).
- **App.jsx** has AuthGate plus permission-aware route wrappers. If token present, it calls `api.auth.me()` and passes the returned profile/permissions into layout and route gating.
- **Routes:** All API under `/api/*`; versioned API at `/api/v1` with envelope responses; OpenAPI at `server/api/openapi.json` and served at `/api/v1/docs` and `/api/v1/openapi.json`.

For more detail on architecture, data models, and where to change things, see **ARCHITECTURE.md**, **DATA_MODELS.md**, and **FEATURES.md**.
