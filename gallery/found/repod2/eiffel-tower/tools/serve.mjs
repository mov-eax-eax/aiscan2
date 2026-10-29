/**
 * Minimal static server for this project (ES modules need an http origin).
 *   node tools/serve.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const PORT = Number(process.argv[2] || 8123);
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.stat(file, (err, st) => {
      if (err && !path.extname(file)) {
        file = `${file}.html`;
        fs.stat(file, (e2, s2) => (e2 ? notFound(res) : send(res, file, s2)));
        return;
      }
      if (err || !st.isFile()) {
        notFound(res);
        return;
      }
      send(res, file, st);
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Tour Eiffel served at http://127.0.0.1:${PORT}/`);
  });

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
}

function send(res, file, st) {
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': st.size,
    'cache-control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}
