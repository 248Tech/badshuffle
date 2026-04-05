# Architecture

## v0.0.12 Rust Engine Core

BadShuffle is not moving backward into a different stack. `rust.md` is being used as strategic direction only.

Decisions for this release:

- keep Node/Express as the application transport layer
- keep SQLite as the authoritative database
- add Rust as an internal engine service behind feature flags
- start with inventory availability only

Request flow:

`Frontend -> /api/availability -> Node legacy logic or Rust engine -> normalized response -> Frontend`

Rust service boundaries:

- `api`: Axum server
- `inventory-engine`: availability rules
- `db`: SQLite read layer
- `shared-types`: typed request/response contracts
- `telemetry`: logs and metrics

Future domains:

- pricing engine
- logistics engine
- quote engine

These remain scaffolds only in v0.0.12.
