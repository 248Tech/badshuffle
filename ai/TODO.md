# TODO

## Active: Stability Foundations + Sales Workflow

### Phase A — Stability (Verification Only)

- [x] A1 — Verify DB persistence: sql.js writes badshuffle.db after every mutation; path is pkg-aware (no changes needed)
- [x] A2 — Verify audit fields: items.created_at, items.updated_at exist; PUT handler sets updated_at (no changes needed)
- [ ] A3 — Image display fix: investigate photo_url rendering; ensure proxy route exists at /api/proxy-image; apply api.proxyImageUrl() in image components (see HANDOFF A3)

### Phase B — Sales Workflow

- [ ] B1 — DB migrations: ALTER TABLE quotes ADD COLUMN status/lead_id/public_token; ALTER TABLE leads ADD COLUMN quote_id; create unique index on quotes.public_token (server/db.js)
- [ ] B2 — Quote status routes: POST /api/quotes/:id/send, /approve, /revert; update PUT to accept lead_id (server/routes/quotes.js)
- [ ] B3 — Public quote endpoint: GET /api/quotes/public/:token (unauthenticated, registered in server/index.js public block)
- [ ] B4 — Lead PUT endpoint: accept quote_id linkage; accept quote_id on POST (server/routes/leads.js)
- [ ] B5 — Client API: add sendQuote, approveQuote, revertQuote, getPublicQuote, updateLead (client/src/api.js)
- [ ] B6 — QuotePage UI: status badge, Send to Client button, Copy Link button (client/src/pages/QuotePage.jsx + .module.css)
- [ ] B7 — Public quote page: new PublicQuotePage.jsx with read-only view + print button; add /quote/public/:token public route to App.jsx
- [ ] B8 — Verify print/export: window.print() in PublicQuotePage triggers browser print dialog; @media print hides buttons (no new packages)

### Phase C — Roles and Permissions

- [ ] C1 — Create server/lib/operatorMiddleware.js (requireOperator: admin or operator role required)
- [ ] C2 — Apply requireOperator to PUT /api/settings in server/index.js
- [ ] C3 — Add GET /api/auth/me endpoint to server/routes/auth.js
- [ ] C4 — Client role awareness: fetch api.auth.me() in App.jsx; pass role to Sidebar; hide Admin nav link for non-admin
- [ ] C5 — Upgrade extension-token endpoint to admin/operator guard in server/routes/auth.js

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
- [x] Move `/api/extension` to public block (remove auth middleware)
- [x] Extend sheetsParser.js 400 to access-error check
- [x] Update LeadsPreview label to "leads in database"
- [x] Update LeadsPreview empty-state text

## Backlog

- [ ] Email notification on role change
- [ ] Role badge in top nav
- [ ] Contract sub-resource on quotes (contracts table, PDF contract generation)
- [ ] Lead timeline / activity log
