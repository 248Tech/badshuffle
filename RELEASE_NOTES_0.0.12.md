# BadShuffle 0.0.12 Release Notes

Release date: 2026-04-05

## Summary

`0.0.12` is the operations, AI, and engine release. It adds a guarded Rust engine layer, quote-scoped AI workflows, live internal notifications and team chat, deeper inventory operations, pull sheets, QR-backed product identity, and more complete admin/settings/help surfaces.

## Highlights

- Rust engine workspace with guarded inventory availability/conflict integration, pricing-engine scaffolding, lifecycle controls, parity reports, and release gating
- Quote Assistant foundation with quote-aware AI help, provider/model routing, and richer item-description/suggestion workflows
- Team Chat, Team Groups, live notifications, notification settings, and stronger presence-aware coordination
- Managed local Onyx support plus managed local Ollama support for BadShuffle AI features
- Inventory upgrades including set-aside workflows, batch AI edit UX, better search, mobile/desktop grid controls, serial numbers, QR identity, and product sales totals
- Pull-sheet generation, aggregate pull export for overlapping jobs, and scan-aware internal picking views
- New Clients and Venues directory pages with stronger quote-linked relationship syncing
- Expanded Admin > System controls, guided Help documentation, and a dedicated Appearance settings page

## Notes

- This remains a `0.x` pre-release line
- Rust is introduced as a guarded internal engine service; Node/Express and SQLite remain the primary application/runtime layers
- Managed local AI features depend on the target machine having the required companion runtime support available
- Formal legal e-sign compliance remains separate from the current internal audit/evidence trail
