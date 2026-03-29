import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import styles from './PublicItemPage.module.css';

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

export default function PublicItemPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [company, setCompany] = useState({ name: 'Event Rentals', email: '', logo: '' });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.catalog.getMeta().then(d => {
      setCompany(d.company || { name: 'Event Rentals', email: '', logo: '' });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.catalog.getItem(id).then(d => {
      setItem(d.item);
    }).catch(() => {
      setNotFound(true);
    }).finally(() => setLoading(false));
  }, [id]);

  const pageTitle = item
    ? [item.title, item.category ? `${item.category} Rental` : null, company.name].filter(Boolean).join(' — ')
    : company.name;
  const pageDesc = item
    ? (item.description
        ? `${item.description.slice(0, 160)}${item.description.length > 160 ? '...' : ''} Available for rent from ${company.name}.`
        : `Rent ${item.title} for your next event. Available from ${company.name}${item.unit_price ? ` starting at $${Number(item.unit_price).toFixed(2)}` : ''}.`)
    : '';

  useMeta(pageTitle, pageDesc);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <div className={styles.notFoundIcon} aria-hidden="true">📦</div>
          <h1>Item not found</h1>
          <Link to="/catalog" className={styles.btnPrimary}>Back to Catalog</Link>
        </div>
      </div>
    );
  }

  const isAvailable = (item.quantity_in_stock || 0) > 0;
  const priceStr = item.unit_price ? `$${Number(item.unit_price).toFixed(2)}` : null;
  const backHref = item.category ? `/catalog?category=${encodeURIComponent(item.category)}` : '/catalog';
  const ctaHref = company.email
    ? `mailto:${company.email}?subject=${encodeURIComponent(`Rental inquiry: ${item.title}`)}`
    : '/catalog';

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {company.logo && (
            <img src={company.logo} alt={`${company.name} logo`} className={styles.headerLogo} />
          )}
          <div>
            <div className={styles.headerName}><Link to="/catalog">{company.name}</Link></div>
            {company.email && <div className={styles.headerSub}>{company.email}</div>}
          </div>
        </div>
      </header>

      {/* Detail */}
      <div className={styles.detail} itemScope itemType="https://schema.org/Product">
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/catalog">Catalog</Link>
          {item.category && (
            <>
              <span className={styles.sep}>/</span>
              <Link to={`/catalog?category=${encodeURIComponent(item.category)}`}>{item.category}</Link>
            </>
          )}
          <span className={styles.sep}>/</span>
          <span aria-current="page">{item.title}</span>
        </nav>

        <div className={styles.grid}>
          {/* Image */}
          <div>
            {item.photo_url ? (
              <img
                src={item.photo_url}
                alt={item.title}
                className={styles.image}
                width={600}
                height={450}
                itemProp="image"
              />
            ) : (
              <div className={styles.imagePlaceholder} aria-hidden="true">📦</div>
            )}
          </div>

          {/* Info */}
          <div>
            {item.category && (
              <div className={styles.category} itemProp="category">{item.category}</div>
            )}
            <h1 className={styles.title} itemProp="name">{item.title}</h1>

            {isAvailable && (
              <div className={styles.badge}><span aria-hidden="true">✓</span> Available for rent</div>
            )}

            {priceStr && (
              <div className={styles.priceBox} itemProp="offers" itemScope itemType="https://schema.org/Offer">
                <div className={styles.price} itemProp="price" content={Number(item.unit_price).toFixed(2)}>
                  {priceStr}
                </div>
                <div className={styles.priceLabel}>
                  per event &nbsp;·&nbsp;{' '}
                  <span itemProp="priceCurrency" content="USD">USD</span>
                </div>
              </div>
            )}

            {item.description && (
              <p className={styles.description} itemProp="description">{item.description}</p>
            )}

            <ul className={styles.meta}>
              {item.quantity_in_stock != null && (
                <li>
                  <span className={styles.metaKey}>In Stock</span>
                  <span className={styles.metaVal}>
                    {item.quantity_in_stock} unit{item.quantity_in_stock !== 1 ? 's' : ''}
                  </span>
                </li>
              )}
              {item.category && (
                <li>
                  <span className={styles.metaKey}>Category</span>
                  <span className={styles.metaVal}>{item.category}</span>
                </li>
              )}
              {item.taxable ? (
                <li>
                  <span className={styles.metaKey}>Taxable</span>
                  <span className={styles.metaVal}>Yes</span>
                </li>
              ) : null}
            </ul>

            <div className={styles.cta}>
              <a href={ctaHref} className={styles.btnPrimary}>Request a Quote</a>
              <Link to={backHref} className={styles.btnBack}>
                <span aria-hidden="true">←</span> Back to {item.category || 'Catalog'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <section className={styles.ctaBand} aria-label="Request a quote">
        <h2>Interested in {item.title}?</h2>
        <p>Contact us to check availability and build a custom quote for your event.</p>
        {company.email && (
          <a href={`mailto:${company.email}?subject=${encodeURIComponent(`Rental inquiry: ${item.title}`)}`} className={styles.btnPrimary}>
            Contact Us
          </a>
        )}
      </section>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} {company.name}. All rights reserved.</p>
        {company.email && <p><a href={`mailto:${company.email}`}>{company.email}</a></p>}
      </footer>
    </div>
  );
}
