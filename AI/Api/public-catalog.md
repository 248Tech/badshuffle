# Public Catalog API

These endpoints require **no authentication**. They are the primary data source for a customer-facing e-commerce site.

All responses use `Content-Type: application/json` unless noted.

---

## GET /api/public/catalog-meta

Returns company branding info and the full category tree. Call this once on page load to populate navigation, header, and category sidebar.

**Request**
```http
GET /api/public/catalog-meta
```

**Response**
```json
{
  "company": {
    "name": "Acme Event Rentals",
    "email": "hello@acme-rentals.com",
    "logo": "https://your-host.com/api/files/42/serve?sig=abc&exp=1712500000000",
    "phone": "555-123-4567",
    "address": "123 Main St, Springfield, IL"
  },
  "categories": [
    "Chairs",
    "Linens",
    "Lighting",
    "Tables"
  ],
  "counts": {
    "Chairs": 12,
    "Linens": 8,
    "Lighting": 5,
    "Tables": 9
  },
  "total": 34
}
```

**Notes**
- `company.logo` is a fully-resolved, signed URL (safe to use directly in an `<img>` tag)
- `categories` is alphabetically sorted
- `counts` maps each category name to its item count
- `total` is the count of all visible (non-hidden) items

---

## GET /api/public/items

Returns a paginated list of all public inventory items. Supports filtering by category and text search.

**Request**
```http
GET /api/public/items?category=Chairs&search=chiavari&limit=50&offset=0
```

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | — | Filter to one category (case-insensitive) |
| `search` | string | — | Full-text search on `title` and `description` |
| `limit` | int | 200 | Items per page (max 500) |
| `offset` | int | 0 | Pagination offset |

**Response**
```json
{
  "items": [
    {
      "id": 7,
      "title": "Gold Chiavari Chair",
      "category": "Chairs",
      "description": "Classic gold resin chiavari chair with seat pad included.",
      "unit_price": 4.50,
      "photo_url": "https://your-host.com/api/files/7/serve?sig=xyz&exp=1712500000000",
      "quantity_in_stock": 200,
      "taxable": 1,
      "updated_at": "2025-03-15 14:22:01"
    }
  ],
  "total": 1,
  "categories": ["Chairs", "Linens", "Lighting", "Tables"],
  "counts": { "Chairs": 12, "Linens": 8, "Lighting": 5, "Tables": 9 }
}
```

**Item fields exposed**

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Unique item ID |
| `title` | string | Display name |
| `category` | string\|null | Category grouping |
| `description` | string\|null | Long-form description |
| `unit_price` | float\|null | Rental price per unit, per event |
| `photo_url` | string\|null | Fully-resolved signed image URL |
| `quantity_in_stock` | int | Total units available |
| `taxable` | 0\|1 | Whether tax applies |
| `updated_at` | ISO datetime | Last modification time |

**Notes**
- Items with `hidden = 1` are excluded automatically
- `photo_url` is `null` if no image is assigned
- Results sorted by `category ASC, title ASC`
- Signed photo URLs are time-limited; do not cache them for more than a few hours

---

## GET /api/public/items/:id

Returns a single public item by its ID.

**Request**
```http
GET /api/public/items/7
```

**Response**
```json
{
  "item": {
    "id": 7,
    "title": "Gold Chiavari Chair",
    "category": "Chairs",
    "description": "Classic gold resin chiavari chair with seat pad included.",
    "unit_price": 4.50,
    "photo_url": "https://your-host.com/api/files/7/serve?sig=xyz&exp=1712500000000",
    "quantity_in_stock": 200,
    "taxable": 1,
    "updated_at": "2025-03-15 14:22:01"
  }
}
```

**Error**
```json
{ "error": "Not found" }   // 404
```

---

## GET /api/files/:id/serve

Serves a file (image, PDF, etc.) directly. Supports two auth modes:

**Mode 1: Signed URL (for public use)**
```http
GET /api/files/42/serve?sig=<hmac-sha256-hex>&exp=<unix-ms-timestamp>
```
The `photo_url` field in all public API responses is pre-constructed with a valid `sig` and `exp`. Use them directly.

**Mode 2: Bearer JWT (for authenticated use)**
```http
GET /api/files/42/serve
Authorization: Bearer <token>
```

**Image Variants**

Request a specific format using the `variant` query parameter:

| Variant | Description |
|---------|-------------|
| (none) | Original file format |
| `webp` | WebP-compressed version (smaller, modern browsers) |
| `avif` | AVIF version (if enabled on server) |

```http
GET /api/files/42/serve?sig=...&exp=...&variant=webp
```

For e-commerce use, request `webp` for product images to reduce bandwidth.

---

## SEO-Rendered HTML Pages

These return full HTML pages (not JSON) — useful for embedding or server-side rendering.

### GET /catalog

Full catalog page with sidebar navigation, product grid, meta tags, and structured data (`schema.org/ItemList`, `schema.org/LocalBusiness`).

**Query Parameters:** `category`, `search` (same as JSON API)

### GET /catalog/item/:id

Single item page with full product detail, breadcrumbs, and structured data (`schema.org/Product`, `schema.org/BreadcrumbList`).

Both pages include:
- Open Graph meta tags (`og:title`, `og:description`, `og:image`)
- Twitter card meta
- JSON-LD structured data (Google-indexable)
- XML sitemap link

These pages can be used as the SEO layer while a React SPA handles the interactive shopping experience.

---

## GET /robots.txt and GET /sitemap.xml

Standard SEO files, auto-generated from live inventory data.

The sitemap includes:
- `/catalog` — main catalog page
- `/catalog?category=<name>` — one entry per category
- `/catalog/item/:id` — one entry per public item

---

## Pagination Pattern

```javascript
// Fetch first page
const page1 = await fetch('/api/public/items?limit=50&offset=0').then(r => r.json());

// Total items
const total = page1.total;

// Fetch subsequent pages
for (let offset = 50; offset < total; offset += 50) {
  const page = await fetch(`/api/public/items?limit=50&offset=${offset}`).then(r => r.json());
}
```

---

## React Integration Example

```jsx
// hooks/useCatalog.js
import { useState, useEffect } from 'react';

export function useCatalog({ category, search } = {}) {
  const [data, setData] = useState({ items: [], total: 0, categories: [], counts: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    params.set('limit', '200');

    fetch(`/api/public/items?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [category, search]);

  return { ...data, loading };
}
```

```jsx
// pages/ShopPage.jsx
import { useCatalog } from '../hooks/useCatalog';

export default function ShopPage() {
  const [category, setCategory] = useState(null);
  const { items, categories, counts, loading } = useCatalog({ category });

  return (
    <div className="shop-layout">
      <aside>
        <button onClick={() => setCategory(null)}>All Items</button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}>
            {cat} ({counts[cat]})
          </button>
        ))}
      </aside>
      <main>
        {loading ? <Spinner /> : (
          <div className="product-grid">
            {items.map(item => <ProductCard key={item.id} item={item} />)}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## Image Caching Recommendations

Signed photo URLs are time-limited. Recommended caching strategy:

- Cache responses from `/api/public/items` for **5–15 minutes** (via React Query / SWR stale time)
- Do **not** persist signed `photo_url` values in a long-term cache (they expire)
- For a Next.js / SSR setup, re-fetch on every server render and pass signed URLs to the client

---

## Null / Missing Fields

Always handle `null` defensively:

```jsx
function ProductCard({ item }) {
  return (
    <div>
      {item.photo_url
        ? <img src={item.photo_url} alt={item.title} />
        : <div className="placeholder-image">📦</div>
      }
      <h2>{item.title}</h2>
      {item.unit_price != null && (
        <p>${item.unit_price.toFixed(2)} / event</p>
      )}
      {item.description && <p>{item.description}</p>}
    </div>
  );
}
```
