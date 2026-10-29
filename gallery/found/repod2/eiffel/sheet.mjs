import puppeteer from 'puppeteer-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// usage: node sheet.mjs <out.png> <views csv> [query] [tileW] [tileH] [cols]
const out = process.argv[2];
const views = (process.argv[3] || 'postcard,champ,base,lattice').split(',');
const query = process.argv[4] || '';
const TW = parseInt(process.argv[5] || '620', 10);
const TH = parseInt(process.argv[6] || '620', 10);
const COLS = parseInt(process.argv[7] || '2', 10);
const target = process.env.SHEET_TARGET ? resolve(process.env.SHEET_TARGET) : resolve(root, 'eiffel2/dist/tower.dev.html');
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage', '--hide-scrollbars', '--no-sandbox', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: TW, height: TH, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 900)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const url = 'file:///' + target.replace(/\\/g, '/') + '?hud=0&still=1' + (query ? '&' + query : '');
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__ready === true', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 900));

const tiles = [];
for (const v of views) {
  const ok = await page.evaluate('window.__snap(' + JSON.stringify(v) + ')');
  await new Promise((r) => setTimeout(r, 2200));         // let a couple of frames land
  if (!ok) errors.push('unknown view: ' + v);
  const shot = await page.screenshot({ encoding: 'base64' });
  tiles.push({ v, shot });
}

const html = '<html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(' + COLS +
  ',1fr);gap:2px;font:11px sans-serif;color:#fff">' +
  tiles.map((t) => '<div style="position:relative"><img src="data:image/png;base64,' + t.shot +
    '" style="width:100%;display:block"><div style="position:absolute;left:6px;top:6px;background:rgba(0,0,0,.55);padding:2px 6px;border-radius:4px">' +
    t.v + '</div></div>').join('') + '</body></html>';
await page.setViewport({ width: COLS * TW + (COLS - 1) * 2, height: Math.ceil(views.length / COLS) * TH + 4, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 400));
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(JSON.stringify({ out, views, errors: errors.slice(0, 4) }, null, 1));
await browser.close();
