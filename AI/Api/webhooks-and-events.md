# Webhooks and Events

BadShuffle has a rich internal event system for tracking everything that happens on a quote. This document covers:

1. What exists today (activity logs, polling)
2. How to build outgoing webhooks
3. Recommended event types for e-commerce integrations

---

## What Exists Today

### Internal Activity Logging

Every significant action on a quote writes a record to `quote_activity_log`. This is an immutable append-only table.

```http
GET /api/quotes/:id/activity
Authorization: Bearer <token>
```

**Tracked events:**

| `event_type` | When it fires |
|-------------|---------------|
| `status_change` | Quote transitions between statuses |
| `item_added` | Inventory item added to quote |
| `item_removed` | Inventory item removed |
| `item_updated` | Quantity, price, or notes changed |
| `custom_item_added` | Non-catalog item added |
| `custom_item_removed` | Non-catalog item removed |
| `adjustment_added` | Discount or fee added |
| `adjustment_removed` | Discount or fee removed |
| `payment_added` | Payment recorded |
| `payment_deleted` | Payment removed |
| `damage_charge_added` | Post-event damage charge |
| `contract_signed` | Client e-signature completed |
| `file_attached` | File attached to quote |
| `file_removed` | File detached from quote |

Each log entry records:
- `event_type` — machine-readable event name
- `description` — human-readable summary
- `old_value` / `new_value` — before/after (JSON or plain string)
- `user_id` / `user_email` — who triggered it (null for client actions)
- `created_at` — timestamp

### Billing History

Financial events are separately tracked in `billing_history`:

```http
GET /api/billing/history
Authorization: Bearer <token>
```

Tracks `payment`, `refund`, and `damage_charge` events with amounts.

### Message Threading

All client/team communications are stored in the `messages` table and queryable via:

```http
GET /api/messages?quote_id=55
Authorization: Bearer <token>
```

New inbound messages (direction: `inbound`) increment the unread count checked via:

```http
GET /api/messages/unread-count
Authorization: Bearer <token>
```

---

## Polling Pattern (Current Integration Method)

Since BadShuffle does not yet have outgoing webhooks, external systems must **poll** for changes.

### Polling for new leads

```javascript
// Check for leads created after a known timestamp
const since = '2025-03-01T00:00:00Z';
const leads = await fetch(`/api/leads`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

const newLeads = leads.filter(l => l.created_at > since);
```

### Polling for quote status changes

```javascript
// Poll every 60 seconds for status changes
setInterval(async () => {
  const quotes = await fetch('/api/quotes?sort_by=updated_at&sort_dir=desc&limit=10', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());

  // Check for status changes since last poll
  quotes.quotes.forEach(q => {
    if (q.updated_at > lastPollTime) {
      handleQuoteUpdate(q);
    }
  });

  lastPollTime = new Date().toISOString();
}, 60_000);
```

---

## Building Outgoing Webhooks (Recommended Architecture)

When you're ready to add real-time outgoing webhooks to BadShuffle, here is the recommended implementation plan:

### 1. Database schema additions

```sql
CREATE TABLE webhook_endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER DEFAULT 1,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,          -- HMAC signing secret
  events TEXT NOT NULL,          -- JSON array of subscribed event types
  active INTEGER DEFAULT 1,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,         -- JSON
  status TEXT DEFAULT 'pending', -- pending | delivered | failed
  status_code INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  last_attempted_at TEXT,
  delivered_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. API routes to manage webhook endpoints

```
GET    /api/webhooks              List all endpoints
POST   /api/webhooks              Register a new endpoint
PUT    /api/webhooks/:id          Update endpoint (URL, events, active)
DELETE /api/webhooks/:id          Remove endpoint
POST   /api/webhooks/:id/test     Send a test payload
GET    /api/webhooks/:id/deliveries  View delivery history
```

### 3. Payload format

Each webhook delivery should use a consistent envelope:

```json
{
  "id": "evt_01HX...",
  "type": "quote.status_changed",
  "created": 1711900000,
  "data": {
    "quote_id": 55,
    "quote_name": "Smith Wedding",
    "old_status": "sent",
    "new_status": "approved",
    "client_email": "jane@example.com",
    "public_token": "a1b2c3d4-...",
    "updated_at": "2025-03-31T14:22:01Z"
  }
}
```

### 4. Signature verification (HMAC-SHA256)

Sign each delivery so the receiver can verify authenticity:

```javascript
// Server-side: sign the payload
const crypto = require('crypto');

function signPayload(secret, payload) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${sig}`;
}

// Add to request headers:
// X-BadShuffle-Signature: sha256=<hex>
// X-BadShuffle-Delivery: <uuid>
// X-BadShuffle-Event: quote.status_changed
```

```javascript
// Receiver-side: verify the signature
function verifySignature(secret, body, signature) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### 5. Delivery with retry

```javascript
async function deliverWebhook(endpoint, event) {
  const payload = buildPayload(event);
  const sig = signPayload(endpoint.secret, payload);

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BadShuffle-Signature': sig,
        'X-BadShuffle-Event': event.type,
        'X-BadShuffle-Delivery': event.id,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    await logDelivery(endpoint.id, event, res.status, await res.text());
  } catch (err) {
    await scheduleRetry(endpoint.id, event, err.message);
  }
}
```

Retry schedule: 1 min, 5 min, 30 min, 2 hr, 24 hr (exponential backoff).

### 6. Where to fire webhooks

Add webhook dispatch calls after the following existing server-side operations in `server/routes/`:

| File | Operation | Event type |
|------|-----------|-----------|
| `quotes.js` | Status transition | `quote.status_changed` |
| `quotes.js` | Quote created | `quote.created` |
| `quotes.js` | Quote deleted | `quote.deleted` |
| `quotes.js` | Payment recorded | `quote.payment_added` |
| `quotes.js` | Contract signed (public) | `quote.contract_signed` |
| `quotes.js` | Client approves | `quote.approved_by_client` |
| `leads.js` | Lead created | `lead.created` |
| `messages.js` | Inbound message | `message.received` |
| `items.js` | Item created/updated | `item.created`, `item.updated` |

---

## Recommended Webhook Events for E-Commerce Integration

These are the events an external customer-facing site will care about most:

| Event | Trigger | What the site should do |
|-------|---------|------------------------|
| `lead.created` | Customer submits inquiry form | Send confirmation email to customer |
| `quote.created` | Operator creates quote from lead | Notify customer quote is being prepared |
| `quote.status_changed` | Quote sent/approved/confirmed | Email customer with updated status |
| `quote.approved_by_client` | Customer approves quote via link | Mark order as approved in site's order list |
| `quote.contract_signed` | Customer signs contract | Mark contract complete; trigger deposit invoice |
| `quote.payment_added` | Payment recorded | Update "amount paid" in customer portal |
| `message.received` | Customer sends message | Alert operations team |

---

## Lead Capture API (E-Commerce → BadShuffle)

This is the primary **inbound** hook — customer inquiry forms on the e-commerce site post directly to BadShuffle.

```http
POST /api/leads
Authorization: Bearer <operator-service-token>
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "555-123-4567",
  "event_date": "2025-09-20",
  "event_type": "Wedding",
  "source_url": "https://your-ecommerce-site.com/shop/chairs",
  "notes": "Looking for 150 gold chiavari chairs. Also interested in linens."
}
```

**Response** `201 Created`
```json
{
  "id": 42,
  "name": "Jane Smith",
  "email": "jane@example.com",
  "event_date": "2025-09-20",
  "created_at": "2025-03-31 14:30:00"
}
```

The `source_url` field tracks which product page or category the customer was browsing when they submitted the inquiry — valuable for attribution.

### Enriching leads with item interest

Pass interested items in the `notes` field (plain text), or include a structured `notes` string:

```javascript
const itemsInterested = cartItems.map(i => `${i.quantity}x ${i.title}`).join(', ');

await fetch('/api/leads', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${serviceToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: form.name,
    email: form.email,
    phone: form.phone,
    event_date: form.eventDate,
    event_type: form.eventType,
    source_url: window.location.href,
    notes: `Items of interest: ${itemsInterested}\n\nAdditional notes: ${form.notes}`,
  }),
});
```

---

## Customer Portal Pattern (No Webhooks Needed)

If you want a simple customer portal where clients can check quote status without needing webhooks:

1. After a quote is sent, the customer receives an email with a unique URL:
   ```
   https://your-badshuffle-host.com/quotes/<public_token>
   ```
   (or your e-commerce site can proxy this)

2. Customer portal fetches quote state:
   ```http
   GET /api/quotes/public/<token>
   ```

3. Customer approves from the portal:
   ```http
   POST /api/quotes/approve-by-token
   { "token": "<public_token>" }
   ```

4. Customer signs contract from the portal:
   ```http
   POST /api/quotes/contract/sign
   { "token": "<public_token>", "signer_name": "Jane Smith" }
   ```

This requires **no webhooks** and **no auth tokens** on the customer side — just the share token.
