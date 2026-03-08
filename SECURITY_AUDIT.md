# BadShuffle — Security Audit Report

**Date:** March 7, 2025  
**Scope:** Full application (server, client, auth, APIs, file handling, dependencies)

---

## Executive summary

The application uses solid patterns in several areas (parameterized SQL, bcrypt, JWT with role checks from DB, brute-force protection, CORS allowlist). Several **high** and **medium** issues should be addressed: unauthenticated file serving, default/weak JWT secret, public test-mail abuse, XSS via contract HTML, image-proxy allowlist bypass, dependency vulnerabilities, and header injection in file download. Recommendations are listed by priority.

---

## 1. Authentication & secrets

### 1.1 Default / weak JWT secret — **HIGH**

- **Where:** `server/lib/authMiddleware.js`, `server/lib/crypto.js`, `server/routes/auth.js`
- **Issue:** `JWT_SECRET` defaults to `'change-me'` when `process.env.JWT_SECRET` is unset. The same value is used for AES encryption of SMTP/IMAP passwords in `lib/crypto.js`. If the app is run without setting `JWT_SECRET`, anyone can forge JWTs and decrypt stored credentials.
- **Fix:**
  - Require `JWT_SECRET` in production (fail startup if missing or equals `'change-me'`).
  - Use a long, random secret (e.g. 32+ bytes) and document in `.env.example` and deployment docs.
  - Consider using a separate key for encryption (e.g. `ENCRYPTION_KEY`) instead of reusing JWT_SECRET.

### 1.2 Extension token = full API access — **MEDIUM**

- **Where:** `server/lib/authMiddleware.js`
- **Issue:** Requests with a valid `X-Extension-Token` header bypass JWT and are treated as authenticated. The token is a single shared secret; if leaked (e.g. from admin’s machine or network), an attacker has full API access.
- **Fix:** Treat extension token as a separate, limited scope (e.g. only certain routes). Rotate token if compromise is suspected. Prefer short-lived tokens or scoped tokens if the extension’s needs allow.

### 1.3 JWT in localStorage — **LOW (known tradeoff)**

- **Where:** `client/src/api.js` — `localStorage.getItem('bs_token')`
- **Issue:** XSS can steal the token. No httpOnly cookie alternative.
- **Fix:** Acceptable for many SPA deployments; document the risk. Consider moving to httpOnly cookies and CSRF protection if threat model requires it.

---

## 2. Authorization & access control

### 2.1 Unauthenticated file download — **HIGH**

- **Where:** `server/index.js` (lines 76–84), `server/api/v1.js` (lines 30–37)
- **Issue:** `GET /api/files/:id/serve` (and v1 equivalent) serves file contents **without authentication**. Anyone who can guess or obtain a file ID (e.g. from quote JSON, logs, or enumeration) can download that file.
- **Fix:** Either:
  - Require authentication and enforce that the requester is allowed to see the file (e.g. file linked to a quote they can access, or operator/admin), or
  - Use short-lived, signed URLs (e.g. signed query param) for file access and only generate those in contexts where the user is already authorized to see the quote/file.

### 2.2 Public quote and contract/sign by token — **BY DESIGN**

- **Where:** `GET /api/quotes/public/:token`, `POST /api/quotes/approve-by-token`, `POST /api/quotes/contract/sign`
- **Note:** These are intentionally unauthenticated and keyed by a long random token. Security depends on token secrecy and entropy (e.g. 24-byte hex). No change needed if tokens are generated with `crypto.randomBytes(24).toString('hex')` and not logged or exposed.

### 2.3 Extension download is public — **LOW**

- **Where:** `server/routes/extension.js` — `GET /api/extension/download`
- **Issue:** No auth; anyone can download the extension bundle. Low impact if the bundle contains no secrets; ensure it does not (e.g. no hardcoded API keys or tokens).

---

## 3. Input validation & injection

### 3.1 SQL injection — **NONE FOUND**

- **Where:** All server routes using `db.prepare(...).run/get/all(...)` with parameters.
- **Note:** Queries use parameterized statements; no string concatenation of user input into SQL. Safe.

### 3.2 Image proxy host allowlist bypass — **MEDIUM**

- **Where:** `server/lib/imageProxy.js` — `parsedUrl.hostname.endsWith(h)`
- **Issue:** Hostnames like `evilgoodshuffle.com` or `goodshuffle.com.attacker.com` satisfy `endsWith('goodshuffle.com')`, so an attacker can proxy content from a domain they control.
- **Fix:** Use exact hostname match, or allow only `hostname === h || hostname.endsWith('.' + h)` so only the intended domain and its subdomains are allowed.

### 3.3 Content-Disposition header injection — **MEDIUM**

- **Where:** `server/index.js` (line 81), `server/api/v1.js` (line 35)  
  `filename="' + file.original_name.replace(/"/g, '') + '"`
- **Issue:** Only double-quotes are stripped. If `original_name` contains CR/LF (e.g. `"foo\r\nX-Injected: bar"`), the response can inject extra headers or break the header.
- **Fix:** Sanitize filename: strip or replace all control characters (including `\r`, `\n`) and restrict to a safe character set (e.g. alphanumeric, space, hyphen, underscore). Use a small allowlist or encode non-allowed chars.

### 3.4 File upload — **LOW**

- **Where:** `server/routes/files.js` — multer `filename: crypto.randomBytes(16).toString('hex') + path.extname(file.originalname)`
- **Note:** Stored name is random; path traversal in stored path is avoided. No server-side MIME or extension allowlist; consider restricting to expected types (e.g. images, PDFs) and validating magic bytes to reduce abuse (e.g. executable uploads).

---

## 4. XSS (client-side)

### 4.1 Contract body_html rendered with dangerouslySetInnerHTML — **HIGH**

- **Where:** `client/src/pages/PublicQuotePage.jsx` (lines 399–402)
- **Issue:** `quote.contract.body_html` is rendered with `dangerouslySetInnerHTML` without sanitization. Contract HTML is set by staff (quote contract and contract templates) and by the public contract/sign endpoint (body can be null). If an operator or admin (or a bug) inserts script, or if a future change allows client-supplied HTML, any user viewing the public quote page can be hit by XSS.
- **Fix:** Sanitize HTML before rendering (e.g. DOMPurify with a strict config). Restrict allowed tags/attributes to a minimal set (e.g. p, strong, ul, li, a with safe attributes). Prefer rendering rich text only from trusted staff input and still sanitize.

### 4.2 Email/other HTML — **LOW**

- **Where:** `client/src/pages/MessagesPage.jsx` (line 185)
- **Note:** `msg.body_text || msg.body_html` is rendered as text content (no `dangerouslySetInnerHTML`), so no XSS from that usage. If you later render `body_html` as HTML, sanitize it.

---

## 5. API & business logic

### 5.1 Public test-mail endpoint — **HIGH**

- **Where:** `server/routes/auth.js` — `POST /api/auth/test-mail`
- **Issue:** No authentication. Request body can include `smtp_host`, `smtp_user`, `smtp_pass`, `to`. Rate limit is 5 requests per minute per IP. An attacker can use the server as an open relay to send email to arbitrary addresses (spam/phishing), or probe SMTP config.
- **Fix:** Require authentication (e.g. operator or admin). If it must stay for “test from setup wizard,” restrict to setup phase only (e.g. no users created yet or special setup token) and/or require auth.

### 5.2 Settings GET returns decrypted passwords — **MEDIUM (by design)**

- **Where:** `server/routes/settings.js` — GET returns `smtp_pass` and `imap_pass` decrypted.
- **Note:** Protected by operator role; necessary for UI to show/test. Ensure only operators/admins can access and that HTTPS and secure storage are used in production.

### 5.3 Brute-force protection — **GOOD**

- **Where:** `server/routes/auth.js` — login attempts limited by IP (e.g. 5 failures in 15 minutes). Uses `req.ip`.
- **Note:** If the app is behind a proxy, ensure `req.ip` is set from a trusted header (e.g. `X-Forwarded-For`) only when the proxy is trusted; otherwise IP can be spoofed and limits bypassed.

---

## 6. Dependencies

### 6.1 Server (npm audit)

- **multer &lt; 2.1.1:** High — DoS via uncontrolled recursion. **Fix:** Run `npm audit fix` in `server/` (upgrade to 2.1.1+).
- **xlsx:** High — Prototype pollution and ReDoS. No fix available in current version. **Mitigation:** Use only with trusted or validated input; consider alternative (e.g. read-only parsing with a different library) if processing untrusted uploads.

### 6.2 Root (pkg)

- **pkg:** Moderate — Local privilege escalation. **Mitigation:** Use only in controlled build environments; avoid running pkg as root; track advisory for updates.

### 6.3 Client (Vite / esbuild)

- **esbuild / Vite:** Moderate — Dev server can receive requests from any website. **Mitigation:** Use dev server only locally; production build is not affected. Consider `npm audit fix` or upgrading when feasible without breaking the build.

---

## 7. Other good practices

- **CORS:** Restrictive allowlist (localhost, chrome-extension). No wildcard.
- **DB:** Parameterized queries throughout; foreign keys enabled.
- **Passwords:** bcrypt with cost 10; reset tokens single-use and time-limited.
- **Password reset:** Generic “email sent” response to avoid user enumeration.
- **Admin role:** Checked against DB, not only JWT payload, reducing role escalation risk.
- **Google Sheets import:** Fetches only Google Sheets export URLs; SSRF surface is limited.

---

## 8. Recommendations (priority order)

1. ~~**HIGH — Require strong JWT_SECRET in production**~~ **DONE** — Server exits in production if JWT_SECRET missing or `change-me`.
2. ~~**HIGH — Add authentication or signed URLs for file serve**~~ **DONE** — File serve requires Bearer auth or valid signed URL (sig+exp); public quote returns signed URLs for images.
3. ~~**HIGH — Protect or remove public test-mail**~~ **DONE** — `POST /api/auth/test-mail` now requires auth + operator role.
4. ~~**HIGH — Sanitize contract body_html**~~ **DONE** — PublicQuotePage uses DOMPurify with allowed tags/attrs before `dangerouslySetInnerHTML`.
5. ~~**MEDIUM — Fix image proxy allowlist**~~ **DONE** — Host allowed only if exact match or `hostname.endsWith('.' + allowed)`.
6. ~~**MEDIUM — Sanitize Content-Disposition filename**~~ **DONE** — `safeFilename()` strips control chars, quotes, backslash; used in file serve.
7. ~~**MEDIUM — Harden extension token**~~ **DONE** — Extension token sets `req.user.byExtension`; admin and operator middleware reject it (403).
8. **LOW — Upgrade multer** in server (`npm audit fix`).
9. **LOW — Restrict file upload types** (MIME/extension allowlist, optional magic-byte check).
10. **LOW — Add security headers** (e.g. Helmet: CSP, X-Frame-Options, etc.) if not already present.

---

## 9. Checklist for deployment

- [ ] `JWT_SECRET` set to a long random value (not `change-me`).
- [ ] HTTPS only; no sensitive cookies/tokens on plain HTTP.
- [ ] CORS origins updated for production front-end origin(s).
- [ ] `APP_URL` and SMTP/IMAP settings correct for production.
- [ ] Database and uploads directory permissions restricted.
- [ ] No `.env` or secrets committed; `.env.example` has no real secrets.
- [ ] Dependencies reviewed and updated (especially multer, xlsx, pkg, Vite/esbuild as above).
