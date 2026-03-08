# Cursor Briefing — BadShuffle (as of 2026-03-06)

## What this project is

BadShuffle is a self-hosted inventory and quoting tool for event rental businesses. It runs as two local Windows executables (server + client). Stack: Node/Express + sql.js SQLite on the back end, React + Vite on the front end.

## Current state: v0.3.2 (latest release)

All planned phases (A, B, C from HANDOFF.md) are complete. Latest release:

```
release: v0.3.2 — Quote detail header refactor, button hierarchy, status badge, UI redesign strategy, Billing page, version history correction
```

### What was built in v0.3.2
- **QuoteHeader component** — Extracted from QuoteDetailPage: title, metadata, status badge, and all quote actions in one component; flex layout with space-between and responsive wrapping
- **Quote detail button hierarchy** — Primary: Send to Client; Secondary: Edit; Ghost: Copy Client Link, AI Suggest, Duplicate; Danger: Delete
- **Status badge** — More prominent styling (larger padding, 12px font, uppercase) for draft/sent/approved
- **docs/UI_UX_REDESIGN_STRATEGY.md** — Full UI/UX redesign strategy (priority plan, design system rules, concrete recommendations for quote detail and global spacing)
- **JSX fix** — Removed stray closing tag that broke the quote-tab fragment in QuoteDetailPage

### What was built in v0.3.1
- **Quotes page** — Toggle between List and Tile view; each quote quickview shows contract total and a Duplicate button; multi-select (checkboxes) with batch "Duplicate (n)" and "Delete (n)"; optional ConfirmDialog title for batch delete
- **API** — `POST /api/quotes/:id/duplicate` (already present); GET `/api/quotes` returns computed `total` per quote
- **QuoteCard** — Displays total, Duplicate button, selection checkbox when in selectable mode; Open/Duplicate/Delete use stopPropagation so card click toggles selection

### What was built in v0.3.0
- **Quote approval from public link** — "Approve this Quote" on public quote page; `POST /api/quotes/approve-by-token` (no auth)
- **Contract sub-resource** — `contracts` table; Contract tab on QuoteDetailPage (body HTML); client signs on public page (checkbox + name); `GET/PUT /api/quotes/:id/contract`, public `POST /api/quotes/contract/sign`
- **Lead timeline** — `lead_events` table; auto-log: lead created, quote linked, email sent, reply received; activity panel on LeadsPage (click lead to see timeline)
- **Contract change logs** — `contract_logs` table; every contract update records time, user email, and old/new body; "Change log" section in Contract tab

### What was built in v0.2.0
- **Files** — media library (`/files`), upload images/PDFs, attach to emails
- **Custom quote items** — one-off line items with title, price, qty, photo from media library
- **Messages** — two-pane thread view, logs outbound emails, ingests client replies via IMAP poll
- **SMTP send** — "Send to Client" delivers email via SMTP and logs the message
- **IMAP auto-poll** — checks inbox every 5 min, links replies back to originating quote

### What was built before v0.2.0 (all complete)
- CLI admin tools: `create-admin`, `reset-password`, `reset-auth`, `wipe-database`
- Auth fix: no more logout loop or incognito 401 redirect loop
- Lead import wizard: 3-step column mapping (CSV/XLSX/Google Sheets)
- Quote workflow: status badge (draft/sent/approved), Send to Client, public token link, public quote page (`/quote/public/:token`)
- Quote detail: client info fields, venue info (click-to-edit), logistics section, totals bar (subtotal/delivery/tax/grand), tax rate
- Email templates: CRUD at `/templates`, default template auto-selected in send modal
- Roles: admin/operator/user, `requireOperator` middleware, Sidebar hides Admin link from non-admins
- Dashboard, logistics picker, single unified search

## Project structure (key paths)

```
server/
  index.js              — Express entry; mounts all routes; IMAP poller startup
  db.js                 — sql.js shim (mirrors better-sqlite3 API); all migrations here
  routes/
    quotes.js           — Quote CRUD + /send /approve /revert + custom items + contract + contract/logs
    leads.js            — Lead CRUD + CSV/XLSX/Sheets import + column mapping + /:id/events
    templates.js        — Email template CRUD
    files.js            — File upload / serve
    messages.js         — Outbound log + inbound IMAP messages
    settings.js         — SMTP/IMAP config
    auth.js             — Login, logout, /me, extension-token, forgot/reset
    admin.js            — User management, role change, system settings
    items.js            — Inventory CRUD
    sheets.js           — Google Sheets scrape
    stats.js            — Usage stats
    ai.js               — GPT-4o-mini item suggestions
  lib/
    authMiddleware.js
    adminMiddleware.js
    operatorMiddleware.js
  services/
    singleInstance.js
    updateCheck.js
    emailPoller.js      — IMAP polling service

client/src/
  App.jsx               — Routes, AuthGate, role state
  api.js                — All API calls
  pages/
    DashboardPage.jsx
    InventoryPage.jsx
    QuoteDetailPage.jsx — Main quote editing UI (38 KB — the biggest file)
    PublicQuotePage.jsx — Read-only public quote view + print
    TemplatesPage.jsx   — Email template CRUD
    FilesPage.jsx       — Media library
    MessagesPage.jsx    — Email thread view
    SettingsPage.jsx    — SMTP/IMAP config
    LeadsPage.jsx
    ImportPage.jsx      — 3-step lead import wizard
    AdminPage.jsx
  components/
    QuoteBuilder.jsx    — Line item editor (qty, unit price, line total, taxable)
    Sidebar.jsx         — Nav (role-aware)
    QuoteExport.jsx     — PNG/PDF export
```

## Git state

- `badshuffle.lock` deleted (runtime lock file, ignored going forward)
- `badshuffle/` untracked — this is the extracted/packaged executable directory, not source

Working tree is committed; canonical version is v0.3.2 (0.x pre-release until 1.0).

## Known stubs / incomplete items

1. **SMTP send** — wired and working; requires user to configure SMTP in Settings
2. **IMAP poll** — wired; requires IMAP credentials in Settings

## Backlog (prioritized by value)

### 1. Role badge in top nav
- Small "Admin" / "Operator" badge next to the user email in the header
- Data already available: `role` is fetched in `App.jsx` and passed to Sidebar

### 2. Email notification on role change
- When `PUT /api/admin/users/:id/role` is called, send an email to the affected user
- SMTP is already wired; just need to call the mailer from the admin route

## How to run in dev

```bash
# from repo root
npm run dev        # starts server (port 3001) + client (port 5173) concurrently
```

Server env vars (`.env` in repo root):
- `OPENAI_API_KEY` — optional, enables AI item suggestions
- DB lives at `server/badshuffle.db` (auto-created on first run)

## API (v1)

- **All development must consider the API.** See **`ai/API_DEVELOPMENT.md`**.
- Versioned API: **`/api/v1`** — envelope responses `{ data, meta }` / `{ error: { code, message }, meta }`.
- OpenAPI spec: `server/api/openapi.json`; docs: **`GET /api/v1/docs`**, spec: **`GET /api/v1/openapi.json`**.
- v1 router: `server/api/v1.js`; envelope: `server/lib/apiEnvelope.js`. New endpoints should be added under v1 and documented in the OpenAPI spec.

## Important conventions

- All DB migrations go in `server/db.js` inside `initDb()`, using `try { db.run("ALTER TABLE...") } catch(e) {}` pattern
- Server routes are factory functions: `module.exports = function makeRouter(db) { ... return router; }`
- Client API calls go through `request()` in `api.js` which attaches JWT from localStorage
- Public routes (no auth) are mounted before the `auth` middleware in `server/index.js`
- CSS Modules used throughout (`*.module.css`)
- No TypeScript — plain JS/JSX
- No test suite currently
