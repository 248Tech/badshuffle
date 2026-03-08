# Client View Quote Page — UX/UI Redesign Guide

---

## 1. Overview

This document defines the UX/UI redesign task for the client-facing quote page.

- The agent has **full authority** over the presentation layer but **must not modify** backend behavior or API contracts.
- The goal is to improve **clarity**, **usability**, and **professionalism** of the client quote viewing experience.

---

## 2. Target Page

| | |
|---|---|
| **Route** | `/quote/public/:token` |
| **Component Entry Point** | `PublicQuotePage.jsx` |

This is the public client quote view used by customers to:

- Review a quote
- View items and pricing
- Read the contract
- Approve the quote
- Sign the contract
- Print or export the quote

The page must remain **publicly accessible**.

---

## 3. Design Authority

The agent has **full control** over the presentation layer. This includes redesigning or restructuring the following.

### Layout

The agent may change:

- Page structure
- Section ordering
- Grid systems
- Card layouts
- Spacing
- Section grouping
- Visual hierarchy

### Visual Design

The agent may modify:

- Typography
- Color usage
- Icon usage
- Spacing
- Section emphasis
- Layout density

### Components

The agent may redesign or restructure:

- Quote summary
- Client information
- Event / venue information
- Line item tables
- Custom items
- Totals summary
- Contract display
- Signature UI
- Approval controls
- Image/media displays

### UX States

The agent may redesign how the page behaves in the following states:

- Loading
- Error
- Empty data
- Contract signing
- Quote approved
- Quote declined

---

## 4. Responsiveness Requirements

The page must function well on:

- Desktop
- Tablet
- Mobile

Design should prioritize:

- Readable content
- Clear sections
- Usable buttons
- Responsive layouts

---

## 5. Accessibility Guidelines

Follow best practices where possible:

- Readable typography
- Semantic HTML structure
- Keyboard navigation
- Visible focus states
- Adequate contrast ratios

Accessibility improvements are encouraged but not mandatory.

---

## 6. Design Tone

The design tone should aim for something similar to:

- Minimal
- Clean
- Premium
- Professional
- Client-friendly

The page should feel **trustworthy** and **easy for clients to approve**.

---

## 7. Hard Constraints (Do NOT Change)

The following elements are **strictly fixed** and must not change.

| Constraint | Requirement |
|------------|-------------|
| **Route** | `/quote/public/:token` |
| **Component Entry Point** | `PublicQuotePage.jsx` |
| **API Usage** | The page must continue using the same data source: `getPublicQuote` |

The following data structures must remain unchanged:

- `quote`
- `items`
- `customItems`
- `contract`

**Do not modify backend contracts or API behavior.**

---

## 8. Required Client Actions

The following actions must remain available:

- **Approve Quote**
- **Sign Contract**
- **Print / Export PDF**

The UI may be redesigned, but the **functionality** must remain intact.

---

## 9. Authentication Rules

- The page must remain **public**.
- No authentication should be required.
- Clients access the page via the public token URL.

---

## 10. Required Content

All of the following must still appear **somewhere** on the page. The layout and order may change, but the content must remain visible.

### Quote Information

- Quote name
- Quote date

### Client Information

- Client details

### Event Information

- Venue
- Event details

### Quote Items

- Line items
- Custom items (if present)

### Pricing

- Totals summary

### Contract

- Contract text

### Client Actions

- Approve
- Sign
- Print / PDF

---

## 11. Implementation Guidelines

- Follow existing project conventions where possible.

### Styling

Prefer existing styling systems:

- CSS Modules
- Existing theme variables
- Current component patterns

### Images

When displaying images, use:

- `api.proxyImageUrl`

### Print Support

Improve or add clean print styling using:

- `@media print`

The quote should print cleanly.

---

## 12. Design Freedom

The agent may **completely redesign** the visual experience if doing so improves:

- Clarity
- Usability
- Professional appearance
- Client approval conversion

The agent is **not required** to preserve the current layout.

---

## 13. Agent Task

The agent should **redesign** the `PublicQuotePage`.

Focus on:

- Improving readability
- Improving visual hierarchy
- Making approval actions clear
- Making the quote feel professional
- Improving mobile layout
- Improving print output

---

## 14. Expected Output

The agent **must** return the following sections.

### 1. UX Explanation

Explain:

- New layout structure
- Section hierarchy
- Visual design decisions
- Usability improvements

### 2. Implementation Plan

Explain:

- Component structure changes
- New layout sections
- How state handling works
- How approval / signing flows appear in the UI

### 3. Code Changes

Provide the updated or refactored code for:

- **PublicQuotePage.jsx**

The code should be **production ready** and compatible with the existing project structure.

---

*End of Guide*
