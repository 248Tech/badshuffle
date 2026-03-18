/**
 * BadShuffle content script — scrapes Goodshuffle Pro inventory/catalog pages.
 *
 * Goodshuffle Pro is an AngularJS app. This script uses three layered strategies:
 *   1. Label-scan  — walk form-group/label pairs to read input values by field name
 *   2. ng-model    — query AngularJS bindings directly for known model paths
 *   3. CSS/text    — CSS class selectors + regex on visible text (last resort)
 *
 * Runs both on catalog listing pages (multi-item, image-driven) and on single
 * item detail/edit pages (/inventory/:id).
 */

const CLOUDFRONT_HOST = 'd1cy5d26evii7s.cloudfront.net';

// ─── Selectors tried in order to find an item title ────────────────────────
const TITLE_SELECTORS = [
  '.item-name', '.item-title', '.product-name', '.product-title',
  '[ng-bind*="item.name"]', '[ng-bind*="item.title"]', '[ng-bind*="product.name"]',
  'h1', 'h2', 'h3', 'h4', 'strong'
];

// ─── Selectors tried in order to identify a multi-item card container ───────
const CONTAINER_SELECTORS = [
  '.inventory-item', '.catalog-item', '.item-row', '.quote-item',
  '.product-item', '.item-card', 'tr', 'li'
];

// ───────────────────────────────────────────────────────────────────────────
// Strategy 1: Label-scan
// Finds a value by looking for a form-group/row whose label text matches one
// of the provided strings, then reads the adjacent input / textarea / div.
// ───────────────────────────────────────────────────────────────────────────
function findByLabel(labelTexts, scope) {
  scope = scope || document;
  const norm = labelTexts.map(t => t.toLowerCase().trim());

  // Walk every recognisable group container
  const groups = Array.from(scope.querySelectorAll(
    '.form-group, .form-field, .field-group, .field-row, .input-wrapper, tr, [class*="field"]'
  ));

  for (const group of groups) {
    const lbl = group.querySelector(
      'label, .control-label, .field-label, .label, th, td:first-child'
    );
    if (!lbl) continue;
    const lblText = lbl.textContent.trim().toLowerCase();
    if (!norm.some(t => lblText.includes(t))) continue;

    // Value: prefer an input/textarea inside the group
    const inp = group.querySelector(
      'input:not([type="hidden"]):not([type="checkbox"]), textarea, select'
    );
    if (inp) {
      const v = (inp.value || '').trim();
      if (v) return v;
    }

    // Value: try a dedicated value element
    const val = group.querySelector(
      '.form-control-static, .field-value, .control-value, .value, td + td, dd'
    );
    if (val) {
      const v = val.textContent.trim();
      if (v) return v;
    }
  }

  // Fallback: scan all labels in scope and check adjacent siblings
  const labels = Array.from(scope.querySelectorAll('label, .label-text, .gs-label'));
  for (const lbl of labels) {
    const lblText = lbl.textContent.trim().toLowerCase();
    if (!norm.some(t => lblText.includes(t))) continue;

    // Try the element the label is for
    if (lbl.htmlFor) {
      const target = document.getElementById(lbl.htmlFor);
      if (target) {
        const v = (target.value || target.textContent || '').trim();
        if (v) return v;
      }
    }

    // Try next sibling
    const sib = lbl.nextElementSibling;
    if (sib) {
      const inp = sib.matches('input,textarea,select')
        ? sib
        : sib.querySelector('input:not([type="hidden"]), textarea, select');
      if (inp) {
        const v = (inp.value || '').trim();
        if (v) return v;
      }
      const v = sib.textContent.trim();
      if (v) return v;
    }

    // Try parent → next sibling
    const parentSib = lbl.parentElement && lbl.parentElement.nextElementSibling;
    if (parentSib) {
      const inp = parentSib.querySelector('input:not([type="hidden"]), textarea, select');
      if (inp) {
        const v = (inp.value || '').trim();
        if (v) return v;
      }
    }
  }

  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Strategy 2: AngularJS ng-model lookup
// Goodshuffle binds data via ng-model; reading .value gives the current input.
// ───────────────────────────────────────────────────────────────────────────
function findByNgModel(patterns, scope) {
  scope = scope || document;
  for (const p of patterns) {
    const el = scope.querySelector(
      `[ng-model*="${p}"], [data-ng-model*="${p}"], [x-ng-model*="${p}"]`
    );
    if (el) {
      const v = (el.value || el.textContent || '').trim();
      if (v) return v;
    }
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Strategy 3: CSS class + text-regex (last resort for catalog card view)
// ───────────────────────────────────────────────────────────────────────────
function findByCss(selectors, scope) {
  scope = scope || document;
  for (const sel of selectors) {
    const el = scope.querySelector(sel);
    if (el) {
      const v = (el.value || el.textContent || '').trim();
      if (v) return v;
    }
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Field extractors — each tries all three strategies in order
// ───────────────────────────────────────────────────────────────────────────

function extractTitle(scope) {
  for (const sel of TITLE_SELECTORS) {
    const el = (scope || document).querySelector(sel);
    if (el) {
      const t = (el.textContent || el.getAttribute('ng-bind') || '').trim();
      if (t && t.length > 1 && t.length < 200) return t;
    }
  }
  // Walk text nodes as last resort
  const walker = document.createTreeWalker(scope || document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.trim();
    if (t.length > 2 && t.length < 200) return t;
  }
  return null;
}

function extractCategory(scope) {
  // 1. Label scan
  const byLabel = findByLabel(['category', 'categor'], scope);
  if (byLabel && byLabel.length < 100) return byLabel;

  // 2. ng-model
  const byModel = findByNgModel(
    ['category', 'category_id', 'categoryId', 'item_category'],
    scope
  );
  if (byModel && byModel.length < 100) return byModel;

  // 3. CSS / data attribute
  const withData = (scope || document).querySelector('[data-category]');
  if (withData) return withData.getAttribute('data-category').trim() || null;

  const byCss = findByCss(
    ['.category-name', '.item-category', '.product-category', '.category-tag',
     '[class*="category"]'],
    scope
  );
  if (byCss && byCss.length < 100) return byCss;

  // 4. Page breadcrumb (catalog listing detail pages)
  const breadcrumb = document.querySelector(
    '.breadcrumb li:nth-last-child(2), .category-breadcrumb, .breadcrumb-item:nth-last-child(2)'
  );
  if (breadcrumb) return breadcrumb.textContent.trim() || null;

  return null;
}

function extractQuantity(scope) {
  // 1. Label scan — Goodshuffle calls this "Qty Posted", "Qty Available", "Quantity"
  const byLabel = findByLabel(
    ['qty posted', 'posted qty', 'qty in stock', 'quantity in stock',
     'qty available', 'quantity available', 'qty owned', 'quantity owned',
     'qty', 'quantity', 'in stock'],
    scope
  );
  if (byLabel) {
    const n = parseInt(byLabel.replace(/[^\d]/g, ''), 10);
    if (!isNaN(n)) return n;
  }

  // 2. ng-model
  const byModel = findByNgModel(
    ['quantity_posted', 'qty_posted', 'posted_quantity',
     'quantity_in_stock', 'qty_in_stock', 'quantity_available',
     'qty_available', 'quantity_owned', 'item.quantity', 'item.qty'],
    scope
  );
  if (byModel) {
    const n = parseInt(byModel.replace(/[^\d]/g, ''), 10);
    if (!isNaN(n)) return n;
  }

  // 3. data attribute
  const withData = (scope || document).querySelector('[data-quantity]');
  if (withData) {
    const n = parseInt(withData.getAttribute('data-quantity'), 10);
    if (!isNaN(n)) return n;
  }

  // 4. CSS quantity inputs
  const qInput = (scope || document).querySelector(
    'input#quantity, input[name="quantity"], input.quantity, input[name="qty"], input.qty'
  );
  if (qInput) {
    const n = parseInt(qInput.value, 10);
    if (!isNaN(n)) return n;
  }

  return null;
}

function extractPrice(scope) {
  // 1. Label scan — Goodshuffle shows "Unit Price", "Rate", "Rental Price", "Price"
  const byLabel = findByLabel(
    ['unit price', 'rental price', 'rate', 'price per', 'daily rate',
     'event price', 'base price', 'price'],
    scope
  );
  if (byLabel) {
    const m = byLabel.match(/[\d,]+\.?\d*/);
    if (m) return parseFloat(m[0].replace(/,/g, ''));
  }

  // 2. ng-model
  const byModel = findByNgModel(
    ['unit_price', 'default_price', 'rental_price', 'price_per',
     'base_price', 'item.price', 'item.rate'],
    scope
  );
  if (byModel) {
    const m = byModel.match(/[\d,]+\.?\d*/);
    if (m) return parseFloat(m[0].replace(/,/g, ''));
  }

  // 3. data attribute
  const withData = (scope || document).querySelector('[data-price]');
  if (withData) {
    const p = parseFloat(withData.getAttribute('data-price'));
    if (!isNaN(p)) return p;
  }

  // 4. CSS price elements
  const priceEl = (scope || document).querySelector(
    '.price, .item-price, .unit-price, .rental-price, .rate-display, [class*="price"]'
  );
  if (priceEl) {
    const m = priceEl.textContent.match(/\$?\s*([\d,]+\.?\d*)/);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
  }

  // 5. First $xx.xx pattern in container text
  const m = (scope || document).textContent.match(/\$\s*([\d,]+\.?\d{2})/);
  if (m) return parseFloat(m[1].replace(/,/g, ''));

  return null;
}

function extractDescription(scope) {
  // 1. Label scan — specifically the INTERNAL description, not contract description
  //    Try "Internal Description", "Notes", "Description" but skip if it looks
  //    like the contract description field.
  const byLabel = findByLabel(
    ['internal description', 'internal notes', 'item notes',
     'staff notes', 'admin notes', 'description'],
    scope
  );
  if (byLabel && byLabel.length > 2 && byLabel.length < 2000) return byLabel.slice(0, 1000);

  // 2. ng-model
  const byModel = findByNgModel(
    ['internal_description', 'item_description', 'item.description',
     'product.description', 'notes'],
    scope
  );
  if (byModel && byModel.length > 2) return byModel.slice(0, 1000);

  // 3. CSS
  const descEl = (scope || document).querySelector(
    '.item-description, .product-description, .item-details p, .product-details p'
  );
  if (descEl) return descEl.textContent.trim().slice(0, 1000) || null;

  return null;
}

function extractContractDescription(scope) {
  // 1. Label scan — Goodshuffle has a dedicated "Contract Description" field
  //    that appears on customer-facing quotes and contracts.
  const byLabel = findByLabel(
    ['contract description', 'contract desc', 'customer description',
     'public description', 'quote description', 'client description',
     'document description', 'invoice description'],
    scope
  );
  if (byLabel && byLabel.length > 2 && byLabel.length < 2000) return byLabel.slice(0, 1000);

  // 2. ng-model — Goodshuffle likely uses one of these model paths
  const byModel = findByNgModel(
    ['contract_description', 'contractDescription', 'document_description',
     'documentDescription', 'public_description', 'customer_description',
     'quote_description', 'client_description'],
    scope
  );
  if (byModel && byModel.length > 2) return byModel.slice(0, 1000);

  // 3. CSS — look for a textarea with a class that indicates contract/customer content
  const descEl = (scope || document).querySelector(
    '[class*="contract-desc"], [class*="contract_desc"], [id*="contract-desc"], [id*="contractDesc"], [name*="contract"], [ng-model*="contract"]'
  );
  if (descEl) {
    const v = (descEl.value || descEl.textContent || '').trim();
    if (v.length > 2) return v.slice(0, 1000);
  }

  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Item container helpers
// ───────────────────────────────────────────────────────────────────────────

function getItemContainer(imgEl) {
  let el = imgEl.parentElement;
  while (el && el !== document.body) {
    for (const sel of CONTAINER_SELECTORS) {
      if (el.matches(sel)) return el;
    }
    el = el.parentElement;
  }
  // Fallback: 3 levels up
  el = imgEl;
  for (let i = 0; i < 3; i++) el = el.parentElement || el;
  return el;
}

function isHiddenItem(container) {
  const hiddenClues = [
    '.sub-items', '.accessories', '.associated-items', '.child-items',
    '[ng-show*="hidden"]', '[ng-if*="associated"]'
  ];
  let el = container.parentElement;
  while (el && el !== document.body) {
    if (hiddenClues.some(s => el.matches && el.matches(s))) return true;
    el = el.parentElement;
  }
  return false;
}

// ───────────────────────────────────────────────────────────────────────────
// Lead / contact extraction (quote detail pages)
// ───────────────────────────────────────────────────────────────────────────

function extractLeadInfo() {
  const getText = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() || null : null;
  };
  const getModel = (pattern) => {
    const el = document.querySelector(
      `[ng-bind*="${pattern}"], [ng-model*="${pattern}"]`
    );
    return el ? (el.textContent || el.value || '').trim() || null : null;
  };

  const name = getText('.client-name, .contact-name')
    || getModel('client.name') || getModel('contact.name');
  const email = getText('.client-email, .contact-email')
    || getModel('client.email') || getModel('contact.email');
  const phone = getText('.client-phone, .contact-phone')
    || getModel('client.phone') || getModel('contact.phone');
  const event_date = getText('.event-date') || getModel('event.date');
  const event_type = getText('.event-type') || getModel('event.type');

  if (!name && !email && !phone) return null;
  return { name, email, phone, event_date, event_type, source_url: window.location.href };
}

// ───────────────────────────────────────────────────────────────────────────
// Single-item detail page extraction
// Runs when the page looks like an inventory item detail/edit view
// ───────────────────────────────────────────────────────────────────────────

function extractFromDetailPage() {
  // Heuristic: page has a single main item being edited (form with item fields).
  // Look for a CloudFront image to get the photo, then scrape the whole page.
  const imgs = Array.from(document.querySelectorAll('img')).filter(
    img => (img.src || '').includes(CLOUDFRONT_HOST)
  );
  const photo_url = imgs.length > 0 ? imgs[0].src : null;

  const title = findByLabel(['item name', 'product name', 'name'], document)
    || findByNgModel(['item.name', 'item.title', 'product.name'], document)
    || extractTitle(document.querySelector('main, .content, .page-content, body'));

  if (!title) return null;

  return {
    title,
    photo_url,
    hidden: 0,
    category:             extractCategory(document),
    quantity_in_stock:    extractQuantity(document),
    unit_price:           extractPrice(document),
    description:          extractDescription(document),
    contract_description: extractContractDescription(document),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Main extraction — catalog listing (image-driven, multi-item)
// ───────────────────────────────────────────────────────────────────────────

function extractItems() {
  const imgs = Array.from(document.querySelectorAll('img'));
  const cfImgs = imgs.filter(img =>
    (img.src || img.getAttribute('ng-src') || '').includes(CLOUDFRONT_HOST)
  );

  // If only one item image found, we may be on a detail page
  if (cfImgs.length === 1) {
    const detail = extractFromDetailPage();
    if (detail && detail.title) {
      const lead = extractLeadInfo();
      return { items: [detail], parentChildPairs: [], lead };
    }
  }

  const seen = new Map();
  const items = [];
  const parentChildPairs = [];

  for (const img of cfImgs) {
    const container = getItemContainer(img);
    const title = extractTitle(container);
    if (!title) continue;

    const photo_url  = img.src || img.getAttribute('ng-src') || null;
    const hidden     = isHiddenItem(container);

    const category             = extractCategory(container);
    const quantity_in_stock    = extractQuantity(container);
    const unit_price           = extractPrice(container);
    const description          = extractDescription(container);
    const contract_description = extractContractDescription(container);

    if (!seen.has(title)) {
      const item = { title, photo_url, hidden, category, quantity_in_stock,
                     unit_price, description, contract_description };
      seen.set(title, item);
      items.push(item);

      if (hidden) {
        let parentEl = container.parentElement;
        for (let i = 0; i < 5; i++) {
          if (!parentEl || parentEl === document.body) break;
          const parentTitle = extractTitle(parentEl);
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

// ─── Initial scrape ─────────────────────────────────────────────────────────
const { items, parentChildPairs, lead } = extractItems();
if (items.length > 0) {
  console.log(`[BadShuffle] Found ${items.length} item(s) on page`);
  sendToBackground({ items, parentChildPairs, lead });
}

// ─── Watch for AngularJS lazy-loaded content ────────────────────────────────
let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const { items: newItems, parentChildPairs: newPairs, lead: newLead } = extractItems();
    if (newItems.length > 0) {
      sendToBackground({ items: newItems, parentChildPairs: newPairs, lead: newLead });
    }
  }, 600);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});
