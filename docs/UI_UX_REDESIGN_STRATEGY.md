# Quote Detail UI/UX Redesign Strategy

## Redesign Strategy Summary

The quote detail experience suffers from **flat hierarchy** (totals and status don’t stand out), **competing CTAs** (Send, Edit, AI Suggest, Duplicate, Delete look similar), **loose spacing** that wastes space without improving clarity, and **weak separation** between Client, Venue, Logistics, Custom Items, and Totals. This strategy:

1. **Tightens layout** using a defined spacing scale so the page feels denser but not cramped.
2. **Establishes a clear CTA order**: one primary (Send to Client when draft), then secondary (Edit, Copy link), then tertiary (AI Suggest, Duplicate, Delete).
3. **Elevates key info**: larger, bolder totals bar; a more visible status badge; tabs with stronger active/inactive contrast.
4. **Groups content** with clear section cards and headings so Client, Venue, Logistics, Custom Items, and Totals are easy to scan.
5. **Improves usability** of quote rows (bigger qty controls, aligned price columns) and of top nav (utilities grouped and labeled where helpful).
6. **De-emphasizes export** and **improves empty states** so the UI feels intentional end-to-end.

Workflow and information architecture stay the same; changes are visual and interaction refinements.

---

## Priority Plan

### High impact / low–medium effort

| # | Area | Change | Rationale |
|---|------|--------|-----------|
| 1 | **Totals section** | Prominent totals bar: larger type, clear “Grand total” row, optional sticky or always-visible placement. | Directly addresses “totals easy to miss”; high value, mostly CSS. |
| 2 | **Status badge** | Larger badge, stronger color, slightly more padding; consider pill + icon. | Status is critical; small change, big clarity gain. |
| 3 | **Top-right CTA hierarchy** | Single primary (Send when draft), ghost secondary (Edit, Copy link), text/icon tertiary (AI, Duplicate, Delete). | Removes “all buttons same weight”; no workflow change. |
| 4 | **Tabs** | Stronger active state (background + border), inactive with higher contrast text; ensure 3:1 minimum. | Fixes “tabs low contrast” and accessibility with limited code. |
| 5 | **Button consistency** | Use only `.btn-primary` for primary, `.btn-ghost` for secondary, `.btn-ghost` + muted/danger for destructive; same size class. | One source of truth; reduces visual noise. |
| 6 | **Section separation** | Wrap Client+Venue, Logistics, Custom Items in light cards or bordered blocks with a single spacing variable. | Clear grouping without re-architecting. |

### High impact / high effort

| # | Area | Change | Rationale |
|---|------|--------|-----------|
| 7 | **Quote items list** | Denser rows: fixed column widths (thumb | name | unit price | qty control | line total | remove), aligned number columns, optional compact mode. | Improves scannability and “row density”; touches QuoteBuilder layout. |
| 8 | **Quantity controls** | Larger tap targets (min 32px), optional stepper styling; keep current debounced input behavior. | Addresses “quantity controls small”; may need layout tweaks. |
| 9 | **Client & venue grouping** | Distinct visual treatment (e.g. client = one card, venue = another) and optional short labels (e.g. “Date”, “Guests”) next to metadata. | Stronger hierarchy and “information blocks poor grouping”. |

### Medium impact / low effort

| # | Area | Change | Rationale |
|---|------|--------|-----------|
| 10 | **Global spacing** | Introduce a spacing scale in `theme.css` and use it in QuoteDetailPage + QuoteBuilder. | Fixes “inconsistent spacing”; low risk. |
| 11 | **Export panel** | Style as secondary: smaller heading, muted “Export” label, same card style but visually lighter. | “Export detached” and “export priority confusing” with minimal code. |
| 12 | **Logistics “+ Add item”** | Place button inline with section title (already done) and add a short hint: “Add delivery/logistics items.” | Clarifies “action placement confusion”. |
| 13 | **Custom items empty state** | Replace plain text with a short empty-state block: icon, one line of copy, “+ Add custom item” button. | “Missing empty state design” with one small component. |
| 14 | **Metadata icons** | Add `aria-label` and optional visible labels (e.g. “Event date”, “Guests”) on first use or in a small legend. | “Metadata icons unclear” and accessibility. |
| 15 | **Top nav (Layout)** | Group Help, Settings, Logout in a compact dropdown or with a “User”/“Account” label so they’re discoverable but not competing with page content. | “Top navigation low visibility” without changing routes. |

---

## Detailed UI Recommendations

### Header (quote title + back)

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Back “← Quotes” competes with page title. | Keep back link left; style as text link (e.g. `color: var(--color-text-muted)`, no heavy border). | Reduces visual competition with quote name. |
| Title and status share one row; status feels small. | Keep title (e.g. 24px) left; place status badge immediately after with more weight (see Status below). | Clear “name + status” at a glance. |

**Implementation:**  
- In `QuoteDetailPage.jsx`, keep structure; in CSS ensure `.title` has `font-size: 22px` or `24px` and `.badge` is enlarged (see Status).  
- Back button: use class like `btn-link` or a custom muted link so it’s not `.btn-ghost` (reserve ghost for in-page actions).

---

### Top-right actions

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Edit, AI Suggest, Duplicate, Delete have similar weight. | **Primary:** Only “Send to Client” when status is draft (already in quote header). **Secondary:** “Edit”, “Copy Client Link” — `btn-ghost btn-sm`. **Tertiary:** “AI Suggest”, “Duplicate”, “Delete” — same ghost style but “Duplicate” neutral, “Delete” danger (e.g. `color: var(--color-danger)`). Optionally move Duplicate/Delete into a “⋯” menu. | Single clear primary CTA; secondary actions visible but not competing. |
| Inconsistent button styles. | Use only `btn-primary` for one primary action per context; all others `btn-ghost btn-sm`. Use one danger style for Delete (e.g. ghost + red text). | Consistent hierarchy and predictability. |

**Implementation:**  
- In `QuoteDetailPage.jsx` top bar: render “Send to Client” only in quote header (already), not duplicated in top bar.  
- Top bar actions order: Edit | Copy Client Link (if token) | AI Suggest | Duplicate | Delete.  
- Apply `btn-ghost btn-sm` to all except Delete; Delete: `btn-ghost btn-sm` with `style={{ color: 'var(--color-danger)' }}` or a `.btn-ghost-danger` class in `theme.css`.  
- Optional: wrap AI Suggest, Duplicate, Delete in a dropdown “Actions” to reduce clutter; keep Edit and Copy link always visible.

---

### Navigation tabs (Quote, Contract, Billing, Files, Logs)

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Tabs have weak contrast; active tab not obvious. | **Inactive:** `background: var(--color-surface)`, `color: var(--color-text-muted)`, `border: 1px solid var(--color-border)`. **Active:** `background: var(--color-primary)`, `color: #fff`, `border-color: var(--color-primary)`. Ensure inactive text meets 4.5:1 (or at least 3:1) on background. | Accessibility and “tabs low contrast”. |
| Small touch targets. | Min height 36px, padding 10px 16px; keep gap between tabs (e.g. 4px). | Easier to click/tap. |

**Implementation (QuoteDetailPage.module.css):**  
- `.tab`: `min-height: 36px`, `padding: 10px 16px`, `font-size: 13px`, `font-weight: 500`, `background: var(--color-surface)`, `color: var(--color-text)` (not muted for better contrast), `border: 1px solid var(--color-border)`.  
- `.tabActive`: `background: var(--color-primary)`, `color: #fff`, `border-color: var(--color-primary)`.  
- Verify contrast with your `--color-surface` and `--color-text` in theme.

---

### Client & venue info

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Client and venue blocks look the same; no hierarchy. | Keep two-column grid; give each block a clear **section title** (e.g. “Client” / “Venue”) and a light background difference (e.g. same `--color-surface` but add a left border accent for one). Use a single spacing variable between the two (e.g. `gap: var(--space-4)`). | “Information blocks poor grouping”. |
| Long lines (email, address) hard to scan. | Use **short labels** above or inline (“Email”, “Phone”, “Address”) and allow wrapping with `word-break: break-word` or `overflow-wrap: break-word` so long strings don’t stretch one line. | “Long line readability”. |

**Implementation:**  
- In `QuoteDetailPage.module.css`, `.clientBlock` and `.venueBlock`: add a 3px left border (e.g. client `border-left-color: var(--color-primary)`, venue `border-left-color: var(--color-accent)`).  
- Ensure `.venueTitle` (reuse for client) is 12px uppercase label; content below uses `.venueGrid` with wrap.  
- For long text: `.venueGrid span { max-width: 100%; overflow-wrap: break-word; }`.

---

### Quote items list (QuoteBuilder)

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Rows feel cluttered; price/qty not aligned. | **Grid-like row:** fixed or min widths: thumb (40px) | name (min 0, flex 1) | unit price (width ~70px, right-align) | qty control (width ~100px, center) | line total (width ~72px, right-align) | taxable (small) | remove. Use a single row height (e.g. 40px or 44px). | “Quote items row density” and “price alignment inconsistent”. |
| Quantity controls too small. | Min 32×32px touch target for +/-; slightly larger input (e.g. 44px wide); keep debounced save. | “Quantity controls small”. |

**Implementation (QuoteBuilder.module.css):**  
- `.quoteItem`: `display: grid`, `grid-template-columns: 40px 1fr 70px 100px 72px auto auto`, `align-items: center`, `gap: 12px`, `min-height: 44px`, `padding: 6px 10px`. Adjust columns for “T” and remove button.  
- `.unitPrice`, `.lineTotal`: `text-align: right`.  
- `.qtyControl`: `display: flex`, `align-items: center`, `gap: 4px`; buttons `min-width: 32px`, `min-height: 32px`; input `width: 52px` (or 56px).  
- On narrow viewports, switch to `grid-template-columns: 40px 1fr auto` and allow a second row for price/qty/total or keep horizontal scroll.

---

### Logistics / custom items

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| “+ Add item” feels disconnected from the list. | Keep button in same row as section title; add a one-line hint under the title: “Add delivery or logistics items from inventory.” | “Action placement confusion”. |
| Sections blend together. | Put Logistics and Custom Items in **section cards**: same border/radius as client/venue, padding 12–16px, margin-top 16px. Use a section title (e.g. 12px uppercase) and the add button on the same row. | “Weak section separation”. |
| Custom items empty: plain text. | **Empty state:** 48px icon (e.g. receipt or list), one line “No custom line items yet”, primary or ghost “+ Add custom item” button. Reuse `.empty-state` pattern from theme or a small inline variant. | “Missing empty state design”. |

**Implementation:**  
- Logistics: add a `<p className={styles.sectionHint}>Add delivery or logistics items from inventory.</p>` under `.logisticsHeader`.  
- Custom items: when `customItems.length === 0 && !showCustomForm`, render a small block: icon + text + button “+ Add custom item” instead of a single `<p className={styles.emptyHint}>`.  
- Wrap both blocks in a shared section wrapper with `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`, `padding: 14px`, `background: var(--color-surface)` (or keep current border-top and add a wrapper with margin).

---

### Totals section

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Subtotal, delivery, tax, grand total are small and easy to miss. | **Totals bar:** larger padding (14px 18px), two-line layout optional: line 1 = Subtotal | Custom | Delivery | Tax; line 2 = **Grand total** with larger font (e.g. 18px or 20px), bold, `color: var(--color-primary)` or `--color-text`. Right-align numbers; consider a subtle background (e.g. `--color-surface`) and a top border. | “Totals section low emphasis”. |

**Implementation (QuoteDetailPage.module.css):**  
- `.totalsBar`: `padding: 14px 18px`, `font-size: 14px`, `display: flex`, `flex-wrap: wrap`, `align-items: baseline`, `gap: 16px 24px`, `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`.  
- Last item (grand total): use a class `.totalsBarGrand`: `font-size: 18px`, `font-weight: 700`, `color: var(--color-primary)` or `var(--color-text)`, `margin-left: auto` if in a flex row.  
- In JSX, render “Grand total” in a `<span className={styles.totalsBarGrand}>` so it’s the last element and stands out.

---

### Right sidebar / export panel

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Export feels detached and too prominent. | Keep sidebar layout; style the export block as **secondary**: heading “Export” with smaller font (13px), muted color (`--color-text-muted`), no bold or uppercase unless consistent with other section labels. Use same card style as rest of app but no extra shadow. | “Export panel detached”, “export priority confusing”. |
| Same card as main content. | Use same `.card` class but add a modifier e.g. `.exportCard { border-color: var(--color-border); background: var(--color-surface); }` so it’s slightly subdued. | Visually groups with page but de-emphasizes. |

**Implementation:**  
- In `QuoteDetailPage.module.css`, `.exportTitle`: `font-size: 13px`, `font-weight: 600`, `color: var(--color-text-muted)` (already similar; ensure it’s not 14px bold).  
- `.exportCard`: keep padding; optionally `background: var(--color-surface)` so it doesn’t compete with main column.

---

### Global spacing and design system

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Inconsistent spacing between sections. | Define a **spacing scale** in `theme.css`, e.g. `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`. Use in QuoteDetailPage and QuoteBuilder: e.g. `.page { gap: var(--space-5); }`, section margins `var(--space-4)`. | “Inconsistent spacing system”. |
| Reduce excessive whitespace. | Slightly reduce `.page` gap (e.g. 16px instead of 20px); reduce padding in edit card and client/venue blocks (e.g. 12px instead of 20px where it’s currently large). | “Layout excessive whitespace” without cramping. |

**Implementation:**  
- Add to `:root` in `theme.css` the `--space-*` variables above.  
- In `QuoteDetailPage.module.css`, replace magic numbers: e.g. `gap: 20px` → `gap: var(--space-5)`, `padding: 20px` → `padding: var(--space-5)` where appropriate, and use `var(--space-4)` for tighter blocks.

---

### Status badge (quote header)

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Status badge is small and unnoticeable. | Increase size: `padding: 4px 12px`, `font-size: 12px`, `font-weight: 600`. Keep draft/sent/approved colors; ensure sufficient contrast (e.g. draft dark text on light indigo, sent dark on light amber, approved dark on light green). | “Status label unnoticeable”. |

**Implementation (QuoteDetailPage.module.css):**  
- `.badge`: `padding: 4px 12px`, `font-size: 12px`.  
- `.badge_draft`, `.badge_sent`, `.badge_approved`: keep or darken text color so contrast ratio ≥ 4.5:1 on the background.

---

### Metadata icons (date, guests, items)

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Icons (📅, 👥) lack labels; not everyone understands. | Add `aria-label` to the container or each tag, e.g. “Event date: 3/6/2026”. Optionally add visible text “Date”, “Guests”, “Items” on first occurrence (e.g. in a small legend) or use a consistent pattern: icon + value and ensure the wrapper has a title or aria-label. | “Metadata icons unclear” and accessibility. |

**Implementation:**  
- In `QuoteDetailPage.jsx`, for each `.metaTag` wrap in `<span aria-label="Event date: {date}">` or add `title` with full text.  
- Optional: use inline text “Date”, “Guests”, “Items” next to the value instead of only emoji (e.g. “Date 3/6/2026”) for clarity.

---

### Top navigation (Layout: Help, Settings, Logout)

| Problem | Recommendation | Why |
|--------|----------------|----------------|
| Help, Settings, Logout are small and de-emphasized. | Keep them in the top bar; group under a single “Account” or “User” trigger (e.g. user email or avatar) that opens a dropdown with Help, Settings, Logout. Or keep as links but style as a compact row with a subtle separator and slightly larger click area (e.g. padding 8px 12px). | “Top navigation low visibility” while avoiding distraction from page goal. |

**Implementation:**  
- **Option A:** In `Layout.jsx`, add a dropdown: trigger = user email or “Account”; menu items = Help, Settings, Logout.  
- **Option B:** Keep current links; in `Layout.module.css`, `.menuItem`: `padding: 8px 12px`, `font-size: 13px`, ensure hover state is visible. Add a left border or divider between “page context” and “user menu” if needed.

---

## Suggested Design System Rules

### Spacing scale

Use a single scale so spacing is consistent and easy to tune.

```css
/* theme.css :root */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
```

- **Between sections on a page:** `var(--space-4)` or `var(--space-5)`.  
- **Between form fields / list items:** `var(--space-2)` or `var(--space-3)`.  
- **Card/section internal padding:** `var(--space-3)` to `var(--space-4)`.  
- **Page outer padding:** keep existing (e.g. 24px) or map to `var(--space-6)`.

### Button hierarchy

- **Primary:** One per context (e.g. “Send to Client”, “Save”). Use `.btn-primary` only for this.  
- **Secondary:** Cancel, Edit, Copy link. Use `.btn-ghost` (and `btn-sm` where appropriate).  
- **Tertiary / destructive:** Duplicate (neutral), Delete (danger). Use `.btn-ghost` with danger color for Delete; optionally add `.btn-ghost-danger` in theme.  
- **Consistency:** Same size in a given bar (e.g. all `btn-sm` in quote top bar).

### Card / section separation

- **Section:** Use a wrapper with `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`, `background: var(--color-surface)` or `var(--color-bg)`, `padding: var(--space-3)` or `var(--space-4)`.  
- **Section title:** 12px, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: .04em`, `color: var(--color-text-muted)`, margin below `var(--space-2)`.  
- **Between major sections:** `margin-top: var(--space-4)` or `var(--space-5)`.

### Typography hierarchy

- **Page title:** 22–24px, font-weight 700.  
- **Section title:** 12–14px, uppercase optional, semibold, muted.  
- **Body:** 14px (or inherit), line-height 1.5.  
- **Supporting / metadata:** 12–13px, muted.  
- **Numbers (prices, totals):** Prefer tabular-nums for alignment; grand total 18–20px, bold.

### Badge / status styling

- **Size:** Min height ~24px, padding 4px 12px, font-size 12px, font-weight 600.  
- **Contrast:** Background and text must meet WCAG AA (4.5:1 for normal text).  
- **Semantics:** draft = neutral/indigo, sent = amber/warning, approved = green/success. Keep existing semantic colors; darken text if needed.

### Empty states

- **Pattern:** Icon (optional, 40–48px, muted) + one short sentence + primary or secondary CTA.  
- **Do not:** Use only “No items yet” in italics with no button.  
- **Reuse:** Extend `.empty-state` in theme.css for full-page; create a smaller inline variant (e.g. `.empty-state-inline`) for in-section empty (custom items, logistics when empty).

### Icon usage

- Prefer **consistent set** (e.g. one icon library or a small set of inline SVGs).  
- **Always** pair with a label or `aria-label` for accessibility.  
- **Metadata:** “Date”, “Guests”, “Items” as text or icon+label; avoid icon-only when meaning is not universal.

---

## Component-level restructuring (optional)

- **QuoteDetailPage:** Consider splitting the Quote tab into smaller components: `QuoteHeader` (title, badge, meta, quote actions), `QuoteClientVenue` (client + venue blocks), `QuoteLogistics` (logistics block + picker), `QuoteCustomItems` (list + form + empty state), `QuoteTotalsBar`, then the two-column layout with `QuoteBuilder` and `QuoteExport`. This keeps the same layout but makes styling and future changes easier.  
- **QuoteBuilder:** The quote list could be a `<table>` or a CSS grid with explicit column roles for alignment and accessibility (e.g. “Unit price” column header).  
- **Design tokens:** Move all spacing and typography values used in QuoteDetailPage and QuoteBuilder into `theme.css` (e.g. `--totals-bar-font-size`, `--section-title-size`) so future tweaks are in one place.

---

## Summary checklist

- [ ] Add `--space-*` scale to `theme.css` and use in QuoteDetailPage + QuoteBuilder.  
- [ ] Totals bar: larger grand total, right-align numbers, clear visual weight.  
- [ ] Status badge: larger, sufficient contrast.  
- [ ] Top actions: single primary (Send in header), rest ghost; Delete danger-style.  
- [ ] Tabs: stronger active/inactive contrast, 36px min height.  
- [ ] Client/Venue: section titles, optional left-border accent, word-break for long text.  
- [ ] Quote items: grid columns, aligned price/qty, 32px qty controls.  
- [ ] Logistics/Custom: section cards, hint text, custom items empty state with CTA.  
- [ ] Export: de-emphasize heading and card.  
- [ ] Layout top nav: optional dropdown or improved padding/labels.  
- [ ] Metadata: aria-labels and optional visible “Date”/“Guests”/“Items” labels.

This document is the single source of truth for the quote-detail UI redesign; implement in the order of the Priority Plan for maximum impact with manageable effort.
