# Cursor Briefing — BadShuffle (as of 2026-03-19)

## What this project is

BadShuffle is a self-hosted inventory and quoting tool for event rental businesses. It runs as two local Windows executables (server + client), or via Docker. Stack: Node/Express + sql.js SQLite on the back end, React + Vite on the front end.

## Current state: v0.0.4 (latest release)

Latest release:

```
release: v0.0.4 — startup stability hotfix for fresh installs and slow-device initialization paths
```

### What shipped in v0.0.4
- **Inventory empty-state crash fix** — Removed an undefined `search` reference in `ItemGrid` that could throw when the inventory list was empty.
- **Startup rejection handling** — `InventoryPage` now catches failed `getItems` calls during sql.js startup and degrades gracefully.

### What shipped in v0.0.3
- **Quote pricing + layout polish** — Drag-to-reorder line items, per-item discounts, status-colored quote cards, and stronger conflict visibility.
- **Public quote parity** — Public quote route and page now respect quote expiration, show rental/payment policy content, and calculate totals using discounted pricing.
- **Inventory + operator UX** — Item accessories can be linked in Inventory, Messages can jump straight to related quotes, and UI scale can be adjusted globally.
- **Repo hygiene** — README, quickstart, license, gitignore, and coordination docs were refreshed.

### What shipped in v0.0.2
- **Quote list + create flow** — Quotes page supports search/status/date/venue/balance filters, and a 2-step quote creation wizard with optional Google Places autocomplete.
- **Public quote messaging** — No-auth thread routes (`GET/POST /api/quotes/public/:token/messages`) plus live message UI on the public quote page.
- **Availability UX** — Endpoint `GET /api/availability/quote/:id/items?ids=...` for stock/reserved counts in QuoteBuilder picker and line-item badges.
- **Theme + map controls** — Settings adds `ui_theme`, `google_places_api_key`, and `map_default_style`.
- **Extension + schema updates** — Layered extension extraction and persistence of `items.contract_description`.

### What shipped in v0.0.1
- **Public catalog** — `/catalog` and `/catalog/item/:id` routes with server-rendered SEO pages and public JSON APIs.
- **Docker** — `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-entrypoint.sh` for portable deployment.
- **Development launch flow** — `dev:host`, `dev:docker`, dev-only `/api/auth/dev-login`, and server-side static client serving.
- **Settings / AI controls** — Encrypted Claude/OpenAI/Gemini key storage and per-feature enable/model settings.
- **Responsive client polish** — Mobile sidebar overlay, larger touch targets, category chips, and broad responsive cleanup.

### Historical groundwork (pre-v0.0.1)
- Availability and conflict detection endpoints, vendors/subrental support, rental date fields, and dashboard conflict panels.
- Quote contract/signature workflows, lead timeline events, role-aware auth/admin tooling, and import pipeline improvements.
- Bun adoption and local runtime/developer workflow hardening.

## Project structure (key paths)

```text
server/
  index.js              — Express entry; mounts routes; IMAP poller startup
  db.js                 — sql.js shim (migrations live here)
  routes/
    quotes.js           — Quote CRUD, send/approve, custom items, adjustments, reorder
    leads.js            — Lead CRUD + CSV/XLSX/Sheets import + events
    templates.js        — Email templates + policy/terms routes
    files.js            — File upload/serve
    messages.js         — Outbound log + inbound IMAP messages
    settings.js         — SMTP/IMAP + app settings
    auth.js             — Login/logout/me + extension-token + password reset + dev login
    admin.js            — User management + system settings
    items.js            — Inventory CRUD + accessories/subrental fields
    availability.js     — Conflicts, subrental-needs, quote-item availability
    vendors.js          — Vendor CRUD
    publicCatalog.js    — Public catalog routes + API + SEO surfaces
    sheets.js           — Google Sheets scrape
    stats.js            — Usage stats
    ai.js               — AI item suggestions
  lib/
    authMiddleware.js
    adminMiddleware.js
    operatorMiddleware.js
  services/
    singleInstance.js
    updateCheck.js
    emailPoller.js

client/src/
  App.jsx               — Routes + auth gate
  api.js                — API client methods
  pages/
    DashboardPage.jsx
    InventoryPage.jsx
    QuoteDetailPage.jsx
    PublicQuotePage.jsx
    PublicCatalogPage.jsx
    PublicItemPage.jsx
    VendorsPage.jsx
    TemplatesPage.jsx
    FilesPage.jsx
    MessagesPage.jsx
    SettingsPage.jsx
    LeadsPage.jsx
    ImportPage.jsx
    AdminPage.jsx
  components/
    QuoteBuilder.jsx
    Sidebar.jsx
    QuoteExport.jsx

Dockerfile             — Multi-stage build
/docker-compose*.yml   — Container orchestration
```

## Git state

- Runtime lockfiles, uploads, and local editor config are ignored.
- Canonical release line is `v0.0.1` through `v0.0.4`.
- Current canonical version is `v0.0.4`.

## Known stubs / incomplete items

1. **SMTP send** — wired; requires SMTP configuration in Settings.
2. **IMAP poll** — wired; requires IMAP credentials in Settings.

## Backlog (high level)

1. Role badge in top nav.
2. Email notification on role change.
3. Mobile/responsive polish pass for quote and messaging flows.

## API (v1)

- API is versioned under `/api/v1` with envelope responses.
- OpenAPI: `server/api/openapi.json`; docs: `GET /api/v1/docs`; spec: `GET /api/v1/openapi.json`.
- New endpoints should be added under v1 and documented in OpenAPI.

## Important conventions

- DB migrations live in `server/db.js` (`initDb()` try/catch migration pattern).
- Route modules are factory functions receiving `db`.
- Client API calls run through `request()` in `api.js` with JWT from localStorage.
- Public no-auth routes are mounted before auth middleware.
- CSS Modules throughout (`*.module.css`), plain JS/JSX, no TypeScript.
- No formal automated test suite yet.
