# BadShuffle — Setup

How to run the project locally and in production.

---

## Environment Requirements

- **Bun** — 1.1+ (primary dev runtime and installer).
- **Node.js** — 14.x required for `pkg` executable targets (packaging flow); modern Node is also used in Docker/runtime images.
- **npm** — Optional wrapper for root scripts.
- **Docker** — Optional for containerized runs.

---

## Install

From repo root:

```bash
npm run install:all
```

This runs Bun installs at root/server/client. Or manually:

```bash
bun install
bun install --cwd server
bun install --cwd client
```

---

## Environment Variables

Create `.env` in the **repo root** (copy from `.env.example`). Used by the server; client uses Vite env (e.g. `VITE_API_BASE` for API base URL).

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3001) |
| `JWT_SECRET` | **Required in production.** Must be a strong random value; not "change-me". |
| `OPENAI_API_KEY` | Optional. Enables AI item suggestions (/api/ai/suggest). |
| `SMTP_*`, `APP_URL` | Optional. For sending quote emails and password reset. See .env.example. |

Database path: in dev, `server/badshuffle.db` (created on first run). When packaged (pkg), DB is next to the executable.

---

## Dev Server

From repo root:

```bash
npm run dev
```

This runs server and client concurrently (server dev uses Bun; client uses Vite).

- **Server:** http://localhost:3001 by default (or `PORT` from `.env`; if `PORT` is unset and 3001 is busy, server auto-selects the next free localhost port)
- **Client:** http://localhost:5173 (Vite). Vite proxy forwards `/api` to the server.

If the server auto-selects a port, it writes it into `badshuffle.lock`; Vite reads that lockfile so `/api` continues to proxy correctly.

---

## Database Setup

- **No separate DB install.** SQLite (sql.js) runs in-process; DB file is `server/badshuffle.db` (or pkg path).
- **Creation:** On first server start, `initDb()` in `server/db.js` creates the file and all tables. Migrations are ALTER TABLE / CREATE TABLE inside `db.js` (try/catch for idempotency).
- **Migrations:** All schema changes live in `server/db.js`. Add new ALTER/CREATE there; no external migration runner.

---

## CLI (from repo root)

| Command | Description |
|---------|-------------|
| `npm run create-admin -- --email <e> --password <p> [--role admin\|operator\|user]` | Create or update user (default role admin). |
| `npm run reset-password -- --email <e> --password <p>` | Set password for existing user. |
| `npm run reset-auth` | Clear users, login_attempts, reset_tokens, extension_tokens (requires --yes in script). Keeps inventory, leads, quotes. |
| `npm run wipe-database` | Remove DB file; with default --backup, copy to ./backups/badshuffle-YYYYMMDD-HHMMSS.db first (requires --yes). |

Direct CLI: `node server/cli.js <cmd> [options]`. Help: `node server/cli.js --help`.

---

## Production Build / Package

- **Client:** `npm run build:client` (Vite build to client dist).
- **Server + client exes:** `npm run package` builds server and client executables (pkg) and updater/extension; `scripts/postpackage.js` can bundle client into server or dist.
- **Release:** `npm run release` (package + gh release create). See root `package.json` scripts.

---

## Optional Services

- **SMTP:** Configure in Settings (operator). Used for “Send to Client” and password reset. If not set, send still marks quote as sent and generates public link but may not send email.
- **IMAP:** Configure in Settings for inbound reply polling. Optional dependency `imapflow`; if missing, IMAP polling is no-op.
- **OpenAI:** Set `OPENAI_API_KEY` for AI suggest feature.

---

## Quick Reference

| Task | Command |
|------|--------|
| Install all | `npm run install:all` |
| Run dev | `npm run dev` |
| Create admin | `npm run create-admin -- --email you@example.com --password "YourPass"` |
| Reset auth | `npm run reset-auth` |
| Wipe DB (with backup) | `npm run wipe-database` |
