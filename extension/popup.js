const DEFAULT_SERVER = 'http://localhost:3001';

document.addEventListener('DOMContentLoaded', () => {
  const tokenInput    = document.getElementById('tokenInput');
  const saveBtn       = document.getElementById('saveBtn');
  const connectMsg    = document.getElementById('connectMsg');
  const connectForm   = document.getElementById('connectForm');
  const connectedRow  = document.getElementById('connectedRow');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const serverInput   = document.getElementById('serverInput');
  const serverSaveBtn = document.getElementById('serverSaveBtn');
  const serverMsg     = document.getElementById('serverMsg');
  const openBtn       = document.getElementById('openBtn');

  const statusValue   = document.getElementById('statusValue');
  const statRow       = document.getElementById('statRow');
  const statItems     = document.getElementById('statItems');
  const statNew       = document.getElementById('statNew');
  const statUpdated   = document.getElementById('statUpdated');
  const exportCard    = document.getElementById('exportCard');
  const copyJsonBtn   = document.getElementById('copyJsonBtn');
  const copyJsonMsg   = document.getElementById('copyJsonMsg');
  const exportItemCount = document.getElementById('exportItemCount');

  function setOpenBtnUrl(serverUrl) {
    openBtn.href = (serverUrl || DEFAULT_SERVER).replace(/\/$/, '');
  }

  // Load all stored state in one call
  chrome.storage.local.get(['extToken', 'serverUrl', 'lastSync', 'lastScrapedItems', 'lastScrapedAt'], (result) => {
    const serverUrl = result.serverUrl || DEFAULT_SERVER;
    serverInput.value = serverUrl;
    setOpenBtnUrl(serverUrl);

    if (result.extToken) showConnected();

    // Show export card if we have scraped items
    if (result.lastScrapedItems && result.lastScrapedItems.length > 0) {
      exportCard.style.display = 'block';
      const count = result.lastScrapedItems.length;
      const scrapedTs = result.lastScrapedAt ? new Date(result.lastScrapedAt).toLocaleTimeString() : '';
      exportItemCount.textContent = `${count} item${count !== 1 ? 's' : ''} scraped${scrapedTs ? ' at ' + scrapedTs : ''}`;
    }

    const sync = result.lastSync;
    if (!sync) {
      statusValue.textContent = 'No sync yet — visit a Goodshuffle page';
      return;
    }
    if (sync.error) {
      statusValue.innerHTML = `<span class="error">Error: ${sync.error}</span>`;
      return;
    }

    const ts = new Date(sync.timestamp);
    const elapsed = Math.floor((Date.now() - ts.getTime()) / 1000);
    const timeStr = elapsed < 60
      ? `${elapsed}s ago`
      : elapsed < 3600
        ? `${Math.floor(elapsed / 60)}m ago`
        : ts.toLocaleTimeString();

    statusValue.textContent = timeStr;
    statRow.style.display = 'flex';
    statItems.textContent = sync.itemCount || 0;
    statNew.textContent   = sync.created   || 0;
    statUpdated.textContent = sync.updated || 0;
  });

  function showConnected() {
    connectForm.style.display = 'none';
    connectedRow.style.display = 'flex';
  }

  function showDisconnected() {
    connectForm.style.display = 'block';
    connectedRow.style.display = 'none';
    tokenInput.value = '';
    connectMsg.textContent = '';
  }

  serverSaveBtn.addEventListener('click', () => {
    const url = serverInput.value.trim() || DEFAULT_SERVER;
    serverInput.value = url;
    chrome.storage.local.set({ serverUrl: url }, () => {
      setOpenBtnUrl(url);
      serverMsg.innerHTML = '<span class="success">Server URL saved.</span>';
      setTimeout(() => { serverMsg.textContent = ''; }, 2000);
    });
  });

  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (!token) {
      connectMsg.innerHTML = '<span class="error">Please paste a token first.</span>';
      return;
    }
    chrome.storage.local.set({ extToken: token }, () => {
      showConnected();
    });
  });

  disconnectBtn.addEventListener('click', () => {
    chrome.storage.local.remove('extToken', () => {
      showDisconnected();
    });
  });

  copyJsonBtn.addEventListener('click', () => {
    chrome.storage.local.get(['lastScrapedItems'], (result) => {
      const items = result.lastScrapedItems;
      if (!items || !items.length) {
        copyJsonMsg.innerHTML = '<span class="error">No items scraped yet.</span>';
        return;
      }
      const json = JSON.stringify(items, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        copyJsonMsg.innerHTML = '<span class="success">Copied!</span>';
        setTimeout(() => { copyJsonMsg.textContent = ''; }, 2500);
      }).catch(() => {
        copyJsonMsg.innerHTML = '<span class="error">Copy failed</span>';
      });
    });
  });
});
