# BadShuffle — TODO / FIXME / Unfinished

Aggregated from the codebase and existing `ai/` docs. No inline `TODO`/`FIXME` comments were found in project source (only in node_modules).

---

## From ai/TODO.md (Backlog)

- [ ] **Email notification on role change** — When admin changes a user’s role via PUT /api/admin/users/:id/role, send an email to that user. SMTP is already wired; call mailer from admin route.
- [ ] **Role badge in top nav** — Small “Admin” / “Operator” badge next to user email in header. Data already available (role in App.jsx → Sidebar).
- [ ] **Contract sub-resource on quotes** — Already implemented (contracts table, Contract tab, public sign). No open task.
- [ ] **Lead timeline / activity log** — Already implemented (lead_events, GET /api/leads/:id/events, LeadsPage). No open task.

---

## From ai/STATUS.md and CURSOR_BRIEFING

- **Optional: wire POST /quotes/:id/send to real SMTP** — Already wired when SMTP is configured in Settings; “stub” only when Settings are not set.
- **Optional: preview pane in send modal** — Preview of email body or link to public quote in Send modal not implemented.
- **Optional: more target fields for lead import** — e.g. guest count, delivery address if sheet columns expand.

---

## API / Docs

- **API-first development:** See `ai/API_DEVELOPMENT.md` if present. New or changed features that expose data should be reflected in v1 and OpenAPI (`server/api/openapi.json`).

---

## Priority (where obvious)

| Item | Priority | Note |
|------|----------|------|
| Role badge in top nav | Low | UX polish; role already available |
| Email on role change | Low | Improves safety/UX for role changes |
| Send modal preview | Low | Nice-to-have |
| Lead import extra fields | Low | When needed for sheet format |

No high/critical TODOs identified in the scanned codebase.
