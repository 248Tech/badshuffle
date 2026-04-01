# BadShuffle 0.0.11 Release Notes

Release date: 2026-03-31

## Summary

`0.0.11` is the visibility-and-operations release. It adds maps, analytics, fulfillment, profiles, team presence, permission-aware navigation, and a more scalable backend structure for the quote domain.

## Highlights

- Operator Maps workspace backed by Mapbox, quote geocode cache fields, and a dedicated maps API
- Sales analytics foundation with date-range, status, and staff filtering
- User profiles, persistent presence, and a Team workspace with roster, recent activity, and YTD performance context
- Fulfillment item rows, check-in actions, and internal fulfillment notes for confirmed projects
- Module-level role permissions with shared client/server gating
- Larger backend refactor into `server/db/*`, focused quote services, and reusable query/repository helpers
- Dedicated `AI/Api/` documentation for auth, inventory, quotes, public catalog usage, and e-commerce integration planning

## Notes

- This remains a `0.x` pre-release line
- Maps require a configured `MAPBOX_ACCESS_TOKEN`
- Formal e-sign compliance remains separate from the current internal audit/evidence trail
