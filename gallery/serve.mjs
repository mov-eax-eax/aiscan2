// Gallery static server. Restricts access to the gallery plus the twelve model
// projects on purpose: this repository also contains research data and private
// scan material that should not be exposed by a casual static server.
//
// Usage: node gallery/serve.mjs [port]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(here, '..');
const port = Number(process.argv[2] || process.env.PORT || 8150);
const host = process.env.HOST || '127.0.0.1';

const MODELS = [
  '747',
  '747_2',
  'acts27-storm',
  'dualsense-atlas',
  'eif3',
  'fishing game',
  'hhib',
  'mario-3-2',
  'ps5-dualsense',
  'revelation-3d',
  'sagrada-familia',
  'tropico-2026',
];
const ALLOWED_TOP = new Set(['gallery', ...MODELS]);

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
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

function allowedPath(rel) {
  const first = rel.split(/[\\/]/).filter(Boolean)[0];
  if (!first) return true;
  return first === 'index.html' ? false : ALLOWED_TOP.has(first);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (pathname === '/' || pathname === '') {
      res.writeHead(302, { location: '/gallery/' }).end();
      return;
    }
    const rel = normalize(pathname.replace(/^\/+/, '')).replaceAll('\\', '/');
    if (rel.startsWith('..') || rel.includes('/../') || !allowedPath(rel)) {
      res.writeHead(403, { 'content-type': 'text/plain' }).end('Forbidden');
      return;
    }
    let filePath = resolve(join(root, rel));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let st = null;
    try {
      st = await stat(filePath);
    } catch {
      /* not found */
    }
    if (st?.isDirectory()) filePath = join(filePath, 'index.html');
    if (!extname(filePath)) filePath += '.html';
    let data;
    try {
      data = await readFile(filePath);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err && err.stack));
  }
});

server.listen(port, host, () => {
  console.log(`The Model Room: http://${host}:${port}/gallery/`);
});
