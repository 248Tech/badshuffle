# Project Context

BadShuffle is a self-hosted event rental platform with a React/Vite client, an Express backend, and a SQLite database powered by `sql.js`.

Current architectural posture:

- Node/Express remains the public backend
- SQLite remains the system of record
- Rust is being introduced as an additive engine layer
- `/api/availability` is the first integration seam for the Rust service

Current release target:

- `v0.0.12 Rust Engine Core`

Primary goal:

- introduce a real Rust workspace and service without breaking existing product behavior
