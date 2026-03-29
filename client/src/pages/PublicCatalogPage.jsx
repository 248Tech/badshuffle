import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import styles from './PublicCatalogPage.module.css';

// ── SEO helper ────────────────────────────────────────────────────────────────
function useMeta(title, description) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc ? metaDesc.getAttribute('content') : '';
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);
    return () => {
      document.title = prev;
      if (metaDesc) metaDesc.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PublicCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCat = searchParams.get('category') || '';
  const searchQ = searchParams.get('search') || '';

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [company, setCompany] = useState({ name: 'Event Rentals', email: '', logo: '' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchQ);

  const pageTitle = selectedCat
    ? `${selectedCat} Rentals — ${company.name}`
    : `Event Rental Catalog — ${company.name}`;
  const pageDesc = selectedCat
    ? `Browse ${items.length} ${selectedCat} rental items from ${company.name}.`
    : `Browse ${company.name}'s complete event rental catalog — ${total} items across ${categories.length} categories.`;

  useMeta(pageTitle, pageDesc);

  // fetch meta once
  useEffect(() => {
    api.catalog.getMeta().then(d => {
      setCompany(d.company || { name: 'Event Rentals', email: '', logo: '' });
      setCategories(d.categories || []);
      setCounts(d.counts || {});
    }).catch(() => {});
  }, []);

  // fetch items when filters change
  useEffect(() => {
    setLoading(true);
    const params = {};
    if (selectedCat) params.category = selectedCat;
    if (searchQ) params.search = searchQ;
    api.catalog.getItems(params).then(d => {
      setItems(d.items || []);
      setTotal(d.total || 0);
      if (d.categories) setCategories(d.categories);
      if (d.counts) setCounts(d.counts);
    }).catch(() => {
      setItems([]);
    }).finally(() => setLoading(false));
  }, [selectedCat, searchQ]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (search) next.set('search', search);
    else next.delete('search');
    setSearchParams(next, { replace: true });
  }, [search, searchParams, setSearchParams]);

  const setCategory = useCallback((cat) => {
    const next = new URLSearchParams();
    if (cat) next.set('category', cat);
    if (searchQ) next.set('search', searchQ);
    setSearchParams(next, { replace: true });
  }, [searchQ, setSearchParams]);

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {company.logo && (
            <img src={company.logo} alt={`${company.name} logo`} className={styles.headerLogo} />
          )}
          <div>
            <div className={styles.headerName}>
              <Link to="/catalog">{company.name}</Link>
            </div>
            {company.email && <div className={styles.headerSub}>{company.email}</div>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero} aria-label="Catalog hero">
        <h1 className={styles.heroTitle}>
          {selectedCat ? `${selectedCat} Rentals` : 'Event Rental Catalog'}
        </h1>
        <p className={styles.heroSub}>
          {selectedCat
            ? `Browse our selection of ${selectedCat} rental items.`
            : `Everything you need for your perfect event.`}
        </p>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <div className={styles.heroStatNum}>{total}</div>
            <div className={styles.heroStatLabel}>Items</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatNum}>{categories.length}</div>
            <div className={styles.heroStatLabel}>Categories</div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar} aria-label="Filter by category">
          <div className={styles.sidebarBox}>
            <div className={styles.sidebarTitle}>Categories</div>
            <ul className={styles.catList}>
              <li>
                <button
                  type="button"
                  className={`${styles.catLink}${!selectedCat ? ` ${styles.catActive}` : ''}`}
                  onClick={() => setCategory('')}
                >
                  All Items
                  <span className={styles.catCount}>{totalAll}</span>
                </button>
              </li>
              {categories.map(cat => (
                <li key={cat}>
                  <button
                    type="button"
                    className={`${styles.catLink}${cat === selectedCat ? ` ${styles.catActive}` : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                    <span className={styles.catCount}>{counts[cat] || 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <section aria-label="Catalog items">
          <form className={styles.searchBar} onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Search items…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search items"
            />
          </form>
          <div className={styles.mainHeader}>
            <div className={styles.mainTitle}>{selectedCat || 'All Items'}</div>
            <div className={styles.mainCount}>{total} item{total !== 1 ? 's' : ''}</div>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading…</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden="true">📦</div>
              <p>No items found.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {items.map(item => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* CTA */}
      <section className={styles.ctaBand} aria-label="Request a quote">
        <h2>Ready to Book?</h2>
        <p>Contact us to check availability and get a custom quote for your event.</p>
        {company.email && (
          <a href={`mailto:${company.email}`} className={styles.btnPrimary}>
            Request a Quote
          </a>
        )}
      </section>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} {company.name}. All rights reserved.</p>
        {company.email && (
          <p><a href={`mailto:${company.email}`}>{company.email}</a></p>
        )}
      </footer>
    </div>
  );
}

function ItemCard({ item }) {
  return (
    <article className={styles.card} itemScope itemType="https://schema.org/Product">
      <Link to={`/catalog/item/${item.id}`} aria-label={item.title}>
        {item.photo_url ? (
          <img
            src={item.photo_url}
            alt={item.title}
            className={styles.cardImg}
            loading="lazy"
            width={400}
            height={300}
          />
        ) : (
          <div className={styles.cardPlaceholder} aria-hidden="true">📦</div>
        )}
      </Link>
      <div className={styles.cardBody}>
        {item.category && (
          <div className={styles.cardCat} itemProp="category">{item.category}</div>
        )}
        <h2 className={styles.cardTitle} itemProp="name">
          <Link to={`/catalog/item/${item.id}`}>{item.title}</Link>
        </h2>
        {item.description && (
          <p className={styles.cardDesc} itemProp="description">{item.description}</p>
        )}
        <div className={styles.cardFoot}>
          {item.unit_price ? (
            <span className={styles.cardPrice}>
              ${Number(item.unit_price).toFixed(2)}
              <small> / event</small>
            </span>
          ) : <span />}
          <Link to={`/catalog/item/${item.id}`} className={styles.cardLink}>View <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}
