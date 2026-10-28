/**
 * serve.mjs — dependency-free dev server for the modular sources.
 *
 *   node tools/serve.mjs            → http://127.0.0.1:8123
 *   PORT=9000 node tools/serve.mjs
 *
 * Serves the index.html shell and builds /app.js on the fly from src/, so
 * editing a src fragment and reloading is enough. index.html on disk is exactly
 * what `build.mjs` consumes, so there is one shell only.
 */
import { createServer } from 'node:http';
import { bundle, readShell, ROOT } from './modules.mjs';

const PORT = Number(process.env.PORT || 8123);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(await readShell());
      return;
    }
    if (url.pathname === '/app.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(await bundle());
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(err));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('eif3 dev server → http://127.0.0.1:' + PORT + '/');
  console.log('sources   → ' + ROOT + '\\src');
  console.log('night     → http://127.0.0.1:' + PORT + '/#night');
});
