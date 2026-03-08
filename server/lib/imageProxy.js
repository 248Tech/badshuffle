const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  // Only allow proxying known image hosts
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const allowedHosts = [
    'd1cy5d26evii7s.cloudfront.net',
    'goodshuffle.com',
    'goodshuffle.pro'
  ];

  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowed = allowedHosts.some(h => {
    const allowed = h.toLowerCase();
    return hostname === allowed || hostname.endsWith('.' + allowed);
  });
  if (!isAllowed) {
    return res.status(403).json({ error: 'Host not allowed' });
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BadShuffle/1.0' }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream error' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.body.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
