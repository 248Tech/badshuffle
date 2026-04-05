# RUST_ENGINE_CORE_V0_0_12

## Goal

Ship the first real Rust execution layer for BadShuffle under one internal milestone.

## Included

- `rust-core/` Cargo workspace
- Axum service with health, readiness, metrics, and inventory engine endpoint
- SQLite-backed Rust inventory availability logic
- Node feature flag integration:
  - `USE_RUST_INVENTORY`
  - `RUST_INVENTORY_SHADOW_MODE`
- rollout docs and AI coordination files

## Non-goals

- full backend rewrite
- PostgreSQL migration
- replacing the existing Node application layer
- full pricing/logistics/quote engine extraction in this release
