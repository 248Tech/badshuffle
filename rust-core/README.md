# Rust Engine Core

`rust-core/` is the first BadShuffle Rust execution layer. It is intentionally additive: Node/Express remains the app backend, while Rust provides feature-flagged engine execution for inventory availability.

## Workspace layout

- `crates/api`: Axum service entrypoint
- `crates/inventory-engine`: inventory availability rules
- `crates/shared-types`: typed request/response contracts
- `crates/db`: SQLite connection layer
- `crates/config`: env loading
- `crates/telemetry`: tracing + metrics
- `crates/events`: future engine event scaffolding

## Run

```bash
cargo run --manifest-path rust-core/Cargo.toml -p api
```

Useful env vars:

- `RUST_ENGINE_HOST=127.0.0.1`
- `RUST_ENGINE_PORT=3101`
- `RUST_ENGINE_DB_PATH=/absolute/path/to/badshuffle.db`
- `RUST_LOG=info`

If `RUST_ENGINE_DB_PATH` is not set, the service falls back to `DB_PATH`, then `server/badshuffle.db`.
