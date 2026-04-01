const prefetched = new Set();

const routeLoaders = {
  '/dashboard': () => import('../pages/DashboardPage.jsx'),
  '/maps': () => import('../pages/MapsPage.jsx'),
  '/inventory': () => import('../pages/InventoryPage.jsx'),
  '/inventory-settings': () => import('../pages/InventorySettingsPage.jsx'),
  '/import': () => import('../pages/ImportPage.jsx'),
  '/quotes': () => import('../pages/QuotePage.jsx'),
  '/billing': () => import('../pages/BillingPage.jsx'),
  '/stats': () => import('../pages/StatsPage.jsx'),
  '/extension': () => import('../pages/ExtensionPage.jsx'),
  '/leads': () => import('../pages/LeadsPage.jsx'),
  '/files': () => import('../pages/FilesPage.jsx'),
  '/messages': () => import('../pages/MessagesPage.jsx'),
  '/admin': () => import('../pages/AdminPage.jsx'),
  '/templates': () => import('../pages/TemplatesPage.jsx'),
  '/vendors': () => import('../pages/VendorsPage.jsx'),
  '/settings': () => import('../pages/SettingsPage.jsx'),
  '/directory': () => import('../pages/DirectoryPage.jsx'),
  '/team': () => import('../pages/TeamPage.jsx'),
  '/profile': () => import('../pages/ProfilePage.jsx'),
  '/message-settings': () => import('../pages/MessageSettingsPage.jsx'),
  '/catalog': () => import('../pages/PublicCatalogPage.jsx'),
};

function normalizeRoute(pathname) {
  if (!pathname) return null;
  if (pathname.startsWith('/inventory/')) return '/inventory';
  if (pathname.startsWith('/quotes/')) return '/quotes';
  if (pathname.startsWith('/quote/public/')) return null;
  if (pathname.startsWith('/catalog/item/')) return '/catalog';
  return pathname;
}

function getConnection() {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function canWarmInBackground() {
  if (typeof window === 'undefined') return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;

  const connection = getConnection();
  if (connection) {
    if (connection.saveData) return false;
    const effectiveType = String(connection.effectiveType || '').toLowerCase();
    if (effectiveType.includes('2g')) return false;
    if (effectiveType === 'slow-2g') return false;
  }

  const deviceMemory = typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number'
    ? navigator.deviceMemory
    : null;
  if (deviceMemory != null && deviceMemory <= 2) return false;

  const hardwareConcurrency = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
    ? navigator.hardwareConcurrency
    : null;
  if (hardwareConcurrency != null && hardwareConcurrency <= 4) return false;

  return true;
}

function getLikelyRoutes(currentPathname = '') {
  const current = normalizeRoute(currentPathname);
  switch (current) {
    case '/dashboard':
      return ['/quotes', '/maps'];
    case '/maps':
      return ['/dashboard', '/quotes'];
    case '/quotes':
      return ['/dashboard', '/inventory'];
    case '/inventory':
      return ['/quotes', '/dashboard'];
    case '/messages':
      return ['/dashboard'];
    case '/billing':
      return ['/quotes'];
    default:
      return ['/dashboard', '/quotes'];
  }
}

export function prefetchRoute(pathname) {
  const normalized = normalizeRoute(pathname);
  if (!normalized || prefetched.has(normalized)) return;
  const loader = routeLoaders[normalized];
  if (!loader) return;
  prefetched.add(normalized);
  loader().catch(() => {
    prefetched.delete(normalized);
  });
}

export function warmCoreRoutes(currentPathname = '') {
  if (!canWarmInBackground()) return undefined;

  const queue = getLikelyRoutes(currentPathname).filter((route) => route !== normalizeRoute(currentPathname));
  if (queue.length === 0) return undefined;

  let cancelled = false;
  let idleId = null;
  let timeoutId = null;

  const run = () => {
    if (cancelled) return;
    queue.forEach((route, index) => {
      window.setTimeout(() => {
        if (!cancelled) prefetchRoute(route);
      }, index * 180);
    });
  };

  if (typeof window.requestIdleCallback === 'function') {
    idleId = window.requestIdleCallback(run, { timeout: 1500 });
  } else {
    timeoutId = window.setTimeout(run, 900);
  }

  return () => {
    cancelled = true;
    if (idleId != null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
    }
  };
}
