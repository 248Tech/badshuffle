'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 5173;

// In pkg mode the exe sits next to the www/ folder.
// In dev mode (node serve.js) serve from client/dist/.
const staticDir = typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'www')
  : path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp'
};

const server = http.createServer(function (req, res) {
  // Strip query string
  let urlPath = req.url.split('?')[0];

  // Resolve to a file path
  let filePath = path.join(staticDir, urlPath);

  // If it's a directory, try index.html inside it
  let stat;
  try { stat = fs.statSync(filePath); } catch {}

  if (!stat || stat.isDirectory()) {
    // SPA fallback
    filePath = path.join(staticDir, 'index.html');
  }

  let content;
  try {
    content = fs.readFileSync(filePath);
  } catch {
    // Final fallback
    try {
      content = fs.readFileSync(path.join(staticDir, 'index.html'));
      filePath = 'index.html';
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
});

server.listen(PORT, '127.0.0.1', function () {
  const url = 'http://localhost:' + PORT;
  console.log('BadShuffle client running on ' + url);
  // Open browser
  exec('start "" "' + url + '"');
});
