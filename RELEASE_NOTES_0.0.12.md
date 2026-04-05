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

## GitHub Release Body

`0.0.12` is the operations, AI, and engine release.

### Added

- Rust engine workspace with guarded availability/conflict integration, pricing scaffolding, parity checks, lifecycle controls, and release gating
- Quote Assistant, Team Chat, Team Groups, live notifications, notification settings, and stronger internal coordination workflows
- Managed local Onyx and managed local Ollama support for BadShuffle AI features
- Inventory set-aside workflows, AI batch editing, improved search modes/ranking, serial numbers, QR-backed product identity, and product sales totals
- Pull-sheet generation, aggregate pull export for overlapping jobs, and scan-aware internal picking views
- Clients, Venues, Help, Appearance settings, and runtime-oriented admin controls

### Improved

- Quote/project operator workflow with pull sheets, assistant tools, column controls, clearer conflict status, and stronger mobile behavior
- Inventory usability across mobile and desktop, including layout controls, selection behavior, and search relevance
- Admin/runtime operations for Rust, Onyx, and Ollama
- Release readiness with guarded parity verification and cleaner startup behavior

### Credits

BadShuffle `0.0.12` builds on and integrates with important external software and platforms, including **React**, **Vite**, **Express**, **SQLite/sql.js**, **Rust**, **Mapbox**, **Onyx**, **Ollama**, **bwip-js**, **Sharp**, **IMAPFlow**, **Nodemailer**, and optional hosted AI providers including **OpenAI**, **Anthropic**, and **Gemini**.
