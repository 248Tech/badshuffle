# TODO

## Active: Role enforcement, route protection, UI role awareness

### Completed in previous session — verified, do not repeat

- [x] Create `server/services/singleInstance.js` (lockfile guard, taskkill on Windows)
- [x] Wire `singleInstance.acquire()` and `release()` in `server/index.js`
- [x] Create `server/services/updateCheck.js` (GitHub API, 12h throttle, graceful failure)
- [x] Wire `updateCheck.run(db)` after port-bind in `server/index.js` (non-blocking)
- [x] Seed system settings in `server/db.js` (`autokill_enabled`, `update_check_enabled`, `update_check_last`, `update_check_latest`, `update_available`)
- [x] Add `GET /api/admin/system` and `PUT /api/admin/system` to `server/routes/admin.js`
- [x] Add `PUT /api/admin/users/:id/role` with last-admin guard to `server/routes/admin.js`
- [x] Add `api.admin.getSystemSettings()`, `api.admin.updateSystemSettings()`, `api.admin.changeRole()` to `client/src/api.js`
- [x] Add System tab with toggle controls and version/update status to `client/src/pages/AdminPage.jsx`
- [x] Add role picker dropdown to user table in `client/src/pages/AdminPage.jsx`

---

### Remaining — Cursor to implement

#### Server

- [ ] Create `server/lib/operatorMiddleware.js`
  - Export `requireOperator(db)` factory
  - Allow `role === 'admin'` or `role === 'operator'`; deny `user` with 403
  - Mirror the pattern in `server/lib/adminMiddleware.js`

- [ ] Apply operator-level protection to `PUT /api/settings`
  - Options: inline middleware in `routes/settings.js` PUT handler, or apply in `index.js`
  - `GET /api/settings` must remain accessible to all auth users — do not over-restrict

- [ ] Add `GET /api/auth/me` to `server/routes/auth.js`
  - Verify Bearer JWT (same pattern as `GET /auth/extension-token`)
  - Return `{ id, email, role }` from the `users` table
  - Return 401 for invalid/missing JWT, 404 if user row not found

#### Client

- [ ] Add `api.auth.me()` to the `auth` section of `client/src/api.js`
  - Maps to `GET /auth/me`

- [ ] Fetch current user role in `client/src/App.jsx`
  - Call `api.auth.me()` inside `AuthGate` after status check passes
  - Store result in `role` state (`useState('')`)
  - Pass as `role` prop to `<Layout />`

- [ ] Thread `role` prop through `client/src/components/Layout.jsx`
  - Accept `role` prop; pass it to `<Sidebar role={role} />`
  - Read the file first — find exactly where `<Sidebar />` is rendered

- [ ] Gate Admin nav item in `client/src/components/Sidebar.jsx`
  - Accept `role` prop
  - In `NAV.map(...)`, skip items with `to: '/admin'` unless `role === 'admin'`

#### Coordination (required at end of session)

- [ ] Update `ai/STATUS.md` with completed tasks, files changed, commands used, and next steps
- [ ] `git diff HEAD > ai/LAST.patch`
- [ ] `git status --porcelain > ai/LAST.status`

---

## Backlog (not for this session)

- [ ] Add `role` to pending-count API so Sidebar doesn't need a separate `getUsers()` call
- [ ] Role badge in top nav / user avatar area
- [ ] Email notification when admin changes a user's role
- [ ] Enforce operator-level on `/api/leads` write endpoints (currently admin-only via middleware)
- [ ] Upgrade Node → 18 LTS; swap `sql.js` for `better-sqlite3` for improved performance
