# HANDOFF — BadShuffle UI/UX Redesign

**Type:** Cosmetic redesign, non-breaking
**Produced:** 2026-03-23
**Source:** Raw design notes → structured design system memo
**Next Action:** Aider begins Phase 1 implementation

---

## Summary

A full UI/UX redesign memo has been produced for BadShuffle based on raw design notes identifying four core problems: visual flatness, weak hierarchy, no breathing room, and no interaction feedback.

The redesign transforms BadShuffle from a functional internal tool into a product that looks and feels like a polished SaaS. No APIs, business logic, or features change. The entire scope is presentation layer.

**Three artifacts produced:**
1. `ai/UXDesign/BADSHUFFLE_REDESIGN.md` — Complete design spec (12 sections, execution-ready)
2. `ai/TODO.md` — 20 new UX tasks with agent routing, file targets, and priorities
3. `ai/HANDOFF.md` — This document

---

## Key Decisions

### 1. The Background Layer Is the Biggest Single Win
The single highest-leverage change in the entire redesign is one line:
```css
body { background: var(--color-surface); }
```
Currently `body` and `.card` both use `--color-bg` (white). They're indistinguishable. Switching body to `--color-surface` (already defined as light gray in all 4 themes) creates instant visual depth across every page with zero risk.

**Implementation note:** Aider should do this FIRST, before any other change. Cursor then verifies across all themes.

### 2. Two New Derived Tokens Replace All Inline rgba() Calls
The design requires a "primary-light" and "primary-hover" tint throughout (sidebar active, quote summary, inventory overlay). Rather than hardcoding `rgba(26, 143, 193, 0.12)` everywhere and breaking on theme switch, we add two derived tokens using `color-mix()` (already used in the codebase):
```css
--color-primary-subtle: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg));
--color-primary-hover:  color-mix(in srgb, var(--color-primary) 20%, var(--color-bg));
```
These must be added to ALL 5 `:root` blocks in `theme.css` (default + 4 themes).

### 3. Quote Builder Item Cards Replace Table Rows — Most Complex Change
The Quote Builder is the critical path screen. The redesign converts line items from table rows to card components. This is the most complex single change because `QuoteBuilder.jsx` has existing drag-to-reorder logic (HTML5 drag handles), discount badge rendering, and qty controls that must continue working inside the new card layout.

**Implementation note:** Aider must NOT change the drag, discount, or qty logic — only the wrapping layout/styling. Cursor should polish spacing and verify drag still functions after Aider's pass.

### 4. Stepper for Import Flow Is New JSX, Not CSS-Only
The Import flow stepper (UX-16) requires state management (current step) inside `ImportPage.jsx`. This is the only Phase 3 item that touches JSX meaningfully. All other Phase 3 items are CSS changes applied to existing structure. Aider should implement this as a local state pattern inside `ImportPage.jsx` — no new component extraction required unless the same stepper is needed elsewhere (it is not, currently).

### 5. `theme.css` Is the Correct Place for Global Changes
The app uses CSS Modules per-file, but `theme.css` defines global utilities (`.card`, `.btn`, `.badge`, `.empty-state`, `.spinner`). All Phase 1 changes belong in `theme.css` — this ensures they apply everywhere without touching individual files. Phase 2+ changes go into per-file CSS Modules.

### 6. Hover Overlays on Inventory Cards Must Not Break Touch
The inventory card hover overlay (action buttons appear on hover) works cleanly on desktop. On touch devices, hover doesn't trigger. The solution: on touch devices, actions should remain visible (or appear on tap). CSS `@media (hover: none)` can be used to keep buttons visible on touch screens. Cursor should handle this during Phase 4 mobile pass.

### 7. No New npm Packages
Every technique used (CSS transitions, `color-mix()`, `position: sticky`, CSS Grid/Flexbox, keyframe animations) is browser-native. No additional dependencies.

---

## Files Created/Updated

| File | Action | Notes |
|---|---|---|
| `ai/UXDesign/BADSHUFFLE_REDESIGN.md` | Created | Full 12-section design spec |
| `ai/TODO.md` | Updated | Added 20 UX tasks (UX-1 through UX-20), preserved existing backlog |
| `ai/HANDOFF.md` | Updated | This document |

---

## Files Aider Will Touch (by phase)

### Phase 1 (start here)
| File | Change |
|---|---|
| `client/src/theme.css` | body background, derived tokens, btn:active, card hover |
| `client/src/components/Layout.module.css` | content area padding + max-width |
| `client/src/components/Sidebar.module.css` | active pill, hover state, section spacing |

### Phase 2
| File | Change |
|---|---|
| `client/src/pages/DashboardPage.jsx` | KPI card structure, empty states |
| `client/src/pages/DashboardPage.module.css` | .kpiCard, .kpiValue, .kpiLabel styles |
| `client/src/components/ItemCard.jsx` | Add overlay div for hover actions |
| `client/src/components/ItemCard.module.css` | Hover overlay, image aspect-ratio, lift transform |
| `client/src/pages/InventoryPage.module.css` | Filter bar scroll, pill styles |
| `client/src/pages/LeadsPage.module.css` | Row padding, hover, sticky header |
| `client/src/pages/BillingPage.module.css` | Same as LeadsPage |

### Phase 3
| File | Change |
|---|---|
| `client/src/components/QuoteBuilder.jsx` | Item card structure (layout only, keep logic) |
| `client/src/components/QuoteBuilder.module.css` | .quoteItem card styles, addedFlash animation, summary panel |
| `client/src/pages/QuoteDetailPage.module.css` | Summary total emphasis, action grouping |
| `client/src/pages/ImportPage.jsx` | Add stepper state + step navigation |
| `client/src/pages/ImportPage.module.css` | Stepper styles, step card styles |
| `client/src/pages/MessagesPage.jsx` | Empty state JSX, thread list structure |
| `client/src/pages/MessagesPage.module.css` | Thread row styles, bubble styles |

### Phase 4 (Cursor)
| File | Change |
|---|---|
| `client/src/theme.css` | Add .skeleton class |
| All loading components | Replace text/spinner loading with skeleton |
| All relevant files | Mobile/responsive fixes |

---

## Implementation Guidance for Aider

### Order of Execution
1. **`theme.css` first, always.** Every global change must land before per-screen work begins. Otherwise screens look inconsistent mid-implementation.
2. **Layout.module.css second.** Sets the spatial canvas for everything else.
3. **Sidebar.module.css third.** Navigation is the persistent chrome — fix it early.
4. **Then screens in order:** Dashboard → Inventory → Leads/Billing → Quote Builder → Import → Messages.
5. **Quote Builder last** in Aider's scope because it's the most structurally complex.

### How to Read the Design Memo
- Section 5 = tokens/variables to change (theme.css targets)
- Section 6 = layout changes (Layout.module.css, Sidebar.module.css)
- Section 7 = per-screen changes (one subsection per screen)
- Section 8 = interaction patterns (theme.css + per-component)
- Section 10 = phase ordering

### What Aider Should NOT Do
- Do not refactor JSX component hierarchy — change styles and minimal structure only
- Do not change any prop names, state variables, or event handlers
- Do not add TypeScript or PropTypes
- Do not extract new components unless the task explicitly says to (e.g., Stepper for ImportPage)
- Do not touch `server/` — this is frontend-only
- Do not add `!important` to override specificity conflicts — fix the root selector instead

### CSS Module Specificity
The existing codebase uses CSS Modules. When adding new styles, add them to the relevant `.module.css` file and reference them as `styles.className` in the JSX. Never inject style tags or use global class names in component files.

---

## Risks / Watchouts

### Risk 1: theme.css Card Hover + Pages With Dense Card Grids
Adding `card:hover { box-shadow: var(--shadow-md) }` globally will apply to every `.card` instance, including tables, form sections, and modal content. On pages where cards are stacked tightly (Settings page), constant hover shadow changes can feel noisy. **Mitigation:** Add a `.card-static` modifier class for cards that should not have hover elevation (settings form cards, modal bodies). Cursor should audit during Phase 4.

### Risk 2: `body { background: var(--color-surface) }` on Auth/Setup Pages
The auth and setup pages (login, password reset, first-time setup) may look different with a light gray body — some are centered card layouts that rely on white body for full-bleed appearance. **Mitigation:** Aider should check `AuthPage.jsx` and `SetupPage.jsx` after changing body background. These may need `min-height: 100vh; background: var(--color-surface)` on the page wrapper to maintain their centered layout.

### Risk 3: Inventory Hover Overlay on Touch
The hover-based action overlay on ItemCard does not trigger on touch devices (iOS/Android). Users on tablets won't be able to add items. **Mitigation:** Add `@media (hover: none) { .itemCardOverlay { display: flex; } }` to show the overlay permanently on touch devices. Handle in Phase 4 mobile pass.

### Risk 4: Quote Builder Drag-to-Reorder + New Card Layout
`QuoteBuilder.jsx` has HTML5 drag-and-drop reorder logic tied to the current item row structure (dragstart, dragover, drop handlers, visual drag handle). Converting rows to cards changes the DOM structure. The drag handle (⠿) must remain as the first child of each item card and the `draggable` attribute must stay on the item wrapper. **Mitigation:** Aider should preserve the exact draggable structure — only wrap in a card container, do not restructure the interior drag elements.

### Risk 5: Sticky Summary Panel in Quote Builder
`position: sticky` requires the parent container to have `overflow: visible` (not `overflow: auto` or `overflow: hidden`). If the QuoteBuilder's layout container clips overflow, sticky won't work. **Mitigation:** Cursor should verify and fix parent overflow settings after Aider implements sticky.

### Risk 6: color-mix() Browser Support
`color-mix()` is supported in all modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+). The app appears to target desktop/modern browsers given the pkg/Windows EXE packaging. No polyfill needed. However, if the packaged client exe uses an older Chromium version via electron or similar, verify support.

---

## Next Recommended Tool

**Aider** — Begin with Phase 1. Provide the following files as context:
- `ai/UXDesign/BADSHUFFLE_REDESIGN.md` (full spec)
- `client/src/theme.css` (first target)
- `client/src/components/Layout.module.css`
- `client/src/components/Sidebar.module.css`

First prompt to Aider:
> "Implement UX-1 through UX-6 from the design spec in ai/UXDesign/BADSHUFFLE_REDESIGN.md. These are Phase 1 foundation changes to theme.css, Layout.module.css, and Sidebar.module.css. No JSX changes. No API changes. CSS and theme tokens only. See sections 5 and 6 of the design memo for exact values."

After Aider completes Phase 1, hand to **Cursor** for cross-theme visual QA before proceeding to Phase 2.
