// ============================================================
// serve.js — zero-dependency static server for the dashboard.
// Serves the ui/ folder so app.js can fetch() data.json
// (browsers block fetch of local file:// paths).
//
// Usage:  node ui/serve.js   (or: npm run ui:serve)
// Then open http://localhost:4173/
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.UI_PORT ? Number(process.env.UI_PORT) : 4173;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    // Strip query string and prevent path traversal.
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = path.join(ROOT, rel);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`[ui] Mission Control serving at http://localhost:${PORT}/`);
  });
