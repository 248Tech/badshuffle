document.addEventListener('DOMContentLoaded', () => {
  const tokenInput    = document.getElementById('tokenInput');
  const saveBtn       = document.getElementById('saveBtn');
  const connectMsg    = document.getElementById('connectMsg');
  const connectForm   = document.getElementById('connectForm');
  const connectedRow  = document.getElementById('connectedRow');
  const disconnectBtn = document.getElementById('disconnectBtn');

  const statusValue = document.getElementById('statusValue');
  const statRow     = document.getElementById('statRow');
  const statItems   = document.getElementById('statItems');
  const statNew     = document.getElementById('statNew');
  const statUpdated = document.getElementById('statUpdated');

  // Load stored token and sync status
  chrome.storage.local.get(['extToken', 'lastSync'], (result) => {
    if (result.extToken) {
      showConnected();
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
});
