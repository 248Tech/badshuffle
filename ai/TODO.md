# TODO

## Active: Extension download auth, Sheets 400 error, Leads wording

### Fix 1 — Extension download endpoint (server/index.js)

- [ ] Move `app.use('/api/extension', ...)` from the protected block to the public block
      (alongside `/api/auth` and `/api/health`)
- [ ] Remove the `auth` middleware argument from that line
- [ ] Verify: `curl http://localhost:3001/api/extension/download -o test.zip` succeeds
      without an Authorization header

### Fix 2 — Google Sheets 400 error (server/lib/sheetsParser.js)

- [ ] In `fetchCsv`, extend the access-error condition on line 24 to include status 400:
      change `resp.status === 401 || resp.status === 403`
      to     `resp.status === 400 || resp.status === 401 || resp.status === 403`
- [ ] Do NOT modify `sheetUrlToCsvUrl` — URL conversion is correct
- [ ] Verify: a private (non-published) Google Sheet URL now returns the
      "Sheet is not publicly accessible" message instead of "400 Bad Request"

### Fix 3 — Leads counter wording (client/src/pages/ImportPage.jsx)

- [ ] In `LeadsPreview`, change the label from
      `{total} leads scraped from Goodshuffle`
      to `{total} leads in database`
- [ ] Update the empty-state paragraph text: remove "Browse Goodshuffle quote pages"
      and replace with something accurate (e.g. "Import a sheet or use the extension to capture contacts.")
- [ ] Do NOT change the `api.getLeads` call or `total` binding — the count logic is correct

### Coordination (required at end of session)

- [ ] Update `ai/STATUS.md` with completed tasks, files changed, and verification notes
- [ ] `git diff HEAD > ai/LAST.patch`
- [ ] `git status --porcelain > ai/LAST.status`

---

## Completed in previous sessions

- [x] Create `server/services/singleInstance.js`
- [x] Wire singleInstance into `server/index.js`
- [x] Create `server/services/updateCheck.js`
- [x] Wire updateCheck into `server/index.js`
- [x] Seed system settings in `server/db.js`
- [x] Add GET/PUT `/api/admin/system` and PUT `/api/admin/users/:id/role`
- [x] Add `api.admin.getSystemSettings`, `updateSystemSettings`, `changeRole`
- [x] Add System tab + toggles to `AdminPage.jsx`
- [x] Add role picker to AdminPage users table
- [x] Add `api.auth.me()` to `client/src/api.js`

## Backlog

- [ ] Create `server/lib/operatorMiddleware.js` (`requireOperator`)
- [ ] Apply operator guard to `PUT /api/settings`
- [ ] Add `GET /api/auth/me` endpoint to `server/routes/auth.js`
- [ ] Thread `role` prop through App → Layout → Sidebar; hide Admin link for non-admins
- [ ] Role badge in top nav
- [ ] Email notification on role change
