/* Deterministic offline capture: headless Chrome + SwiftShader WebGL. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///F:/repotest2/compound-bow/mathews.html';
const OUT = 'F:/repotest2/compound-bow/shots';
const W = 1600, H = 1000;

const SHOTS = [
  { n: '01_side', view: 'side' },
  { n: '02_hero', view: 'pair' },
  { n: '03_three', view: 'three' },
  { n: '04_cam', view: 'cam' },
  { n: '05_riser', view: 'riser' },
  { n: '06_grip', view: 'grip' },
  { n: '07_full_draw', view: 'draw', st: { draw: 1 } },
  { n: '08_mid_draw', view: 'side', st: { draw: 0.55 } },
  { n: '09_front', view: 'front' },
  { n: '10_whole', view: 'whole' },
  { n: '11_camo', view: 'three', st: { finish: 'camo', draw: 0.35 } },
  { n: '12_quiver', view: 'side', st: { quiver: true, draw: 0.3 } },
  { n: '13_ui', view: 'three', st: { ui: true, labels: true, draw: 0.72 } }
];
const only = process.argv[2] || null;
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 240000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
         '--disable-dev-shm-usage', '--allow-file-access-from-files',
         '--hide-scrollbars', '--window-size=' + W + ',' + H]
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', r => logs.push('[reqfail] ' + r.url().slice(0, 130)));

const t0 = Date.now();
let ok = true;
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 90000, polling: 200 });
} catch (e) { ok = false; console.log('LOAD FAILED after ' + ((Date.now() - t0) / 1000).toFixed(1) + 's: ' + e.message); }
console.log('ready in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's ok=' + ok);
if (ok) console.log('STATS ' + JSON.stringify(await page.evaluate(() => window.__STATS__)));

if (ok) {
  for (const s of SHOTS) {
    if (only && !s.n.includes(only)) continue;
    const ts = Date.now();
    await page.evaluate((sh) => {
      window.__set({ ui: false, draw: 0, auto: false, labels: false, quiver: false, finish: 'graphite' });
      if (sh.st) window.__set(sh.st);
      window.__view(sh.view);
    }, s);
    await new Promise(r => setTimeout(r, 260));
    await page.evaluate(() => window.__settle(4));
    await new Promise(r => setTimeout(r, 420));
    await page.screenshot({ path: OUT + '/' + s.n + '.png' });
    console.log('shot ' + s.n + ' ' + ((Date.now() - ts) / 1000).toFixed(1) + 's');
  }
}
if (logs.length) console.log('--- page log ---\n' + logs.slice(0, 30).join('\n'));
await browser.close();
process.exit(ok ? 0 : 1);
