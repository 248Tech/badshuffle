# BadShuffle — TODO / FIXME / Unfinished

Aggregated from the codebase and existing `ai/` docs. Updated 2026-03-24.

---

## 🎨 UX Redesign — Active Sprint

See full design spec: `ai/UXDesign/BADSHUFFLE_REDESIGN.md`

### Phase 1 — Foundation ✅ COMPLETE

- [x] **UX-1: Background layer separation** — done (`body { background: var(--color-surface) }` in theme.css)
- [x] **UX-2: Add derived color tokens** — done (`--color-primary-subtle`, `--color-primary-hover` in all 5 `:root` blocks)
- [x] **UX-3: Button active micro-interaction** — done (`.btn:active { transform: scale(0.97) }`)
- [x] **UX-4: Card hover elevation** — done (`.card:hover { box-shadow: var(--shadow-md) }`)
- [x] **UX-5: Content area padding + max-width** — done (`padding: 24px 32px`, `max-width: 1440px` on `.mainInner`)
- [x] **UX-6: Sidebar active state upgrade** — done (left accent bar + hover state)

---

### Phase 2 — Core Screens ✅ COMPLETE

- [x] **UX-7: Dashboard KPI card redesign** — done (`border-left: 4px solid var(--color-primary)`, 30px bold values)
- [x] **UX-8: Dashboard empty states** — done (`.empty-state` used throughout dashboard sections)
- [x] **UX-9: Inventory filter bar — single-row scroll** — done (`overflow-x: auto`, `flex-wrap: nowrap` in InventoryPage.module.css)
- [x] **UX-10: Inventory item card — hover overlay + lift** — done (ItemCard.module.css: overlay, 4:3 image, `translateY(-2px)`)
- [x] **UX-11: Table row styling — Leads page** — done (`padding: 14px 16px`, sticky header, hover state)
- [x] **UX-12: Table row styling — Billing page** — done (same treatment applied)

---

### Phase 3 — Critical Flow ✅ COMPLETE

- [x] **UX-13: Quote Builder item cards** — done (padding upgraded to `12px 14px`, thumbnail 48×48, hover shadow, `border-radius: var(--radius)`)
- [x] **UX-14: Quote Builder — add-to-quote flash animation** — done (`newlyAddedItemId` state, `quoteItemAdded` class applied on add)
- [x] **UX-15: Quote Builder — summary panel sticky + total emphasis** — done (`.exportCol { position: sticky; top: 24px }`, `.totalsValueGrand { font-size: 24px; color: var(--color-primary) }`)
- [x] **UX-16: Import flow — stepper component** — done (STEPS array, step state, `.stepper` CSS in ImportPage)
- [x] **UX-17: Messages empty state + thread list upgrade** — done (`.empty` with icon, thread rows `min-height: 56px`, active state)

---

### Phase 4 — Polish 🔄 IN PROGRESS

- [x] **UX-18: Skeleton loaders** — done (ItemGrid: 8-card skeleton grid + CSS; DashboardPage: KPI + chart skeletons; LeadsPage: skeleton table rows)
- [ ] **UX-19: Cross-theme QA pass** — Manually load all 4 themes (default, shadcn, material, chakra). Verify: background separation, primary-subtle token, sidebar active, KPI accents. **Requires visual review.**
- [ ] **UX-20: Mobile responsive pass** — QuoteBuilder two-panel stacks at <1024px, import stepper compact at <768px, messages split-pane collapses, all tables get horizontal scroll at <768px. **(Partially done — needs spot-check.)**

---

## 🐛 Bug / Theme Compat Fixes ✅ DONE THIS SESSION

- [x] `FilesPage.module.css` — `var(--color-bg-elevated)` undefined → `var(--color-surface)`
- [x] `DashboardPage.module.css` — hardcoded `#1a8fc1` → `var(--color-primary)`
- [x] `DashboardPage.jsx` — inline `borderLeftColor: '#1a8fc1'` removed; `#16b2a5` → `var(--color-accent)`; bar fallback → `var(--color-primary)`
- [x] Focus rings (`rgba(26,143,193,0.12)`) → `var(--color-primary-subtle)` in InventoryPage, LeadsPage, QuotePage
- [x] `Layout.module.css` — added `max-width: 1440px` on `.mainInner`

---

## Active / In-Progress (Existing Backlog)

- [ ] **Task 13: Condense client/venue info display** — QuoteDetailPage view mode: make the client/venue info block more compact (tighter layout, less vertical whitespace).
- [ ] **Task 14: Mobile optimization** — Responsive layout pass. Known pain points: QuoteBuilder on narrow screens (table overflow), QuoteDetailPage tabs, MessagesPage split-pane, modals.

---

## 🚀 New: Performance & Optimization

- [ ] **PERF-1: Lazy-load page components** — Currently all pages are bundled together. Add `React.lazy()` + `Suspense` for heavy pages (QuoteDetailPage, ImportPage, SettingsPage, AdminPage). Reduces initial bundle parse time.
  - Files: `client/src/App.jsx`
  - Priority: **High**

- [x] **PERF-2: Image lazy loading** — done (`loading="lazy"` added to ItemCard.jsx img tags). Still needed: `FilesPage.jsx`, `PublicCatalogPage.jsx`.
  - Files: `FilesPage.jsx`, `PublicCatalogPage.jsx` (remaining)
  - Priority: **High** — inventory grids can have 200+ images

- [ ] **PERF-3: Debounce search inputs** — Several search inputs (QuotePage filter, InventoryPage) trigger API calls on every keystroke. Unify debounce to 300ms across all search inputs.
  - Files: `InventoryPage.jsx`, `QuotePage.jsx`, `BillingPage.jsx`
  - Priority: **Medium**

- [ ] **PERF-4: Memoize QuoteBuilder item list** — `QuoteBuilder.jsx` re-renders the full item list on every `localQty` keystroke. Wrap item map in `useMemo` keyed to `items` and `newlyAddedItemId`.
  - Files: `QuoteBuilder.jsx`
  - Priority: **Medium**

- [ ] **PERF-5: Virtual list for large inventory grids** — Inventory grids with 500+ items cause jank. Consider `react-window` or manual `IntersectionObserver` pagination. (Already has server-side pagination in QuoteBuilder picker — extend to InventoryPage grid.)
  - Files: `InventoryPage.jsx`, `ItemGrid.jsx`
  - Priority: **Low** (pagination mitigates this for most users)

---

## ♿ Accessibility (a11y)

- [x] **A11Y-1: Add `aria-label` to icon-only buttons** — done for ItemCard overlay buttons and QuoteBuilder remove button. Remaining: drag handles ⠿ in QuoteBuilder. — Several buttons render only emoji/SVG with no text (e.g., remove buttons `×`, drag handles ⠿, overlay action buttons in ItemCard). Screen readers announce nothing useful.
  - Files: `QuoteBuilder.jsx`, `ItemCard.jsx`, `ItemCard.module.css`
  - Priority: **High**

- [ ] **A11Y-2: Keyboard navigation for inventory card overlay** — The hover overlay on ItemCard (Add to Quote / Edit) is unreachable by keyboard. Add `tabIndex` to the card and show overlay on `:focus-within`.
  - Files: `ItemCard.jsx`, `ItemCard.module.css`
  - Priority: **High**

- [ ] **A11Y-3: Focus trap in modals** — Modals (delete confirm, discount edit, custom item form) do not trap focus — Tab escapes the modal into background content.
  - Files: `QuoteDetailPage.jsx`, `QuoteBuilder.jsx`, modal components
  - Priority: **Medium**

- [x] **A11Y-4: `role="status"` on toast notifications** — done (`role="status"`, `aria-live="polite"`, `aria-atomic="false"` added to Toast container) — The Toast component should announce messages to screen readers via `aria-live="polite"`.
  - Files: `client/src/components/Toast.jsx`
  - Priority: **Medium**

- [ ] **A11Y-5: Color-only status indicators** — Several status badges rely solely on color (red/green/yellow) with no icon or label difference. Fails WCAG 1.4.1 (Use of Color).
  - Files: `QuoteCard.jsx`, `DashboardPage.jsx`, `BillingPage.jsx`
  - Priority: **Medium**

- [ ] **A11Y-6: Proper heading hierarchy** — Most pages use `<h1>` for the page title but skip to `<h3>` for sections. Fix to sequential `h1 → h2 → h3`.
  - Files: Multiple page files
  - Priority: **Low**

---

## 🔍 SEO / Meta (for public-facing pages)

- [x] **SEO-1: `<title>` and `<meta description>` on public quote page** — done (`document.title = quote.name + ' — Quote'` set on load in PublicQuotePage.jsx) — `PublicQuotePage.jsx` renders with no page title or description. Clients who receive a quote link see a blank browser tab title. Add dynamic `<title>` via `document.title = quoteData.event_name`.
  - Files: `PublicQuotePage.jsx`
  - Priority: **High** — client-facing

- [ ] **SEO-2: Open Graph tags on public catalog** — `PublicCatalogPage.jsx` and `PublicItemPage.jsx` are public pages. Add `<meta property="og:title">`, `og:description`, `og:image` via `react-helmet` or direct `document.querySelector`.
  - Files: `PublicCatalogPage.jsx`, `PublicItemPage.jsx`
  - Priority: **Medium**

- [ ] **SEO-3: Canonical URL on public pages** — Public quote, catalog, and item pages should have `<link rel="canonical">` to avoid duplicate content if accessed through multiple URL patterns.
  - Files: `PublicQuotePage.jsx`, `PublicCatalogPage.jsx`, `PublicItemPage.jsx`
  - Priority: **Low** (app is a SaaS tool; public pages have limited SEO value)

---

## 🤝 User-Friendliness / UX Quality

- [ ] **UXQ-1: Unsaved changes warning** — QuoteDetailPage edit form doesn't warn before navigating away with unsaved changes. Use `useBeforeUnload` + `useBlocker` (React Router v6) to show a confirmation dialog.
  - Files: `QuoteDetailPage.jsx`
  - Priority: **High** — users lose work silently

- [x] **UXQ-2: Empty search results message** — done for LeadsPage (contextual "No leads match X" + Clear button) and InventoryPage/ItemGrid (contextual "No items match X" + Clear button) — When a search returns 0 results, show "No results for [query]" with a clear/reset button. Currently just shows an empty table with no explanation.
  - Files: `LeadsPage.jsx`, `BillingPage.jsx`, `QuotePage.jsx`, `InventoryPage.jsx`
  - Priority: **High**

- [ ] **UXQ-3: Confirm before destructive actions** — Delete buttons (delete quote, delete item, delete lead, bulk delete files) trigger immediately or with a basic `window.confirm()`. Replace with inline confirm UI (button turns red + "Are you sure?" inline).
  - Files: Multiple pages
  - Priority: **High**

- [ ] **UXQ-4: Keyboard shortcut to add item in QuoteBuilder** — Power users editing quotes should be able to type to search inventory and press Enter to add. Currently requires mouse click.
  - Files: `QuoteBuilder.jsx`
  - Priority: **Medium**

- [ ] **UXQ-5: Print-friendly quote export** — `QuoteExport.module.css` exists with print styles but print action is buried. Add a keyboard shortcut `Ctrl+P` interceptor on QuoteDetailPage that triggers the export print view.
  - Files: `QuoteDetailPage.jsx`
  - Priority: **Medium**

- [ ] **UXQ-6: Autosave indicator** — When a quote field changes (qty, price), show a subtle "Saving…" → "Saved ✓" indicator near the summary panel. Currently no feedback that changes persisted.
  - Files: `QuoteBuilder.jsx`, `QuoteDetailPage.jsx`
  - Priority: **Medium**

- [x] **UXQ-7: Error boundary** — done (`ErrorBoundary.jsx` created, wraps `<App>` in `main.jsx`. Shows friendly message + reload button on crash) — The app has no React error boundary. A runtime error in any component crashes the entire UI with a blank screen. Add a top-level `<ErrorBoundary>` with a friendly fallback.
  - Files: `client/src/main.jsx` or `App.jsx`
  - Priority: **Medium**

- [ ] **UXQ-8: Back navigation on detail pages** — ItemDetailPage, QuoteDetailPage, and LeadsPage detail view have no clear "← Back" navigation. The browser back button works, but there's no in-app affordance.
  - Files: `ItemDetailPage.jsx`, `QuoteDetailPage.jsx`
  - Priority: **Low**

- [ ] **UXQ-9: `<title>` tag updates for app pages** — The browser tab always shows the default title. Each page should update `document.title` to reflect the current view (e.g., "Quote — John's Wedding | BadShuffle").
  - Files: All main page files
  - Priority: **Low**

---

## Backlog (not yet scheduled)

### Quote builder
- [ ] **Auto-add permanent accessories** — When a product is added to a quote, automatically add its `item_accessories` as sub-items. Schema exists (`item_accessories` table); no UI implements auto-add yet.
- [ ] **Drag-nest accessories (2-second hover)** — When dragging a quote item over another for 2 seconds, nest it as a temporary accessory under that item.

### Templates / TemplatesPage
- [ ] **Preview pane in send modal** — Render email body or public quote link preview in the Send to Client modal before sending.

### Inventory
- [ ] **Outbound message attachment info** — Show info about attached quote/image in message detail view in MessagesPage.

### Auth / admin
- [ ] **Role badge in top nav** — Small "Admin" / "Operator" badge next to user email in header. Data already available (role in App.jsx → Sidebar).
- [ ] **Email notification on role change** — When admin changes a user's role, send an email to that user. SMTP is already wired.

### Lead import
- [ ] **More target fields** — e.g. guest count, delivery address if sheet columns expand.

---

## API / Docs

- **OpenAPI spec** — `server/api/openapi.json` has not been updated for recent additions (per-item discounts, quote expiration, payment policies, rental terms, item accessories, reorder endpoint, templates, files). Update if API consumers rely on the spec.

---

## Verified / No Action Needed

- DB persistence (`sql.js` writes to disk after every mutation) — confirmed working.
- Audit fields (`items.updated_at`, `quotes.updated_at`) — already set on PUT.
- Contract sub-resource — fully implemented.
- Lead timeline / activity log — fully implemented.
- SMTP send — wired when `smtp_host` is configured in Settings.

---

## Priority Summary

| Item | Priority | Note |
|------|----------|-------|
| UX-19: Cross-theme QA | High | Pre-merge gate — visual review required |
| PERF-1: Lazy-load pages | High | Reduces initial parse time |
| PERF-2: Image lazy loading | High | 200+ images in inventory |
| A11Y-1: aria-label icon buttons | High | Screen reader baseline |
| A11Y-2: Keyboard inventory overlay | High | Tab navigation gap |
| SEO-1: Public quote `<title>` | High | Client-facing |
| UXQ-1: Unsaved changes warning | High | Data loss risk |
| UXQ-2: Empty search feedback | High | Dead-end UX |
| UXQ-3: Confirm destructive actions | High | Accidental deletion |
| UX-20: Mobile pass | Medium | After desktop solid |
| PERF-3: Debounce search | Medium | Excess API calls |
| A11Y-3: Focus trap in modals | Medium | Keyboard trap |
| UXQ-6: Autosave indicator | Medium | Trust + polish |
| UXQ-7: Error boundary | Medium | Crash resilience |
| Task 13: Condense venue block | Medium | View-mode polish |
