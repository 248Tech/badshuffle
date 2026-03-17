/**
 * publicCatalog.js — no-auth public catalog routes
 *
 * Mounts:
 *   GET /robots.txt
 *   GET /sitemap.xml
 *   GET /api/public/catalog-meta
 *   GET /api/public/items
 *   GET /api/public/items/:id
 *   GET /catalog              — server-rendered HTML (SEO)
 *   GET /catalog/item/:id     — server-rendered HTML (SEO)
 */
const express = require('express');
const { getSignedFileServePath } = require('../lib/fileServeAuth');

// ─── helpers ────────────────────────────────────────────────────────────────

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePhoto(photoUrl, appUrl) {
  if (!photoUrl) return null;
  const p = String(photoUrl).trim();
  if (/^\d+$/.test(p)) return `${appUrl}${getSignedFileServePath(p, '/api/files')}`;
  return p;
}

// ─── styles (embedded for zero extra requests) ───────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6f8;color:#1a1a2e;line-height:1.6}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%;height:auto}
/* header */
.sh{background:#0f172a;color:#fff;padding:.875rem 0}
.sh-in{max-width:1200px;margin:0 auto;padding:0 1.5rem;display:flex;align-items:center;gap:.875rem}
.sh-logo{height:44px;width:auto;border-radius:4px}
.sh-name{font-size:1.25rem;font-weight:800;letter-spacing:-.3px}
.sh-name a{color:#fff}
.sh-sub{font-size:.8rem;color:rgba(255,255,255,.55);margin-top:.1rem}
/* hero */
.hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#fff;padding:3.5rem 1.5rem 2.5rem;text-align:center}
.hero h1{font-size:clamp(1.75rem,4vw,2.75rem);font-weight:900;letter-spacing:-1px;line-height:1.15;margin-bottom:.6rem}
.hero-sub{font-size:1.05rem;color:rgba(255,255,255,.75);max-width:560px;margin:0 auto 1.75rem}
.hero-stats{display:flex;gap:2.5rem;justify-content:center;flex-wrap:wrap;margin-top:1.5rem}
.hs-num{font-size:2rem;font-weight:900;color:#60a5fa;line-height:1}
.hs-lbl{font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.5);margin-top:.2rem}
/* cta buttons */
.btn{display:inline-block;border-radius:8px;font-weight:700;font-size:.95rem;padding:.75rem 1.75rem;transition:.15s}
.btn-p{background:#3b82f6;color:#fff}.btn-p:hover{background:#2563eb}
.btn-o{border:2px solid rgba(255,255,255,.35);color:#fff;margin-left:.6rem}.btn-o:hover{border-color:#fff}
/* layout */
.wrap{max-width:1200px;margin:0 auto;padding:2rem 1.5rem;display:grid;grid-template-columns:210px 1fr;gap:1.75rem;align-items:start}
@media(max-width:800px){.wrap{grid-template-columns:1fr}}
/* sidebar */
.sbox{background:#fff;border-radius:12px;padding:1.1rem 1.25rem;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem}
.sbox-ttl{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#94a3b8;margin-bottom:.6rem}
.cat-list{list-style:none}
.cat-list li{margin-bottom:.15rem}
.cat-a{display:flex;align-items:center;justify-content:space-between;padding:.38rem .6rem;border-radius:6px;font-size:.88rem;color:#475569;transition:.12s}
.cat-a:hover,.cat-a.on{background:#eff6ff;color:#2563eb;font-weight:600}
.cat-n{font-size:.7rem;background:#f1f5f9;color:#94a3b8;padding:.05rem .4rem;border-radius:99px}
.cat-a.on .cat-n{background:#dbeafe;color:#3b82f6}
/* main */
.main-hdr{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:1.1rem;gap:.5rem;flex-wrap:wrap}
.main-ttl{font-size:1.3rem;font-weight:800}
.main-ct{font-size:.85rem;color:#94a3b8}
/* grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1.1rem}
@media(max-width:480px){.grid{grid-template-columns:repeat(2,1fr);gap:.7rem}}
/* card */
.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);display:flex;flex-direction:column;transition:.2s}
.card:hover{box-shadow:0 6px 20px rgba(0,0,0,.12);transform:translateY(-2px)}
.card-img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#e8ecf0}
.card-ph{width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#e8ecf0,#d1d8e0);display:flex;align-items:center;justify-content:center;font-size:2.25rem;color:#b0bec5}
.card-body{padding:.8rem .9rem;flex:1;display:flex;flex-direction:column}
.card-cat{font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#3b82f6;margin-bottom:.25rem}
.card-ttl{font-size:.9rem;font-weight:700;line-height:1.3;margin-bottom:.3rem}
.card-ttl a{color:#1a1a2e}
.card-desc{font-size:.78rem;color:#64748b;line-height:1.45;flex:1;margin-bottom:.65rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-foot{display:flex;align-items:center;justify-content:space-between}
.card-price{font-size:.95rem;font-weight:800;color:#0f172a}
.card-price small{font-size:.65rem;font-weight:400;color:#94a3b8}
.card-link{font-size:.75rem;color:#3b82f6;font-weight:700}
/* detail */
.detail{max-width:960px;margin:0 auto;padding:2rem 1.5rem}
.bc{font-size:.82rem;color:#94a3b8;margin-bottom:1.5rem;display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
.bc a{color:#3b82f6}.bc-sep{color:#cbd5e1}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start}
@media(max-width:640px){.detail-grid{grid-template-columns:1fr}}
.d-img{width:100%;border-radius:14px;aspect-ratio:4/3;object-fit:cover;box-shadow:0 6px 24px rgba(0,0,0,.12);background:#e8ecf0}
.d-ph{width:100%;border-radius:14px;aspect-ratio:4/3;background:linear-gradient(135deg,#e8ecf0,#d1d8e0);display:flex;align-items:center;justify-content:center;font-size:4.5rem;color:#b0bec5}
.d-cat{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#3b82f6;margin-bottom:.4rem}
.d-ttl{font-size:clamp(1.5rem,3vw,2rem);font-weight:900;letter-spacing:-.5px;line-height:1.2;margin-bottom:.75rem}
.badge{display:inline-flex;align-items:center;gap:.35rem;font-size:.8rem;font-weight:700;padding:.3rem .7rem;border-radius:99px;margin-bottom:1rem}
.badge-ok{background:#dcfce7;color:#15803d}
.price-box{background:#eff6ff;border-radius:10px;padding:.9rem 1.1rem;margin-bottom:1.1rem}
.price-box .p{font-size:1.75rem;font-weight:900;color:#0f172a}
.price-box .pl{font-size:.8rem;color:#64748b}
.d-desc{font-size:.95rem;color:#475569;line-height:1.75;margin-bottom:1.4rem}
.meta{list-style:none;margin-bottom:1.4rem}
.meta li{display:flex;gap:.75rem;padding:.45rem 0;border-bottom:1px solid #f1f5f9;font-size:.87rem}
.meta li:last-child{border-bottom:none}
.mk{color:#94a3b8;min-width:90px}
.mv{font-weight:600}
.d-cta{display:flex;gap:.65rem;flex-wrap:wrap}
.d-cta .btn-p{background:#3b82f6;color:#fff;padding:.8rem 1.75rem;border-radius:8px}
.d-cta .btn-b{border:2px solid #e2e8f0;color:#475569;padding:.8rem 1.5rem;border-radius:8px;font-weight:600;font-size:.9rem}
.d-cta .btn-b:hover{border-color:#94a3b8}
/* cta band */
.cta-band{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:3rem 1.5rem;text-align:center;margin-top:3rem}
.cta-band h2{font-size:1.9rem;font-weight:900;margin-bottom:.6rem}
.cta-band p{font-size:1rem;color:rgba(255,255,255,.72);max-width:480px;margin:0 auto 1.4rem}
/* footer */
.foot{background:#0f172a;color:rgba(255,255,255,.4);text-align:center;padding:1.25rem 1.5rem;font-size:.82rem}
.foot a{color:rgba(255,255,255,.6)}
/* empty */
.empty{text-align:center;padding:4rem 1rem;color:#94a3b8}
.empty-icon{font-size:3rem;margin-bottom:.75rem}
/* search */
.search-bar{margin-bottom:1.25rem}
.search-bar input{width:100%;padding:.65rem 1rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.9rem;background:#fff;color:#0f172a;outline:none;transition:.15s}
.search-bar input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
`;

// ─── shared layout renderer ──────────────────────────────────────────────────

function layout({ head, body, company, appUrl }) {
  const logoHtml = company.logo
    ? `<img src="${esc(resolvePhoto(company.logo, appUrl))}" alt="${esc(company.name)} logo" class="sh-logo">`
    : '';
  const ctaHref = company.email ? `mailto:${esc(company.email)}` : '/catalog';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
${head}
<style>${CSS}</style>
</head>
<body>
<header class="sh" role="banner">
  <div class="sh-in">
    ${logoHtml}
    <div>
      <div class="sh-name"><a href="/catalog">${esc(company.name)}</a></div>
      ${company.email ? `<div class="sh-sub">${esc(company.email)}</div>` : ''}
    </div>
  </div>
</header>
<main id="main" role="main">${body}</main>
<section class="cta-band" aria-label="Get a quote">
  <h2>Ready to Book?</h2>
  <p>Contact us to check availability and request a custom quote for your event.</p>
  <a href="${ctaHref}" class="btn btn-p">${company.email ? 'Request a Quote' : 'Browse Catalog'}</a>
</section>
<footer class="foot" role="contentinfo">
  <p>&copy; ${year} ${esc(company.name)}. All rights reserved.</p>
  ${company.email ? `<p><a href="mailto:${esc(company.email)}">${esc(company.email)}</a></p>` : ''}
</footer>
</body>
</html>`;
}

function metaHead({ title, description, url, image, company }) {
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="${esc(company.name)}">
${image ? `<meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">`;
}

function jsonLdTag(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

// ─── router factory ──────────────────────────────────────────────────────────

module.exports = function makePublicCatalogRouter(db) {
  const router = express.Router();

  // ── db helpers ──────────────────────────────────────────────────────────────

  function getCompany() {
    const rows = db.prepare(
      "SELECT key, value FROM settings WHERE key IN ('company_name','company_email','company_logo','company_phone','company_address')"
    ).all();
    const c = {};
    for (const r of rows) c[r.key] = r.value != null ? String(r.value) : '';
    return {
      name: c.company_name || 'Event Rentals',
      email: c.company_email || '',
      logo: c.company_logo || '',
      phone: c.company_phone || '',
      address: c.company_address || '',
    };
  }

  function getCategories() {
    return db.prepare(
      "SELECT DISTINCT category FROM items WHERE hidden=0 AND category IS NOT NULL AND category!='' ORDER BY category ASC"
    ).all().map(r => r.category);
  }

  function getCategoryCounts() {
    const counts = {};
    db.prepare(
      "SELECT category, COUNT(*) AS n FROM items WHERE hidden=0 AND category IS NOT NULL AND category!='' GROUP BY category"
    ).all().forEach(r => { counts[r.category] = r.n; });
    return counts;
  }

  function publicItemSelect() {
    return 'id,title,category,description,unit_price,photo_url,quantity_in_stock,taxable,updated_at';
  }

  // ── robots.txt ──────────────────────────────────────────────────────────────

  router.get('/robots.txt', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\n` +
      `Allow: /catalog\n` +
      `Allow: /catalog/\n` +
      `Disallow: /api/\n` +
      `Disallow: /login\n` +
      `Disallow: /setup\n` +
      `Disallow: /dashboard\n` +
      `Disallow: /inventory\n` +
      `Disallow: /quotes\n` +
      `Disallow: /leads\n` +
      `Disallow: /messages\n` +
      `Disallow: /files\n` +
      `Disallow: /admin\n` +
      `Disallow: /settings\n` +
      `Disallow: /stats\n` +
      `Disallow: /vendors\n` +
      `Disallow: /billing\n` +
      `Disallow: /templates\n` +
      `Disallow: /import\n` +
      `Sitemap: ${appUrl}/sitemap.xml\n`
    );
  });

  // ── sitemap.xml ─────────────────────────────────────────────────────────────

  router.get('/sitemap.xml', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const today = new Date().toISOString().split('T')[0];
    const items = db.prepare(
      'SELECT id, updated_at FROM items WHERE hidden=0 ORDER BY id ASC'
    ).all();
    const categories = getCategories();

    const urls = [
      `<url><loc>${appUrl}/catalog</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`,
      ...categories.map(cat =>
        `<url><loc>${appUrl}/catalog?category=${encodeURIComponent(cat)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
      ),
      ...items.map(item => {
        const mod = item.updated_at ? String(item.updated_at).split(' ')[0] : today;
        return `<url><loc>${appUrl}/catalog/item/${item.id}</loc><lastmod>${mod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
      }),
    ];

    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
    );
  });

  // ── JSON API ─────────────────────────────────────────────────────────────────

  router.get('/api/public/catalog-meta', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const company = getCompany();
    if (company.logo) company.logo = resolvePhoto(company.logo, appUrl);
    const categories = getCategories();
    const counts = getCategoryCounts();
    const total = db.prepare('SELECT COUNT(*) AS n FROM items WHERE hidden=0').get().n;
    res.json({ company, categories, counts, total });
  });

  router.get('/api/public/items', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const { category, search, limit = 200, offset = 0 } = req.query;

    let where = 'hidden=0';
    const params = [];
    if (category) {
      where += " AND LOWER(TRIM(category))=LOWER(?)";
      params.push(String(category).trim());
    }
    if (search) {
      where += " AND (title LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${where}`).get(...params).n;
    const lim = Math.min(500, parseInt(limit, 10) || 200);
    const off = Math.max(0, parseInt(offset, 10) || 0);
    const items = db.prepare(
      `SELECT ${publicItemSelect()} FROM items WHERE ${where} ORDER BY category ASC, title ASC LIMIT ? OFFSET ?`
    ).all(...params, lim, off).map(item => ({
      ...item,
      photo_url: resolvePhoto(item.photo_url, appUrl),
    }));

    const categories = getCategories();
    const counts = getCategoryCounts();
    res.json({ items, total, categories, counts });
  });

  router.get('/api/public/items/:id', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const item = db.prepare(
      `SELECT ${publicItemSelect()} FROM items WHERE id=? AND hidden=0`
    ).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item: { ...item, photo_url: resolvePhoto(item.photo_url, appUrl) } });
  });

  // ── server-rendered catalog page ─────────────────────────────────────────────

  router.get('/catalog', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const selectedCat = req.query.category ? String(req.query.category).trim() : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const company = getCompany();
    const allCategories = getCategories();
    const counts = getCategoryCounts();

    let where = 'hidden=0';
    const params = [];
    if (selectedCat) {
      where += " AND LOWER(TRIM(category))=LOWER(?)";
      params.push(selectedCat);
    }
    if (search) {
      where += " AND (title LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    const items = db.prepare(
      `SELECT ${publicItemSelect()} FROM items WHERE ${where} ORDER BY category ASC, title ASC`
    ).all(...params);

    const pageTitle = selectedCat
      ? `${selectedCat} Rentals — ${company.name}`
      : `Event Rental Catalog — ${company.name}`;
    const pageDesc = selectedCat
      ? `Browse ${items.length} ${selectedCat} rental items available from ${company.name}. Request a custom quote for your next event.`
      : `Browse ${company.name}'s complete event rental catalog — ${items.length} items across ${allCategories.length} categories. Perfect for weddings, corporate events, and parties.`;
    const pageUrl = `${appUrl}/catalog${selectedCat ? `?category=${encodeURIComponent(selectedCat)}` : ''}`;

    // JSON-LD: ItemList
    const itemListSchema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: pageTitle,
      description: pageDesc,
      url: pageUrl,
      numberOfItems: items.length,
      itemListElement: items.slice(0, 100).map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: item.title,
          url: `${appUrl}/catalog/item/${item.id}`,
          ...(item.unit_price ? {
            offers: { '@type': 'Offer', price: Number(item.unit_price).toFixed(2), priceCurrency: 'USD' }
          } : {}),
        },
      })),
    };

    // JSON-LD: LocalBusiness
    const bizSchema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: company.name,
      ...(company.email ? { email: company.email } : {}),
      ...(company.phone ? { telephone: company.phone } : {}),
      ...(company.address ? { address: company.address } : {}),
      url: appUrl,
    };

    // Category sidebar
    const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
    const sidebarHtml = `
<li><a href="/catalog" class="cat-a${!selectedCat ? ' on' : ''}">All Items<span class="cat-n">${totalAll}</span></a></li>
${allCategories.map(cat => `
<li><a href="/catalog?category=${encodeURIComponent(cat)}" class="cat-a${cat === selectedCat ? ' on' : ''}">${esc(cat)}<span class="cat-n">${counts[cat] || 0}</span></a></li>`).join('')}`;

    // Item cards
    const cardsHtml = items.length > 0
      ? items.map(item => {
          const photo = resolvePhoto(item.photo_url, appUrl);
          const imgHtml = photo
            ? `<img src="${esc(photo)}" alt="${esc(item.title)}" class="card-img" loading="lazy" width="400" height="300">`
            : `<div class="card-ph" aria-hidden="true">📦</div>`;
          const priceHtml = item.unit_price
            ? `<span class="card-price">$${Number(item.unit_price).toFixed(2)}<small> / event</small></span>`
            : '<span></span>';
          return `
<article class="card" itemscope itemtype="https://schema.org/Product">
  <a href="/catalog/item/${item.id}" aria-label="${esc(item.title)}">${imgHtml}</a>
  <div class="card-body">
    ${item.category ? `<div class="card-cat" itemprop="category">${esc(item.category)}</div>` : ''}
    <h2 class="card-ttl" itemprop="name"><a href="/catalog/item/${item.id}">${esc(item.title)}</a></h2>
    ${item.description ? `<p class="card-desc" itemprop="description">${esc(item.description)}</p>` : ''}
    <div class="card-foot">${priceHtml}<a href="/catalog/item/${item.id}" class="card-link">View →</a></div>
  </div>
</article>`;
        }).join('')
      : `<div class="empty"><div class="empty-icon">📦</div><p>No items found.</p></div>`;

    const body = `
<section class="hero" aria-label="Catalog">
  <h1>${selectedCat ? `${esc(selectedCat)} Rentals` : 'Event Rental Catalog'}</h1>
  <p class="hero-sub">${selectedCat
    ? `Browse our complete selection of ${esc(selectedCat)} rental items.`
    : `Everything you need for your perfect event. ${items.length} items ready to rent.`}</p>
  <div class="hero-stats">
    <div><div class="hs-num">${items.length}</div><div class="hs-lbl">Items</div></div>
    <div><div class="hs-num">${allCategories.length}</div><div class="hs-lbl">Categories</div></div>
  </div>
</section>
<div class="wrap">
  <aside aria-label="Filter by category">
    <div class="sbox"><div class="sbox-ttl">Categories</div><ul class="cat-list">${sidebarHtml}</ul></div>
  </aside>
  <section aria-label="Inventory">
    <div class="main-hdr">
      <div>
        <div class="main-ttl">${selectedCat ? esc(selectedCat) : 'All Items'}</div>
        <div class="main-ct">${items.length} item${items.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
    <div class="grid" itemscope itemtype="https://schema.org/ItemList">${cardsHtml}</div>
  </section>
</div>`;

    const html = layout({
      company, appUrl,
      head: `${metaHead({ title: pageTitle, description: pageDesc, url: pageUrl, company })}
${jsonLdTag(itemListSchema)}
${jsonLdTag(bizSchema)}`,
      body,
    });

    res.type('text/html').send(html);
  });

  // ── server-rendered item detail page ─────────────────────────────────────────

  router.get('/catalog/item/:id', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const item = db.prepare(
      `SELECT ${publicItemSelect()} FROM items WHERE id=? AND hidden=0`
    ).get(req.params.id);
    if (!item) return res.status(404).send('Item not found');

    const company = getCompany();
    const photo = resolvePhoto(item.photo_url, appUrl);
    const isAvailable = (item.quantity_in_stock || 0) > 0;
    const priceStr = item.unit_price ? `$${Number(item.unit_price).toFixed(2)}` : null;

    const pageTitle = [
      item.title,
      item.category ? `${item.category} Rental` : null,
      company.name,
    ].filter(Boolean).join(' — ');

    const pageDesc = item.description
      ? `${item.description.slice(0, 160).trim()}${item.description.length > 160 ? '...' : ''} Available for rent from ${company.name}.`
      : `Rent ${item.title} for your next event.${priceStr ? ` Starting at ${priceStr}.` : ''} Available from ${company.name}.`;

    const pageUrl = `${appUrl}/catalog/item/${item.id}`;

    // JSON-LD: Product
    const productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: item.title,
      description: item.description || pageDesc,
      url: pageUrl,
      ...(photo ? { image: photo } : {}),
      ...(item.category ? { category: item.category } : {}),
      brand: { '@type': 'Brand', name: company.name },
      offers: {
        '@type': 'Offer',
        ...(item.unit_price ? { price: Number(item.unit_price).toFixed(2), priceCurrency: 'USD' } : {}),
        availability: isAvailable
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: company.name },
        ...(appUrl ? { url: pageUrl } : {}),
      },
    };

    // JSON-LD: BreadcrumbList
    const crumbItems = [
      { '@type': 'ListItem', position: 1, name: 'Catalog', item: `${appUrl}/catalog` },
    ];
    if (item.category) {
      crumbItems.push({
        '@type': 'ListItem', position: 2, name: item.category,
        item: `${appUrl}/catalog?category=${encodeURIComponent(item.category)}`,
      });
    }
    crumbItems.push({ '@type': 'ListItem', position: crumbItems.length + 1, name: item.title, item: pageUrl });
    const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbItems };

    const imgHtml = photo
      ? `<img src="${esc(photo)}" alt="${esc(item.title)}" class="d-img" width="600" height="450" itemprop="image">`
      : `<div class="d-ph" aria-hidden="true">📦</div>`;

    const backHref = item.category ? `/catalog?category=${encodeURIComponent(item.category)}` : '/catalog';
    const backLabel = item.category ? item.category : 'Catalog';
    const ctaHref = company.email
      ? `mailto:${esc(company.email)}?subject=${encodeURIComponent(`Rental inquiry: ${item.title}`)}`
      : '/catalog';

    const metaRows = [
      item.quantity_in_stock != null && `<li><span class="mk">In Stock</span><span class="mv">${item.quantity_in_stock} unit${item.quantity_in_stock !== 1 ? 's' : ''}</span></li>`,
      item.category && `<li><span class="mk">Category</span><span class="mv">${esc(item.category)}</span></li>`,
      item.taxable && `<li><span class="mk">Taxable</span><span class="mv">Yes</span></li>`,
    ].filter(Boolean).join('');

    const body = `
<div class="detail" itemscope itemtype="https://schema.org/Product">
  <nav class="bc" aria-label="Breadcrumb">
    <a href="/catalog">Catalog</a>
    ${item.category ? `<span class="bc-sep">/</span><a href="/catalog?category=${encodeURIComponent(item.category)}">${esc(item.category)}</a>` : ''}
    <span class="bc-sep">/</span>
    <span aria-current="page">${esc(item.title)}</span>
  </nav>
  <div class="detail-grid">
    <div>${imgHtml}</div>
    <div>
      ${item.category ? `<div class="d-cat" itemprop="category">${esc(item.category)}</div>` : ''}
      <h1 class="d-ttl" itemprop="name">${esc(item.title)}</h1>
      ${isAvailable ? `<div class="badge badge-ok">✓ Available for rent</div>` : ''}
      ${priceStr ? `
      <div class="price-box" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <div class="p" itemprop="price" content="${Number(item.unit_price).toFixed(2)}">${priceStr}</div>
        <div class="pl">per event &nbsp;·&nbsp; <span itemprop="priceCurrency" content="USD">USD</span></div>
      </div>` : ''}
      ${item.description ? `<p class="d-desc" itemprop="description">${esc(item.description)}</p>` : ''}
      ${metaRows ? `<ul class="meta">${metaRows}</ul>` : ''}
      <div class="d-cta">
        <a href="${ctaHref}" class="btn btn-p">Request a Quote</a>
        <a href="${esc(backHref)}" class="btn-b btn">← Back to ${esc(backLabel)}</a>
      </div>
    </div>
  </div>
</div>`;

    const html = layout({
      company, appUrl,
      head: `${metaHead({ title: pageTitle, description: pageDesc, url: pageUrl, image: photo, company })}
${jsonLdTag(productSchema)}
${jsonLdTag(breadcrumbSchema)}`,
      body,
    });

    res.type('text/html').send(html);
  });

  return router;
};
