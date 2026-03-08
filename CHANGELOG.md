# Changelog

All notable changes are documented here. The project uses [Semantic Versioning](https://semver.org/). **Until 1.0.0, all releases are pre-release** and the public API may change.

## Version history (canonical)

- **0.1.0** – Initial release
- **0.1.1**, **0.1.2** – Early fixes
- **0.2.0** – Feature release
- **0.3.0**, **0.3.1** – Quote workflow, admin CLI, leads, auth improvements

**Note:** Earlier tags using a 3.x scheme were created on the remote in error. The project version line remains **0.x** until an official 1.0 release. Use **0.4.x** as the current pre-release line.

---

## [0.4.2] - 2026-03-07

### Added
- **Availability & conflict detection** — `/api/availability/conflicts`, `/api/availability/subrental-needs`, `/api/availability/quote/:id`; considers quote status and rental date ranges (delivery → pickup).
- **Vendor / subrental system** — `vendors` table; CRUD API; items support `is_subrental` and `vendor_id`; Vendors management page; vendor selection in item editor.
- **Rental date fields on quotes** — `rental_start`, `rental_end`, `delivery_date`, `pickup_date`; editable in quote editor.
- **Dashboard** — Conflicts panel (items over-reserved); Subrental Needs panel (items needing external source).
- **Quote builder** — Conflict indicator icon next to line items that overlap with other reservations.
- **Setting** — `count_oos_oversold` (whether out-of-stock items count toward dashboard conflict detection).
- **Client API helpers** — `getVendors`, `createVendor`, `updateVendor`, `deleteVendor`, `getConflicts`, `getSubrentalNeeds`, `getQuoteConflicts**.

### Development
- Initial Bun support testing in dev workflow (non-breaking).

---

## [0.4.1] - (tag exists; features documented in 0.4.2)

---

## [0.4.0] - 2026-03-06

### Added
- **AI folder** — Consolidated documentation for onboarding and extension: PROJECT_OVERVIEW, ARCHITECTURE, FEATURES, DATA_MODELS, WORKFLOWS, TODO, KNOWN_GAPS, SETUP, README.
- **README** — "Coming soon" section: pull sheets, role badge, email on role change, send preview, inventory reservation, delivery/return tracking.

### Changed
- GitHub README updated to v0.4.0; project structure now includes `AI/`.

---

## [0.3.2] - 2026-03-06

### Changed
- Version metadata and CHANGELOG added; canonical version remains 0.x pre-release.

### Added
- Billing page: overpaid quotes list for sales (refund due).
- Quote quickview: remaining balance below contract total (red); overpaid badge and overpaid amount when applicable.

---

## [0.3.1]

- Quote workflow, venue/totals, PDF export, leads import.

## [0.3.0]

- Admin CLI, auth guard fixes, role enforcement.

## [0.2.0]

- Extension, leads, inventory improvements.

## [0.1.x]

- Initial app: inventory, quotes, auth, setup.
