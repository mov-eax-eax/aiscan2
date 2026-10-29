/* Multi-view contact sheet: capture several camera angles of one file so the
   whole machine can be reviewed at once.
   node tools/sheet.mjs [file] [tag]                                          */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'F:/repotest2';
const FILE = process.argv[2] || 'crossbow.html';
const TAG = process.argv[3] || 'sheet';
const OUT = 'F:/repotest2/shots-xbow';
fs.mkdirSync(OUT, { recursive: true });
const W = 900, H = 620;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/' + FILE;
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(path.resolve(ROOT)) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 240000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto(`http://127.0.0.1:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 90000, polling: 200 });
await page.evaluate(() => { document.querySelectorAll('.panel,#status').forEach(e => e.style.display = 'none'); });

/* free camera: pass an explicit camera position + target */
const CAMS = [
  ['A_side', [-1.30, 0.42, -0.30], [0, 0.15, 0.05], 42],
  ['B_3q', [-0.98, 0.66, -0.86], [0, 0.16, 0.02], 46],
  ['C_top', [0.02, 1.20, -0.16], [0, 0.14, 0.06], 44],
  ['D_front', [-0.30, 0.42, 1.05], [0, 0.14, 0.10], 40],
  ['E_camclose', [-0.62, 0.30, 0.30], [-0.30, 0.10, 0.32], 30],
  ['F_rear', [-0.32, 0.50, -1.05], [0, 0.14, -0.10], 42],
  ['G_under', [-0.85, -0.42, -0.55], [0, 0.16, 0.05], 44],
  ['H_wide', [-1.75, 0.98, -1.30], [0, 0.18, 0.05], 44],
];
for (const [n, pos, tgt, fov] of CAMS) {
  await page.evaluate((p, t, f) => { window.__set({ view: 'full' }); window.__camFree(p, t, f); }, pos, tgt, fov);
  await new Promise(r => setTimeout(r, 420));
  await page.screenshot({ path: `${OUT}/${TAG}_${n}.png` });
  console.log(TAG + '_' + n);
}
await browser.close();
server.close();
