# BadShuffle 0.0.9 Release Notes

Release date: 2026-03-26

## Summary

`0.0.9` is the security hardening and quote-workflow refactor release. It tightens auth/public/file behavior on the backend, extracts the largest quote flows into reusable services and helpers, and continues the QuoteDetail/QuoteBuilder decomposition so future work can land with less coupling and less drift.

## Highlights

- Stricter auth and public-surface handling around JWT, extension-token access, file serving, and public quote payloads
- Upload validation now uses detected file signatures instead of trusting browser MIME values
- Quote email attachments are restricted to files already linked to the active quote
- `server/routes/quotes.js` now delegates orchestration to:
  - `server/lib/quoteActivity.js`
  - `server/services/itemStatsService.js`
  - `server/services/quoteService.js`
- Shared quote pricing/totals logic moved to `client/src/lib/quoteTotals.js`
- QuoteDetail and QuoteBuilder have been broken into smaller modules, hooks, and focused panels for easier iteration

## Notes

- This remains a `0.x` pre-release line
- The backend extraction work is complete in this release
- Frontend refactor follow-through and broader responsive/theme QA remain active follow-up work
