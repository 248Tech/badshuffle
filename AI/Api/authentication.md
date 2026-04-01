# Authentication

BadShuffle uses **JWT (JSON Web Tokens)** for all authenticated API calls. Tokens are obtained via the login endpoint and sent as a Bearer header on subsequent requests.

---

## Obtaining a Token

### POST /api/auth/login

Authenticates a user and returns a signed JWT.

**Request**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "operator@yourcompany.com",
  "password": "your-password",
  "math_a": 5,
  "math_b": 3,
  "math_answer": 8
}
```

> **CAPTCHA fields** (`math_a`, `math_b`, `math_answer`): BadShuffle requires a simple math CAPTCHA on every login. Call `GET /api/auth/captcha-config` first to see if reCAPTCHA is also required.

**GET /api/auth/captcha-config** — Returns:
```json
{
  "recaptcha_enabled": false,
  "recaptcha_site_key": null
}
```

If `recaptcha_enabled` is true, also include a `"recaptcha_response"` field from Google's reCAPTCHA widget.

**Success Response** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**
| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid fields |
| `401` | Wrong email or password |
| `429` | Too many attempts (5 per 15 min per IP) |

---

## Using the Token

Include the token as a Bearer header on every authenticated request:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token lifetime:** 7 days. Store it securely (e.g., `localStorage` for a trusted internal tool, or `httpOnly` cookie for higher security).

---

## Token Claims

```json
{
  "sub": 1,         // user_id
  "email": "operator@yourcompany.com",
  "iat": 1711900000,
  "exp": 1712504800
}
```

---

## Checking Setup Status

Before doing anything, you can check if the system has been initialized:

```http
GET /api/auth/status
```

```json
{ "setup": true }
```

If `setup` is `false`, no users exist yet — the first admin must be created via `POST /api/auth/setup`.

---

## Password Reset Flow

```
POST /api/auth/forgot   { "email": "user@example.com" }
  ↓ (server sends reset email with token link)
POST /api/auth/reset    { "token": "...", "password": "new-password" }
```

---

## User Roles

| Role | Description | Access Level |
|------|-------------|-------------|
| `admin` | Full access, user management, system settings, DB backup | Everything |
| `operator` | Staff with configuration access | Quotes, inventory, settings, templates, vendors |
| `user` | Regular team member | Quotes, inventory, messages, files |

Role is embedded in the `users` table, **not** in the JWT. The server re-reads it from the DB on each request.

---

## Extension Token (for inventory sync only)

The browser extension uses a separate token system for syncing inventory:

```http
x-extension-token: your-extension-token
```

This token only grants access to `GET/POST /api/items` and `POST /api/sheets/*`. It is **not** suitable for e-commerce integrations — use a JWT instead.

---

## Signed File URLs (no token required)

Inventory images and attached files can be served without a JWT using time-limited signed URLs. These are generated server-side and embedded in API responses automatically.

Format:
```
/api/files/:id/serve?sig=<hmac-sha256>&exp=<unix-timestamp-ms>
```

- Signature is HMAC-SHA256 over the file ID using the server's JWT secret
- URLs expire after a configurable window (default a few hours)
- Used automatically in `GET /api/public/items` responses — `photo_url` will already be a signed URL

For the e-commerce integration you generally don't need to generate these manually; the public API responses include fully-resolved URLs.

---

## Rate Limits

| Endpoint group | Limit |
|----------------|-------|
| All API (default) | 600 requests / minute per IP |
| `/api/auth/login`, `/api/auth/forgot`, `/api/auth/setup` | 60 requests / 15 min per IP |
| `/api/files/:id/serve` | 240 requests / minute per IP |
| Public quote endpoints (`/api/quotes/public/*`) | 60 requests / minute per IP |

Rate limits can be tuned via environment variables:
```
API_RATE_LIMIT_WINDOW_MS
API_RATE_LIMIT_MAX
API_AUTH_RATE_LIMIT_WINDOW_MS
API_AUTH_RATE_LIMIT_MAX
```

Exceeding a limit returns `429 Too Many Requests`.

---

## Environment Variables (Server)

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Secret used to sign/verify tokens (required in production) |
| `APP_URL` | Public base URL (used for CORS and signed URLs) |
| `DB_PATH` | SQLite database file path |

---

## Server-to-Server Integration

For a backend service (e.g., Node.js/Python middleware sitting between your customer site and BadShuffle), use a service account:

1. Create a dedicated `operator` user in BadShuffle admin
2. Authenticate once and store the JWT
3. Refresh when the token approaches expiry (7-day window)
4. Use this token for all server-side API calls (creating leads, reading inventory)

Never expose the operator JWT in client-side code. The public catalog endpoints (`/api/public/*`) are the safe alternative for unauthenticated browsing.
