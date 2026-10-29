import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const b64 = readFileSync('F:/repod2/eiffel2/shots/elev.png').toString('base64');
const plate = JSON.parse(readFileSync('F:/repod2/eiffel2/profile.json', 'utf8'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.goto('about:blank');
const res = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const W = c.width, H = c.height, d = ctx.getImageData(0, 0, W, H).data;
  const lum = (x, y) => { const i = (y * W + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
  const out = [];
  for (let y = 0; y < H; y++) {
    let lo = -1, hi = -1;
    for (let x = 0; x < W; x++) {
      if (lum(x, y) < 110) { if (lo < 0) lo = x; hi = x; }   // iron is dark against sky/gravel
    }
    if (lo >= 0) out.push([y, lo, hi]);
  }
  return { W, H, rows: out };
}, 'data:image/png;base64,' + b64);
// projection: camera at y=150 m, 1500 m away, fov 14 deg, portrait
const H = res.H, PXM = H / (2 * 1500 * Math.tan((14 * Math.PI / 180) / 2));
const yOf = (h) => H / 2 - (h - 150) * PXM;
const mine = {};
for (const [y, lo, hi] of res.rows) {
  const h = (H / 2 - y) / PXM + 150;
  if (h < 2 || h > 310) continue;
  const w = (hi - lo) / 2 / PXM;
  const k = Math.round(h);
  if (!(k in mine) || w > mine[k]) mine[k] = w;
}
const platePPM = plate.pxPerM, ground = plate.ground, axis = plate.axis;
const plateAt = {};
for (const [y, lo, hi] of plate.rows) {
  const h = (ground - y) / platePPM;
  if (h < 2 || h > 305) continue;
  const w = (hi - lo) / 2 / platePPM;
  const k = Math.round(h);
  if (!(k in plateAt) || w > plateAt[k]) plateAt[k] = w;
}
let worst = 0, worstH = 0, sum = 0, n = 0;
const table = [];
for (let h = 5; h <= 295; h += 10) {
  const m = mine[h], p = plateAt[h];
  if (m === undefined || p === undefined) continue;
  const dev = m - p, pct = 100 * dev / p;
  table.push([h, +p.toFixed(2), +m.toFixed(2), +dev.toFixed(2), +pct.toFixed(1)]);
  sum += Math.abs(pct); n++;
  if (Math.abs(pct) > worst) { worst = Math.abs(pct); worstH = h; }
}
console.log('h(m) | plate halfW | render halfW | delta | %');
for (const row of table) console.log(row.join('\t'));
console.log('mean abs error: ' + (sum / n).toFixed(1) + '%   worst: ' + worst.toFixed(1) + '% at ' + worstH + ' m');
await browser.close();
