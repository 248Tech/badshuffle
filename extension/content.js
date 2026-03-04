/**
 * BadShuffle content script — scrapes Goodshuffle quote/catalog pages.
 * Goodshuffle is an AngularJS app; by document_idle, ng-src has compiled to src.
 */

const CLOUDFRONT_HOST = 'd1cy5d26evii7s.cloudfront.net';

// Selectors tried in order to find item title
const TITLE_SELECTORS = [
  '.item-name',
  '.item-title',
  '[ng-bind*="item.name"]',
  '[ng-bind*="item.title"]',
  '[ng-bind*="product.name"]',
  'h4',
  'h3',
  'strong'
];

// Selectors tried in order to identify an item container
const CONTAINER_SELECTORS = [
  '.item-row',
  '.quote-item',
  '.catalog-item',
  '.product-item',
  'tr',
  'li'
];

function findTitle(container) {
  for (const sel of TITLE_SELECTORS) {
    const el = container.querySelector(sel);
    if (el) {
      const text = (el.textContent || el.getAttribute('ng-bind') || '').trim();
      if (text && text.length > 1 && text.length < 200) return text;
    }
  }
  // Fallback: first non-empty text node in the container
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (text.length > 2 && text.length < 200) return text;
  }
  return null;
}

function getItemContainer(imgEl) {
  let el = imgEl.parentElement;
  while (el && el !== document.body) {
    for (const sel of CONTAINER_SELECTORS) {
      if (el.matches(sel)) return el;
    }
    el = el.parentElement;
  }
  // Fallback: return 3 levels up
  el = imgEl;
  for (let i = 0; i < 3; i++) el = el.parentElement || el;
  return el;
}

function isHiddenItem(container) {
  const hiddenClues = [
    '.sub-items',
    '.accessories',
    '.associated-items',
    '.child-items',
    '[ng-show*="hidden"]',
    '[ng-if*="associated"]'
  ];
  let el = container.parentElement;
  while (el && el !== document.body) {
    if (hiddenClues.some(s => el.matches && el.matches(s))) return true;
    el = el.parentElement;
  }
  return false;
}

function extractPrice(container) {
  // Try data attribute first
  const withData = container.querySelector('[data-price]');
  if (withData) {
    const p = parseFloat(withData.getAttribute('data-price'));
    if (!isNaN(p)) return p;
  }
  // Try price class
  const priceEl = container.querySelector('.price, .item-price, .unit-price');
  if (priceEl) {
    const m = priceEl.textContent.match(/\$?([\d,]+\.?\d*)/);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
  }
  // Scan text nodes for $xx.xx pattern
  const text = container.textContent;
  const m = text.match(/\$\s*([\d,]+\.?\d{2})/);
  if (m) return parseFloat(m[1].replace(/,/g, ''));
  return null;
}

function extractCategory(container) {
  const withData = container.querySelector('[data-category]');
  if (withData) return withData.getAttribute('data-category').trim() || null;
  // Try breadcrumb
  const breadcrumb = document.querySelector('.breadcrumb li:nth-last-child(2), .category-name');
  if (breadcrumb) return breadcrumb.textContent.trim() || null;
  return null;
}

function extractQuantity(container) {
  const withData = container.querySelector('[data-quantity]');
  if (withData) {
    const q = parseInt(withData.getAttribute('data-quantity'), 10);
    if (!isNaN(q)) return q;
  }
  const qInput = container.querySelector('input#quantity, input[name="quantity"], input.quantity');
  if (qInput) {
    const q = parseInt(qInput.value, 10);
    if (!isNaN(q)) return q;
  }
  return null;
}

function extractDescription(container) {
  const descEl = container.querySelector('.item-description, .product-description');
  if (descEl) return descEl.textContent.trim().slice(0, 500) || null;
  const detailsEl = container.querySelector('.item-details p, .product-details p');
  if (detailsEl) return detailsEl.textContent.trim().slice(0, 500) || null;
  return null;
}

function extractLeadInfo() {
  // Try to extract contact info from a Goodshuffle quote detail page
  const getText = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : null;
  };

  const name = getText('.client-name, .contact-name, [ng-bind*="client.name"], [ng-bind*="contact.name"]');
  const email = getText('.client-email, .contact-email, [ng-bind*="client.email"]');
  const phone = getText('.client-phone, .contact-phone, [ng-bind*="client.phone"]');
  const event_date = getText('.event-date, [ng-bind*="event.date"]');
  const event_type = getText('.event-type, [ng-bind*="event.type"]');

  if (!name && !email && !phone) return null;

  return { name, email, phone, event_date, event_type, source_url: window.location.href };
}

function extractItems() {
  const imgs = Array.from(document.querySelectorAll('img'));
  const cfImgs = imgs.filter(img => {
    const src = img.src || img.getAttribute('ng-src') || '';
    return src.includes(CLOUDFRONT_HOST);
  });

  const seen = new Map(); // title -> item
  const items = [];
  const parentChildPairs = [];

  for (const img of cfImgs) {
    const container = getItemContainer(img);
    const title = findTitle(container);
    if (!title) continue;

    const photo_url = img.src || img.getAttribute('ng-src') || null;
    const hidden = isHiddenItem(container);
    const unit_price = extractPrice(container);
    const category = extractCategory(container);
    const quantity_in_stock = extractQuantity(container);
    const description = extractDescription(container);

    if (!seen.has(title)) {
      seen.set(title, { title, photo_url, hidden, unit_price, category, quantity_in_stock, description });
      items.push({ title, photo_url, hidden, unit_price, category, quantity_in_stock, description });

      if (hidden) {
        let parentEl = container.parentElement;
        for (let i = 0; i < 5; i++) {
          if (!parentEl || parentEl === document.body) break;
          const parentTitle = findTitle(parentEl);
          if (parentTitle && parentTitle !== title) {
            parentChildPairs.push({ parent_title: parentTitle, child_title: title });
            break;
          }
          parentEl = parentEl.parentElement;
        }
      }
    }
  }

  const lead = extractLeadInfo();
  return { items, parentChildPairs, lead };
}

function sendToBackground(data) {
  chrome.runtime.sendMessage({ type: 'SYNC_ITEMS', ...data });
}

// Initial scrape
const { items, parentChildPairs, lead } = extractItems();
if (items.length > 0) {
  console.log(`[BadShuffle] Found ${items.length} items on page`);
  sendToBackground({ items, parentChildPairs, lead });
}

// Watch for AngularJS lazy-loaded content
let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const { items: newItems, parentChildPairs: newPairs, lead: newLead } = extractItems();
    if (newItems.length > 0) {
      sendToBackground({ items: newItems, parentChildPairs: newPairs, lead: newLead });
    }
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});
