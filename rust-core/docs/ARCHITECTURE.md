# Rust Engine Core Architecture

BadShuffle keeps Node/Express as the public application backend. Rust is introduced as an internal engine service behind feature flags.

Current request path:

`Frontend -> Node /api/availability -> Rust engine (optional) -> Node fallback/normalization -> Frontend`

v0.0.12 scope:

- SQLite remains the system of record
- inventory availability is the only live Rust engine
- pricing, logistics, and quote engines are scaffold-only follow-ons

The Rust service reads the existing SQLite database in read-only mode and mirrors the same core concepts already used in the Node availability route:

- quote date windows
- signed vs potential reservations
- fulfillment reservations
- set-aside inventory
- oversell / out-of-stock settings

The public client contract does not change in this milestone.
