# BadShuffle v0.4.3

A self-hosted inventory and quoting tool for event rental businesses. Manage your catalog, build quotes, track usage stats, and sync items directly from Goodshuffle Pro — all running locally on your machine with no subscription required.

*Pre-release (0.x). See [CHANGELOG.md](CHANGELOG.md) for version history.*

---

## What's New in v0.4.3

- **Public catalog** — New no-auth catalog at `/catalog` and `/catalog/item/:id`, with server-rendered SEO pages, JSON-LD, `robots.txt`, `sitemap.xml`, and `/api/public/*` endpoints.
- **Docker deployment** — New `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, and entrypoint support for persistent `/data` storage and single-container deployment.
- **Dev launch improvements** — New `npm run dev:host` and `npm run dev:docker` flows, plus a dev-only `/api/auth/dev-login` path that can auto-create/login a local admin while you build.
- **AI integration settings** — Settings now store encrypted Claude, OpenAI, and Gemini keys and expose per-feature enable/model controls.
- **Operator UX refresh** — Mobile sidebar/overlay, stronger touch targets, category chips on Inventory, drag-and-drop quote item ordering, and broader responsive polish across the app shell.
- **Production serving** — The Express server now serves the built client in Docker/production mode, and respects `APP_URL`, `DB_PATH`, and `UPLOADS_DIR`.

## What's New in v0.4.2

- **Inventory availability & conflict detection** — Backend and frontend detect when reserved quantities exceed stock. New `/api/availability` endpoints: conflicts (items over-reserved), subrental-needs (shortfall items), and per-quote conflict check. Conflicts consider quote status and rental date ranges (delivery → pickup).
- **Vendor / subrental system** — New `vendors` table and CRUD API. Inventory items support `is_subrental` and `vendor_id`. Vendor management page in the UI; vendor selection in the item editor.
- **Rental date fields** — Quotes now have `rental_start`, `rental_end`, `delivery_date`, and `pickup_date`; editable and visible in the quote editor.
- **Dashboard improvements** — Conflicts panel (items with reserved quantities exceeding stock) and Subrental Needs panel (items that must be sourced externally).
- **Quote builder** — Conflict indicator icon next to line items that overlap with other reservations.
- **Settings** — New option `count_oos_oversold`: controls whether out-of-stock items count toward dashboard conflict detection.
- **API additions** — Client helpers: `getVendors`, `createVendor`, `updateVendor`, `deleteVendor`, `getConflicts`, `getSubrentalNeeds`, `getQuoteConflicts`.
- **Dev infrastructure** — Initial Bun support testing in the dev workflow (non-breaking); server can run under Bun in development; `npm install` and `node index.js` still work as fallbacks.

## What's New in v0.4.0

- **UI improvements** — Cleaner, more organized experience across the app for daily operations
- **Inventory management** — Sorting changes, item categories, and category filtering to organize and find products faster
- **Tile view for products** — Visual browse of inventory alongside list view
- **Company logo** — Branded feel in settings and customer-facing views
- **Client view of quote page** — Shareable quote page for customers; better presentation beyond internal workflows
- **API with OpenAPI support** — Versioned API and OpenAPI spec for integrations, tooling, and future expansion
- **Security audit** — Full security audit plus [redacted] changes for a more secure, stable, and at least 17% more mysterious platform

## What's New in v0.3.2

- **Quote detail header** — New QuoteHeader component: quote name, status badge, metadata (date, guests, items), and actions in a clear layout with flex and responsive wrapping
- **Button hierarchy** — Primary: Send to Client; Secondary: Edit; Ghost: Copy link, AI Suggest, Duplicate; Danger: Delete
- **Status badge** — More visible draft/sent/approved badge (larger, uppercase)
- **UI redesign strategy** — `docs/UI_UX_REDESIGN_STRATEGY.md` with priority plan, design system rules, and concrete recommendations for quote detail and spacing
- **Billing page** — Overpaid quotes list for sales (refund due); remaining balance on quote quickview

## What's New in v0.3.1

- **Quotes page view toggle** — Switch between List and Tile view from the Quotes page header
- **Contract total on quickview** — Each quote card/tile and list row shows the computed contract total
- **Duplicate on Quotes page** — Duplicate button on each quote quickview (and in list row actions); duplicates full quote (details, line items, custom items)
- **Multi-select and batch actions** — Select one or more quotes via checkboxes; "Duplicate (n)" and "Delete (n)" in a batch bar with confirmation for batch delete

## What's New in v0.3.0

- **Quote approval from public link** — Clients can approve a quote from the public link; "Approve this Quote" button on the shared quote page
- **Contracts** — Add a contract to any quote (Contract tab); clients sign on the public page (agree + name); full change log (who changed what and when)
- **Lead timeline** — Activity log per lead: created, quote linked, email sent, reply received; click a lead on the Leads page to see the timeline
- **Contract change logs** — Every contract edit is recorded with timestamp, user email, and a summary of what changed

## What's New in v0.2.0

- **Files** — media library for uploading images, PDFs, and documents; attach files to outbound emails
- **Custom quote items** — add one-off line items to any quote with a title, price, quantity, and photo picked from your media library or inventory
- **Messages** — log all outbound quote emails and automatically ingest client replies via IMAP polling; two-pane thread view with unread badges
- **SMTP send** — "Send to Client" now actually delivers email via SMTP (configured in Settings) and logs the outbound message
- **IMAP auto-poll** — BadShuffle checks your inbox every 5 minutes for replies and links them back to the originating quote

---

## Features

- **Inventory management** — Add, edit, hide, and search rental items with photos; optional subrental flag and vendor link
- **Quote builder** — Create event quotes, add items with quantities and labels, custom one-off line items, per-line price overrides, discounts/surcharges, drag-to-reorder, conflict indicators for over-reserved items, export to PDF/image
- **Public catalog** — SEO-optimized, no-auth browsable catalog at `/catalog`; server-rendered HTML with JSON-LD, robots.txt, sitemap.xml; React SPA counterpart; JSON API at `/api/public/*`
- **Files / media library** — Upload images and documents; serve them inline for use in quotes and emails
- **Messages** — Full outbound + inbound email log linked to quotes; IMAP polling for client replies
- **AI settings** — Store encrypted Claude/OpenAI/Gemini keys and choose per-feature AI providers from Settings; AI-assisted flows remain optional
- **Usage stats** — See which items are quoted most often and track per-guest-count brackets
- **Availability & conflicts** — Dashboard panels for items over-reserved (conflicts) and items needing subrental; per-quote conflict check; rental date fields on quotes (rental_start/end, delivery_date, pickup_date)
- **Vendors** — Manage subrental vendors; link items to vendors; Vendors page in the UI
- **Google Sheets import** — Bulk-import inventory from a published Sheet URL
- **Chrome extension** — One-click sync of items from your Goodshuffle Pro catalog page directly into BadShuffle
- **Standalone executables** — Package into two Windows `.exe` files that run without Node.js installed

---

## Coming soon

Planned improvements and roadmap (see [ai/KNOWN_GAPS.md](ai/KNOWN_GAPS.md) and [ai/TODO.md](ai/TODO.md) for details):

- **Pull sheets** — Generate warehouse pull lists from approved quotes (order → pull → load → deliver → return). Not yet implemented.
- **Role badge** — Show Admin / Operator badge in the header next to the current user.
- **Email on role change** — Notify users when an admin changes their role.
- **Send modal preview** — Inline preview of the quote email or public link before sending.
- **Inventory reservation** — Use `quantity_in_stock` to reserve or track items going out on quotes (today it’s display-only).

---

## Project Structure

```
badshuffle/
├── server/          Express API + sql.js SQLite (port 3001)
│   ├── index.js
│   ├── db.js        sql.js shim that mirrors better-sqlite3's API
│   ├── routes/      items, quotes, sheets, stats, ai, files, messages, settings, vendors, availability, publicCatalog
│   ├── services/    singleInstance, updateCheck, emailPoller (IMAP)
│   └── lib/         authMiddleware, crypto, imageProxy
├── client/          React + Vite SPA (port 5173 in dev)
│   ├── src/
│   │   ├── pages/   Dashboard, Inventory, Import, Quotes, QuoteDetail,
│   │   │            Stats, Files, Messages, Settings, Leads, Templates, Vendors,
│   │   │            PublicCatalog, PublicItem
│   │   └── components/
│   └── serve.js     Zero-dep static server used by the packaged exe
├── extension/       Chrome MV3 extension (load unpacked)
│   ├── manifest.json
│   ├── content.js   Scrapes Goodshuffle catalog pages
│   ├── background.js  Posts items to localhost:3001
│   └── popup.html
├── ai/              Project context for developers and AI (overview, architecture, features, data models, workflows, TODO, gaps, setup)
├── Dockerfile       Multi-stage build (Bun → client, Node:20 → server)
├── docker-compose.yml  Production deployment with persistent /data volume
└── scripts/
    └── postpackage.js  Copies build output → dist/
```

---

## Requirements (development)

| Requirement | Version |
|---|---|
| Node.js | 14.x (for building `.exe` packages only) |
| Bun | 1.1+ (dev server and installs) |
| Docker | 24+ (optional, for containerized runs) |
| Chrome | any modern version |

> Node 14 is only required if you want to **build the executables** (`pkg` targets node14). The dev server runs under Bun (1.1+). If Bun is not installed, `npm install` and `node index.js` still work as fallbacks.

---

## Quickstart / Dev Launch

### 1. Clone and install

```bash
git clone https://github.com/248Tech/badshuffle.git
cd badshuffle
npm run install:all
```

### 2. Configure `.env` (recommended)

Copy `.env.example` to `.env`, then set any values you need:

```env
OPENAI_API_KEY=sk-...                 # optional
PORT=3001                             # optional
APP_URL=http://localhost:3001         # optional, used by catalog sitemap/canonical URLs
```

### 3. Pick a launch mode

**Local development**

```bash
npm run dev
```

- Starts the API on `http://localhost:3001`
- Starts the Vite app on `http://localhost:5173`
- Use this for normal desktop development

**LAN / phone testing**

```bash
npm run dev:host
```

- Same as local dev, but Vite is exposed on your network
- Open `http://<your-pc-ip>:5173` from another device

**Containerized development**

```bash
npm run dev:docker
```

- Builds and runs the app via `docker-compose.dev.yml`
- Useful when you want to validate the container path locally

**Docker / production-style run**

```bash
docker compose up -d --build
```

- Serves both the API and built client from `http://localhost:3001`
- Persists the DB and uploads in the `badshuffle_data` Docker volume

### 4. Dev login behavior

When the client is running in Vite dev mode, BadShuffle can auto-create and log in a local admin account through the dev-only `/api/auth/dev-login` route. The seeded credentials are:

- `admin@admin.com`
- `admin123`

That route is disabled when `NODE_ENV=production`.

### 5. Load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Browse to your Goodshuffle Pro catalog and use the "Sync to BadShuffle" button

**Locked out?** Run `npm run create-admin -- --email your@email.com --password yournewpassword` from the repo root.

**Connection refused on login?** If you see `ECONNREFUSED` or a proxy error at `/api/auth/login`, the frontend cannot reach the backend. Fix it by:
- Running the app from the repo root with `npm run dev` or `npm run dev:host` so both the API and client are up together.
- Avoiding client-only launches when you expect `/api/*` calls to work.
- Recreating an admin after a DB reset with `npm run create-admin -- --email admin@admin.com --password admin123` once the server is back up.

---

## Configuration — Email (SMTP + IMAP)

Go to **Settings** in the sidebar to configure email.

### Outgoing mail (SMTP)

Fill in your SMTP host, port, credentials, and "from" address. BadShuffle uses these when you click **Send to Client** on a quote. The sent email is logged in the Messages page.

### Incoming mail (IMAP)

BadShuffle can poll your inbox for client replies and automatically link them to the original quote thread.

| Setting | Description |
|---|---|
| IMAP Host | e.g. `imap.gmail.com` |
| Port | 993 (TLS) or 143 (STARTTLS) |
| Secure | TLS/SSL (port 993) or STARTTLS |
| Username / Password | Your email credentials or app password |
| Enable auto-poll | Polls every 5 minutes when enabled |

Only emails that are direct replies to a sent quote (`In-Reply-To` header match) are ingested.

> **Gmail users:** Create an [App Password](https://myaccount.google.com/apppasswords) — regular passwords are blocked by Google for SMTP/IMAP access.

### Conflict detection

| Setting | Description |
|---|---|
| Count out-of-stock as conflicts | `count_oos_oversold` — When enabled, out-of-stock items are included in dashboard conflict detection (Conflicts and Subrental Needs panels). Configure in **Settings**. |

---

## Files (media library)

The **Files** page lets you upload images, PDFs, and documents to BadShuffle's local `uploads/` folder.

- Drag-and-drop or click-to-pick (up to 20 files, 50 MB each)
- Filter by Images / Documents
- Copy the direct serve URL for use in emails or custom items
- Files are served publicly at `/api/files/:id/serve` so `<img>` tags work without authentication

When sending a quote email, select attachments from the file picker in the Send modal.

---

## Custom Quote Items

On any quote detail page, use **+ Add custom item** to add a one-off line item not in your inventory:

- Name, price, quantity, taxable flag
- Pick a photo from the Files library or from inventory item photos
- Custom items appear in quote totals and in the PDF/image export
- Selecting an inventory item image pre-fills the price from that item

---

## Docker Deployment

Single-container production deployment. DB and uploads persist in a named volume.

```bash
docker compose up -d
```

Or build manually:

```bash
docker build -t badshuffle .
docker run -p 3001:3001 -v badshuffle_data:/data badshuffle
```

Copy `.env.example` → `.env` and set `APP_URL` to your public hostname (used for sitemap, canonical URLs, and signed file URLs):

```env
APP_URL=https://catalog.yourcompany.com
OPENAI_API_KEY=sk-...   # optional
```

The container serves the API on port 3001 and also serves the built React SPA. Visit **http://localhost:3001** (or your mapped port) in your browser.

> `badshuffle.db` and `uploads/` are stored at `/data` inside the container, mounted from the `badshuffle_data` named volume.

---

## Building Standalone Executables

Produces two `.exe` files that run on Windows without Node.js installed.

```bash
npm run package
```

Output in `dist/`:

```
dist/
├── badshuffle-server.exe   Express API
├── badshuffle-client.exe   Static file server (opens browser automatically)
├── www/                    Built React SPA
├── .env.example
└── START.bat               Launches both exes in sequence
```

**First run** downloads ~30 MB Node 14 win-x64 binary to `~/.pkg-cache` (cached for future builds).

### Running the packaged app

1. Copy the `dist/` folder anywhere on the target machine
2. (Optional) Copy `.env.example` → `.env` and add your OpenAI key
3. Double-click **`START.bat`** (or run each exe separately)
4. The browser opens to `http://localhost:5173` automatically

> `badshuffle.db` is created next to the server exe and persists between runs.
> An `uploads/` folder is created in the same directory for file storage.

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require `Authorization: Bearer <token>`.

### Items

| Method | Path | Description |
|---|---|---|
| GET | `/items` | List items (`?search=`, `?hidden=`, `?category=`) |
| POST | `/items` | Create item |
| POST | `/items/upsert` | Create or update by title (used by extension) |
| PUT | `/items/:id` | Update item |
| DELETE | `/items/:id` | Delete item |
| GET | `/items/:id/associations` | Get related items |
| POST | `/items/:id/associations` | Add association |
| DELETE | `/items/:id/associations/:child` | Remove association |

### Quotes

| Method | Path | Description |
|---|---|---|
| GET | `/quotes` | List quotes |
| POST | `/quotes` | Create quote |
| GET | `/quotes/:id` | Get quote with items and custom items |
| PUT | `/quotes/:id` | Update quote |
| DELETE | `/quotes/:id` | Delete quote |
| POST | `/quotes/:id/duplicate` | Duplicate quote (details, items, custom items); returns new quote |
| POST | `/quotes/:id/send` | Send quote email, set status to sent, log message |
| POST | `/quotes/:id/approve` | Set status to approved |
| POST | `/quotes/:id/revert` | Revert to draft |
| POST | `/quotes/:id/items` | Add inventory item to quote |
| PUT | `/quotes/:id/items/:qitemId` | Update quote item |
| DELETE | `/quotes/:id/items/:qitemId` | Remove quote item |
| POST | `/quotes/:id/custom-items` | Add custom line item |
| PUT | `/quotes/:id/custom-items/:cid` | Update custom item |
| DELETE | `/quotes/:id/custom-items/:cid` | Remove custom item |
| GET | `/quotes/public/:token` | Public quote view (no auth) |

### Files

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/files` | Required | List uploaded files |
| POST | `/files/upload` | Required | Upload files (multipart, up to 20 files) |
| GET | `/files/:id/serve` | **Public** | Stream file inline (for `<img>` tags) |
| DELETE | `/files/:id` | Required | Delete file from disk and DB |

### Messages

| Method | Path | Description |
|---|---|---|
| GET | `/messages` | List messages (`?quote_id=`, `?direction=`) |
| GET | `/messages/unread-count` | Count of unread inbound messages |
| PUT | `/messages/:id/read` | Mark message as read |
| DELETE | `/messages/:id` | Delete message |

### Availability

| Method | Path | Description |
|---|---|---|
| GET | `/availability/conflicts` | Items where reserved quantities exceed stock |
| GET | `/availability/subrental-needs` | Items requiring subrental due to shortfall |
| GET | `/availability/quote/:id` | Conflict check for a specific quote |

### Vendors

| Method | Path | Description |
|---|---|---|
| GET | `/vendors` | List vendors |
| POST | `/vendors` | Create vendor |
| PUT | `/vendors/:id` | Update vendor |
| DELETE | `/vendors/:id` | Delete vendor |

### Public Catalog (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/catalog` | Server-rendered SEO catalog page (HTML) |
| GET | `/catalog/item/:id` | Server-rendered SEO item detail page (HTML) |
| GET | `/robots.txt` | robots.txt (allows /catalog, disallows internal routes) |
| GET | `/sitemap.xml` | XML sitemap (catalog, category pages, all item URLs) |
| GET | `/api/public/catalog-meta` | Company info, categories, counts, total item count |
| GET | `/api/public/items` | Item list (`?category=`, `?search=`, `?limit=`, `?offset=`) |
| GET | `/api/public/items/:id` | Single public item detail |

### Other

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/stats` | Aggregate usage stats |
| GET | `/stats/:itemId` | Per-item stats |
| POST | `/sheets/preview` | Preview a Google Sheet import |
| POST | `/sheets/import` | Execute sheet import |
| POST | `/ai/suggest` | Get AI item suggestions for a quote |
| GET | `/proxy-image?url=` | Proxy external images (bypasses CORS) |
| GET | `/settings` | Get all settings |
| PUT | `/settings` | Update settings |
| POST | `/settings/test-imap` | Test IMAP connection |

Client helpers in `client/src/api.js`: `getVendors`, `createVendor`, `updateVendor`, `deleteVendor`, `getConflicts`, `getSubrentalNeeds`, `getQuoteConflicts`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Bun (dev) / Node.js (packaged), Express |
| Database | SQLite via [sql.js](https://github.com/sql-js/sql.js) (pure WASM — no native build) |
| Client | React 18, React Router 6, Vite 3 |
| Email send | [nodemailer](https://nodemailer.com/) |
| Email receive | [imapflow](https://imapflow.com/) + [mailparser](https://nodemailer.com/extras/mailparser/) |
| Extension | Chrome MV3 (no build step) |
| Packaging | [pkg](https://github.com/vercel/pkg) 5.8.1 |
| AI | OpenAI GPT-4o-mini (optional) |

`sql.js` is used instead of `better-sqlite3` because it requires no Python / node-gyp compilation, making it portable across machines without a C++ build toolchain.

---

## Development Notes

- The Vite dev server proxies `/api` → `http://localhost:3001` (configured in `vite.config.js`)
- Production builds bake in `VITE_API_BASE=http://localhost:3001` via `client/.env.production`
- The `server/db.js` shim exposes a synchronous API matching `better-sqlite3` so routes don't need to be aware of async WASM initialization
- DB is saved to disk after every write (or after each transaction commit)
- All DB migrations use `try/catch` + `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` so they're safe to run on every startup against existing databases
- Uploaded files are stored in `uploads/` next to the project root (dev) or next to the server exe (packaged); the directory is auto-created on startup
- The IMAP poller only runs when `imap_host`, `imap_user`, and `imap_poll_enabled=1` are all set
- Initial Bun support has been tested in the dev workflow (server runs under `bun index.js` in dev); packaging and production continue to use Node

---

## License

MIT
