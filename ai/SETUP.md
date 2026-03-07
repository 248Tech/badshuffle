# BadShuffle — Setup

How to run the project locally and in production.

---

## Environment Requirements

- **Node.js** — LTS (e.g. 14+). Used for server and client dev/build.
- **npm** — For install and scripts. No pnpm/yarn requirement.

---

## Install

From repo root:

```bash
npm run install:all
```

This runs `npm install` at root and `npm install --prefix server` and `npm install --prefix client`. Or manually:

```bash
npm install
npm install --prefix server
npm install --prefix client
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

This runs server and client concurrently (e.g. `concurrently "npm run dev --prefix server" "npm run dev --prefix client"`).

- **Server:** http://localhost:3001 (or PORT from .env)
- **Client:** http://localhost:5173 (Vite). Vite proxy forwards `/api` to the server.

First run: ensure no other process is using port 3001 (or set PORT). If single-instance autokill is enabled (admin System settings), the server may kill a previous BadShuffle server on startup.

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
