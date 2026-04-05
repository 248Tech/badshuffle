# Decisions

## 2026-04-01 — Use `rust.md` as direction, not as literal architecture
Reason:
The document assumed Node/TS and PostgreSQL, but BadShuffle is currently Node/JS and SQLite.

Implications:
- no backward migration to PostgreSQL for this milestone
- no TypeScript-first integration requirement
- Rust implementation follows the current product reality

## 2026-04-01 — Inventory availability is the first live Rust seam
Reason:
BadShuffle already centralizes availability behind `/api/availability`, making it the lowest-risk integration point.

Implications:
- frontend contract stays unchanged
- Node can shadow-run Rust and compare outputs
- later engines can reuse the same service pattern
