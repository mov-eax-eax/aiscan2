/* Deterministic offline capture: headless Chrome + SwiftShader WebGL.
   Side view first - that is the acceptance test.

   usage: node tools/shot.mjs [nameFilter] */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const PAGE = (process.argv.find(a => a.startsWith('--page=')) || '--page=recurve.html').slice(7);
const URL = 'file:///' + path.join(ROOT, PAGE).replace(/\\/g, '/');
const OUT = path.join(ROOT, 'shots');
const W = 1680, H = 1050;

const SHOTS = [
  { n: '01_side', cam: 'side' },
  { n: '02_whole', cam: 'whole' },
  { n: '03_three', cam: 'three' },
  { n: '04_riser', cam: 'riser' },
  { n: '05_sight', cam: 'sight' },
  { n: '06_front', cam: 'front' },
  { n: '07_side_labels', cam: 'side', st: { labels: true } },
  { n: '08_side_bare', cam: 'side', st: { stand: false } },
];

const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 300000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
    '--disable-dev-shm-usage', '--allow-file-access-from-files',
    '--hide-scrollbars', '--window-size=' + W + ',' + H],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const logs = [];
page.on('console', m => { const t = m.text(); if (t) logs.push('[' + m.type() + '] ' + t); });
page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', r => logs.push('[reqfail] ' + r.url().slice(0, 140)));

const t0 = Date.now();
let ok = true;
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 60000, polling: 250 });
} catch (e) {
  ok = false;
  console.log('LOAD FAILED after ' + ((Date.now() - t0) / 1000).toFixed(1) + 's: ' + e.message);
}
console.log('ready in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's  ok=' + ok);
if (ok) console.log('STATS ' + JSON.stringify(await page.evaluate(() => window.__STATS__)));

if (ok) {
  for (const s of SHOTS) {
    if (only && !s.n.includes(only)) continue;
    const ts = Date.now();
    await page.evaluate((sh) => {
      window.__set({ labels: false, stand: true });
      if (sh.st) window.__set(sh.st);
      window.__view(sh.cam);
    }, s);
    await new Promise(r => setTimeout(r, 420));
    await page.screenshot({ path: path.join(OUT, s.n + '.png') });
    console.log('shot ' + s.n.padEnd(18) + ((Date.now() - ts) / 1000).toFixed(1) + 's');
  }
}
if (logs.length) console.log('--- page log ---\n' + logs.slice(0, 30).join('\n'));
await browser.close();
process.exit(ok ? 0 : 1);
