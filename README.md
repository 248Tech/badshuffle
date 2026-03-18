# BadShuffle v0.4.5

![Release](https://img.shields.io/badge/release-0.4.5-0a7ea4)
![Status](https://img.shields.io/badge/status-pre--release-c79200)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Express%20%7C%20SQLite-1f6feb)
![Deploy](https://img.shields.io/badge/deploy-Docker%20%7C%20Windows%20EXE-2ea44f)
![License](https://img.shields.io/badge/license-MIT-111111)

BadShuffle is a self-hosted event rental software platform for quoting, inventory management, client approvals, messaging, and public catalog publishing. It combines internal operator workflows with SEO-friendly public surfaces, optional AI assistance, and local-first deployment choices instead of recurring SaaS lock-in.

**Keywords:** event rental software, rental inventory management, quote builder, client portal, self-hosted CRM, Goodshuffle sync, public product catalog, event operations software.

*Pre-release (0.x). See [CHANGELOG.md](CHANGELOG.md) for version history.*

---

## Why This Repo Is Worth Reviewing

- **Real product scope** — Inventory, quotes, approvals, messages, templates, files, SEO catalog pages, and operational tooling live in one codebase.
- **Full-stack ownership** — React/Vite frontend, Express API, SQLite/sql.js persistence, Chrome extension, Docker deployment, and Windows packaging all ship together.
- **Domain complexity** — Availability conflicts, per-line pricing overrides, reusable rental/payment policies, and public quote signing target actual event-rental workflows.
- **Deployment pragmatism** — Run it locally, on a LAN, in Docker, or as packaged Windows executables.

## What’s New In v0.4.5

- **Quote pricing controls** — Drag-to-reorder line items, per-item discounts, clearer status borders, and improved conflict visibility.
- **Public quote upgrades** — Quote expiration, reusable rental terms and payment policies, public totals that honor discounted pricing, and approval/signing rules that now respect expiration.
- **Operator quality-of-life** — UI scale setting, direct “View Quote” navigation from Messages, and item accessory relationships in Inventory.
- **Repo polish** — Faster quickstart, badges, license file, cleaner Git hygiene, and a tighter GitHub presentation for discoverability.

## Core Features

- **Inventory management** — Searchable catalog with photos, categories, subrental support, vendor links, associations, and accessory relationships.
- **Quote workflow** — Event quotes, custom items, price overrides, line-item discounts, adjustments, contract text, approvals, signatures, and public sharing.
- **Availability awareness** — Quote conflict checks, oversold detection, subrental needs, and inventory-aware quote building.
- **Public-facing surfaces** — Client quote page, live quote messaging, SEO catalog pages, `robots.txt`, sitemap generation, and JSON-LD metadata.
- **Comms and files** — SMTP send, IMAP reply capture, media library uploads, and quote-linked attachments.
- **Import and sync** — Google Sheets import plus a Chrome extension for syncing items from Goodshuffle Pro.
- **Optional AI** — Per-feature provider settings for OpenAI, Anthropic, and Gemini without making AI a hard dependency.

## What This Demonstrates

- Shipping a product with both internal tools and customer-facing flows.
- Evolving a live schema with safe startup migrations.
- Balancing delivery speed with deployment portability.
- Writing software that can be evaluated as both a business tool and an engineering portfolio piece.

## Near-Term Roadmap

- **Quote detail cleanup** — Condense client/venue display in `QuoteDetailPage` view mode.
- **Mobile optimization** — Tight responsive pass across quote editing, tabs, messages, and modal-heavy screens.
- **Send preview** — Inline preview of quote email/public link before sending.
- **Operations depth** — Pull sheets and richer warehouse workflows.

More context lives in [ai/KNOWN_GAPS.md](ai/KNOWN_GAPS.md) and [ai/TODO.md](ai/TODO.md).

---

## Project Structure

```text
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
├── ai/              Architecture notes, features, workflows, roadmap, setup
├── Dockerfile       Multi-stage build (Bun → client, Node:20 → server)
├── docker-compose.yml
└── scripts/
```

---

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| Bun | 1.1+ | Recommended for repo scripts and dev flow |
| Node.js | 20+ | Fine for general local tooling and fallback runtime |
| Node.js | 14.x | Only required for current `pkg` executable targets |
| Docker | 24+ | Optional |
| Chrome | Current | Optional, for the extension |

> The scripted dev flow assumes Bun is installed. The packaged `.exe` build still targets Node 14 because of `pkg`.

---

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/248Tech/badshuffle.git
cd badshuffle
npm run install:all
```

If you do not have Bun yet, install Bun first or fall back to:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Configure `.env`

Copy `.env.example` to `.env`, then set the values you care about:

```env
PORT=3001
APP_URL=http://localhost:3001
OPENAI_API_KEY=sk-...
```

`APP_URL` matters for public catalog canonicals, signed file URLs, and sitemap output.

### 3. Start the app

**Local development**

```bash
npm run dev
```

- API: `http://localhost:3001`
- Client: `http://localhost:5173`

**LAN / device testing**

```bash
npm run dev:host
```

Use `http://<your-pc-ip>:5173` from another device on the same network.

**Containerized development**

```bash
npm run dev:docker
```

**Production-style Docker run**

```bash
docker compose up -d --build
```

That serves the API and built client from `http://localhost:3001` with DB/uploads persisted in the `badshuffle_data` volume.

### 4. Development auth

In Vite dev mode, BadShuffle can auto-create and log in a local admin account through `/api/auth/dev-login`.

- `admin@admin.com`
- `admin123`

That route is disabled when `NODE_ENV=production`.

### 5. Optional: load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Visit Goodshuffle Pro and use the sync action

### 6. Troubleshooting

**Locked out?** Run `npm run create-admin -- --email your@email.com --password yournewpassword`.

**Frontend can’t reach the API?** If `/api/auth/login` fails with `ECONNREFUSED`, start both services from the repo root with `npm run dev` or `npm run dev:host`.

**Why is `badshuffle.lock` missing from git?** It is a local runtime file used to communicate the active dev port and should stay uncommitted.

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
2. (Optional) Copy `.env.example` → `.env` and add any AI provider keys you want
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
| GET | `/items/:id/accessories` | List saved accessory links for an item |
| POST | `/items/:id/accessories` | Add an accessory link |
| DELETE | `/items/:id/accessories/:accessoryId` | Remove an accessory link |

### Quotes

| Method | Path | Description |
|---|---|---|
| GET | `/quotes` | List quotes (`?search=`, `?status=`, `?event_from=`, `?event_to=`, `?has_balance=1`, `?venue=`) |
| POST | `/quotes` | Create quote |
| GET | `/quotes/:id` | Get quote with items and custom items |
| PUT | `/quotes/:id` | Update quote |
| DELETE | `/quotes/:id` | Delete quote |
| POST | `/quotes/:id/duplicate` | Duplicate quote (details, items, custom items); returns new quote |
| POST | `/quotes/:id/send` | Send quote email, set status to sent, log message |
| POST | `/quotes/:id/approve` | Set status to approved |
| POST | `/quotes/:id/revert` | Revert to draft |
| POST | `/quotes/:id/items` | Add inventory item to quote |
| PUT | `/quotes/:id/items/:qitemId` | Update quote item (quantity `0` removes it) |
| DELETE | `/quotes/:id/items/:qitemId` | Remove quote item |
| PUT | `/quotes/:id/items/reorder` | Update line-item order |
| POST | `/quotes/:id/custom-items` | Add custom line item |
| PUT | `/quotes/:id/custom-items/:cid` | Update custom item (quantity `0` removes it) |
| DELETE | `/quotes/:id/custom-items/:cid` | Remove custom item |
| GET | `/quotes/public/:token` | Public quote view (no auth) |
| GET | `/quotes/public/:token/messages` | Public quote thread (no auth) |
| POST | `/quotes/public/:token/messages` | Post client message to quote thread (no auth) |

### Templates

| Method | Path | Description |
|---|---|---|
| GET | `/templates` | List email templates |
| POST | `/templates` | Create email template |
| PUT | `/templates/:id` | Update email template |
| DELETE | `/templates/:id` | Delete email template |
| GET | `/templates/contract-templates` | List contract templates |
| POST | `/templates/contract-templates` | Create contract template |
| DELETE | `/templates/contract-templates/:id` | Delete contract template |
| GET | `/templates/payment-policies` | List payment policies |
| POST | `/templates/payment-policies` | Create payment policy |
| PUT | `/templates/payment-policies/:id` | Update payment policy |
| DELETE | `/templates/payment-policies/:id` | Delete payment policy |
| GET | `/templates/rental-terms` | List rental terms |
| POST | `/templates/rental-terms` | Create rental terms |
| PUT | `/templates/rental-terms/:id` | Update rental terms |
| DELETE | `/templates/rental-terms/:id` | Delete rental terms |

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
| GET | `/availability/quote/:id/items?ids=1,2,3` | Stock + reserved counts for specific items on that quote's date range |

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
| GET | `/v1/docs` | Swagger UI for the versioned API |
| GET | `/v1/openapi.json` | Raw OpenAPI document |

Client helpers in `client/src/api.js`: `getVendors`, `getConflicts`, `getQuoteAvailabilityItems`, `reorderQuoteItems`, `getPaymentPolicies`, `getRentalTerms`, `getItemAccessories`, `getPublicMessages`, `sendPublicMessage`.

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
| AI | Optional OpenAI, Anthropic, and Gemini provider integrations |

`sql.js` is used instead of `better-sqlite3` because it requires no Python / node-gyp compilation, making it portable across machines without a C++ build toolchain.

---

## Development Notes

- The Vite dev server proxies `/api` to the server port from `PORT` or `badshuffle.lock` (falls back to `http://localhost:3001`)
- Production builds bake in `VITE_API_BASE=http://localhost:3001` via `client/.env.production`
- The `server/db.js` shim exposes a synchronous API matching `better-sqlite3` so routes don't need to be aware of async WASM initialization
- DB is saved to disk after every write (or after each transaction commit)
- All DB migrations use `try/catch` + `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` so they're safe to run on every startup against existing databases
- Uploaded files are stored in `uploads/` next to the project root (dev) or next to the server exe (packaged); the directory is auto-created on startup
- The IMAP poller only runs when `imap_host`, `imap_user`, and `imap_poll_enabled=1` are all set
- Initial Bun support has been tested in the dev workflow (server runs under `bun index.js` in dev); packaging and production continue to use Node

---

## License

MIT. See [LICENSE](LICENSE).
