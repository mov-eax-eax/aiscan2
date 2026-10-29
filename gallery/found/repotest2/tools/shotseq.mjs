/* Capture the full shot: braced -> drawn -> loose -> flight -> impact.
   node tools/shotseq.mjs                                                      */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'F:/repotest2';
const FILE = process.argv[2] || 'crossbow.html';
const OUT = 'F:/repotest2/shots-xbow';
fs.mkdirSync(OUT, { recursive: true });
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
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 240000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 860 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/${FILE}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 90000, polling: 200 });

const shot = async (name, view, seek, extra = {}) => {
  await page.evaluate((v, s, e) => {
    window.__set(e);
    window.__view(v);
    window.__seek(s);
  }, view, seek, extra);
  await new Promise(r => setTimeout(r, 460));
  await page.screenshot({ path: `${OUT}/seq_${name}.png` });
  console.log('seq_' + name);
};

/* posed stills */
await shot('1_brace', 'action', 0);
await shot('2_quarter', 'action', 0.30);
await shot('3_half', 'action', 0.60);
await shot('4_fulldraw', 'action', 1);
await shot('5_hold_side', 'side', 1);
await shot('6_hold_cam', 'cam', 1);
await shot('7_hold_string', 'string', 1);
await shot('8_riser_full', 'riser', 1);

/* live shot in slow motion, sampled during flight */
await page.evaluate(() => { window.__reset(); window.__seek(1); });
await page.waitForFunction(() => document.getElementById('h-phase').textContent === 'hold', { timeout: 15000, polling: 100 });
await page.evaluate(() => { window.__set({ timeScale: 0.06, view: 'range' }); window.__view('range'); window.__fire(); });
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 320));
  const s = await page.evaluate(() => window.__BOLT__);
  await page.screenshot({ path: `${OUT}/seq_9_flight${i}.png` });
  console.log(`seq_9_flight${i}  z=${(s?.z ?? 0).toFixed(2)} v=${(s?.v ?? 0).toFixed(1)}`);
  if (s && s.phase === 'impact') break;
}
/* the last frame: switch to the downrange camera to see the strike */
await page.evaluate(() => window.__view('downrange'));
await new Promise(r => setTimeout(r, 340));
await page.screenshot({ path: `${OUT}/seq_10_impact.png` });
console.log('seq_10_impact');
await browser.close();
server.close();
