# BadShuffle 0.0.10 Release Notes

Release date: 2026-03-29

## Summary

`0.0.10` is the workflow-expansion and product-polish release. It improves client-facing quote presentation, section-aware quote composition, inventory availability realism, audit-oriented contract signing, navigation responsiveness, and upload governance.

## Highlights

- Quote item areas can now act as real sections with their own titles, rental periods, subtotals, duplication, and deletion behavior
- Public quote pages now present grouped sections, item descriptions, and grouped subtotals in a more client-friendly way
- Signed vs unsigned project state is clearer in project totals/balances and in client-facing re-signature flows
- Signed contract artifacts now retain versioned PDFs with stronger audit metadata
- Inventory item editing can stay in-context via a right-side slideout
- Core app navigation is faster thanks to route prefetching and idle warm-up
- File uploads can now prompt operators to extend the allowed file type list from Settings when new file formats appear

## Notes

- This remains a `0.x` pre-release line
- The repo is now better aligned for GitHub/release discoverability via README, metadata, badges, and release-note refreshes
- Formal e-sign compliance remains a separate concern from the current internal audit trail implementation
