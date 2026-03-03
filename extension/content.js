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
  // Hidden/associated items are often nested under a sub-list or have CSS classes
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

function extractItems() {
  const imgs = Array.from(document.querySelectorAll('img'));
  const cfImgs = imgs.filter(img => {
    const src = img.src || img.getAttribute('ng-src') || '';
    return src.includes(CLOUDFRONT_HOST);
  });

  const seen = new Map(); // title -> item
  const items = [];
  const parentChildPairs = []; // [{parent_title, child_title}]

  for (const img of cfImgs) {
    const container = getItemContainer(img);
    const title = findTitle(container);
    if (!title) continue;

    const photo_url = img.src || img.getAttribute('ng-src') || null;
    const hidden = isHiddenItem(container);

    if (!seen.has(title)) {
      seen.set(title, { title, photo_url, hidden });
      items.push({ title, photo_url, hidden });

      // Try to detect parent-child relationship
      if (hidden) {
        // Walk up to find parent container
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

  return { items, parentChildPairs };
}

function sendToBackground(data) {
  chrome.runtime.sendMessage({ type: 'SYNC_ITEMS', ...data });
}

// Initial scrape
const { items, parentChildPairs } = extractItems();
if (items.length > 0) {
  console.log(`[BadShuffle] Found ${items.length} items on page`);
  sendToBackground({ items, parentChildPairs });
}

// Watch for AngularJS lazy-loaded content
let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const { items: newItems, parentChildPairs: newPairs } = extractItems();
    if (newItems.length > 0) {
      sendToBackground({ items: newItems, parentChildPairs: newPairs });
    }
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});
