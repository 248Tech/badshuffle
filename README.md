# BadShuffle v3.2.2

A self-hosted inventory and quoting tool for event rental businesses. Manage your catalog, build quotes, track usage stats, and sync items directly from Goodshuffle Pro — all running locally on your machine with no subscription required.

---

## What's New in v3.2.2

- **Quotes page view toggle** — Switch between List and Tile view from the Quotes page header
- **Contract total on quickview** — Each quote card/tile and list row shows the computed contract total
- **Duplicate on Quotes page** — Duplicate button on each quote quickview (and in list row actions); duplicates full quote (details, line items, custom items)
- **Multi-select and batch actions** — Select one or more quotes via checkboxes; "Duplicate (n)" and "Delete (n)" in a batch bar with confirmation for batch delete

## What's New in v3.2.1

- **Quote approval from public link** — Clients can approve a quote from the public link; "Approve this Quote" button on the shared quote page
- **Contracts** — Add a contract to any quote (Contract tab); clients sign on the public page (agree + name); full change log (who changed what and when)
- **Lead timeline** — Activity log per lead: created, quote linked, email sent, reply received; click a lead on the Leads page to see the timeline
- **Contract change logs** — Every contract edit is recorded with timestamp, user email, and a summary of what changed

## What's New in v3.2

- **Files** — media library for uploading images, PDFs, and documents; attach files to outbound emails
- **Custom quote items** — add one-off line items to any quote with a title, price, quantity, and photo picked from your media library or inventory
- **Messages** — log all outbound quote emails and automatically ingest client replies via IMAP polling; two-pane thread view with unread badges
- **SMTP send** — "Send to Client" now actually delivers email via SMTP (configured in Settings) and logs the outbound message
- **IMAP auto-poll** — BadShuffle checks your inbox every 5 minutes for replies and links them back to the originating quote

---

## Features

- **Inventory management** — Add, edit, hide, and search rental items with photos
- **Quote builder** — Create event quotes, add items with quantities and labels, custom one-off line items, export to PDF/image
- **Files / media library** — Upload images and documents; serve them inline for use in quotes and emails
- **Messages** — Full outbound + inbound email log linked to quotes; IMAP polling for client replies
- **AI suggestions** — GPT-4o-mini recommends items for a quote based on guest count and event type (optional; falls back gracefully without an API key)
- **Usage stats** — See which items are quoted most often and track per-guest-count brackets
- **Google Sheets import** — Bulk-import inventory from a published Sheet URL
- **Chrome extension** — One-click sync of items from your Goodshuffle Pro catalog page directly into BadShuffle
- **Standalone executables** — Package into two Windows `.exe` files that run without Node.js installed

---

## Project Structure

```
badshuffle/
├── server/          Express API + sql.js SQLite (port 3001)
│   ├── index.js
│   ├── db.js        sql.js shim that mirrors better-sqlite3's API
│   ├── routes/      items, quotes, sheets, stats, ai, files, messages, settings
│   ├── services/    singleInstance, updateCheck, emailPoller (IMAP)
│   └── lib/         authMiddleware, crypto, imageProxy
├── client/          React + Vite SPA (port 5173 in dev)
│   ├── src/
│   │   ├── pages/   Dashboard, Inventory, Import, Quotes, QuoteDetail,
│   │   │            Stats, Files, Messages, Settings, Leads, Templates
│   │   └── components/
│   └── serve.js     Zero-dep static server used by the packaged exe
├── extension/       Chrome MV3 extension (load unpacked)
│   ├── manifest.json
│   ├── content.js   Scrapes Goodshuffle catalog pages
│   ├── background.js  Posts items to localhost:3001
│   └── popup.html
└── scripts/
    └── postpackage.js  Copies build output → dist/
```

---

## Requirements (development)

| Requirement | Version |
|---|---|
| Node.js | 14.x (tested on 14.15.5) |
| npm | 6+ |
| Chrome | any modern version |

> Node 14 is required if you want to **build the executables** (pkg targets node14). The dev server itself runs fine on Node 18+ too.

---

## Getting Started

### 1. Install dependencies

```bash
git clone https://github.com/248Tech/badshuffle.git
cd badshuffle
npm run install:all
```

### 2. Configure environment (optional)

Copy `.env.example` to `.env` and fill in your OpenAI key if you want AI suggestions:

```bash
cp .env.example .env
```

```env
OPENAI_API_KEY=sk-...   # optional — app works without it
PORT=3001               # optional — default is 3001
```

### 3. Run in development mode

```bash
npm run dev
```

Opens both the Express server (`:3001`) and Vite dev server (`:5173`) concurrently.
Visit **http://localhost:5173** in your browser.

### 4. Load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Browse to your Goodshuffle Pro catalog — a "Sync to BadShuffle" button will appear

**Locked out?** If you can't log in or forgot the admin password, run:
`npm run create-admin -- --email your@email.com --password yournewpassword`
(from the repo root).

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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js, Express |
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

---

## License

MIT
