# Inventory Engine

The inventory engine reproduces BadShuffle's current availability math in a typed, testable service boundary.

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /metrics`
- `POST /engine/inventory/check`

## Supported actions

- `quote_items`: availability for selected items on a quote, optionally scoped to a section
- `quote_summary`: aggregate conflict status for all quote items

## Data sources

The engine reads directly from the existing SQLite database:

- `items`
- `quotes`
- `quote_items`
- `quote_item_sections`
- `contracts`
- `contract_signature_items`
- `quote_fulfillment_items`
- `item_set_asides`
- `settings`

## Rollout

Node controls rollout with:

- `USE_RUST_INVENTORY=1`
- `RUST_INVENTORY_SHADOW_MODE=1`

When shadow mode is enabled, Node returns the legacy result and logs Rust mismatches for inspection.
