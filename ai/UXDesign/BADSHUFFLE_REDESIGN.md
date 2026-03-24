# BadShuffle UI/UX Redesign Memo

**Type:** Cosmetic Redesign — Non-Breaking
**Version Target:** v0.0.6+
**Scope:** Full application visual pass
**Status:** Ready for implementation
**Last Updated:** 2026-03-23

---

## 1. Objective

Transform BadShuffle from a functional internal tool into a polished, modern SaaS product.

The goal is perception shift. The data, logic, and features do not change. What changes is how the app _feels_ to use — the visual weight of actions, the clarity of information, the satisfaction of interactions.

Reference products: Stripe Dashboard, Linear, Vercel.

**Specific targets:**
- Users should immediately understand what to do on every screen
- The Quote Builder must feel premium — it is the most critical user-facing surface
- Tables and lists must be scannable without effort
- Every action must deliver feedback

---

## 2. Constraints

### MUST NOT
- Modify any API endpoint, request shape, or response shape
- Change any business logic or calculation
- Remove any feature, button, or view
- Hardcode any color value — all colors must reference theme CSS variables
- Add new npm packages without approval

### MUST
- Use existing CSS variable names from `theme.css`: `--color-primary`, `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-danger`, `--color-success`, `--shadow`, `--shadow-md`, `--radius`, `--radius-sm`
- Remain backward compatible across all 4 themes (default, shadcn, material, chakra)
- Be implementable incrementally — no big-bang rewrites
- Keep CSS Modules pattern consistent — no global style injections outside `theme.css`

---

## 3. Current UX Problems

### 3.1 No Visual Depth
`body { background: var(--color-bg) }` and cards also use `var(--color-bg)`. Everything sits on the same layer. The page has no background/foreground separation. Cards don't read as cards.

**Fix:** Page background → `var(--color-surface)`. Cards → `var(--color-bg)`. This single change produces immediate depth.

### 3.2 Weak Hierarchy
Page titles, section headers, data values, and input labels all render at similar visual weight. Users can't tell what matters.

**Fix:** Lock down a 4-level type hierarchy. Apply consistently.

### 3.3 Dense Packing
Padding is inconsistent and frequently too tight. Sections bleed into each other. No breathing room between groups.

**Fix:** Adopt a spacing scale. Apply 24px section gaps, 16px internal gaps throughout.

### 3.4 The Card System Is Incomplete
`theme.css` defines `.card` with border + shadow, but many screens don't use it — they use raw `<div>` with inline styles or nothing. Different screens have different visual weight.

**Fix:** Standardize. Every major content block uses `.card` or a styled equivalent.

### 3.5 Flat KPI Numbers
Dashboard stats are rendered at normal text size. Total revenue displayed the same as a label.

**Fix:** KPI values at 28–32px, bold, with a left accent stripe.

### 3.6 Quote Builder Is Too Dense
The money screen. Currently items are rows in a table, the summary panel is visually weak, and the action bar is cluttered. Users can't find the primary action.

**Fix:** Full layout restructure. Items become cards. Summary panel becomes sticky and dominant. Actions grouped by intent.

### 3.7 Inventory Filters Collapse on Overflow
Category pills wrap into multiple rows when there are many categories.

**Fix:** Horizontal scroll with fade mask. Single-row pill bar.

### 3.8 Import Flow Is One Flat Page
Upload + mapping + review are shown simultaneously. Users feel uncertain about progress.

**Fix:** Stepper component. Each step isolated in its own card.

### 3.9 Tables Look Like Unstyled HTML
Leads and Billing tables have minimal row padding, no hover state, and borders that feel heavy.

**Fix:** More row padding, subtle hover, remove heavy inner borders.

### 3.10 Empty States Are Dead Ends
"No messages yet" with nothing else. Users don't know what to do.

**Fix:** Icon + heading + descriptive sentence + action link/button on every empty state.

### 3.11 No Interaction Feedback
Buttons don't respond visually on press. Adding an item to a quote produces no confirmation. The app feels static.

**Fix:** Button active scale, card hover lift, add-to-quote flash animation.

### 3.12 Sidebar Active State Is Weak
Active nav items use a subtle background. On some themes it's nearly invisible.

**Fix:** Left accent border + filled pill background using `color-mix(in srgb, var(--color-primary) 15%, transparent)`.

---

## 4. Design Principles

These apply to every decision made during implementation.

### 4.1 Hierarchy First
Every screen must answer: _what matters most here?_ Use size, weight, and spacing — not more elements — to communicate priority.

### 4.2 One Primary Action Per Screen
- Dashboard → no primary CTA (read-only overview)
- Inventory → "Add Item" or item card click
- Quote Detail → "Send to Client"
- Quote Builder → "Send to Client" (sticky in right panel)
- Import → "Import" (final step only)

Secondary actions are visually subordinate. Danger actions are always last and red.

### 4.3 Progressive Disclosure
Default view shows essential information. Secondary details (notes, accessories, metadata) expand on demand. Don't show everything at once.

### 4.4 Space Over Borders
Use padding and background contrast to separate sections. Avoid adding `border-bottom` or `border-top` as a separator — that's what spacing is for. Borders are for _containers_, not _dividers_.

### 4.5 Consistent Patterns
Same visual treatment for the same type of content across all screens. A "status badge" looks the same everywhere. A "table row" looks the same everywhere. Predictability reduces cognitive load.

---

## 5. Visual System

### 5.1 Layered Background — THE SINGLE BIGGEST WIN

**Current:** `body` background is `var(--color-bg)` (white). Cards also use `var(--color-bg)`.

**Change:** Make the page background `var(--color-surface)`. Keep cards at `var(--color-bg)`.

**Location:** `client/src/theme.css`

```css
body {
  background: var(--color-surface);  /* was: var(--color-bg) */
}
```

This one line instantly creates foreground/background depth across every screen.

> **Theme safety:** `--color-surface` is already defined in all 4 themes. No hardcoding required.

### 5.2 Card Upgrade

The existing `.card` in `theme.css` is:
```css
.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
```

**Augment with hover elevation:**
```css
.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}
.card:hover {
  box-shadow: var(--shadow-md);
}
```

Do not add `transform: translateY(-2px)` to generic `.card` — too much motion. Reserve lift transform for inventory product cards only (they are grid items, lift is appropriate).

### 5.3 Derived Theme Tokens

Add to `:root` in `theme.css` and replicate the pattern in each `[data-theme]` block:

```css
:root {
  /* existing tokens ... */
  --color-primary-subtle: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg));
  --color-primary-hover:  color-mix(in srgb, var(--color-primary) 20%, var(--color-bg));
}
```

> `color-mix` is already used in the codebase (e.g., QuoteBuilder.module.css). Safe to use.

These two tokens replace scattered inline `rgba()` calls and ensure theme compatibility.

### 5.4 Typography Hierarchy

No new font stacks. Enforce existing weights/sizes consistently.

| Level | Size | Weight | Color | Usage |
|---|---|---|---|---|
| Page Title | 22px | 700 | `--color-text` | Top of every page |
| Section Header | 13px | 700 | `--color-text-muted` | Card section labels (all-caps, tracked) |
| Body | 14px | 400 | `--color-text` | Default content |
| Muted/Label | 12px | 400–600 | `--color-text-muted` | Metadata, hints, input labels |
| KPI Value | 28–32px | 700 | `--color-text` | Dashboard stat numbers |
| Total | 24px | 700 | `--color-primary` | Quote summary total line |

### 5.5 Spacing Scale

Enforce these values. Do not introduce arbitrary px values.

| Token | Value | Use |
|---|---|---|
| `4px` | tight | Icon-to-label gap, badge internal |
| `8px` | compact | Between related fields, button gap |
| `12px` | medium | Between list items |
| `16px` | default | Card internal padding (mobile), form row gap |
| `20px` | comfortable | Card internal padding (default) |
| `24px` | section | Between cards, between form sections |
| `32px` | major | Page-level top padding |

**Current violation:** Most cards use padding 24px internally, but page containers often have 16px or 12px. Increase page container padding to 24–32px.

### 5.6 Button Scale

Add to `.btn` in `theme.css`:
```css
.btn {
  /* existing ... */
  transition: opacity 0.15s, background 0.15s, transform 0.1s;
}
.btn:active {
  transform: scale(0.97);
}
```

Enhance `.btn:hover` to be slightly less subtle (current `opacity: .88` is fine).

---

## 6. Layout System

### 6.1 Page Content Container

**File:** `client/src/components/Layout.module.css`

Current layout likely has tight padding on the content area. Set a consistent container:

```css
.content {
  padding: 24px 32px;
  max-width: 1440px;
  min-width: 0;
}

@media (max-width: 768px) {
  .content {
    padding: 16px;
  }
}
```

Do not change sidebar width, top bar, or routing.

### 6.2 Sidebar Upgrade

**Files:** `client/src/components/Sidebar.jsx`, `Sidebar.module.css`

Keep all structure and links. Visual changes only:

**Active item:** Replace current background-only active state with pill + left accent:
```css
.navItem.active {
  background: var(--color-primary-subtle);
  border-radius: var(--radius);
  position: relative;
}
.navItem.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
}
```

**Hover:**
```css
.navItem:hover {
  background: var(--color-primary-hover);
  border-radius: var(--radius);
  transition: background 0.15s;
}
```

**Section spacing:** Increase gap between nav groups from current value to 20–24px.

---

## 7. Core Screen Redesigns

### 7.1 Dashboard

**Files:** `DashboardPage.jsx`, `DashboardPage.module.css`

**Problems:** KPI numbers are weak, charts have insufficient padding, no scanning pattern.

**KPI Cards — Top Row**

Layout: 4 cards in a grid row (2x2 on mobile).

Each KPI card structure:
```
[ left accent border (4px, --color-primary) ]
[ icon + label (small, muted) ]
[ value (28px, bold) ]
[ optional: delta/trend line ]
```

CSS additions to `DashboardPage.module.css`:
```css
.kpiCard {
  border-left: 4px solid var(--color-primary);
  padding: 20px;
}
.kpiValue {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.1;
  margin-top: 8px;
}
.kpiLabel {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

Use `--color-primary` for Total Quotes accent, `--color-success` for Approved/Confirmed, `--color-accent` for Revenue.

**Charts Section**

Wrap each chart in a `.card` with proper padding (20px). Add section header labels above each chart. Ensure equal visual weight between charts — equal column widths.

**Activity / Conflicts Section**

Each item in the upcoming/conflicts list should be a mini-card row, not a raw list item.

**Empty states:** Any empty dashboard section must say why and what to do:
- "No upcoming events — create a quote with an event date"
- "No conflicts — you're all clear"

---

### 7.2 Inventory

**Files:** `InventoryPage.jsx`, `InventoryPage.module.css`, `ItemCard.jsx`, `ItemCard.module.css`, `ItemGrid.jsx`, `ItemGrid.module.css`

**Problems:** Category pills wrap, item cards are cramped, action buttons are always visible (clutter).

**Category Filter Bar**
```css
.filterBar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  flex-wrap: nowrap;         /* prevent wrapping */
}
.filterBar::-webkit-scrollbar { display: none; }
```

Active pill: filled background (`var(--color-primary)`, white text).
Inactive pill: outlined (`border: 1px solid var(--color-border)`, muted text).

No wrapping. Single row. Scroll to see more.

**Product Card Redesign**

Current cards are flat. New structure:
```
[ Image — full width, aspect-ratio 4:3, object-fit: cover ]
[ Padding block ]
  [ Title — 14px, semibold ]
  [ Category — 12px, muted ]
  [ Price — 14px, primary color ]
[ Hover overlay ]
  [ "+ Add to Quote" button ]
  [ "Edit" button ]
```

CSS:
```css
.itemCard {
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow);
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  cursor: pointer;
}
.itemCard:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.itemCardImage {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: var(--color-surface);
}
.itemCardOverlay {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.4);
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.itemCard:hover .itemCardOverlay {
  display: flex;
}
```

> Hover overlay hides the always-visible action buttons, dramatically reducing visual noise at rest state.

**Out-of-Stock Indicator**
Show a subtle "Out of Stock" badge overlay on the image (bottom-left), not a separate column. Keeps the grid clean.

---

### 7.3 Quote Builder — CRITICAL PATH

**Files:** `QuoteBuilder.jsx`, `QuoteBuilder.module.css`, `QuoteDetailPage.jsx`, `QuoteDetailPage.module.css`

This is the screen where users decide if the software feels premium. Every detail matters here.

**New Layout**

Two-panel layout (already exists in some form — reinforce it):
```
[ LEFT: 60% — Item List ]    [ RIGHT: 40% — Summary Panel ]
```

On screens < 1024px: stack vertically. Summary panel moves below items.

**LEFT PANEL — Item List**

Each quote item is a card, not a table row:

```css
.quoteItem {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-bottom: 10px;
  transition: box-shadow 0.15s;
}
.quoteItem:hover {
  box-shadow: var(--shadow);
}
```

Item card internal layout (left → right):
1. **Drag handle** (⠿) — 20px wide, muted, cursor: grab
2. **Thumbnail** — 56×56px, rounded, object-fit: cover
3. **Info block** — flex: 1
   - Title (14px, semibold)
   - Label/override (12px, muted, italic if overridden)
   - Category badge
4. **Discount badge** — if discount applied (existing component, keep)
5. **Quantity controls** — `-` / input / `+` with clean styling
6. **Unit price** — 14px, right-aligned
7. **Line total** — 14px, bold, right-aligned
8. **Remove button** — `×`, muted, only visible on hover

**When an item is added via "Add Item" panel:** Flash the new item card with a 400ms background highlight animation:
```css
@keyframes addedFlash {
  0%   { background: var(--color-primary-subtle); }
  100% { background: var(--color-bg); }
}
.quoteItemAdded {
  animation: addedFlash 0.4s ease-out;
}
```

Apply class on mount, remove after animation ends.

**RIGHT PANEL — Summary (Sticky)**

```css
.summaryPanel {
  position: sticky;
  top: 20px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: 24px;
}
```

Summary panel content order:
1. Section heading: "Quote Summary"
2. Item count (e.g. "7 items")
3. Divider (1px, `--color-border`)
4. Subtotal line
5. Delivery line (if applicable)
6. Tax line (with rate %)
7. Adjustments (if applicable)
8. **Heavy divider** (2px)
9. **TOTAL** — 24px, bold, `--color-primary`
10. Spacer
11. **Primary CTA: "Send to Client"** — full width, `btn btn-primary`
12. **Secondary row:** "Copy Link" | "Duplicate" | "Export"
13. **Danger action:** "Delete Quote" — small, `--color-danger`, bottom

The total must visually dominate the summary panel. It should be the first thing the eye lands on.

**Top Action Bar**

Current: cluttered mix of buttons.

**New grouping:**
```
[ Left: Quote name + status badge ]
[ Right: [ View Preview ] [ Save ] | [ Delete ↓ ] ]
```

The "Send to Client" CTA belongs in the summary panel, not the top bar. Removing it from the top bar reduces clutter without removing the feature.

---

### 7.4 Import Flow

**Files:** `ImportPage.jsx`, `ImportPage.module.css`

**Problem:** Three distinct operations (upload → map → review) presented as one flat scroll. Users don't know what step they're on or what comes next.

**Fix: Stepper Component**

Add a stepper above the content area:
```
[ 1. Upload ] → [ 2. Map Columns ] → [ 3. Review & Import ]
         ^active step
```

Stepper visual: numbered circles (filled = complete/active, outlined = future), connected by a line.

Each step content lives in its own `.card`. Only the active step card is visible/expanded. Completed steps show a summary line.

Step 1 — Upload:
- Current upload UI, unchanged
- "Next →" button appears after file is selected

Step 2 — Map Columns:
- Column mapping UI, unchanged
- "← Back" and "Next →" buttons

Step 3 — Review & Import:
- Preview table of parsed rows
- Row count, error count
- "← Back" and "Import" (primary CTA)

**The tab structure on ImportPage (Inventory Sheet / PDF Quote / Leads) stays unchanged.** The stepper applies inside each tab for multi-step operations.

---

### 7.5 Tables (Leads, Billing)

**Files:** `LeadsPage.jsx`, `LeadsPage.module.css`, `BillingPage.jsx`, `BillingPage.module.css`

**Problems:** Minimal row padding, no hover state, feels like an HTML table.

**Row improvements:**
```css
.tableRow {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  transition: background 0.1s;
}
.tableRow:hover {
  background: var(--color-surface);
}
.tableRow td {
  padding: 14px 16px;   /* was: ~8px */
}
```

**Header:**
```css
.tableHead th {
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  background: var(--color-surface);
  position: sticky;
  top: 0;
  z-index: 1;
}
```

**Key column emphasis:**
- Lead name → semibold
- Revenue amounts → semibold, right-aligned
- Dates → muted
- Status badges → use existing `.badge` utility

Remove heavy outer borders from tables. The card container provides the boundary.

---

### 7.6 Messages Page

**Files:** `MessagesPage.jsx`, `MessagesPage.module.css`

**Problems:** Dead empty state, weak thread list, flat message bubbles.

**Empty State:**
Replace "No messages yet." with:
```
[ 📭 icon, large, muted ]
No messages yet
Start a conversation by sending a quote to a client.
[ → Go to Quotes ]
```

Use the existing `.empty-state` utility class from `theme.css`.

**Thread List:**
Each thread item should have:
- Contact name (bold)
- Quote name (muted, smaller)
- Last message preview (1 line, truncated)
- Unread badge (if unread count > 0)
- Timestamp (right-aligned, muted)

Minimum row height: 56px. Active thread: `var(--color-primary-subtle)` background + left accent border.

**Message Bubbles:**
- Outbound: right-aligned, `var(--color-primary-subtle)` background
- Inbound: left-aligned, `var(--color-surface)` background

Both: `border-radius: var(--radius)`, `padding: 10px 14px`, `max-width: 75%`.

---

## 8. Interaction & Feedback

### 8.1 Button Micro-Interaction
Add to `.btn` in `theme.css`:
```css
.btn:active {
  transform: scale(0.97);
}
```

### 8.2 Card Hover Lift
Inventory item cards and KPI cards get subtle lift. Generic `.card` gets shadow elevation only (no transform — too much motion on forms).

### 8.3 Add-to-Quote Flash
When a new item is added to the quote builder, the item card appears with a background flash animation (`addedFlash` — see section 7.3). Duration: 400ms. This replaces the need for a toast notification for this action.

### 8.4 Skeleton Loaders
Replace all `<div>Loading…</div>` or spinner-only loading states with skeleton screens.

Skeleton pattern:
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-border) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Apply to: Dashboard KPI cards, inventory grid, quote item list, table bodies.

### 8.5 Form Focus States
Already defined in `theme.css` via `:focus-visible`. No change needed. Ensure all interactive elements are reachable by keyboard and trigger the focus ring.

### 8.6 Toast Notifications
The app has a `Toast` component. Standardize usage:
- Save success → toast
- Delete → toast with undo (if possible)
- Error → toast (danger variant)
- Add-to-quote → flash (not toast — too frequent)

---

## 9. Component Standardization

Create or standardize these components so they look identical across all screens.

| Component | Location | Notes |
|---|---|---|
| `StatusBadge` | Shared component or `theme.css` | draft/sent/approved/confirmed/closed — already partially exists |
| `EmptyState` | `theme.css` `.empty-state` | Already defined — ensure used consistently |
| `SkeletonLoader` | New or `theme.css` | Add `.skeleton` class |
| `Stepper` | New — `client/src/components/Stepper.jsx` | Used in ImportPage only (Phase 3) |
| `KPICard` | `DashboardPage.module.css` or extract | .kpiCard, .kpiValue, .kpiLabel |
| `TableRow` | Per-page module CSS | Same padding/hover pattern everywhere |
| `Pill/Tag` | `theme.css` or shared | Category pills, filter pills |

**Do not create a new component for every case.** Extract only when the same visual pattern appears on 2+ screens with different implementations.

---

## 10. Implementation Plan

### Phase 1 — Foundation (2–3 days, ~10–15 files)
**Goal:** Apply global changes that improve every screen simultaneously.

1. `theme.css` — Add `body { background: var(--color-surface) }`, add `--color-primary-subtle` and `--color-primary-hover` tokens, add `.btn:active` scale, upgrade `.card` hover shadow, add `.skeleton` class
2. `Layout.module.css` — Increase content area padding (24px/32px), add max-width constraint
3. `Sidebar.module.css` — Pill active state with left accent, hover feedback, section spacing

**Acceptance:** Every page looks immediately better. Cards visually separate from page. Buttons press. Sidebar has clear active state.

---

### Phase 2 — Core Screens (3–5 days, ~8–12 files)
**Goal:** Dashboard and Inventory reach final state.

4. `DashboardPage.jsx` + `DashboardPage.module.css` — KPI card redesign (left accent, large number), charts padding, empty states
5. `ItemCard.jsx` + `ItemCard.module.css` — Hover overlay, image ratio, lift transform
6. `InventoryPage.module.css` — Filter bar single-row scroll, pill styles
7. `LeadsPage.module.css` — Row padding, hover, sticky header
8. `BillingPage.module.css` — Same table treatment

---

### Phase 3 — Critical Flow (4–6 days, ~6–10 files)
**Goal:** Quote Builder and Import reach final state.

9. `QuoteBuilder.jsx` + `QuoteBuilder.module.css` — Item cards, summary panel sticky, add-flash animation, action grouping
10. `QuoteDetailPage.module.css` — Summary panel total emphasis, action bar cleanup
11. `ImportPage.jsx` + `ImportPage.module.css` — Stepper component, step isolation
12. `MessagesPage.jsx` + `MessagesPage.module.css` — Empty state, thread list, message bubbles

---

### Phase 4 — Polish (2–3 days)
**Goal:** Fill remaining gaps. Make it feel finished.

13. Skeleton loaders on all loading states
14. Consistent empty states across all pages
15. Any remaining padding/spacing inconsistencies
16. Cross-theme QA pass (test all 4 themes)
17. Mobile/responsive spot-check (QuoteBuilder, ImportPage, Tables)

---

## 11. Success Criteria

- [ ] Cards visually separate from page background on all screens and all themes
- [ ] Dashboard KPI numbers render at 28px+ bold with left accent
- [ ] Inventory grid shows hover overlay; buttons not visible at rest
- [ ] Quote Builder summary panel is sticky, total is prominent, primary CTA is unmissable
- [ ] Import flow has a visible step indicator
- [ ] Table rows have hover state and 14px vertical padding
- [ ] Every empty state has an icon, a message, and an action
- [ ] Button press produces visible scale response
- [ ] No hardcoded color values in any modified file
- [ ] All 4 themes pass visual QA

---

## 12. Highest Impact Changes

**If you implement nothing else, implement these three:**

### 1. Background Layer Separation (1 line, `theme.css`)
```css
body { background: var(--color-surface); }
```
Instant depth on every screen. Nothing else delivers as much visual improvement for as little effort.

### 2. Quote Builder Summary Panel
The summary panel being sticky, prominent, and driving to a clear CTA turns the quote builder from a form into a tool. This is where deals happen. Make the total large. Make "Send to Client" impossible to miss.

### 3. Inventory Card Hover Overlay
Moving action buttons into a hover overlay cleans up the grid dramatically. Rest state is clean and browseable. Action state is contextual and focused.

---

## Appendix: CSS Variable Reference (theme.css)

```
--color-primary       → brand blue (#1a8fc1 default)
--color-accent        → teal (#16b2a5 default)
--color-bg            → white (card background)
--color-surface       → light gray (#f4f8fb default) ← page background
--color-border        → light border (#dce8f0 default)
--color-text          → dark (#1a1a2e default)
--color-text-muted    → gray (#637080 default)
--color-danger        → red (#e53e3e default)
--color-success       → green (#38a169 default)
--shadow              → 0 2px 8px rgba(0,0,0,0.08)
--shadow-md           → 0 4px 16px rgba(0,0,0,0.12)
--radius              → 8px
--radius-sm           → 4px
--radius-md           → 6px
```

**New tokens to add:**
```
--color-primary-subtle  → color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))
--color-primary-hover   → color-mix(in srgb, var(--color-primary) 20%, var(--color-bg))
```
