# Workflow

For `v0.0.12`, use this execution order:

1. Keep AI coordination files current
2. Build Rust workspace and service foundation
3. Mirror existing availability behavior in Rust
4. Add Node feature-flag integration and fallback
5. Verify parity with targeted checks
6. Record exact gaps and next steps in handoff docs

Release discipline:

- additive only
- no removal of legacy availability logic
- no silent completion claims
- document any parity gaps explicitly
