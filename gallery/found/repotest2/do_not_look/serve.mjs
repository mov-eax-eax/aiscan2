// serve.mjs — tiny zero-dependency static file server for the Eiffel page.
// ES modules do not load over file://, so serve this folder on 127.0.0.1:8080.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = 8080;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.wasm': 'application/wasm'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/\\/g, '/');
    if (path === '/' || path === '') path = '/index.html';
    if (path.startsWith('/')) path = path.slice(1);
    const file = join(ROOT, path);
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
    const data = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + req.url);
  }
}).listen(PORT, HOST, () => {
  console.log(`Eiffel Tower dev server running at http://${HOST}:${PORT}/eiffel-tower.html`);
  console.log(`(Ctrl+C to stop)`);
});
