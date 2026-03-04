# TODO

## Active: Stability Foundations + Sales Workflow

### Phase A — Stability (Verification Only)

- [x] A1 — Verify DB persistence: sql.js writes badshuffle.db after every mutation; path is pkg-aware (no changes needed)
- [x] A2 — Verify audit fields: items.created_at, items.updated_at exist; PUT handler sets updated_at (no changes needed)
- [x] A3 — Image display fix: investigate photo_url rendering; ensure proxy route exists at /api/proxy-image; apply api.proxyImageUrl() in image components (see HANDOFF A3)

### Phase B — Sales Workflow

- [x] B1 — DB migrations: ALTER TABLE quotes ADD COLUMN status/lead_id/public_token; ALTER TABLE leads ADD COLUMN quote_id; create unique index on quotes.public_token (server/db.js)
- [x] B2 — Quote status routes: POST /api/quotes/:id/send, /approve, /revert; update PUT to accept lead_id (server/routes/quotes.js)
- [x] B3 — Public quote endpoint: GET /api/quotes/public/:token (unauthenticated, registered in server/index.js public block)
- [x] B4 — Lead PUT endpoint: accept quote_id linkage; accept quote_id on POST (server/routes/leads.js)
- [x] B5 — Client API: add sendQuote, approveQuote, revertQuote, getPublicQuote, updateLead (client/src/api.js)
- [x] B6 — QuotePage UI: status badge, Send to Client button, Copy Link button (client/src/pages/QuoteDetailPage.jsx + .module.css)
- [x] B7 — Public quote page: new PublicQuotePage.jsx with read-only view + print button; add /quote/public/:token public route to App.jsx
- [x] B8 — Verify print/export: window.print() in PublicQuotePage triggers browser print dialog; @media print hides buttons (no new packages)

### Phase C — Roles and Permissions

- [x] C1 — Create server/lib/operatorMiddleware.js (requireOperator: admin or operator role required)
- [x] C2 — Apply requireOperator to /api/settings in server/index.js
- [x] C3 — Add GET /api/auth/me endpoint to server/routes/auth.js
- [x] C4 — Client role awareness: fetch api.auth.me() in App.jsx; pass role to Sidebar; hide Admin nav link for non-admin
- [x] C5 — Upgrade extension-token endpoint to admin guard in server/routes/auth.js

### Coordination (required at end of session)

- [x] Update `ai/STATUS.md` with completed tasks, files changed, and verification notes
- [x] `git diff HEAD > ai/LAST.patch`
- [x] `git status --porcelain > ai/LAST.status`

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
