# E-Commerce Integration Guide

This guide explains how to build a customer-facing React e-commerce site that uses BadShuffle inventory as product cards and feeds customer inquiries back into BadShuffle for quoting — similar to how WooCommerce displays products and generates orders.

---

## Overview

```
Customer-facing site (React)          BadShuffle (backend)
─────────────────────────────         ──────────────────────────────
/shop                           ←───  GET /api/public/items
/shop/:categorySlug             ←───  GET /api/public/items?category=
/shop/item/:id                  ←───  GET /api/public/items/:id
/request-quote (inquiry form)   ────► POST /api/leads
/my-quote/:token (optional)     ←───  GET /api/quotes/public/:token
  → approve button              ────► POST /api/quotes/approve-by-token
  → sign contract               ────► POST /api/quotes/contract/sign
```

---

## Part 1: Displaying Inventory as Product Cards

### Step 1: Fetch catalog metadata on app load

```javascript
// src/services/catalog.js
const BASE = import.meta.env.VITE_BADSHUFFLE_URL; // e.g. https://bs.yourcompany.com

export async function getCatalogMeta() {
  return fetch(`${BASE}/api/public/catalog-meta`).then(r => r.json());
}

export async function getItems({ category, search, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search)   params.set('search', search);
  params.set('limit', limit);
  params.set('offset', offset);
  return fetch(`${BASE}/api/public/items?${params}`).then(r => r.json());
}

export async function getItem(id) {
  return fetch(`${BASE}/api/public/items/${id}`).then(r => r.json());
}
```

> Set `VITE_BADSHUFFLE_URL` in your `.env` file. If the sites share the same origin, leave it empty and use relative paths.

### Step 2: Shop page with category filtering

```jsx
// src/pages/ShopPage.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getCatalogMeta, getItems } from '../services/catalog';
import ProductCard from '../components/ProductCard';

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || null;
  const search   = searchParams.get('q') || null;

  const [meta, setMeta]   = useState({ categories: [], counts: {}, company: {} });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load meta once
  useEffect(() => {
    getCatalogMeta().then(setMeta);
  }, []);

  // Load items when filters change
  useEffect(() => {
    setLoading(true);
    getItems({ category, search }).then(data => {
      setItems(data.items);
      setLoading(false);
    });
  }, [category, search]);

  return (
    <div className="shop-layout">
      {/* Category sidebar */}
      <aside className="shop-sidebar">
        <Link to="/shop" className={!category ? 'active' : ''}>
          All Items ({Object.values(meta.counts).reduce((a, b) => a + b, 0)})
        </Link>
        {meta.categories.map(cat => (
          <Link
            key={cat}
            to={`/shop?category=${encodeURIComponent(cat)}`}
            className={category === cat ? 'active' : ''}
          >
            {cat} ({meta.counts[cat] || 0})
          </Link>
        ))}
      </aside>

      {/* Product grid */}
      <main>
        <div className="product-grid">
          {loading
            ? [...Array(12)].map((_, i) => <ProductCardSkeleton key={i} />)
            : items.map(item => <ProductCard key={item.id} item={item} />)
          }
        </div>
      </main>
    </div>
  );
}
```

### Step 3: Product card component

```jsx
// src/components/ProductCard.jsx
import { Link } from 'react-router-dom';

export default function ProductCard({ item }) {
  return (
    <Link to={`/shop/item/${item.id}`} className="product-card">
      <div className="product-card__image">
        {item.photo_url
          ? <img src={item.photo_url} alt={item.title} loading="lazy" />
          : <div className="product-card__placeholder">📦</div>
        }
      </div>
      <div className="product-card__body">
        {item.category && (
          <span className="product-card__category">{item.category}</span>
        )}
        <h2 className="product-card__title">{item.title}</h2>
        {item.description && (
          <p className="product-card__desc">{item.description}</p>
        )}
        <div className="product-card__footer">
          {item.unit_price != null
            ? <span className="product-card__price">${item.unit_price.toFixed(2)}<small> / event</small></span>
            : <span className="product-card__price">Contact for pricing</span>
          }
          <span className="product-card__cta">View →</span>
        </div>
      </div>
    </Link>
  );
}
```

### Step 4: Product detail page

```jsx
// src/pages/ItemDetailPage.jsx
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getItem } from '../services/catalog';

export default function ItemDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getItem(id).then(data => { setItem(data.item); setLoading(false); });
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!item)   return <div>Item not found.</div>;

  const inStock = (item.quantity_in_stock || 0) > 0;

  return (
    <div className="item-detail">
      <nav className="breadcrumb">
        <Link to="/shop">Catalog</Link>
        {item.category && (
          <><span> / </span><Link to={`/shop?category=${encodeURIComponent(item.category)}`}>{item.category}</Link></>
        )}
        <span> / {item.title}</span>
      </nav>

      <div className="item-detail__grid">
        <div className="item-detail__media">
          {item.photo_url
            ? <img src={item.photo_url} alt={item.title} />
            : <div className="item-detail__placeholder">📦</div>
          }
        </div>

        <div className="item-detail__info">
          {item.category && <p className="item-detail__category">{item.category}</p>}
          <h1>{item.title}</h1>
          {inStock && <p className="badge badge--available">Available for rent</p>}

          {item.unit_price != null && (
            <div className="item-detail__price">
              <span>${item.unit_price.toFixed(2)}</span>
              <small> per event</small>
            </div>
          )}

          {item.description && <p className="item-detail__desc">{item.description}</p>}

          <div className="item-detail__meta">
            {item.quantity_in_stock != null && (
              <div><label>In stock:</label><span>{item.quantity_in_stock} units</span></div>
            )}
          </div>

          <Link
            to={`/request-quote?item=${encodeURIComponent(item.title)}&id=${item.id}`}
            className="btn btn-primary"
          >
            Request a Quote
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## Part 2: Lead / Inquiry Capture

The "Request a Quote" form posts to `/api/leads` to create a lead in BadShuffle.

### Lead submission service

```javascript
// src/services/leads.js
const BASE = import.meta.env.VITE_BADSHUFFLE_URL;
const SERVICE_TOKEN = import.meta.env.VITE_BADSHUFFLE_SERVICE_TOKEN;

export async function submitLead(data) {
  const res = await fetch(`${BASE}/api/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_TOKEN}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(`Lead submission failed: ${res.status}`);
  return res.json();
}
```

> `VITE_BADSHUFFLE_SERVICE_TOKEN` is a JWT for a dedicated `operator` service account in BadShuffle. **Never expose this in client-side code.** Route the request through your own backend if needed.

### Request a Quote page

```jsx
// src/pages/RequestQuotePage.jsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { submitLead } from '../services/leads';

const EVENT_TYPES = ['Wedding', 'Corporate', 'Birthday', 'Graduation', 'Anniversary', 'Other'];

export default function RequestQuotePage() {
  const [searchParams] = useSearchParams();
  const prefilledItem = searchParams.get('item') || '';

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    event_date: '',
    event_type: '',
    notes: prefilledItem ? `Items of interest: ${prefilledItem}\n\n` : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await submitLead({
        ...form,
        source_url: window.location.href,
      });
      setSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again or call us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="quote-success">
        <h1>Thank you!</h1>
        <p>We've received your inquiry and will be in touch within 1 business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="quote-form">
      <h1>Request a Quote</h1>

      <div className="form-row">
        <label>Your Name *
          <input value={form.name} onChange={set('name')} required />
        </label>
        <label>Email *
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
      </div>

      <div className="form-row">
        <label>Phone
          <input type="tel" value={form.phone} onChange={set('phone')} />
        </label>
        <label>Event Date
          <input type="date" value={form.event_date} onChange={set('event_date')} />
        </label>
      </div>

      <label>Event Type
        <select value={form.event_type} onChange={set('event_type')}>
          <option value="">Select type...</option>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label>Notes / Items of Interest
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={5}
          placeholder="Tell us what you're looking for, your guest count, venue, etc."
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting ? 'Submitting...' : 'Send Inquiry'}
      </button>
    </form>
  );
}
```

### Add to Cart pattern (inquiry cart)

For a WooCommerce-style "add to cart" flow where customers select multiple items before submitting:

```jsx
// src/context/CartContext.jsx
import { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]); // [{ id, title, quantity, unit_price, photo_url }]

  function addItem(item, quantity = 1) {
    setCart(c => {
      const existing = c.find(x => x.id === item.id);
      if (existing) return c.map(x => x.id === item.id ? { ...x, quantity: x.quantity + quantity } : x);
      return [...c, { ...item, quantity }];
    });
  }

  function removeItem(id) {
    setCart(c => c.filter(x => x.id !== id));
  }

  function updateQty(id, quantity) {
    if (quantity <= 0) return removeItem(id);
    setCart(c => c.map(x => x.id === id ? { ...x, quantity } : x));
  }

  function clearCart() {
    setCart([]);
  }

  // Build pre-filled notes string for lead submission
  function buildCartNotes(extraNotes = '') {
    if (cart.length === 0) return extraNotes;
    const items = cart.map(i => `  - ${i.quantity}x ${i.title} @ $${i.unit_price?.toFixed(2) ?? 'TBD'} each`).join('\n');
    return `Items of interest:\n${items}${extraNotes ? '\n\n' + extraNotes : ''}`;
  }

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQty, clearCart, buildCartNotes }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
```

```jsx
// In ProductCard or ItemDetailPage:
const { addItem } = useCart();
<button onClick={() => addItem(item, 1)}>Add to Quote</button>
```

```jsx
// In RequestQuotePage:
const { cart, buildCartNotes, clearCart } = useCart();

// Pre-fill notes from cart
const [form, setForm] = useState({
  notes: buildCartNotes(),
  ...
});

// After successful submission:
clearCart();
```

---

## Part 3: Optional Customer Portal (Quote Tracking)

Let customers view their quote status using the public share token emailed to them by BadShuffle.

### Quote view service

```javascript
// src/services/quotes.js
const BASE = import.meta.env.VITE_BADSHUFFLE_URL;

export async function getPublicQuote(token) {
  const res = await fetch(`${BASE}/api/quotes/public/${token}`);
  if (res.status === 404) throw new Error('Quote not found');
  if (!res.ok) throw new Error('Failed to load quote');
  return res.json();
}

export async function approveQuote(token) {
  const res = await fetch(`${BASE}/api/quotes/approve-by-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('Approval failed');
  return res.json();
}

export async function signContract(token, signerName) {
  const res = await fetch(`${BASE}/api/quotes/contract/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, signer_name: signerName }),
  });
  if (!res.ok) throw new Error('Signing failed');
  return res.json();
}

export async function sendMessage(token, { body_text, from_name, from_email }) {
  const res = await fetch(`${BASE}/api/quotes/public/${token}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body_text, from_name, from_email }),
  });
  if (!res.ok) throw new Error('Message failed');
  return res.json();
}
```

### Quote portal page

```jsx
// src/pages/QuotePortalPage.jsx
import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getPublicQuote, approveQuote } from '../services/quotes';

const STATUS_LABEL = {
  draft: 'Being Prepared',
  sent: 'Awaiting Your Approval',
  approved: 'Approved',
  confirmed: 'Confirmed',
  closed: 'Closed',
};

export default function QuotePortalPage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    getPublicQuote(token)
      .then(data => { setQuote(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  async function handleApprove() {
    setApproving(true);
    await approveQuote(token);
    // Reload quote to get updated status
    const updated = await getPublicQuote(token);
    setQuote(updated);
    setApproving(false);
  }

  if (loading) return <div>Loading your quote...</div>;
  if (!quote)  return <div>Quote not found. Check your email for the correct link.</div>;

  const total = quote.total ?? 0;
  const paid  = quote.amount_paid ?? 0;
  const balance = quote.remaining_balance ?? total;

  return (
    <div className="quote-portal">
      <h1>{quote.name}</h1>
      <p>Status: <strong>{STATUS_LABEL[quote.status] || quote.status}</strong></p>

      {/* Line items */}
      <section>
        <h2>Items</h2>
        {(quote.items || []).filter(i => !i.hidden_from_quote).map(item => (
          <div key={item.id} className="quote-line-item">
            <span>{item.quantity}x {item.label || item.title}</span>
            <span>${item.line_total?.toFixed(2)}</span>
          </div>
        ))}
        {(quote.custom_items || []).map(item => (
          <div key={item.id} className="quote-line-item">
            <span>{item.quantity}x {item.title}</span>
            <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </section>

      {/* Totals */}
      <section className="quote-totals">
        <div><label>Total:</label><span>${total.toFixed(2)}</span></div>
        <div><label>Paid:</label><span>${paid.toFixed(2)}</span></div>
        <div><label>Balance due:</label><span>${balance.toFixed(2)}</span></div>
      </section>

      {/* Contract */}
      {quote.contract?.body_html && (
        <section>
          <h2>Rental Agreement</h2>
          <div dangerouslySetInnerHTML={{ __html: quote.contract.body_html }} />
          {quote.contract.signed_at
            ? <p>✓ Signed by {quote.contract.signer_name} on {new Date(quote.contract.signed_at).toLocaleDateString()}</p>
            : <SignatureWidget token={token} onSigned={() => window.location.reload()} />
          }
        </section>
      )}

      {/* Approval button */}
      {quote.status === 'sent' && (
        <button onClick={handleApprove} disabled={approving} className="btn btn-primary">
          {approving ? 'Approving...' : 'Approve this Quote'}
        </button>
      )}
    </div>
  );
}
```

---

## Part 4: App Router Setup

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import ShopLayout from './layouts/ShopLayout';
import ShopPage from './pages/ShopPage';
import ItemDetailPage from './pages/ItemDetailPage';
import RequestQuotePage from './pages/RequestQuotePage';
import QuotePortalPage from './pages/QuotePortalPage';

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ShopLayout />}>
            <Route path="shop" element={<ShopPage />} />
            <Route path="shop/item/:id" element={<ItemDetailPage />} />
            <Route path="request-quote" element={<RequestQuotePage />} />
            <Route path="quote/:token" element={<QuotePortalPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}
```

---

## Part 5: Data Caching (React Query)

```javascript
// src/lib/queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes (signed photo URLs are safe this long)
      gcTime:    15 * 60 * 1000,    // 15 minutes
    },
  },
});
```

```javascript
// src/hooks/useCatalog.js
import { useQuery } from '@tanstack/react-query';
import { getItems } from '../services/catalog';

export function useCatalogItems({ category, search } = {}) {
  return useQuery({
    queryKey: ['catalog-items', { category, search }],
    queryFn: () => getItems({ category, search }),
  });
}

export function useItem(id) {
  return useQuery({
    queryKey: ['catalog-item', id],
    queryFn: () => getItem(id).then(d => d.item),
    enabled: !!id,
  });
}
```

---

## Part 6: SEO Strategy

| Approach | Benefit | Implementation |
|----------|---------|---------------|
| Use BadShuffle's built-in HTML pages | Zero setup, Google-indexed immediately | Redirect `/shop` → `/catalog` |
| React + `react-helmet-async` | Full control over meta/OG tags | Set title/description per page |
| Next.js SSR/SSG | Best SEO, static generation | Pre-render with `getStaticProps` |
| JSON-LD structured data | Rich results in Google | Already in BadShuffle's `/catalog` pages |

For a fully custom React site, use `react-helmet-async` and populate meta tags from the API data:

```jsx
import { Helmet } from 'react-helmet-async';

// In ItemDetailPage:
<Helmet>
  <title>{item.title} — {company.name}</title>
  <meta name="description" content={item.description?.slice(0, 160)} />
  <meta property="og:title" content={item.title} />
  <meta property="og:image" content={item.photo_url} />
</Helmet>
```

---

## Part 7: Environment Variables

```bash
# .env (e-commerce site)
VITE_BADSHUFFLE_URL=https://bs.yourcompany.com   # BadShuffle server URL
VITE_BADSHUFFLE_SERVICE_TOKEN=eyJ...             # Operator JWT (server-side use only)
```

**Security note:** If you need to call authenticated endpoints (like `POST /api/leads`) from a browser, route through your own API server so the service token is never exposed in client-side code.

---

## Part 8: CORS Setup

If your e-commerce site runs on a different origin than BadShuffle, add its origin to the CORS allowlist in `server/index.js`:

```javascript
// server/index.js — add to the allowedOrigins array or condition
const allowedOrigins = [
  /^http:\/\/localhost(:\d+)?$/,
  process.env.APP_URL,
  'https://shop.yourcompany.com',   // ← add your e-commerce site
];
```

Or set `APP_URL=https://shop.yourcompany.com` in the server's `.env` if the shop is the primary customer-facing URL.

---

## Quick Start Checklist

- [ ] Set `VITE_BADSHUFFLE_URL` to your BadShuffle server
- [ ] Verify `GET /api/public/items` returns your inventory
- [ ] Build `ProductCard` component using `item.photo_url`, `item.title`, `item.unit_price`
- [ ] Build `ShopPage` with category sidebar from `GET /api/public/catalog-meta`
- [ ] Build `ItemDetailPage` with "Request a Quote" CTA
- [ ] Build `RequestQuotePage` form that posts to `POST /api/leads`
- [ ] Create a service account user in BadShuffle (operator role) for `POST /api/leads`
- [ ] Test the full flow: browse → select item → submit inquiry → verify lead appears in BadShuffle
- [ ] (Optional) Build `QuotePortalPage` at `/quote/:token` for client self-service
- [ ] (Optional) Add inquiry cart with `CartContext` for multi-item inquiries
- [ ] Configure CORS if sites are on separate origins
- [ ] Add React Query or SWR for caching (5-minute stale time recommended)
