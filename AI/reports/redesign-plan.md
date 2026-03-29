# BadShuffle — UI Redesign Architecture Plan

**Author:** Claude (Planner mode)
**Date:** 2026-03-28
**Phase:** Architecture — pre-implementation

---

## 1. Goal

Transform BadShuffle from a functional but utilitarian SaaS UI into a polished, pixel-perfect, responsive product that looks and feels premium at every viewport size. The redesign must:

- Preserve all existing behavior — zero logic changes
- Stay fully theme-aware (all 5 themes must look great)
- Use Tailwind utility classes mapped to CSS variables (no hardcoded colors)
- Fix all known mobile/responsive breakage
- Establish a consistent visual language across all pages

---

## 2. What Was Done Before This Plan

| Work Item | Status |
|---|---|
| CSS theme system (4 themes → CSS vars) | ✅ Done |
| Hardcoded hex colors removed from all module files | ✅ Done |
| WCAG accessibility pass (~100 fixes) | ✅ Done |
| Tailwind wired to CSS variable aliases | ✅ Done |
| **Noir (dark) added as 5th theme** | ✅ Done (2026-03-28) |
| **7 critical `flex-wrap` responsive fixes** | ✅ Done (2026-03-28) |

---

## 3. Theme System — 5th Theme: Noir

Added as `data-theme="noir"`. Token values:

| Token | Value |
|---|---|
| `--color-bg` | `#0a0a12` |
| `--color-surface` | `#12121c` |
| `--color-bg-elevated` | `#1a1a26` |
| `--color-sidebar` | `#050509` |
| `--color-sidebar-hover` | `#18181f` |
| `--color-border` | `#22222e` |
| `--color-text` | `#e2e8f0` |
| `--color-text-muted` | `#64748b` |
| `--color-primary` | `#60a5fa` (blue-400) |
| `--color-accent` | `#34d399` (emerald-400) |
| `--color-danger` | `#f87171` (red-400) |
| `--color-success` | `#4ade80` (green-400) |
| `--color-warning` | `#fb923c` (orange-400) |
| `--color-discount` | `#a78bfa` (violet-400) |
| `--radius` | `10px` |
| `--shadow` | glow-based (dark-safe) |

**Design principle:** All tint colors (`-subtle`, `-border`, `-strong`) are derived via `color-mix()` with `var(--color-bg)`, so dark tints are naturally dark. No additional override rules needed.

**Wiring needed:** SettingsPage.jsx THEMES array already updated. No other changes needed — the `data-theme="noir"` attribute on `<html>` activates it.

---

## 4. Responsive Fixes Completed

The following `flex-wrap` issues were fixed (all action bars now wrap on small viewports):

| File | Selector | Fix |
|---|---|---|
| `AdminPage.module.css` | `.actions` | + `flex-wrap: wrap` |
| `SettingsPage.module.css` | `.actions` | + `flex-wrap: wrap; gap: 8px` |
| `VendorsPage.module.css` | `.actions` | + `flex-wrap: wrap` |
| `InventorySettingsPage.module.css` | `.actions` | + `flex-wrap: wrap` |
| `MessageSettingsPage.module.css` | `.actions` | + `flex-wrap: wrap` |
| `QuoteDetailPage.module.css` | `.topActions` | + `flex-wrap: wrap` |
| `QuoteCard.module.css` | `.actions` | + `flex-wrap: wrap` |

---

## 5. Remaining Responsive Issues (Next Pass)

### 5a. Fixed-width elements that may truncate

| File | Rule | Issue | Fix |
|---|---|---|---|
| `StatsBar.module.css` | `.label` | `width: 180px` — truncates on < 400px | Change to `min-width: 120px; max-width: 180px` |
| `StatsBar.module.css` | `.value` | `width: 40px` — may clip long values | Change to `min-width: 36px` |
| `DashboardPage.module.css` | `.barLabel` | `width: 74px` — may clip on small | Wrap in overflow ellipsis or use `min-width` |
| `BillingPage.module.css` | `.search` | `width: 220px` — fixed input width | Change to `width: min(220px, 100%)` |

### 5b. Pages needing mobile audit

- **QuoteDetailPage.jsx** — very large component, multi-tab layout with dense action bars; needs a mobile-first bottom tab bar review
- **QuoteBuilder (embedded)** — picker panel + section panes need scroll containment audit on mobile
- **MessagesPage.jsx** — split-pane layout (thread list / thread detail) collapses but needs visual review at 320px-480px
- **ItemDetailPage.jsx** — needs button bar wrapping audit for edit/delete/back row
- **BillingPage.jsx** — table overflow needs `tableWrapper` check at < 480px

### 5c. Touch targets

Base `.btn` class already has `min-height: 44px` on `@media (max-width: 768px)`. However the following need auditing:
- Sidebar chevron toggle (26px wide currently — should be 44px minimum on mobile)
- QuoteCard action buttons when `selectable` mode is active
- Date picker inputs in QuoteBuilder section headers

---

## 6. Redesign Architecture — Visual Language

### 6a. Design Principles

1. **Space is hierarchy.** Generous padding at the page level. Tighter within cards. Dense inside tables.
2. **Color signals state, not decoration.** Primary = interactive. Accent = live data. Danger/Warning = user action needed.
3. **Motion is subtle.** Hover: 150ms ease. Page transitions: none (SPA speed is the UX).
4. **Typography is stepped.** Page titles → section headers → body → metadata — each a clear step down.

### 6b. Global Layout Pass (Priority 1)

**Target:** `Layout.module.css`, `theme.css`

Current issues:
- `main` has `padding: 20px 24px` — fine on desktop, correct on mobile, but no max-width constraint on very wide screens
- No `max-width` on content area — pages stretch edge-to-edge on ultrawide monitors

Proposed changes:
```css
/* Layout.module.css additions */
.mainInner {
  width: 100%;
  max-width: 1400px;           /* cap content width on ultrawide */
  margin: 0 auto;
}

@media (min-width: 1280px) {
  .main { padding: 24px 32px; } /* more breathing room on large screens */
}
```

**Note:** Don't constrain `.main` itself — only `.mainInner`. This keeps the surface background full-width.

### 6c. Global Button System Pass (Priority 1)

**Target:** `theme.css` — `.btn` base class

Current: `padding: 7px 14px; border-radius: var(--radius-sm)`

Proposed:
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;     /* ADD: center content when flex-wrapping */
  gap: 6px;
  padding: 8px 16px;           /* slight increase */
  border-radius: var(--radius-sm);
  border: none;
  font-weight: 500;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;         /* ADD: prevent text wrap within button */
  transition: opacity .15s, background .15s, box-shadow .15s, transform .1s;
  cursor: pointer;
}
.btn:hover { opacity: .88; }
.btn:active { opacity: .75; transform: scale(0.97); }
.btn-sm {
  padding: 5px 12px;           /* slight increase from 4px 10px */
  font-size: 12px;
}
```

Mobile override (already exists, keep):
```css
@media (max-width: 768px) {
  .btn { min-height: 44px; padding: 10px 16px; }
}
```

### 6d. Card Elevation System (Priority 2)

Cards currently use a flat 1px border with subtle shadow. The noir theme benefits from slightly elevated surfaces.

Add to `.card`:
```css
.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: box-shadow 0.2s ease;
}
```
This already exists. The Noir theme shadow (`0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)`) provides the elevation glow. No code change needed — the CSS variable system handles it.

### 6e. Typography Pass (Priority 2)

Current page titles: `font-size: 22px; font-weight: 700` (most pages).

Proposed system:
```css
/* Page-level title */
.page-title { font-size: clamp(20px, 3vw, 28px); font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }

/* Section header */
.section-title { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }

/* Card label */
.card-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
```

Apply via Tailwind classes in JSX where possible (e.g. `className="text-2xl font-bold tracking-tight"`).

### 6f. Page-Level Layout Pattern (Priority 2)

Every page should follow this structure:
```
<div class="page">            ← flex col, gap-5
  <header class="page-header"> ← flex row, justify-between, flex-wrap, gap-4
    <div class="page-title-block">  ← title + subtitle
    <div class="page-actions">      ← button group, flex-wrap: wrap, gap-2
  </header>
  <div class="page-body">    ← main content area
</div>
```

Currently inconsistent across pages. Some use `.header`, some `.topBar`, some inline. Standardizing will make future theme/spacing changes trivial.

---

## 7. Per-Page Redesign Tasks

### Priority 1 — High Impact, Low Risk

| Page | Issues | Proposed Fix |
|---|---|---|
| **QuotePage** (list) | Header action bar can overflow on narrow desktop | Add `flex-wrap: wrap` to toolbar row |
| **QuoteDetailPage** | topBar/topDiv pattern inconsistent; dense action bars | Standardize to page-header pattern; group secondary actions into a "⋯ More" dropdown on mobile |
| **Dashboard** | Status badges use hardcoded color ✅ done; bar chart label `width: 74px` truncates | Use `min-width` + ellipsis |
| **Inventory/Items** | Filter toolbar overflows at 900px | Wrap filter chips on overflow |
| **Settings** | Theme picker swatches could be larger / more tappable | Increase swatch hit target to 44×44px |

### Priority 2 — Polish Pass

| Page | Issues | Proposed Fix |
|---|---|---|
| **QuoteBuilder** | Picker panel on mobile is narrow; section panes overlap | `position: sticky` picker, collapse picker to a modal on < 768px |
| **MessagesPage** | Split pane at < 640px shows both panels simultaneously | Properly hide thread list when detail is open (already done) — verify on 375px |
| **BillingPage** | Table scrolls horizontally but no visual indicator | Add `box-shadow: inset -4px 0 8px rgba(0,0,0,0.06)` fade at right edge |
| **FilesPage** | Grid/List toggle controls stack awkwardly at 480px | Wrap filter row; push view toggle to its own line below 480px |
| **ImportPage** | Multi-step wizard arrows are now accessible; visual stepper needs more prominence | Increase step circle size; add connecting line between steps |
| **AuthPage** | Login form width is unconstrained on wide screens | `max-width: 420px; margin: auto` on the card |

### Priority 3 — Long-term

| Item | Description |
|---|---|
| **QuoteDetailPage extraction** | 1550-line God component → extract `QuoteSummaryPanel`, `QuoteContractPanel`, `QuoteFilesPanel`, `QuoteMessagesPanel` |
| **Mobile bottom nav** | On < 640px, sidebar nav is hidden behind hamburger; consider a persistent bottom tab bar for core nav items (Projects, Inventory, Messages, Settings) |
| **Skeleton loading states** | Most pages show blank → loaded; add skeleton shimmer to all list/table pages |
| **Empty states** | Several pages have generic "No items found" text; upgrade to illustrated empty states with CTAs |

---

## 8. Tailwind Usage Strategy

### Rule: CSS Variables First, Tailwind Utilities Second

- Use `var(--color-*)` CSS variables for all color semantics
- Use Tailwind for **layout, spacing, typography** utilities only
- Do NOT use Tailwind color utilities like `bg-blue-500`, `text-gray-800` — use `bg-primary`, `text-muted` (the mapped aliases)

### Mapped Tailwind aliases (from tailwind.config.js)

```js
colors: {
  primary: 'var(--color-primary)',
  accent:  'var(--color-accent)',
  danger:  'var(--color-danger)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  discount: 'var(--color-discount)',
  border:  'var(--color-border)',
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  'text-muted': 'var(--color-text-muted)',
  'primary-subtle': 'var(--color-primary-subtle)',
}
```

These work in all 5 themes.

### Example correct Tailwind usage

```jsx
// ✅ Theme-aware
<button className="btn btn-primary text-sm font-medium">Save</button>
<div className="flex flex-wrap gap-2 items-center">
<p className="text-[color:var(--color-text-muted)] text-xs">

// ❌ Breaks themes
<div className="bg-gray-900 text-white">     // hardcoded dark
<button className="bg-blue-500">             // hardcoded blue
```

---

## 9. Execution Order

### Wave 1 — Foundation (Now → +1 session)
1. ✅ Noir theme (done)
2. ✅ 7 flex-wrap critical fixes (done)
3. `theme.css` global button system refinement
4. `Layout.module.css` max-width on `.mainInner`
5. `StatsBar`, `DashboardPage` fixed-width element fixes
6. `BillingPage` search input `min(220px, 100%)`
7. `AuthPage` card max-width constraint

### Wave 2 — Visual Polish (+2 sessions)
1. Typography pass — `clamp()` based page title sizing
2. Per-page button bar standardization
3. QuoteBuilder mobile picker collapse
4. FilesPage filter wrap
5. ImportPage stepper visual upgrade

### Wave 3 — Component Architecture (Planned)
1. QuoteDetailPage component extraction
2. Mobile bottom tab bar
3. Skeleton loaders on all list pages
4. Illustrated empty states

---

## 10. Files to Track

| File | Wave | Status |
|---|---|---|
| `client/src/theme.css` | 1 | Noir theme ✅ |
| `client/src/pages/SettingsPage.jsx` | 1 | Noir wired ✅ |
| 7× `*.module.css` files | 1 | flex-wrap ✅ |
| `client/src/components/Layout.module.css` | 1 | max-width pending |
| `client/src/theme.css` (`.btn` global) | 1 | refinement pending |
| `client/src/components/StatsBar.module.css` | 1 | width fix pending |
| `client/src/pages/DashboardPage.module.css` | 1 | width fix pending |
| `client/src/pages/BillingPage.module.css` | 1 | search width pending |
| `client/src/pages/AuthPage.module.css` | 1 | max-width pending |
| `client/src/pages/QuoteDetailPage.jsx` | 3 | extraction pending |
