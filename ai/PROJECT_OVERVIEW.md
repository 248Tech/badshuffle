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
- **Operations** — roles (admin/operator/user), presence (who’s online), settings (SMTP/IMAP, company, tax); availability/conflict detection (reserved vs stock, subrental needs); vendors for subrental sourcing; rental date fields on quotes (rental_start/end, delivery_date, pickup_date)

There is **no pull-sheet or warehouse-fulfillment module** in the codebase; operations workflow (pull sheet → load → delivery) is conceptual only and not implemented.

## Major Modules

| Module        | Purpose |
|---------------|---------|
| **Quotes**    | Create/edit quotes, add items (inventory + custom), venue/client info, status (draft/sent/approved), send to client, public view, contract, payments, activity log |
| **Orders**    | Not a separate entity — “order” is an approved quote; no dedicated order table or order-specific routes |
| **Pull sheets** | Not implemented; no pull sheet table or routes |
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
| **Vendors**    | CRUD vendors; items can have is_subrental and vendor_id; Vendors page |
| **Updates**    | Authenticated packaged updater routes for release status/list/install (`/api/updates*`) |
| **Admin**      | Users, roles, approval, system settings (autokill, update check) (admin-only) |
| **Presence**   | In-memory “who’s online” and current path (PUT/GET /api/presence) |

## How the System Is Structured

- **Backend:** Node.js + Express. Database: SQLite via **sql.js** (WASM, synchronous API similar to better-sqlite3). DB file: `server/badshuffle.db` (or next to exe when packaged). All schema and migrations live in `server/db.js`.
- **Frontend:** React 18 + Vite. CSS Modules (`.module.css`). No TypeScript. Client talks to `/api` (Vite proxy in dev to server port).
- **Auth:** JWT in `Authorization: Bearer` (stored in `localStorage` as `bs_token`). Public routes: health, auth, extension download, public quote view, approve-by-token, contract sign. Everything else behind `requireAuth`; some routes also `requireOperator` or `requireAdmin`.
- **Packaging:** Two Windows executables (server + client) plus updater and extension; built with `pkg` and scripts in root `package.json`.

## Frontend ↔ Backend Interaction

- **Client** uses `client/src/api.js`: `request()` and `publicRequest()` to `/api/...`. Token attached for protected calls; 401 clears token and throws (no redirect; AuthGate in App.jsx handles unauthed state and navigates to login once).
- **App.jsx** has AuthGate: if no token, does not call `/api/auth/me`; if token present, calls `api.auth.me()` and passes `role` to Layout/Sidebar. Admin nav link hidden for non-admin.
- **Routes:** All API under `/api/*`; versioned API at `/api/v1` with envelope responses; OpenAPI at `server/api/openapi.json` and served at `/api/v1/docs` and `/api/v1/openapi.json`.

For more detail on architecture, data models, and where to change things, see **ARCHITECTURE.md**, **DATA_MODELS.md**, and **FEATURES.md**.
