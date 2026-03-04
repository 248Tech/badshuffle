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

---

## 2026-03-04 — Extension download endpoint made public

Decision:
Remove `requireAuth` from the `/api/extension` router registration in `server/index.js`.
The endpoint is moved to the public block alongside `/api/auth` and `/api/health`.

Reason:
The download is triggered by a browser `<a href="..." download>` click. Browser-initiated
navigation requests do not attach `Authorization: Bearer` headers, so any auth middleware
will reject them with 401. The extension ZIP is not sensitive — it is a browser extension
that any Badshuffle user needs to install, and it would be publicly distributed in a
GitHub release. Query-token approaches (Option B) add complexity and a token-leakage
surface without meaningful security gain. Option A (public) is the correct choice.

Impact:
Anyone who can reach port 3001 can download the extension ZIP without logging in. This is
acceptable: port 3001 is a local-only server not exposed to the internet. No other
endpoints are affected.

---

## 2026-03-04 — Google Sheets 400 treated as access error

Decision:
In `server/lib/sheetsParser.js`, extend the access-error condition to include HTTP 400
alongside 401 and 403. The human-readable "Sheet is not publicly accessible. Make sure
it is published to the web…" message is shown for all three status codes.

Reason:
Google's Sheets CSV export endpoint returns HTTP 400 (Bad Request) — not 401/403 — when
the spreadsheet is private or the requesting IP has no access. This is undocumented
behavior that differs from standard HTTP semantics. The existing `sheetUrlToCsvUrl`
conversion from edit URLs to export URLs is correct and should not change; only the
error-handling branch needs updating. Surfacing the accurate help message for 400
eliminates the misleading "Failed to fetch sheet: 400 Bad Request" report.

Impact:
Users who paste a private Sheet URL now receive a clear, actionable error. Users who
paste a valid public Sheet URL are unaffected. No change to URL conversion logic.

---

## 2026-03-04 — Lead counter label changed to "leads in database"

Decision:
Change the `LeadsPreview` component label in `ImportPage.jsx` from
`"{total} leads scraped from Goodshuffle"` to `"{total} leads in database"`.
Update the empty-state message to remove the reference to browsing Goodshuffle.

Reason:
Leads enter the database via two paths: Sheet import and the Chrome extension. Neither
path is exclusively "scraping from Goodshuffle." The label was a placeholder that
survived into production. "Leads in database" is source-agnostic and always accurate.
The total count from `api.getLeads` is already correct and requires no change.

Impact:
UI copy change only. No API or data-model changes required.
