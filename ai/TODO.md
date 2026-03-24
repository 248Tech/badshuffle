# BadShuffle — TODO / FIXME / Unfinished

Aggregated from the codebase and existing `ai/` docs. Updated 2026-03-23.

---

## 🎨 UX Redesign — Active Sprint

See full design spec: `ai/UXDesign/BADSHUFFLE_REDESIGN.md`

### Phase 1 — Foundation (start here)

- [ ] **UX-1: Background layer separation**
  - Scope: UI only — 1 line change
  - Files: `client/src/theme.css`
  - Behavior: Change `body { background: var(--color-bg) }` → `body { background: var(--color-surface) }`. Immediately creates foreground/background depth on all screens.
  - Priority: **Critical** — highest ROI change in the entire project
  - Next tool: Aider
  - Follow-up: Cursor (verify all 4 themes look correct)

- [ ] **UX-2: Add derived color tokens**
  - Scope: UI only
  - Files: `client/src/theme.css`
  - Behavior: Add `--color-primary-subtle` and `--color-primary-hover` using `color-mix()` to all 5 `:root` blocks (default + 4 themes). These replace scattered inline `rgba()` calls throughout the codebase.
  - Priority: **Critical** — required by sidebar, quote builder, and inventory changes
  - Next tool: Aider
  - Follow-up: Cursor (grep for remaining inline rgba primary references and replace)

- [ ] **UX-3: Button active micro-interaction**
  - Scope: UI only
  - Files: `client/src/theme.css`
  - Behavior: Add `transition: ..., transform 0.1s` and `.btn:active { transform: scale(0.97) }` to the `.btn` class. Every button in the app presses visually.
  - Priority: **High**
  - Next tool: Aider

- [ ] **UX-4: Card hover elevation**
  - Scope: UI only
  - Files: `client/src/theme.css`
  - Behavior: Add `transition: box-shadow 0.2s ease` and `.card:hover { box-shadow: var(--shadow-md) }` to `.card`. Do NOT add `transform` to generic `.card` — only lift transforms for inventory cards.
  - Priority: **High**
  - Next tool: Aider

- [ ] **UX-5: Content area padding + max-width**
  - Scope: UI only
  - Files: `client/src/components/Layout.module.css`
  - Behavior: Main content area gets `padding: 24px 32px`, `max-width: 1440px`. Mobile: `padding: 16px`. Adds breathing room across all pages.
  - Priority: **High**
  - Next tool: Aider
  - Follow-up: Cursor (check for pages that override layout padding with their own and normalize)

- [ ] **UX-6: Sidebar active state upgrade**
  - Scope: UI only
  - Files: `client/src/components/Sidebar.module.css`
  - Behavior: Active nav item gets pill background (`var(--color-primary-subtle)`) + left accent bar (3px, `var(--color-primary)`). Hover state gets `var(--color-primary-hover)` background. Section groups get 20–24px vertical gap. See design memo section 6.2 for exact CSS.
  - Priority: **High**
  - Next tool: Aider
  - Follow-up: Cursor (verify all themes, check icon alignment)

---

### Phase 2 — Core Screens

- [ ] **UX-7: Dashboard KPI card redesign**
  - Scope: UI only — no data changes
  - Files: `client/src/pages/DashboardPage.jsx`, `client/src/pages/DashboardPage.module.css`
  - Behavior: KPI cards get left accent border (4px, `--color-primary`/`--color-success`/`--color-accent`), value at 28px bold, label at 12px muted uppercase. Each KPI card wrapped in `.card`. See design memo section 7.1 for exact CSS classes.
  - Priority: **High**
  - Next tool: Aider
  - Follow-up: Cursor (spacing consistency, icon sizing if icons are added)

- [ ] **UX-8: Dashboard empty states**
  - Scope: UI only
  - Files: `client/src/pages/DashboardPage.jsx`, `DashboardPage.module.css`
  - Behavior: All empty sections (no upcoming events, no conflicts, no activity) use `.empty-state` utility class with descriptive message + action link. No blank/dead sections.
  - Priority: **Medium**
  - Next tool: Cursor

- [ ] **UX-9: Inventory filter bar — single-row scroll**
  - Scope: UI only
  - Files: `client/src/pages/InventoryPage.module.css`
  - Behavior: Category pill bar becomes `overflow-x: auto`, `flex-wrap: nowrap`, scrollbar hidden. Active pill filled (`var(--color-primary)` bg, white text), inactive outlined. Single horizontal row regardless of category count.
  - Priority: **High**
  - Next tool: Aider

- [ ] **UX-10: Inventory item card — hover overlay + lift**
  - Scope: UI only
  - Files: `client/src/components/ItemCard.jsx`, `client/src/components/ItemCard.module.css`
  - Behavior: Card gets `overflow: hidden`, image at 4:3 aspect-ratio. Hover state shows overlay div (rgba dark) with "Add to Quote" + "Edit" buttons centered. At rest: no action buttons visible. Card lifts on hover: `transform: translateY(-2px)`, `box-shadow: var(--shadow-md)`. Out-of-stock badge overlaid on image (bottom-left). Existing click behavior unchanged.
  - Priority: **High**
  - Next tool: Aider
  - Follow-up: Cursor (image loading states, placeholder styling)

- [ ] **UX-11: Table row styling — Leads page**
  - Scope: UI only
  - Files: `client/src/pages/LeadsPage.module.css`
  - Behavior: `td { padding: 14px 16px }`. Row hover: `background: var(--color-surface)`. Header: 11px uppercase, sticky, `background: var(--color-surface)`. Remove heavy inner borders. Key column (name) semibold. Table wrapped in `.card`. See design memo section 7.5.
  - Priority: **Medium**
  - Next tool: Aider

- [ ] **UX-12: Table row styling — Billing page**
  - Scope: UI only
  - Files: `client/src/pages/BillingPage.module.css`
  - Behavior: Same treatment as UX-11 (Leads). Apply consistently.
  - Priority: **Medium**
  - Next tool: Aider

---

### Phase 3 — Critical Flow

- [ ] **UX-13: Quote Builder item cards**
  - Scope: UI only — no data or logic changes
  - Files: `client/src/components/QuoteBuilder.jsx`, `client/src/components/QuoteBuilder.module.css`
  - Behavior: Each quote line item becomes a card (not a table row). Layout: drag handle → thumbnail (56×56) → info block → discount badge → qty controls → unit price → line total → remove (hover only). See design memo section 7.3 for exact CSS. Drag behavior unchanged.
  - Priority: **Critical**
  - Next tool: Aider
  - Follow-up: Cursor (spacing, mobile collapse behavior)

- [ ] **UX-14: Quote Builder — add-to-quote flash animation**
  - Scope: UI only
  - Files: `client/src/components/QuoteBuilder.jsx`, `QuoteBuilder.module.css`
  - Behavior: When a new item is added to the quote, the new item card animates in with a 400ms background flash (`addedFlash` keyframe: primary-subtle → bg). Class added on mount, removed after animation. No toast needed for this action.
  - Priority: **Medium**
  - Next tool: Cursor

- [ ] **UX-15: Quote Builder — summary panel sticky + total emphasis**
  - Scope: UI only
  - Files: `client/src/components/QuoteBuilder.module.css`, `client/src/pages/QuoteDetailPage.module.css`
  - Behavior: Summary panel gets `position: sticky`, `top: 20px`, `box-shadow: var(--shadow-md)`. Total line: 24px, bold, `color: var(--color-primary)`. "Send to Client" button: full width, `btn-primary`, bottom of summary panel. Secondary actions (Copy Link, Duplicate, Export) grouped as a row below primary CTA. Delete: small, `--color-danger`, separated below. Top action bar cleaned up: quote name + status badge left; Save + secondary dropdown right.
  - Priority: **Critical**
  - Next tool: Aider
  - Follow-up: Cursor (sticky behavior on mobile, overflow scroll)

- [ ] **UX-16: Import flow — stepper component**
  - Scope: UI only — no data or API changes
  - Files: `client/src/pages/ImportPage.jsx`, `client/src/pages/ImportPage.module.css`
  - New file: `client/src/components/Stepper.jsx` (optional extraction)
  - Behavior: Add a stepper (step indicators + connector line) above the content in each ImportPage tab that has multiple steps. Each step's content isolated in a `.card`. Only active step is expanded. Stepper shows: Upload → Map Columns → Review & Import. "Next" button advances step. "Back" button regresses. Final step shows "Import" as primary CTA. Existing upload/mapping/review logic unchanged.
  - Priority: **High**
  - Next tool: Aider
  - Follow-up: Cursor (step transition animation, mobile layout)

- [ ] **UX-17: Messages empty state + thread list upgrade**
  - Scope: UI only
  - Files: `client/src/pages/MessagesPage.jsx`, `client/src/pages/MessagesPage.module.css`
  - Behavior: Empty state: large icon + "No messages yet" + "Start a conversation by sending a quote to a client" + "→ Go to Quotes" link. Thread list rows: 56px min-height, contact name bold, quote name muted, last message preview truncated, timestamp right-aligned, unread badge. Active thread: `--color-primary-subtle` bg + left accent. Message bubbles: outbound right-aligned primary-subtle bg, inbound left-aligned surface bg, 75% max-width, rounded corners.
  - Priority: **Medium**
  - Next tool: Aider
  - Follow-up: Cursor (bubble alignment edge cases)

---

### Phase 4 — Polish

- [ ] **UX-18: Skeleton loaders**
  - Scope: UI only
  - Files: `client/src/theme.css`, then per-page files
  - Behavior: Add `.skeleton` shimmer class to `theme.css`. Replace `Loading…` text and spinner-only states with skeleton placeholders on: Dashboard KPI area, Inventory grid, Quote item list, Table bodies.
  - Priority: **Medium**
  - Next tool: Cursor

- [ ] **UX-19: Cross-theme QA pass**
  - Scope: QA only
  - Files: none (visual review)
  - Behavior: Load all 4 themes (default, shadcn, material, chakra). Verify: background separation works, primary-subtle derived token renders correctly, sidebar active state visible, KPI accents visible, no hardcoded color escapes into wrong theme color.
  - Priority: **High** (must happen before any merge)
  - Next tool: Cursor

- [ ] **UX-20: Mobile responsive pass**
  - Scope: UI only
  - Files: QuoteBuilder, ImportPage, MessagesPage, Tables
  - Behavior: QuoteBuilder two-panel stacks vertically at <1024px. Import stepper becomes compact at <768px. Messages split-pane collapses to single-pane with back navigation. All tables get horizontal scroll container at <768px.
  - Priority: **Medium**
  - Next tool: Cursor

---

## Active / In-Progress (Existing Backlog)

### Post-v0.0.3 polish backlog

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
- [ ] **Role badge in top nav** — Small "Admin" / "Operator" badge next to user email in header. Data already available (role in App.jsx → Sidebar).
- [ ] **Email notification on role change** — When admin changes a user's role via `PUT /api/admin/users/:id/role`, send an email to that user. SMTP is already wired.

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

## Priority Summary

| Item | Priority | Agent | Note |
|------|----------|-------|------|
| UX-1: Background separation | Critical | Aider | 1 line, instant improvement |
| UX-2: Derived color tokens | Critical | Aider | Unblocks sidebar + inventory work |
| UX-3: Button active scale | High | Aider | Global, immediate feel improvement |
| UX-4: Card hover elevation | High | Aider | Global |
| UX-5: Layout padding | High | Aider | Global breathing room |
| UX-6: Sidebar active state | High | Aider | Key navigation clarity |
| UX-7: Dashboard KPI cards | High | Aider | High visibility |
| UX-9: Inventory filter bar | High | Aider | Stops category pill chaos |
| UX-10: Inventory item cards | High | Aider | Major visual improvement |
| UX-13: Quote item cards | Critical | Aider | Money screen |
| UX-15: Summary panel | Critical | Aider | Money screen |
| UX-16: Import stepper | High | Aider | Flow clarity |
| UX-11/12: Table styling | Medium | Aider | Scanability |
| UX-17: Messages | Medium | Aider | Empty state fix |
| UX-14: Add-flash animation | Medium | Cursor | Polish |
| UX-18: Skeleton loaders | Medium | Cursor | Polish |
| UX-19: Theme QA | High | Cursor | Pre-merge gate |
| UX-20: Mobile pass | Medium | Cursor | After desktop is solid |
| Task 13: Condense venue block | Medium | Cursor | UI polish |
| Task 14: Mobile optimization | Medium | Cursor | Responsive |
