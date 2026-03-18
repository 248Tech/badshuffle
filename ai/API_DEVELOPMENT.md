# API-First Development — Mandatory for All New Work

**All development going forward must consider the API.**

This document is part of the AI coordination layer. When implementing features, all editor/agent workflows must treat the API as a first-class surface.

## Rule

- **Every feature that exposes or changes data must be reflected in the API.**  
  If you add or change behavior that the client uses (or that an external consumer could use), you must:
  1. **Implement or update the API v1 surface** — use the versioned base path `/api/v1` and the shared route modules (see `server/api/v1.js`).
  2. **Keep the OpenAPI spec in sync** — update `server/api/openapi.json` when adding or changing v1 endpoints, request bodies, or response shapes.
  3. **Use the v1 response envelope** — success: `{ data, meta }`, error: `{ error: { code, message }, meta }`. Envelope middleware is in `server/lib/apiEnvelope.js`; do not bypass it for new v1 JSON responses.
  4. **Prefer v1 for new endpoints** — new JSON endpoints should be added under `/api/v1` (and optionally mirrored on legacy `/api` if the existing client still uses it). Document the v1 contract in the OpenAPI spec.

## Where the API Lives

- **v1 router**: `server/api/v1.js` — mounts all v1 routes with envelope middleware.
- **Envelope**: `server/lib/apiEnvelope.js` — standardizes success/error JSON for v1.
- **OpenAPI spec**: `server/api/openapi.json` — single source of truth for v1 contract.
- **Docs**: `GET /api/v1/docs` — Swagger UI; `GET /api/v1/openapi.json` — raw spec.

## Checklist for New or Changed Features

When adding or changing a feature that touches the server:

- [ ] If it adds or changes an HTTP endpoint, add or update it under the v1 router and (if needed) under legacy `/api`.
- [ ] Update `server/api/openapi.json` with the new/updated path, parameters, and response description.
- [ ] Ensure errors use `res.status(4xx).json({ error: 'message' })` so the envelope can produce `{ error: { code, message } }`.
- [ ] If the client calls this endpoint, add or update the corresponding method in `client/src/api.js`; use the same path under the v1 base when migrating to v1 (e.g. `request('/v1/items')` if the client is updated to use v1 base).

## Legacy vs v1

- **Legacy**: `/api/*` — unchanged behavior; no envelope; still used by the current React client.
- **v1**: `/api/v1/*` — envelope applied; same route handlers; OpenAPI-documented. Use v1 for new integrations and when adding new endpoints.

New development should extend the v1 API and keep the OpenAPI spec and this instruction in mind.
