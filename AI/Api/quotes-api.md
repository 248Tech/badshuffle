# Quotes API

Quotes are the core business object in BadShuffle. Each quote represents a potential or confirmed rental event with line items, client info, payments, and a contract.

All endpoints require a Bearer JWT unless noted. See [authentication.md](authentication.md).

---

## Quote Lifecycle

```
draft ──▶ sent ──▶ approved ──▶ confirmed ──▶ closed
           ↑                        │
           └── revert ◀─────────────┘
```

| Status | Who sets it | Inventory impact |
|--------|-------------|-----------------|
| `draft` | Created by default | None |
| `sent` | Staff clicks "Send" | Soft-reserved (tracked, not locked) |
| `approved` | Client approves or staff approves | Soft-reserved |
| `confirmed` | Staff confirms | **Hard reserved** (blocks availability) |
| `closed` | Staff closes after event | Released (damage charges allowed) |

---

## Quote Listing

### GET /api/quotes

```http
GET /api/quotes?status=confirmed&page=1&limit=25
Authorization: Bearer <token>
```

**Query Parameters**

| Param | Description |
|-------|-------------|
| `search` | Search name, client name, venue |
| `status` | Filter by status: `draft`, `sent`, `approved`, `confirmed`, `closed` |
| `event_from` | Events on or after this date (YYYY-MM-DD) |
| `event_to` | Events on or before this date |
| `has_balance` | `1` to only show quotes with outstanding balance |
| `venue` | Filter by venue name |
| `sort_by` | `created_at` (default), `event_date`, `name`, `status` |
| `sort_dir` | `asc` or `desc` (default: `desc`) |
| `page` | Page number (1-indexed) |
| `limit` | Items per page (default 25) |

**Response**
```json
{
  "quotes": [
    {
      "id": 55,
      "name": "Smith Wedding",
      "status": "confirmed",
      "event_date": "2025-06-14",
      "event_type": "Wedding",
      "client_first_name": "Jane",
      "client_last_name": "Smith",
      "client_email": "jane@example.com",
      "guest_count": 150,
      "venue_name": "The Grand Ballroom",
      "total": 4800.00,
      "amount_paid": 2400.00,
      "remaining_balance": 2400.00,
      "overpaid": false,
      "created_at": "2025-02-01 10:00:00",
      "updated_at": "2025-03-10 15:30:00"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 25
}
```

---

## GET /api/quotes/summary

Dashboard aggregates. Used for the dashboard stats.

```http
GET /api/quotes/summary
Authorization: Bearer <token>
```

**Response**
```json
{
  "total": 120,
  "byStatus": {
    "draft": 18,
    "sent": 24,
    "approved": 15,
    "confirmed": 45,
    "closed": 18
  },
  "revenueByStatus": {
    "draft": 12500.00,
    "sent": 38000.00,
    "approved": 22000.00,
    "confirmed": 85000.00,
    "closed": 62000.00
  },
  "upcoming": [
    {
      "id": 55,
      "name": "Smith Wedding",
      "status": "confirmed",
      "event_date": "2025-06-14",
      "guest_count": 150,
      "created_at": "2025-02-01 10:00:00"
    }
  ],
  "byMonth": [
    { "month": "2025-01", "count": 8 },
    { "month": "2025-02", "count": 12 },
    { "month": "2025-03", "count": 15 }
  ]
}
```

- `upcoming` — quotes with `event_date` in the next 90 days, sorted by date
- `byMonth` — quote creation counts per month (rolling 6 months)

---

## GET /api/quotes/:id

Returns the full quote detail including items, custom items, sections, adjustments, payments, and contract info.

```http
GET /api/quotes/55
Authorization: Bearer <token>
```

**Response** (condensed)
```json
{
  "id": 55,
  "name": "Smith Wedding",
  "status": "confirmed",
  "event_date": "2025-06-14",
  "event_type": "Wedding",
  "guest_count": 150,
  "client_first_name": "Jane",
  "client_last_name": "Smith",
  "client_email": "jane@example.com",
  "client_phone": "555-000-1234",
  "venue_name": "The Grand Ballroom",
  "venue_address": "456 Oak Ave, Springfield, IL",
  "tax_rate": 8.5,
  "notes": "External client-visible notes here",
  "quote_notes": "Internal team notes (not shown to client)",
  "public_token": "a1b2c3d4-...",
  "expires_at": null,
  "has_unsigned_changes": 0,
  "sections": [
    {
      "id": 1,
      "title": "Ceremony",
      "delivery_date": "2025-06-14",
      "rental_start": "2025-06-14",
      "rental_end": "2025-06-14",
      "pickup_date": "2025-06-15",
      "sort_order": 0
    }
  ],
  "items": [
    {
      "id": 101,
      "item_id": 7,
      "section_id": 1,
      "title": "Gold Chiavari Chair",
      "quantity": 150,
      "unit_price": 4.50,
      "unit_price_override": null,
      "discount_type": "none",
      "discount_amount": 0,
      "description": null,
      "hidden_from_quote": 0,
      "sort_order": 0,
      "line_total": 675.00
    }
  ],
  "custom_items": [],
  "adjustments": [
    {
      "id": 3,
      "label": "Early bird discount",
      "type": "discount",
      "value_type": "percent",
      "amount": 10,
      "sort_order": 0
    }
  ],
  "payments": [
    {
      "id": 8,
      "amount": 2400.00,
      "method": "Check",
      "reference": "1042",
      "paid_at": "2025-03-01",
      "note": "Deposit"
    }
  ],
  "contract": {
    "signed_at": "2025-02-15 09:30:00",
    "signer_name": "Jane Smith"
  },
  "total": 4800.00,
  "subtotal": 5280.00,
  "tax": 0,
  "discount_total": 480.00,
  "amount_paid": 2400.00,
  "remaining_balance": 2400.00
}
```

---

## POST /api/quotes

Creates a new quote (starts as `draft`).

```http
POST /api/quotes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Johnson Corporate Event",
  "event_date": "2025-09-20",
  "event_type": "Corporate",
  "guest_count": 200,
  "client_first_name": "Bob",
  "client_last_name": "Johnson",
  "client_email": "bob@corp.com",
  "client_phone": "555-987-6543",
  "venue_name": "Hilton Downtown",
  "venue_address": "789 Elm St, Springfield, IL",
  "tax_rate": 8.5,
  "notes": "Client is expecting a detailed setup timeline.",
  "lead_id": 12
}
```

**All fields are optional except `name`.** Returns the created quote with its assigned `id`.

---

## PUT /api/quotes/:id

Updates an existing quote. Send only changed fields.

```http
PUT /api/quotes/55
Authorization: Bearer <token>
Content-Type: application/json

{
  "guest_count": 160,
  "venue_notes": "Load in via loading dock, not main entrance."
}
```

---

## Quote Line Items

### Add inventory item to quote

```http
POST /api/quotes/55/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "item_id": 7,
  "quantity": 150,
  "section_id": 1,
  "unit_price_override": null,
  "discount_type": "percent",
  "discount_amount": 10,
  "description": "Gold chairs for ceremony seating",
  "notes": "Deliver 1 hour before ceremony start"
}
```

| Field | Description |
|-------|-------------|
| `item_id` | Inventory item ID (required) |
| `quantity` | Number of units (required) |
| `section_id` | Which section to place the item in |
| `unit_price_override` | Custom price (null = use item's unit_price) |
| `discount_type` | `none` \| `percent` \| `fixed` |
| `discount_amount` | Discount value (% or dollar amount) |
| `description` | Description override for client view |
| `notes` | Internal delivery/setup notes |
| `hidden_from_quote` | `1` to hide from client view |

### Update a quote item

```http
PUT /api/quotes/55/items/101
Authorization: Bearer <token>

{ "quantity": 160, "unit_price_override": 4.00 }
```

> Setting `quantity` to `0` removes the item.

### Remove a quote item

```http
DELETE /api/quotes/55/items/101
Authorization: Bearer <token>
```

### Reorder quote items

```http
PUT /api/quotes/55/items/reorder
Authorization: Bearer <token>

[
  { "id": 101, "sort_order": 0 },
  { "id": 102, "sort_order": 1 }
]
```

---

## Custom (Non-Catalog) Line Items

Custom items are arbitrary line items not tied to inventory.

```http
POST /api/quotes/55/custom-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Dance Floor Installation",
  "unit_price": 500.00,
  "quantity": 1,
  "taxable": 1,
  "section_id": 1
}
```

Update: `PUT /api/quotes/55/custom-items/:id`
Delete: `DELETE /api/quotes/55/custom-items/:id`

---

## Adjustments (Discounts & Fees)

### List

```http
GET /api/quotes/55/adjustments
Authorization: Bearer <token>
```

### Add

```http
POST /api/quotes/55/adjustments
Authorization: Bearer <token>

{
  "label": "Delivery fee",
  "type": "fee",
  "value_type": "fixed",
  "amount": 150
}
```

| `type` | `value_type` | Effect |
|--------|-------------|--------|
| `discount` | `percent` | Subtract N% from subtotal |
| `discount` | `fixed` | Subtract $N from subtotal |
| `fee` | `percent` | Add N% to subtotal |
| `fee` | `fixed` | Add $N to subtotal |

Update: `PUT /api/quotes/55/adjustments/:id`
Delete: `DELETE /api/quotes/55/adjustments/:id`

---

## Quote Sections

Sections group line items by phase or location, each with their own rental date range.

### Create

```http
POST /api/quotes/55/sections
Authorization: Bearer <token>

{
  "title": "Reception",
  "delivery_date": "2025-06-14",
  "rental_start": "2025-06-14",
  "rental_end": "2025-06-14",
  "pickup_date": "2025-06-15"
}
```

Update: `PUT /api/quotes/55/sections/:id`
Duplicate: `POST /api/quotes/55/sections/:id/duplicate`
Delete: `DELETE /api/quotes/55/sections/:id`

---

## Quote Status Transitions

### Send quote to client

```http
POST /api/quotes/55/send
Authorization: Bearer <token>
```

- Generates `public_token` if missing
- Emails the quote to `client_email`
- Sets status to `sent`

### Approve (staff-side)

```http
POST /api/quotes/55/approve
Authorization: Bearer <token>
```

### Confirm (locks inventory)

```http
POST /api/quotes/55/confirm
Authorization: Bearer <token>
```

### Close (post-event)

```http
POST /api/quotes/55/close
Authorization: Bearer <token>
```

### Revert to draft

```http
POST /api/quotes/55/revert
Authorization: Bearer <token>
```

---

## Payments

### Record a payment

```http
POST /api/quotes/55/payments
Authorization: Bearer <token>

{
  "amount": 2400.00,
  "method": "Credit Card",
  "reference": "ch_3abc",
  "paid_at": "2025-03-01",
  "note": "50% deposit"
}
```

### Refund

```http
POST /api/quotes/55/refund
Authorization: Bearer <token>

{
  "amount": 200.00,
  "method": "Credit Card",
  "reference": "re_xyz",
  "note": "Cancelled one table"
}
```

Delete: `DELETE /api/quotes/55/payments/:id`

---

## Total Calculation

```
subtotal = Σ(item.effective_unit_price × quantity)
           where effective_unit_price = unit_price_override ?? item.unit_price
           minus per-line discounts

tax = Σ(taxable_line_subtotals) × (tax_rate / 100)

adjustments = Σ(fee amounts) - Σ(discount amounts)
              (percent adjustments applied to subtotal)

total = subtotal + tax + adjustments

remaining_balance = total - Σ(payment.amount)
```

---

## Public Quote Access (No Auth)

### View quote

```http
GET /api/quotes/public/<token>
```

Returns the full quote including company info, items (excluding `hidden_from_quote` ones), contract, and signed image URLs. This is what the client sees via their email link.

### Client approves

```http
POST /api/quotes/approve-by-token
Content-Type: application/json

{ "token": "a1b2c3d4-..." }
```

Sets status from `sent` → `approved`.

### Generate public share link

```http
POST /api/quotes/55/ensure-public-token
Authorization: Bearer <token>
```

Returns `{ "public_token": "...", "public_url": "https://..." }`.

---

## Contract

### Get contract

```http
GET /api/quotes/55/contract
Authorization: Bearer <token>
```

```json
{
  "id": 12,
  "quote_id": 55,
  "body_html": "<p>Rental Agreement...</p>",
  "signed_at": "2025-02-15 09:30:00",
  "signer_name": "Jane Smith",
  "signed_quote_total": 4800.00
}
```

### Create/update contract

```http
PUT /api/quotes/55/contract
Authorization: Bearer <token>

{ "body_html": "<p>Updated contract text...</p>" }
```

### Client signs contract (no auth)

```http
POST /api/quotes/contract/sign
Content-Type: application/json

{
  "token": "a1b2c3d4-...",
  "signer_name": "Jane Smith"
}
```

Records IP address, user agent, signed total, and timestamp for audit trail.

---

## Messages on Quote

### Staff sends message (authenticated)

```http
POST /api/messages
Authorization: Bearer <token>

{
  "quote_id": 55,
  "body_text": "Your items are confirmed! Please pay the remaining balance by June 1.",
  "subject": "Booking Confirmed"
}
```

### Client replies (no auth, via share token)

```http
POST /api/quotes/public/<token>/messages

{
  "body_text": "Thank you! I'll send a check.",
  "from_name": "Jane Smith",
  "from_email": "jane@example.com"
}
```

### View thread (no auth, via share token)

```http
GET /api/quotes/public/<token>/messages
```

---

## Files on Quote

### Attach file to quote

```http
POST /api/quotes/55/files
Authorization: Bearer <token>

{ "file_id": 88 }
```

### List attached files

```http
GET /api/quotes/55/files
Authorization: Bearer <token>
```

---

## Activity Log

Full audit trail of all changes on a quote.

```http
GET /api/quotes/55/activity
Authorization: Bearer <token>
```

```json
[
  {
    "id": 1,
    "event_type": "status_change",
    "description": "Status changed from draft to sent",
    "old_value": "draft",
    "new_value": "sent",
    "user_email": "operator@acme.com",
    "created_at": "2025-02-05 10:00:00"
  },
  {
    "id": 2,
    "event_type": "contract_signed",
    "description": "Contract signed by Jane Smith",
    "user_email": null,
    "created_at": "2025-02-15 09:30:00"
  }
]
```

**Common `event_type` values:**
- `status_change` — Quote status transition
- `contract_signed` — Client e-signature recorded
- `payment_added` — Payment recorded
- `payment_deleted` — Payment removed
- `damage_charge_added` — Post-event damage charge
- `item_added` / `item_removed` / `item_updated` — Line item changes

---

## Duplicate a Quote

```http
POST /api/quotes/55/duplicate
Authorization: Bearer <token>
```

Creates an exact copy (status resets to `draft`, public_token cleared).

---

## Delete a Quote

```http
DELETE /api/quotes/55
Authorization: Bearer <token>
```

---

## Lead → Quote Workflow

```
POST /api/leads                         Create lead from customer inquiry
  ↓
GET  /api/leads                         Review lead in BadShuffle
  ↓
POST /api/quotes  { lead_id: X, ... }   Convert lead to draft quote
  ↓
POST /api/quotes/:id/items              Add items
  ↓
POST /api/quotes/:id/send               Email to client
  ↓
POST /api/quotes/approve-by-token       Client approves
  ↓
POST /api/quotes/:id/confirm            Staff confirms
  ↓
POST /api/quotes/:id/payments           Record deposits
  ↓
POST /api/quotes/:id/close              Post-event close
```
