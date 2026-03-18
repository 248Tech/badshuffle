# BadShuffle — TODO / FIXME / Unfinished

Aggregated from the codebase and existing `ai/` docs. Updated 2026-03-18.

---

## Active / In-Progress

### Post-v0.4.5 polish backlog

- [ ] **Task 13: Condense client/venue info display** — QuoteDetailPage view mode: make the client/venue info block more compact (tighter layout, less vertical whitespace). Edit form is fine; view-mode display needs condensing.
- [ ] **Task 14: Mobile optimization** — Responsive layout pass. Known pain points: QuoteBuilder on narrow screens (table overflow), QuoteDetailPage tabs, MessagesPage split-pane, modals. Start with `@media (max-width: 640px)` rules in the heavy pages.

---

## Backlog (not yet scheduled)

### Quote builder
- [ ] **Drag-nest accessories (2-second hover)** — When dragging a quote item over another for 2 seconds, nest it as a temporary accessory under that item. Item accessories (permanent) are now stored in `item_accessories`; the auto-add-on-quote-item feature (add parent → accessories auto-appear) is not yet implemented.
- [ ] **Auto-add permanent accessories** — When a product is added to a quote, automatically add its `item_accessories` as hidden/sub-items. Schema exists (`item_accessories` table); no route or UI implements the auto-add yet.

### Templates / TemplatesPage
- [ ] **Preview pane in send modal** — Render email body or public quote link preview in the Send to Client modal before sending.

### Inventory
- [ ] **Outbound message attachment info** — Show info about attached quote/image in message detail view in MessagesPage (item 16 from original batch; messages currently show thread but not attachment metadata).

### Auth / admin
- [ ] **Role badge in top nav** — Small “Admin” / “Operator” badge next to user email in header. Data already available (role in App.jsx → Sidebar).
- [ ] **Email notification on role change** — When admin changes a user’s role via `PUT /api/admin/users/:id/role`, send an email to that user. SMTP is already wired.

### Lead import
- [ ] **More target fields** — e.g. guest count, delivery address if sheet columns expand.

---

## API / Docs

- **OpenAPI spec** — `server/api/openapi.json` has not been updated for recent additions (per-item discounts, quote expiration, payment policies, rental terms, item accessories, reorder endpoint). Update if API consumers rely on the spec.

---

## Verified / No Action Needed

- DB persistence (`sql.js` writes to disk after every mutation) — confirmed working.
- Audit fields (`items.updated_at`, `quotes.updated_at`) — already set on PUT. No change needed.
- Contract sub-resource — fully implemented.
- Lead timeline / activity log — fully implemented.
- SMTP send — wired when `smtp_host` is configured in Settings; stub only when not configured.

---

## Priority

| Item | Priority | Note |
|------|----------|------|
| Task 13: condense client/venue display | Medium | UI polish, quick CSS/layout change |
| Task 14: mobile optimization | Medium | Usability on phones/tablets |
| Auto-add permanent accessories | Medium | Completes the accessories feature loop |
| Drag-nest temporary accessories | Low | Complex DnD interaction |
| Send modal preview | Low | Nice-to-have |
| Role badge in nav | Low | Data already available |
| Email on role change | Low | SMTP already wired |
| OpenAPI spec sync | Low | Only matters if API consumers use the spec |
