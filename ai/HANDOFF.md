# HANDOFF — Complete Role Enforcement and UI Role Awareness

## Objective

The core infrastructure for single-instance guard, startup update check, admin system
settings, and the role picker was implemented in the prior session. This HANDOFF covers
the three remaining gaps needed to close the feature:

1. An `operatorMiddleware` so that `operator`-role users can write settings but cannot
   reach admin-only endpoints.
2. A `GET /api/auth/me` endpoint so the client knows the current user's role without
   parsing a potentially-stale JWT.
3. Role-aware rendering in the client: hide the Admin nav link from non-admin users.

---

## Constraints

- Node 14.15.5 — do **not** use `||=`, `&&=`, `??=` (logical assignment operators).
- No new npm packages; use existing dependencies and built-ins only.
- Minimal diffs — do not rewrite existing working code.
- Must work in both dev (`npm run dev`) and packaged (`badshuffle-server.exe`) modes.

---

## Current State

### Already complete — DO NOT touch

| File | What it does |
|---|---|
| `server/services/singleInstance.js` | Lockfile guard; wired into index.js |
| `server/services/updateCheck.js` | GitHub check, 12h throttle; wired into index.js |
| `server/db.js` | Seeds `autokill_enabled`, `update_check_enabled`, `update_check_last/latest/available` |
| `server/routes/admin.js` | `GET/PUT /admin/system`, `PUT /admin/users/:id/role` |
| `server/lib/authMiddleware.js` | `requireAuth(db)` — JWT or extension token |
| `server/lib/adminMiddleware.js` | `requireAdmin(db)` — admin role only |
| `client/src/pages/AdminPage.jsx` | System tab with toggles; role picker in user table |
| `client/src/api.js` | `admin.getSystemSettings`, `admin.updateSystemSettings`, `admin.changeRole` |

### Gaps — Cursor to implement

1. `server/lib/operatorMiddleware.js` does not exist.
2. `PUT /api/settings` is guarded only by `requireAuth` — any logged-in user can save
   settings changes.
3. There is no `GET /api/auth/me` endpoint.
4. `App.jsx` does not fetch or hold the current user's role.
5. `Sidebar.jsx` renders the Admin nav link unconditionally regardless of role.

---

## Implementation Plan

### A — Create `server/lib/operatorMiddleware.js`

Export a factory function `requireOperator(db)` that returns Express middleware.

Logic: verify JWT (same pattern as `authMiddleware.js`), then load the user row from the
`users` table by `req.user.sub` and check `role`. Allow if `role` is `'admin'` or
`'operator'`. Return 403 with `{ error: 'Operator or Admin access required' }` if `role`
is `'user'` or the row is missing.

Pattern reference: read `server/lib/adminMiddleware.js` — this is structurally identical
except the role condition.

### B — Apply `requireOperator` to settings writes

In `server/index.js`:

- Import `requireOperator` from `./lib/operatorMiddleware`.
- On the `/api/settings` line, `GET` is acceptable for all authenticated users (they need
  to read company name, tax rate, etc.). Only `PUT` needs operator-level protection.
- The cleanest approach: register the settings router as-is behind `requireAuth`, then
  add a route-level middleware guard inside `server/routes/settings.js` on the PUT handler,
  OR register two separate middleware entries in `index.js`.
- **Recommended**: add `const op = requireOperator(db)` and apply it as inline middleware
  on the PUT in `routes/settings.js` (add `op` parameter to `makeRouter` or call it
  inline). Alternatively, in `index.js` apply `requireOperator(db)` as a second middleware
  after `auth` only on the settings router — Express allows stacking middleware.
- Do not remove `requireAuth` from the settings route; `requireOperator` chains after it.

### C — Add `GET /api/auth/me` to `server/routes/auth.js`

Add a new route inside `authRouter`:

```
GET /api/auth/me
```

- Requires a valid Bearer JWT (verify with `jwt.verify`; return 401 on failure).
- Look up the user row by `req.user.sub` (decoded JWT subject is the user `id`).
- Return `{ id, email, role }`.
- Return 404 if the user row does not exist.

Pattern reference: the `GET /api/auth/extension-token` route in the same file already
manually verifies the JWT header — follow that exact pattern.

### D — Add `api.auth.me()` to `client/src/api.js`

Add to the `auth` section:

```
me: () => request('/auth/me'),
```

### E — Role-aware client (App.jsx → Layout.jsx → Sidebar.jsx)

**App.jsx**

`AuthGate` already calls `api.auth.status()` on mount. After confirming the setup is
complete, also call `api.auth.me()` and store the result in a `role` state variable
(`useState('')`). Pass `role` as a prop to `<Layout role={role} />`.

If `api.auth.me()` fails (user not yet logged in), treat role as `''` — Sidebar will
simply not show the Admin link, which is fine.

**`client/src/components/Layout.jsx`**

Accept a `role` prop and pass it through to `<Sidebar role={role} />`.
Read the current file first to find exactly where `<Sidebar />` is rendered.

**`client/src/components/Sidebar.jsx`**

Accept a `role` prop. In the `NAV.map(...)` render, skip the item with `to: '/admin'`
unless `role === 'admin'`.

---

## Files To Create

- `server/lib/operatorMiddleware.js`

## Files To Modify

| File | Change |
|---|---|
| `server/routes/settings.js` | Apply operator-level guard on the PUT handler |
| `server/routes/auth.js` | Add `GET /api/auth/me` |
| `client/src/api.js` | Add `api.auth.me()` |
| `client/src/App.jsx` | Fetch role in AuthGate; pass to Layout |
| `client/src/components/Layout.jsx` | Accept + forward `role` prop to Sidebar |
| `client/src/components/Sidebar.jsx` | Hide Admin nav item for non-admin roles |

---

## Implementation Notes

- `requireOperator` is structurally identical to `requireAdmin`; the only difference is
  the condition `row.role !== 'admin'` becomes
  `row.role !== 'admin' && row.role !== 'operator'`.
- The `GET /api/auth/me` route must be inside the `authRouter` factory so it has access
  to `db`. It is a protected route (requires JWT), unlike `/status` and `/setup`.
- `App.jsx`'s `AuthGate` uses `useNavigate` — it can call `api.auth.me()` in the same
  `useEffect` that calls `api.auth.status()`, or in a chained `.then()`.
- `Sidebar.jsx` already imports from `../api` and uses `useNavigate`. Adding a `role`
  prop requires no new imports.
- The pending-count logic in `Sidebar.jsx` (`api.admin.getUsers()`) is fine to keep as-is;
  it already silently ignores 403 errors for non-admin users.
- Do not add `role` to the JWT payload. The `/api/auth/me` call is the source of truth
  for the client. See DECISIONS.md for rationale.

---

## Design Options (resolved — no decision needed)

| Option | Verdict |
|---|---|
| Role in JWT (parse client-side) | Rejected — stale role until token expires |
| `/api/auth/me` fresh from DB | **Chosen** — see DECISIONS.md |
| requireOperator as separate file | **Chosen** — consistent with adminMiddleware pattern |
| requireOperator inlined in settings route | Acceptable alternative if Cursor prefers |

---

## Acceptance Criteria

- [ ] `PUT /api/settings` returns 403 for a `user`-role JWT
- [ ] `PUT /api/settings` returns 200 for an `operator`-role JWT
- [ ] `PUT /api/settings` returns 200 for an `admin`-role JWT
- [ ] `GET /api/settings` returns 200 for any valid JWT (auth users can read)
- [ ] `GET /api/auth/me` returns `{ id, email, role }` for a valid JWT
- [ ] `GET /api/auth/me` returns 401 for a missing or invalid JWT
- [ ] `GET /api/admin/system` returns 403 for `operator` role (admin-only, no regression)
- [ ] Admin nav link is absent from the Sidebar when logged in as `user`
- [ ] Admin nav link is absent from the Sidebar when logged in as `operator`
- [ ] Admin nav link is present in the Sidebar when logged in as `admin`
- [ ] Visiting `/admin` directly as `operator` or `user` still shows "Not authorised"

---

## Test Plan

1. `npm run dev` — start both server and client.
2. Log in as an `admin` user → Admin nav link visible in sidebar.
3. Create a `user`-role account via Admin panel → log in as that user:
   - Admin nav link absent.
   - `PUT /api/settings` (curl or UI save) → 403.
   - `GET /api/settings` → 200.
4. Promote the account to `operator` via Admin panel → log in as operator:
   - Admin nav link still absent.
   - `PUT /api/settings` → 200 (can save settings).
   - `GET /api/admin/system` → 403.
5. Regression: log back in as admin → all routes work, Admin link visible.
6. Confirm `badshuffle.lock` is written on server start and deleted on clean shutdown.
7. Start server, start it again → console shows "Terminating previous instance".
