# BadShuffle — TODO / FIXME / Unfinished

Prioritized as of 2026-03-27.
Top to bottom is the recommended execution order.

---

## P0 — Do Next

- [ ] **WF-5: Signature/compliance hardening**
  - Technical hardening has landed: immutable signed artifacts, signature event metadata, and `/api` + `/api/v1` parity.
  - Remaining work is policy/compliance review, legal wording, and any provider-backed e-sign decision.
  - Files: `server/services/quoteService.js`, `server/index.js`, `server/api/v1.js`, policy/legal requirements

- [ ] **UXQ-1: Unsaved changes warning**
  - Prevent silent data loss while editing quotes.
  - Files: `client/src/pages/QuoteDetailPage.jsx`

- [ ] **UXQ-3: Better destructive-action confirmation**
  - Replace bare `window.confirm()` / immediate delete paths with more deliberate UI.
  - Files: multiple pages/components

- [ ] **UX-19: Cross-theme QA pass**
  - Manual visual pass across all supported themes.
  - Files: theme + affected pages/components

- [ ] **UX-20: Mobile responsive pass**
  - Finish the remaining responsive cleanup on quote builder, detail pages, messages, tables, and modals.
  - Files: multiple client pages/components

---

## P1 — High Value Product Follow-up

- [ ] **WF-2: Export/print/PDF polish follow-up**
  - Section-aware rendering is now in place, but the signed-contract artifact is still a simple text-style PDF and may need richer presentational polish.
  - Files: `client/src/components/QuoteExport.jsx`, `server/services/quoteService.js`

- [ ] **WF-3: Section reordering**
  - Sections can be added/duplicated/deleted/renamed, but not reordered.
  - Files: `client/src/components/QuoteBuilder.jsx`, `server/routes/quotes.js`, `client/src/api.js`

- [ ] **WF-4: Custom-item description workflow**
  - Public quote can show custom-item descriptions, but there is no first-class editor flow.
  - Files: `client/src/pages/QuoteDetailPage.jsx`, `server/routes/quotes.js`, possibly `client/src/components/QuoteBuilder.jsx`

- [ ] **WF-6: Signed contract file UX polish**
  - Files tab now labels signed contract versions and locks audit artifacts, but a richer contract-history surface may still be useful.
  - Files: `client/src/pages/QuoteDetailPage.jsx`

- [ ] **Task 13: Condense client/venue info display**
  - Make QuoteDetail view mode tighter and more compact.
  - Files: `client/src/pages/QuoteDetailPage.jsx`

- [ ] **PERF-1: Lazy-load heavy page components**
  - Reduce initial JS parse/load time.
  - Files: `client/src/App.jsx`

- [ ] **PERF-3: Debounce search inputs**
  - Normalize search debounce behavior.
  - Files: `client/src/pages/InventoryPage.jsx`, `client/src/pages/QuotePage.jsx`, `client/src/pages/BillingPage.jsx`

- [ ] **A11Y-3: Focus trap in modals**
  - Tab navigation should stay inside open modals.
  - Files: modal components, `QuoteDetailPage.jsx`, `QuoteBuilder.jsx`

- [ ] **A11Y-5: Improve color-only status indicators**
  - Status meaning should not depend on color alone.
  - Files: `QuoteCard.jsx`, `DashboardPage.jsx`, `BillingPage.jsx`

- [ ] **OpenAPI spec refresh**
  - Spec is behind current routes/features.
  - Files: `server/api/openapi.json`

---

## P2 — Medium Priority Polish / Productivity

- [ ] **Task 14: Mobile optimization follow-up**
  - Secondary responsive cleanup after the main mobile pass.
  - Files: multiple client pages/components

- [ ] **PERF-4: Memoize QuoteBuilder item list**
  - Reduce unnecessary rerenders while editing.
  - Files: `client/src/components/QuoteBuilder.jsx`

- [ ] **SEO-2: Open Graph tags on public catalog/item pages**
  - Improve public-sharing metadata.
  - Files: `client/src/pages/PublicCatalogPage.jsx`, `client/src/pages/PublicItemPage.jsx`

- [ ] **UXQ-4: Keyboard shortcut to add item in QuoteBuilder**
  - Faster quote building for power users.
  - Files: `client/src/components/QuoteBuilder.jsx`

- [ ] **UXQ-5: Print-friendly export shortcut**
  - Improve discoverability of quote print/export flow.
  - Files: `client/src/pages/QuoteDetailPage.jsx`

- [ ] **UXQ-6: Autosave indicator**
  - Show “Saving…” / “Saved” feedback during quote edits.
  - Files: `client/src/components/QuoteBuilder.jsx`, `client/src/pages/QuoteDetailPage.jsx`

- [ ] **UXQ-8: Back navigation on detail pages**
  - Add explicit in-app back affordances.
  - Files: `client/src/pages/ItemDetailPage.jsx`, `client/src/pages/QuoteDetailPage.jsx`

- [ ] **UXQ-9: Dynamic page titles across the app**
  - Update `document.title` for main app pages.
  - Files: multiple page files

---

## P3 — Lower Priority / Backlog

- [ ] **PERF-2 follow-up: remaining image lazy loading**
  - Still needed outside `ItemCard`.
  - Files: `client/src/pages/FilesPage.jsx`, `client/src/pages/PublicCatalogPage.jsx`

- [ ] **PERF-5: Virtual list for very large inventory grids**
  - Consider only if server-side pagination is insufficient.
  - Files: `client/src/pages/InventoryPage.jsx`, `client/src/components/ItemGrid.jsx`

- [ ] **A11Y-6: Heading hierarchy cleanup**
  - Normalize `h1 → h2 → h3`.
  - Files: multiple page files

- [ ] **SEO-3: Canonical URLs on public pages**
  - Files: `client/src/pages/PublicQuotePage.jsx`, `client/src/pages/PublicCatalogPage.jsx`, `client/src/pages/PublicItemPage.jsx`

- [ ] **Auto-add permanent accessories to quotes**
  - Schema exists; quote builder does not auto-insert them yet.
  - Files: quote builder + related API paths

- [ ] **Drag-nest accessories after hover**
  - Advanced quote-builder interaction; not currently scheduled.
  - Files: quote builder

- [ ] **Send modal preview pane**
  - Preview email body / public quote link before sending.
  - Files: send modal components

- [ ] **Outbound message attachment info**
  - Show attached quote/image details in message views.
  - Files: `client/src/pages/MessagesPage.jsx`

- [ ] **Role badge in top nav**
  - Files: layout/sidebar/header

- [ ] **Email notification on role change**
  - Files: admin/user management flows

- [ ] **Lead import field expansion**
  - Add more mapping targets as import needs grow.
  - Files: lead import flows

---

## Done / No Action Needed

- [x] Background/theme redesign foundation
- [x] Core screen UI redesign pass
- [x] Quote builder visual redesign pass
- [x] Skeleton loaders
- [x] Error boundary
- [x] Public quote title
- [x] Empty search-result feedback on key pages
- [x] Toast live-region support
- [x] Main product workflow changes already landed:
  - quote sections
  - section-aware availability windows + signed item snapshots
  - public quote section grouping/dates/subtotals
  - event type settings
  - project title city suffix setting
  - unsigned-change signed-balance behavior
