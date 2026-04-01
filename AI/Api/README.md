# BadShuffle API Documentation

This directory contains full API and integration documentation for BadShuffle.

The primary integration goal is a **customer-facing React e-commerce website** that uses BadShuffle inventory as product cards (similar to WooCommerce) and feeds customer inquiries/leads back into BadShuffle for quoting.

---

## Document Index

| File | Purpose |
|------|---------|
| [authentication.md](authentication.md) | JWT auth, API keys, roles, rate limits |
| [public-catalog.md](public-catalog.md) | No-auth endpoints for displaying inventory on a public site |
| [inventory-api.md](inventory-api.md) | Full inventory CRUD (authenticated) |
| [quotes-api.md](quotes-api.md) | Quote lifecycle, line items, payments, contracts |
| [data-models.md](data-models.md) | Full schema reference for all tables |
| [ecommerce-integration.md](ecommerce-integration.md) | Step-by-step guide to building the customer-facing site |
| [webhooks-and-events.md](webhooks-and-events.md) | Event system, activity logs, and webhook architecture plan |

---

## Base URL

All API requests go to the same host as the BadShuffle app:

```
https://your-badshuffle-host.com
```

The React front-end and API share the same origin. Set `APP_URL` in the server `.env` to your production domain.

---

## Quick Reference

### Public endpoints (no auth needed)

```
GET  /api/public/catalog-meta       Company info + category list
GET  /api/public/items              Paginated item list (filterable)
GET  /api/public/items/:id          Single item detail
GET  /api/files/:id/serve?sig=&exp= Signed image URL (time-limited)
GET  /catalog                       SEO-rendered HTML catalog
GET  /catalog/item/:id              SEO-rendered HTML item detail
GET  /sitemap.xml                   XML sitemap
GET  /robots.txt                    Robots file
POST /api/leads                     Submit inquiry / lead capture
```

### Authenticated endpoints (require Bearer JWT)

```
POST /api/auth/login                Obtain JWT
GET  /api/items                     Full inventory list
GET  /api/quotes                    Quote list
POST /api/quotes                    Create quote
POST /api/quotes/:id/send           Send quote to client
GET  /api/quotes/public/:token      View quote by share token (no auth)
POST /api/quotes/approve-by-token   Client approves quote
POST /api/quotes/contract/sign      Client signs contract
```

---

## Architecture Overview

```
┌──────────────────────────────┐        ┌──────────────────────────────────┐
│  Customer-Facing React Site  │        │         BadShuffle Server        │
│  (e-commerce)                │        │                                  │
│                              │        │  ┌────────────────────────────┐  │
│  /shop  → product cards      │──GET──▶│  │  GET /api/public/items     │  │
│  /shop/:slug → item detail   │──GET──▶│  │  GET /api/public/items/:id │  │
│  /request-quote → lead form  │──POST─▶│  │  POST /api/leads           │  │
│                              │        │  └────────────────────────────┘  │
│                              │        │                                  │
│  (optional)                  │        │  ┌────────────────────────────┐  │
│  /quotes/:token → view quote │──GET──▶│  │  GET /api/quotes/public/:t │  │
│  /quotes/:token/approve      │──POST─▶│  │  POST /api/quotes/approve  │  │
│  /quotes/:token/sign         │──POST─▶│  │  POST /api/quotes/contract │  │
│                              │        │  └────────────────────────────┘  │
└──────────────────────────────┘        └──────────────────────────────────┘
```

### Data flow for a typical e-commerce order

1. Customer browses `/shop` → React fetches `GET /api/public/items`
2. Customer views item → React fetches `GET /api/public/items/:id`
3. Customer submits inquiry → React posts `POST /api/leads`
4. BadShuffle operator creates a quote from the lead
5. Quote is sent → customer receives email with link to `GET /api/quotes/public/:token`
6. Customer approves → `POST /api/quotes/approve-by-token`
7. Customer signs contract → `POST /api/quotes/contract/sign`
8. Operator confirms and tracks payments

---

## CORS

The BadShuffle server allows requests from:
- `http://localhost:*` (development)
- `process.env.APP_URL` (production)
- Chrome extension origins

For a separately-hosted customer site, add its origin to the CORS config in `server/index.js` or set `APP_URL` appropriately.
