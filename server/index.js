/* Minimal image proxy server
   - Streams files from NAS_BASE_URL and preserves original bytes (no re-encoding)
   - Use .env to set NAS_BASE_URL, NAS_USER, NAS_PASS
   - Caution: in production put authentication and rate-limiting in front of this server
*/

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 4000;

const NAS_BASE = process.env.NAS_BASE_URL;
const NAS_USER = process.env.NAS_USER;
const NAS_PASS = process.env.NAS_PASS;
const IMAGE_LIST_URL = process.env.IMAGE_LIST_URL;

if (!NAS_BASE && !IMAGE_LIST_URL) {
  console.warn('Warning: NAS_BASE_URL and IMAGE_LIST_URL are not configured. The server will serve a sample list only.');
}

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

// Return a list of images (proxied from IMAGE_LIST_URL if set)
app.get('/api/images', async (req, res) => {
  const category = req.query.category;

  if (IMAGE_LIST_URL) {
    try {
      const r = await fetch(IMAGE_LIST_URL);
      if (!r.ok) return res.status(502).send('Failed to fetch image list from IMAGE_LIST_URL');
      let list = await r.json();
      
      if (category) {
        list = list.filter(item => item.category === category);
      }
      
      return res.json(list);
    } catch (err) {
      console.error(err);
      return res.status(502).send('Error fetching image list');
    }
  }

  // sample fallback with categories
  let sampleList = [
    { path: 'sample/portrait1.jpg', title: 'Sample Portrait 1', category: 'portraits' },
    { path: 'sample/portrait2.jpg', title: 'Sample Portrait 2', category: 'portraits' },
    { path: 'sample/landscape1.jpg', title: 'Sample Landscape 1', category: 'landscapes' },
    { path: 'sample/landscape2.jpg', title: 'Sample Landscape 2', category: 'landscapes' },
    { path: 'sample/event1.jpg', title: 'Sample Event 1', category: 'events' },
    { path: 'sample/product1.jpg', title: 'Sample Product 1', category: 'products' }
  ];

  if (category) {
    sampleList = sampleList.filter(item => item.category === category);
  }

  return res.json(sampleList);
});

// Proxy route: /images/<relative-path>
app.get('/images/*', async (req, res) => {
  if (!NAS_BASE) return res.status(500).send('NAS_BASE_URL not configured');
  const rel = req.params[0];
  const targetUrl = (NAS_BASE.endsWith('/') ? NAS_BASE.slice(0,-1) : NAS_BASE) + '/' + rel;

  const headers = {};
  if (NAS_USER && NAS_PASS) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${NAS_USER}:${NAS_PASS}`).toString('base64');
  }

  try {
    const upstream = await fetch(targetUrl, { headers });
    if (!upstream.ok) return res.status(upstream.status).send('Upstream returned ' + upstream.status);

    // Forward key headers
    const contentType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const lastModified = upstream.headers.get('last-modified');

    if (contentType) res.set('Content-Type', contentType);
    if (contentLength) res.set('Content-Length', contentLength);
    if (lastModified) res.set('Last-Modified', lastModified);

    // Allow browser caching of static images; tune as needed
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Stream upstream body directly without touching bytes (preserves ICC profiles and original encoding)
    upstream.body.pipe(res);
  } catch (err) {
    console.error('Proxy error', err);
    res.status(502).send('Proxy error');
  }
});

app.listen(PORT, () => {
  console.log(`Image proxy server listening on port ${PORT}`);
});
