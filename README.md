# BadShuffle

A self-hosted inventory and quoting tool for event rental businesses. Manage your catalog, build quotes, track usage stats, and sync items directly from Goodshuffle Pro — all running locally on your machine with no subscription required.

---

## Features

- **Inventory management** — Add, edit, hide, and search rental items with photos
- **Quote builder** — Create event quotes, add items with quantities and labels, export to PDF/image
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
│   ├── routes/      items, quotes, sheets, stats, ai
│   └── lib/         imageProxy
├── client/          React + Vite SPA (port 5173 in dev)
│   ├── src/
│   │   ├── pages/   Inventory, Import, Quotes, QuoteDetail, Stats
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

---

## API Reference

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/items` | List items (supports `?search=`, `?hidden=`) |
| POST | `/items` | Create item |
| POST | `/items/upsert` | Create or update by title (used by extension) |
| PUT | `/items/:id` | Update item |
| DELETE | `/items/:id` | Delete item |
| GET | `/items/:id/associations` | Get related items |
| POST | `/items/:id/associations` | Add association |
| DELETE | `/items/:id/associations/:child` | Remove association |
| GET | `/quotes` | List quotes |
| POST | `/quotes` | Create quote |
| GET | `/quotes/:id` | Get quote with items |
| PUT | `/quotes/:id` | Update quote |
| DELETE | `/quotes/:id` | Delete quote |
| POST | `/quotes/:id/items` | Add item to quote |
| PUT | `/quotes/:id/items/:qitemId` | Update quote item |
| DELETE | `/quotes/:id/items/:qitemId` | Remove quote item |
| GET | `/stats` | Aggregate usage stats |
| GET | `/stats/:itemId` | Per-item stats |
| POST | `/sheets/preview` | Preview a Google Sheet import |
| POST | `/sheets/import` | Execute import |
| POST | `/ai/suggest` | Get AI item suggestions for a quote |
| GET | `/proxy-image?url=` | Proxy external images (bypasses CORS) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js, Express |
| Database | SQLite via [sql.js](https://github.com/sql-js/sql.js) (pure WASM — no native build) |
| Client | React 18, React Router 6, Vite 3 |
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

---

## License

MIT
