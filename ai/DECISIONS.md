# DECISIONS

Record architectural decisions.

## Date — Title

Decision:
Description of the decision.

Reason:
Why it was made.

Impact:
Consequences for the system.

---

## 2026-03-04 — Single-instance detection via lockfile + PID

Decision:
Use a JSON lockfile (`badshuffle.lock`, written next to the exe in packaged mode or project
root in dev) containing `{ pid, name, startedAt }`. On startup: read lockfile → verify PID
is alive via `process.kill(pid, 0)` → verify `name === 'badshuffle-server'` → kill via
`taskkill /F /PID` (Windows) or `SIGKILL` (other) → wait 800 ms → proceed.

Reason:
Port-only detection (check who is listening on 3001) is unsafe because it could match any
process on that port. Process-name matching via `tasklist` is Windows-specific, fragile
against exe renames, and requires spawning a shell. A lockfile with a deterministic name
tag gives safe identity verification with no native modules and no shell injection risk.
The autokill behaviour is togglable in the admin System settings panel so operators can
disable it in environments where force-killing is undesirable.

Impact:
Server writes and cleans up a file on disk. If the process is killed without cleanup
(e.g. power loss), the lockfile is stale on next start — handled: stale lock is cleared
when the stored PID is no longer alive. Lockfile path is pkg-aware.

---

## 2026-03-04 — Startup update check via GitHub releases API

Decision:
After the port binds, fire a non-blocking async call to
`https://api.github.com/repos/248Tech/badshuffle/releases/latest` (GitHub REST API).
Throttle to once per 12 hours using `update_check_last` persisted in the settings table.
Writes `update_available`, `update_check_latest`, and `update_check_last` back to settings.
The entire call is wrapped in a try/catch and errors are logged but not thrown.

Reason:
Running after port bind ensures the server is available whether or not the check completes.
GitHub's unauthenticated rate limit is 60 req/hr per IP; 12-hour throttle means at most
2 requests per day per deployment. Persisting results in the settings table avoids a
separate status endpoint — the admin System tab reads the same table rows.

Impact:
Requires outbound HTTPS to github.com on startup (when not throttled). Fails gracefully
when offline. Results persist across restarts so the "last checked / latest version"
values in the admin System tab are always populated from a prior successful check.

---

## 2026-03-04 — Role hierarchy: Admin / Operator / User

Decision:
Three roles stored in `users.role` (TEXT column, values: `'admin'`, `'operator'`, `'user'`).
Middleware chain on server:

- `requireAuth(db)` — any valid JWT or extension token; sets `req.user`
- `requireOperator(db)` — role must be `admin` or `operator`; 403 for `user`
- `requireAdmin(db)` — role must be `admin`; 403 for `operator` or `user`

A dedicated `GET /api/auth/me` endpoint returns `{ id, email, role }` from the DB so the
client has a fresh, authoritative role after each login. The client calls this endpoint
inside `AuthGate` on mount and gates the Admin nav link on `role === 'admin'`.

Role is **not** embedded in the JWT payload.

Reason:
Embedding role in the JWT would make role changes invisible to the client until the
7-day token expires. `/api/auth/me` is a single lightweight DB read that provides the
current role without token invalidation or a refresh-token mechanism. The three-level
middleware stack maps cleanly to the three route categories: public-ish protected (auth),
operational (operator+), and owner-level (admin-only). Keeping each as a separate
middleware file mirrors the existing `authMiddleware` / `adminMiddleware` pattern.

Impact:
One additional network call per page load (Auth.me in AuthGate). Role change takes effect
on the user's next page reload (no live push). Admin-only routes (`/api/admin/*`) remain
protected by `requireAdmin` with no changes. Settings write route (`PUT /api/settings`)
is upgraded from `requireAuth` to `requireOperator`. All other protected routes remain
behind `requireAuth`.
