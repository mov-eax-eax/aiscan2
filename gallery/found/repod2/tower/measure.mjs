import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const b64 = readFileSync('F:/repod2/ref-tutorial/Draw-the-Eiffel-Tower-Step-10-Version-3.jpg').toString('base64');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage(); await page.goto('about:blank');
const out = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = Math.round(img.naturalWidth * 0.5), H = Math.round(img.naturalHeight * 0.5);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const cand = new Uint8Array(W * H);
  for (let p = 0, i = 0; p < W * H; p++, i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; cand[p] = (Math.max(r, g, b) - Math.min(r, g, b)) > 34 ? 1 : 0; }
  const seen = new Uint8Array(W * H); let best = null, bestN = 0; const stack = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) { if (!cand[s] || seen[s]) continue; let sp = 0; stack[sp++] = s; seen[s] = 1; const px = [];
    while (sp) { const p = stack[--sp]; px.push(p); const x = p % W, y = (p - x) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (cand[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; } } }
    if (px.length > bestN) { bestN = px.length; best = px; } }
  const mask = new Uint8Array(W * H); for (const p of best) mask[p] = 1;
  return { W, H, mask: Array.from(mask) };
}, 'data:image/jpeg;base64,' + b64);
await browser.close();
const { W, H } = out; const mask = Uint8Array.from(out.mask);
let y0 = H, y1 = -1;
const centers = [], spans = [];
for (let y = 0; y < H; y++) { let lo = -1, hi = -1; for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (lo < 0) lo = x; hi = x; } if (lo >= 0) { if (y < y0) y0 = y; if (y > y1) y1 = y; centers.push((lo + hi) / 2); spans.push([y, lo, hi]); } }
centers.sort((a, b) => a - b);
const axis = centers[Math.floor(centers.length / 2)];
const TIP = y0, GROUND = y1, TH = GROUND - TIP;
const N = 201, outer = new Array(N), inner = new Array(N);
const rowOf = new Map(spans.map(([y, lo, hi]) => [y, [lo, hi]]));
for (let i = 0; i < N; i++) {
  const k = i / 2;
  const yy = Math.min(y1, Math.max(y0, Math.round(GROUND - (k / 100) * TH)));
  const r = rowOf.get(yy); if (!r) { outer[i] = outer[i - 1] ?? 0; inner[i] = inner[i - 1] ?? 0; continue; }
  const [lo, hi] = r;
  outer[i] = (hi - lo) / 2 / TH;
  const ax = Math.round(axis);
  let gl = 0, gr = 0;
  for (let x = ax; x >= lo; x--) if (mask[yy * W + x]) { gl = (ax - x) / TH; break; }
  for (let x = ax; x <= hi; x++) if (mask[yy * W + x]) { gr = (x - ax) / TH; break; }
  inner[i] = (gl + gr) / 2;
}
outer[0] = outer[1] + (outer[1] - outer[2]);
inner[0] = inner[1];   // the bottom scan line lands on the feet shadows and reads short
const bands = []; let bs = -1;
for (let i = 1; i < N - 1; i++) {
  const flat = Math.abs(outer[i] - outer[i - 1]) < 0.0008 && Math.abs(outer[i + 1] - outer[i]) < 0.0008;
  if (flat && bs < 0) bs = i;
  if (!flat && bs >= 0) { if (i - bs >= 5) bands.push([+(bs / 2).toFixed(1), +(i / 2).toFixed(1), +outer[bs].toFixed(5)]); bs = -1; }
}
const doc = { source: 'wikiHow "Draw the Eiffel Tower" method 1 final illustration', axis: +axis.toFixed(1), tip: TIP, ground: GROUND, heightPx: TH, aspect: +(TH / (2 * outer.slice(20).reduce((a, b) => Math.max(a, b), 0))).toFixed(3), kStep: 0.5, outer: outer.map(v => +v.toFixed(5)), inner: inner.map(v => +v.toFixed(5)), bands };
writeFileSync('F:/repod2/tower/src/tutorial-profile.json', JSON.stringify(doc));
console.log('axis', doc.axis, 'aspect', doc.aspect, 'bands', JSON.stringify(bands));
for (let k = 0; k <= 100; k += 5) { const i = k * 2; console.log(String(k).padStart(4), outer[i].toFixed(4), inner[i].toFixed(4)); }
