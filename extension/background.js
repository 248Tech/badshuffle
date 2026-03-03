/**
 * BadShuffle background service worker.
 * Receives scraped items from content.js and POSTs them to localhost:3001.
 * Content scripts cannot do cross-origin fetch in MV3; background can.
 */

const API_BASE = 'http://localhost:3001/api';

async function upsertItem(item) {
  const resp = await fetch(`${API_BASE}/items/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: item.title,
      photo_url: item.photo_url || null,
      source: 'extension',
      hidden: item.hidden ? 1 : 0
    })
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function syncItems(items, parentChildPairs) {
  const results = { created: 0, updated: 0, errors: 0 };
  const titleToId = {};

  // Upsert all items first
  for (const item of items) {
    try {
      const data = await upsertItem(item);
      titleToId[item.title] = data.item.id;
      if (data.created) results.created++;
      else results.updated++;
    } catch (e) {
      console.error('[BadShuffle] upsert failed:', item.title, e.message);
      results.errors++;
    }
  }

  // Resolve associations
  for (const pair of parentChildPairs) {
    const parentId = titleToId[pair.parent_title];
    const childId = titleToId[pair.child_title];
    if (!parentId || !childId) continue;

    try {
      await fetch(`${API_BASE}/items/${parentId}/associations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId })
      });
    } catch (e) {
      console.error('[BadShuffle] association failed:', e.message);
    }
  }

  return results;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'SYNC_ITEMS') return;

  const { items = [], parentChildPairs = [] } = message;

  syncItems(items, parentChildPairs)
    .then(results => {
      const summary = `Synced ${items.length} items: ${results.created} new, ${results.updated} updated, ${results.errors} errors`;
      console.log('[BadShuffle]', summary);

      // Save last sync info
      chrome.storage.local.set({
        lastSync: {
          timestamp: new Date().toISOString(),
          itemCount: items.length,
          created: results.created,
          updated: results.updated,
          errors: results.errors
        }
      });

      sendResponse({ ok: true, ...results });
    })
    .catch(e => {
      console.error('[BadShuffle] sync error:', e);
      chrome.storage.local.set({
        lastSync: {
          timestamp: new Date().toISOString(),
          error: e.message
        }
      });
      sendResponse({ ok: false, error: e.message });
    });

  return true; // keep message channel open for async response
});
