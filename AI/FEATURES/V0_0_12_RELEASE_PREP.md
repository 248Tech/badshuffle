# v0.0.12 Release Prep

## Baseline

- GitHub baseline: `origin/master`
- baseline tag: `v0.0.11`
- local release target: `v0.0.12`

## What Changed Since GitHub

### Product surfaces

- Quote Assistant
- Team Groups
- Notification Settings
- Set Aside inventory page
- Inventory AI description tools
- Rust diagnostics/admin controls

### Backend capabilities

- central notifications service and inbox routes
- team groups CRUD
- set-aside workflow and availability impact
- upload/import/export improvements
- Rust engine lifecycle, parity, release checks, pricing integration

### Platform/ops

- Rust release guard
- packaged release-check artifacts
- startup wait-for-server flow
- richer diagnostics trails

## Release Packaging Notes

- version is now set to `0.0.12`
- `package` is already guarded by `npm run check:rust:release`
- `release` still flows through `package`

## Do Not Treat As Release Source Files

- `logs/`
- `rust-core/target/`

These are local runtime/build outputs and should be excluded from the final source snapshot.

## Final Verification Pass

1. Confirm Rust engine is on the current build.
2. Run `npm run rust:parity-report`.
3. Run the client build.
4. Run the package flow.
5. Generate GitHub release notes from `AI/Next-Release.md`.
