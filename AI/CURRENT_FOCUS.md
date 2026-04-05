# Current Focus

Release: `v0.0.12 Rust Engine Core`

Active implementation focus:

1. Consolidate Rust scope to the two justified engine domains: inventory availability/conflicts and quote pricing
2. Keep inventory Rust rollout guarded by parity reports, admin diagnostics, and release checks
3. Move pricing from parity-only toward feature-flagged live use with legacy fallback and mismatch logging
4. Avoid adding new Rust domains until inventory and pricing are production-stable
