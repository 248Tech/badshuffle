# Inventory API (Authenticated)

The inventory API provides full CRUD access to the item catalog. All endpoints require a valid Bearer JWT (see [authentication.md](authentication.md)).

For **read-only public access** (customer-facing site), use the public catalog endpoints in [public-catalog.md](public-catalog.md) instead.

---

## GET /api/items

Returns a filtered, paginated list of all items (including hidden ones).

**Request**
```http
GET /api/items?search=chair&category=Chairs&limit=50&page=1
Authorization: Bearer <token>
```

**Query Parameters**

| Param | Description |
|-------|-------------|
| `search` | Filter by title or description |
| `category` | Filter by exact category name |
| `hidden` | `1` to include only hidden items |
| `limit` | Items per page (default 50) |
| `page` | Page number (1-indexed) |

**Response**
```json
{
  "items": [
    {
      "id": 7,
      "title": "Gold Chiavari Chair",
      "category": "Chairs",
      "description": "Classic gold resin chiavari chair with seat pad.",
      "unit_price": 4.50,
      "quantity_in_stock": 200,
      "taxable": 1,
      "labor_hours": 0.05,
      "item_type": "product",
      "is_subrental": 0,
      "vendor_id": null,
      "photo_url": "7",
      "contract_description": null,
      "source": "manual",
      "hidden": 0,
      "created_at": "2024-11-01 09:00:00",
      "updated_at": "2025-03-15 14:22:01"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

> Note: In the authenticated API, `photo_url` is returned as a raw file ID (e.g., `"7"`) or an external URL string. Construct the serve URL manually: `/api/files/7/serve` with a valid JWT. The public catalog API returns fully resolved signed URLs.

---

## GET /api/items/:id

Returns a single item by ID.

```http
GET /api/items/7
Authorization: Bearer <token>
```

**Response** — same shape as a single item in the list, plus optional extended fields.

---

## POST /api/items

Creates a new inventory item. Requires `operator` or `admin` role.

**Request**
```http
POST /api/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Silver Chiavari Chair",
  "category": "Chairs",
  "description": "Silver resin chiavari chair with silver cushion.",
  "unit_price": 4.50,
  "quantity_in_stock": 100,
  "taxable": 1,
  "labor_hours": 0.05,
  "item_type": "product",
  "photo_url": null,
  "contract_description": null,
  "vendor_id": null
}
```

**Item Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Unique item name (case-insensitive) |
| `category` | string | No | Category label |
| `description` | string | No | Long description |
| `unit_price` | float | No | Price per unit per event |
| `quantity_in_stock` | int | No | Physical stock count |
| `taxable` | 0\|1 | No | Whether to apply tax (default: 1) |
| `labor_hours` | float | No | Setup/teardown estimate in hours |
| `item_type` | string | No | `product` \| `labor` \| `service` \| `subrental` |
| `is_subrental` | 0\|1 | No | Vendor-sourced (not in-house) |
| `photo_url` | string\|null | No | File ID (int as string) or external URL |
| `vendor_id` | int\|null | No | FK to vendors table |
| `contract_description` | string | No | Legal/rental terms for this item |
| `hidden` | 0\|1 | No | If 1, excluded from public catalog |

**Response** `201 Created`
```json
{ "id": 42, "title": "Silver Chiavari Chair", ... }
```

**Error**
```json
{ "error": "Title already exists" }   // 409
```

---

## PUT /api/items/:id

Updates an existing item. Send only the fields you want to change.

```http
PUT /api/items/7
Authorization: Bearer <token>
Content-Type: application/json

{
  "unit_price": 5.00,
  "quantity_in_stock": 175
}
```

**Response** `200 OK` — updated item object.

---

## DELETE /api/items/:id

Deletes an item. Will fail if the item is referenced in any quote.

```http
DELETE /api/items/7
Authorization: Bearer <token>
```

**Response** `200 OK` — `{ "deleted": true }` or error if item is in use.

---

## POST /api/items/upsert

Create or update an item by title. Useful for syncing from external systems.

```http
POST /api/items/upsert
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Gold Chiavari Chair",
  "unit_price": 4.75,
  "quantity_in_stock": 200
}
```

Returns the created or updated item.

---

## POST /api/items/bulk-upsert

Create or update multiple items in one request. Used by the browser extension for catalog sync.

```http
POST /api/items/bulk-upsert
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "title": "Chair A", "unit_price": 4.00, "quantity_in_stock": 50 },
    { "title": "Table B", "unit_price": 25.00, "quantity_in_stock": 20 }
  ]
}
```

**Response**
```json
{
  "created": 1,
  "updated": 1,
  "items": [...]
}
```

---

## GET /api/items/categories

Returns all distinct category names used in the catalog (including hidden items).

```http
GET /api/items/categories
Authorization: Bearer <token>
```

```json
{ "categories": ["Chairs", "Linens", "Lighting", "Tables"] }
```

---

## GET /api/items/categories/popular

Returns categories ranked by how frequently they appear in quotes.

```http
GET /api/items/categories/popular
Authorization: Bearer <token>
```

```json
[
  { "category": "Chairs", "quote_count": 45 },
  { "category": "Linens", "quote_count": 38 },
  { "category": "Tables", "quote_count": 31 }
]
```

---

## Item Accessories

Accessories are items that are optionally linked to a parent item (e.g., chair → cushion).

### GET /api/items/:id/accessories
```http
GET /api/items/7/accessories
Authorization: Bearer <token>
```
Returns `{ "accessories": [{ id, title, unit_price, ... }] }`

### POST /api/items/:id/accessories
```json
{ "accessory_id": 12 }
```

### DELETE /api/items/:id/accessories/:accessory_id

---

## Item Associations

Associations define parent-child relationships for inventory grouping.

### GET /api/items/:id/associations
### POST /api/items/:id/associations
```json
{ "child_id": 15 }
```
### DELETE /api/items/:id/associations/:child_id

---

## Item Statistics

```http
GET /api/stats/:item_id
Authorization: Bearer <token>
```

**Response**
```json
{
  "item_id": 7,
  "times_quoted": 42,
  "total_guests": 3800,
  "last_used_at": "2025-03-10 18:00:00",
  "probability": 1.1,
  "usage_brackets": [
    { "bracket_min": 0, "bracket_max": 100, "times_used": 8 },
    { "bracket_min": 100, "bracket_max": 200, "times_used": 20 },
    { "bracket_min": 200, "bracket_max": 999, "times_used": 14 }
  ]
}
```

- `probability` = `times_quoted / total_guests * 100`
- Usage brackets show frequency in guest-count ranges

---

## Availability Checking

```http
GET /api/availability?item_id=7&start=2025-06-15&end=2025-06-16
Authorization: Bearer <token>
```

Returns availability data showing reserved quantities across overlapping quotes. Used by the quote builder to warn about overbooking.

---

## Item Types

| Value | Meaning |
|-------|---------|
| `product` | Physical rental item (furniture, decor, equipment) |
| `labor` | Labor line item (setup, teardown, delivery) |
| `service` | Service offering (DJ, photography — non-physical) |
| `subrental` | Outsourced from a vendor, not in-house inventory |

---

## Hiding Items from Public Catalog

Set `hidden: 1` to exclude an item from `/api/public/items` and the SEO catalog while keeping it available in the internal quote builder.

Use case: seasonal items, discontinued stock, internal-only services.

```http
PUT /api/items/7
Authorization: Bearer <token>

{ "hidden": 1 }
```

---

## Image Upload Workflow

1. Upload file: `POST /api/files/upload` (multipart, `files` field)
2. Note the returned `id`
3. Save `id` as a string to `photo_url` on the item: `PUT /api/items/:id` `{ "photo_url": "42" }`
4. The public catalog API resolves this to a signed URL automatically

```javascript
async function uploadItemPhoto(file, itemId, token) {
  const form = new FormData();
  form.append('files', file);

  const upload = await fetch('/api/files/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  }).then(r => r.json());

  const fileId = upload.files[0].id;

  await fetch(`/api/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ photo_url: String(fileId) }),
  });
}
```

---

## Spreadsheet / PDF Import

For bulk catalog population:

```http
POST /api/sheets/upload        — Upload .xlsx or .csv file
POST /api/sheets/preview       — Preview parsed columns + suggested mapping
POST /api/sheets/import        — Commit import with column mapping
POST /api/sheets/upload-pdf    — Upload PDF for AI extraction
POST /api/sheets/import-pdf-quote — Extract quote items from PDF
```

See `server/routes/sheets.js` for full request/response shapes. Requires AI API key configured in Settings for PDF extraction.
