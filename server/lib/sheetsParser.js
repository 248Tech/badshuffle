const fetch = require('node-fetch');
const Papa = require('papaparse');

function sheetUrlToCsvUrl(url) {
  // Handle various Google Sheets URL formats
  const editMatch = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!editMatch) throw new Error('Invalid Google Sheets URL');

  const id = editMatch[1];

  // Check for specific gid (sheet tab)
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

async function fetchCsv(url) {
  const csvUrl = sheetUrlToCsvUrl(url);
  const resp = await fetch(csvUrl, { redirect: 'follow' });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
      throw new Error('Sheet is not publicly accessible. Make sure it is published to the web (File → Share → Publish to web).');
    }
    throw new Error(`Failed to fetch sheet: ${resp.status} ${resp.statusText}`);
  }

  const text = await resp.text();
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true
  });

  if (result.errors.length > 0) {
    const serious = result.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');
    if (serious.length > 0) throw new Error('CSV parse error: ' + serious[0].message);
  }

  return result;
}

module.exports = { fetchCsv, sheetUrlToCsvUrl };
