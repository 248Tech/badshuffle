document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastSync'], (result) => {
    const statusValue = document.getElementById('statusValue');
    const statRow = document.getElementById('statRow');
    const statItems = document.getElementById('statItems');
    const statNew = document.getElementById('statNew');
    const statUpdated = document.getElementById('statUpdated');

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
    statNew.textContent = sync.created || 0;
    statUpdated.textContent = sync.updated || 0;
  });
});
