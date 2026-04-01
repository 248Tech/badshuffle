# Dashboard Redesign Proposal
Generated: 2026-03-30

---

## What's Broken Now

The current `SalesDashboard` component replaced the original dashboard and broke several things simultaneously:

### 1. Theme clash (critical)
The entire app uses a light/neutral theme via CSS variables (`--color-bg`, `--color-surface`, `--color-text`, etc.). The sales dashboard hardcodes a full dark navy palette (`#07111f`, `#0c1728`, `bg-white/10` borders, `text-white`). It looks like a completely different product was dropped into the middle of the app with no blending.

### 2. Mobile is broken (critical)
- The sidebar (`300px`) stacks on top of everything below `lg` breakpoint. On a phone you see the sidebar, scroll past it, then reach the content.
- The hero section has a long paragraph of placeholder copy that takes up 30% of the phone screen.
- The chart's right-side detail panel (`320px` fixed) stacks below the chart on mobile — two tall sections back to back.
- KPI cards use `md:grid-cols-3` — on a 375px phone each card is ~117px wide, the text overflows.
- No mobile filter access (sidebar is just there, there's no drawer/sheet toggle on small screens).

### 3. Wrong content for a daily-use home page (UX)
The current dashboard is an analytics deep-dive tool. It answers "how is the pipeline doing over a date range?" — that's a stats/reporting page use case. A **home page** dashboard should answer: "What do I need to do today, and what just happened?"

The current page has zero:
- Recent quotes or activity
- Upcoming event dates / conflicts
- Quick-create actions
- Unread messages indicator
- Inventory alerts

### 4. Information hierarchy inverted
Users land on a 3xl hero headline ("Revenue flow, from quote to close"), read a paragraph description, then scroll past a large area chart before seeing anything actionable. Stats should be glanceable up top; heavy analysis should be below or on a separate page.

### 5. Verbosity
The filter sidebar is labeled "Pipeline Controls" with a subtitle. Each section has a header. The chart section has a 2-line description paragraph. This copy belongs in a product tour or onboarding — not persistent UI.

---

## Proposed Redesign

### Philosophy
The home page should work like a morning briefing: one-glance status, what needs attention, recent events. The sales analytics belongs on the existing **Stats page** or as a tab within it.

---

## Layout — Mobile-first, 2-column on desktop

```
MOBILE (≤640px)               DESKTOP (≥1024px)
─────────────────────         ────────────────────────────────────
 [ Quick Stats Row ]           [ Quick Stats Row (4 cols)        ]
 [ Conflicts / Alerts ]        ┌──────────────┬─────────────────┐
 [ Recent Quotes     ]         │ Recent Quotes│ Upcoming Events │
 [ Upcoming Events   ]         │              │ + Conflicts     │
                               └──────────────┴─────────────────┘
                               [ Mini Revenue Chart (sparklines) ]
```

No persistent sidebar. Filters only appear where they're needed (e.g., in the mini chart section).

---

## Section Breakdown

### A. Quick Stats Strip (top, always visible)

4 stat pills in a horizontal scroll row on mobile, 4-column grid on desktop.

| Stat | Source |
|------|--------|
| Open quotes | count of quotes where status = quoteSent |
| Confirmed bookings | count where status = contractSigned |
| This month revenue | sum of contractSigned quotes this calendar month |
| Unread messages | count of unread message threads |

**Design:**
- Each is a compact card: large number, small label, subtle colored left-border accent
- Uses app theme colors (no dark navy) — same surface/border CSS variables as the rest of the app
- On mobile: horizontal scroll row (`flex overflow-x-auto gap-3 pb-1`)
- On desktop: `grid grid-cols-4 gap-4`
- One card per stat, no paragraphs, no descriptions

---

### B. Inventory Conflicts Alert (conditional)

Only shown when conflicts exist. Visually urgent but not modal.

```
⚠  3 availability conflicts   [View all →]
   · Tent 40x60 — Sunset Wedding (Jun 14) and Garden Party (Jun 14)
   · PA System — 2 overlapping bookings Jul 4
```

- Collapses to a single line badge if > 3 conflicts
- Dismiss-able per session
- Links directly to the conflicting quote
- Background: `bg-warning-subtle`, border `border-warning`, icon in amber
- On mobile: full width, stacked list of up to 3 items with "View X more"

---

### C. Recent Quotes (left column on desktop, full width on mobile)

A feed of the 8 most recently modified quotes.

Each row:
```
[Status badge]  Quote Name            Event date
                Client name           $total
```

- Status badge: colored pill (Draft / Sent / Signed / Lost)
- Clicking a row navigates to that quote
- "View all quotes →" link at the bottom
- No pagination — this is a glanceable list, not a full table
- Sorted by `updated_at DESC`

**Design:**
- Compact list cards with `border-b border-border` separators (no individual card borders)
- `py-3 px-4` padding per row
- Hover: `bg-surface` highlight
- Wraps in a section card: `bg-bg border border-border rounded-lg`

---

### D. Upcoming Events (right column on desktop, below recent quotes on mobile)

Quotes with an event date in the next 60 days, sorted ascending.

```
 JUN
  14   Sunset Wedding — Sarah & Tom        [Confirmed]
       Overlake Farm · $4,200

 JUN
  28   Corporate Gala                      [Quote Sent]
       Downtown Convention Center · $8,500
```

- Calendar-style date display (large day number, month above)
- Status badge inline
- Conflict indicator if the date has a conflict (red dot on date)
- "No upcoming events" empty state

**Design:**
- Same section card as Recent Quotes
- Date column: `w-12 text-center shrink-0`
- Day: `text-2xl font-bold`
- Month: `text-[10px] uppercase tracking-wider text-text-muted`
- On mobile: collapses to a compact list without the big date block (just `Jun 14 — Sunset Wedding`)

---

### E. Revenue Sparklines (desktop only, or collapsed on mobile)

Lightweight chart summary — NOT a full analytics tool. Three small sparklines in a row:

| Sparkline | Description |
|-----------|-------------|
| Monthly booked revenue (last 6 months) | Small area chart, no axes |
| Quote-to-signed conversion rate | Line chart, just the trend |
| Avg deal size | Bar chart trend |

Each has a headline number above the chart.

**Design:**
- Uses app theme colors — primary color for the line, surface for background
- Height: 60px each (they're supplemental, not the focus)
- `grid grid-cols-3 gap-4` wrapper
- On mobile: this section is collapsed behind a "Show revenue summary" disclosure or hidden entirely

---

## What Happens to the Sales Dashboard Feature

The SalesAnalytics components (`SalesFilters`, `SalesChart`, `KPISection`) are well-built and shouldn't be deleted. Move them:

**Option 1 (recommended):** Add a "Analytics" tab to the existing **Stats page** (`/stats`). The Stats page already exists and is the appropriate place for pipeline analysis. The dashboard home page links to it.

**Option 2:** Keep `/dashboard` as-is but add a tab switcher at the top: `Overview` | `Pipeline Analytics`. Overview = the new design above. Pipeline Analytics = the current SalesDashboard content, but with the dark theme normalized to match the app.

---

## Theme Normalization (if keeping SalesAnalytics)

If the dark analytics UI is intentional (e.g., it feels more "dashboard-y"), it still needs adjustment:

1. **Sidebar** (`SalesFilters.tsx`): Replace hardcoded `bg-[#07111f]` with `var(--color-surface)`, `text-white` with `var(--color-text)`, `border-white/10` with `var(--color-border)`. This one component causes the most visual whiplash.

2. **Hero section**: Remove entirely or replace with a compact `<h1>` + date range indicator. The current hero is 30% of the viewport on desktop and contributes nothing actionable.

3. **KPI cards**: Keep the colored gradients but reduce `rounded-[24px]` to the app's standard `var(--radius)` or `rounded-lg`. The extreme border-radius reads as "different design system."

4. **Chart section**: Replace `bg-[#07111f]` with `var(--color-bg)`, keep the Recharts chart — it works fine. The hardcoded dark background is the main issue.

---

## Mobile Redesign Specifics

The current layout is completely unusable on mobile. Required fixes regardless of which redesign direction is chosen:

| Issue | Fix |
|-------|-----|
| Sidebar stacks on top | Move filters to a slide-up sheet triggered by a filter icon button |
| Filter button placement | In the page header row, right side: `[Page title] [Filter icon] [Date range]` |
| KPI grid on mobile | 2×3 grid or horizontal scroll, not 3×3 |
| Chart detail panel | On mobile: tap a point on the chart → detail slides up from bottom (modal/sheet) instead of rendering as a side column |
| Hero copy | Remove the paragraph description entirely on mobile |

---

## Recommended Implementation Order

1. **Immediate (unblock):** Wrap `<SalesDashboard />` in a normal page container that applies the app's standard page padding and overrides the most jarring dark backgrounds. Add a `<h1>Dashboard</h1>` header matching other pages. This makes it "not broken" without a full rewrite.

2. **Short term:** Build the 4-stat quick stats strip and the recent quotes list. These need no new API endpoints — quote data is already available.

3. **Medium term:** Build the upcoming events section (requires `event_date` from quotes). Build the conflicts section (reuse existing availability check data).

4. **Long term:** Migrate `SalesDashboard` to a tab on `/stats`. Build the sparklines on the home dashboard.

---

## API Data Availability

| Dashboard Section | Data Available? | API / Hook |
|-------------------|----------------|-----------|
| Open quote count | Yes | Existing quotes API |
| Confirmed count | Yes | Existing quotes API |
| This-month revenue | Yes | Existing quotes API with date filter |
| Unread messages | Needs check | `/messages` route — check if unread count is exposed |
| Conflicts | Yes | Existing availability endpoint |
| Recent quotes | Yes | Quotes list with `sort=updated_at` |
| Upcoming events | Yes | Quotes with `event_date` filter |
| Revenue sparklines | Yes | Repurpose `SalesAnalytics` endpoint |
| Staff options | Yes | Available in `SalesAnalytics` response |

---

## Files to Create / Modify

```
client/src/pages/DashboardPage.jsx             ← replace SalesDashboard with new layout
client/src/pages/DashboardPage.module.css       ← new styles
client/src/features/dashboard/                  ← new feature folder
  components/
    QuickStatsStrip.jsx
    RecentQuotesFeed.jsx
    UpcomingEvents.jsx
    ConflictsAlert.jsx
    RevenueSparklines.jsx   (optional / defer)
  hooks/
    useDashboardData.js     ← single hook fetching all dashboard data in parallel
client/src/pages/StatsPage.jsx                  ← add "Pipeline Analytics" tab
                                                   wrapping existing SalesDashboard
```

The existing `sales-dashboard/` feature folder stays untouched and gets re-homed under StatsPage.
