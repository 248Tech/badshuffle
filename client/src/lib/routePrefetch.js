const prefetched = new Set();

const routeLoaders = {
  '/dashboard': () => import('../pages/DashboardPage.jsx'),
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
  const likelyRoutes = ['/dashboard', '/quotes', '/inventory', '/messages'];
  const queue = likelyRoutes.filter((route) => route !== normalizeRoute(currentPathname));
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
    idleId = window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    timeoutId = window.setTimeout(run, 450);
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
