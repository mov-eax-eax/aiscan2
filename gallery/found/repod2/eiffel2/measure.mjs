import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const b64 = readFileSync('F:/repod2/eiffel2/ref/gal_017.jpg').toString('base64');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.goto('about:blank');
const out = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const W = c.width, H = c.height;
  const d = ctx.getImageData(0, 0, W, H).data;
  let dark = new Uint8Array(W * H);
  for (let i = 0, p = 0; p < W * H; p++, i += 4) dark[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) < 168 ? 1 : 0;
  // dilate once so hairline breaks in the scan are bridged
  const dil = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x;
    if (dark[p] || dark[p - 1] || dark[p + 1] || dark[p - W] || dark[p + W]) dil[p] = 1;
  }
  dark = dil;
  const AXIS = 1476;
  const seen = new Uint8Array(W * H);
  const stack = [];
  const seed = (x, y) => { const p = y * W + x; if (x > 0 && x < W && y > 0 && y < H && dark[p] && !seen[p]) { seen[p] = 1; stack.push(p); } };
  for (let x = AXIS - 420; x < AXIS + 420; x++) seed(x, 2985);
  for (let y = 1000; y < 3010; y += 20) for (let x = AXIS - 12; x <= AXIS + 12; x++) seed(x, y);
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p - x) / W;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
      const q = ny * W + nx;
      if (dark[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
  }
  const rows = [];
  for (let y = 0; y < H; y++) {
    let lo = -1, hi = -1, n = 0;
    for (let x = AXIS - 620; x <= AXIS + 620; x++) {
      if (x < 0 || x >= W) continue;
      if (seen[y * W + x]) { if (lo < 0) lo = x; hi = x; n++; }
    }
    if (n > 0) rows.push([y, lo - AXIS, hi - AXIS, n]);
  }
  return { W, H, rows };
}, 'data:image/jpeg;base64,' + b64);
const R = out.rows;
const GROUND = 3018, PPM = 2044 / 300;
console.log(JSON.stringify({ axis: 1476, firstRow: R[0][0], lastRow: R[R.length - 1][0], ground: GROUND, pxPerM: +PPM.toFixed(3) }));
// sample the half-width every 5 m
const prof = [];
for (let h = 0; h <= 300; h += 5) {
  const y = Math.round(GROUND - h * PPM);
  const row = R.find((r) => r[0] === y) || R.filter((r) => Math.abs(r[0] - y) < 4).sort((a, b) => Math.abs(a[0] - y) - Math.abs(b[0] - y))[0];
  if (row) prof.push([h, +(((row[2] - row[1]) / 2) / PPM).toFixed(2), +((row[1] + row[2]) / 2).toFixed(0)]);
}
console.log('h(m), halfWidth(m), centreOffset(px):');
console.log(JSON.stringify(prof));
// belts: rows whose dark count is a strong local maximum
const belts = [];
for (let i = 3; i < R.length - 3; i++) {
  if (R[i][3] >= 24 && R[i][3] > R[i - 2][3] && R[i][3] > R[i + 2][3] && R[i][3] >= R[i - 1][3] && R[i][3] >= R[i + 1][3]) belts.push([+((GROUND - R[i][0]) / PPM).toFixed(1), R[i][3]]);
}
writeFileSync('F:/repod2/eiffel2/profile.json', JSON.stringify({ pxPerM: PPM, ground: GROUND, axis: 1476, rows: R }));
console.log('belt heights (m) [h,count]:', JSON.stringify(belts));
await browser.close();
