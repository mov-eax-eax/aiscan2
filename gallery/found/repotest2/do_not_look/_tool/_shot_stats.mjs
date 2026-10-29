// _shot_stats.mjs — numeric pixel audit of a screenshot PNG plus an ASCII
// luminance/warmth map so the layout can be "read" without a display.
// usage: node _shot_stats.mjs <png> [maskJson] [png2 maskJson2 ...]
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const pairs = [];
for (let i = 2; i < process.argv.length; i += 2) {
  pairs.push({ png: process.argv[i], mask: process.argv[i + 1] || null });
}
const b64 = f => readFileSync(f).toString('base64');

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=angle',
         '--use-angle=swiftshader', '--window-size=1600,900', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900 }
});
const page = await browser.newPage();
await page.goto('about:blank');

for (const p of pairs) {
  const maskData = p.mask ? JSON.parse(readFileSync(p.mask, 'utf8')) : null;
  const res = await page.evaluate(async (b64, maskData) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const W = img.width, H = img.height;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    const warm = new Uint8Array(W * H);   // saturated warm (windows/lamps)
    const pale = new Uint8Array(W * H);   // bright & desaturated (washed slabs)
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      const r = d[o] / 255, gg = d[o + 1] / 255, b = d[o + 2] / 255;
      const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      lum[i] = L;
      const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
      if (r > 0.42 && r > gg * 1.18 && r > b * 1.45 && sat > 0.14) warm[i] = 1;
      if (L > 0.55 && sat < 0.22) pale[i] = 1;
    }
    const bins = new Array(16).fill(0);
    let sum = 0;
    for (let i = 0; i < lum.length; i++) { bins[Math.min(15, lum[i] * 16 | 0)]++; sum += lum[i]; }
    const hist = bins.map(c => +(c / lum.length));
    const mean = sum / lum.length;
    const pct = q => { // quantile over luma
      let acc = 0;
      for (let bi = 0; bi < 16; bi++) { acc += hist[bi]; if (acc >= q) return (bi + 0.5) / 16; }
      return 1;
    };
    const stats = (sel) => {
      const s = { n: 0, sum: 0, warm: 0, pale: 0, d12: 0, b65: 0, m3065: 0, nmid: 0, wmid: 0, isoW: 0 };
      const scan = (i) => {
        s.n++; s.sum += lum[i];
        if (warm[i]) s.warm++;
        if (pale[i]) s.pale++;
        if (lum[i] < 0.12) s.d12++;
        if (lum[i] > 0.65) s.b65++;
        if (lum[i] >= 0.3 && lum[i] <= 0.65) {
          s.m3065++;
          const o = i * 4;
          const r = d[o] / 255, gg = d[o + 1] / 255, b = d[o + 2] / 255;
          const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
          if (sat < 0.12) s.nmid++;           // neutral grey mid (lit wall?)
          else s.wmid++;                       // tinted mid (window glow/bloom)
        }
      };
      if (sel === 'all') { for (let i = 0; i < lum.length; i++) scan(i); }
      else { for (const i of sel) scan(i); }
      // punctate warm: fraction of warm pixels whose 3x3 neighbourhood has <5 warm
      const warmSet = sel === 'all' ? null : sel;
      if (warmSet) {
        let iso = 0;
        for (const i of warmSet) {
          if (!warm[i]) continue;
          const x = i % W, y = (i / W) | 0;
          let nb = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
            if (warm[yy * W + xx]) nb++;
          }
          if (nb < 5) iso++;
        }
        s.isoW = s.warm ? iso / s.warm : 0;
      }
      return {
        mean: +(s.sum / s.n).toFixed(4),
        d12: +(s.d12 / s.n).toFixed(4),
        m3065: +(s.m3065 / s.n).toFixed(4),
        nmid: +(s.nmid / s.n).toFixed(4),
        wmid: +(s.wmid / s.n).toFixed(4),
        b65: +(s.b65 / s.n).toFixed(4),
        warm: +(s.warm / s.n).toFixed(5),
        pale: +(s.pale / s.n).toFixed(4),
        isoW: +(s.isoW).toFixed(4)
      };
    };
    // masked pixel indices (mask cell => all pixels in that cell)
    let selMask = null;
    if (maskData) {
      const MW = maskData.W, MH = maskData.H, cells = maskData.cells;
      const sel = [];
      for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
        if (!cells[cy * MW + cx]) continue;
        const px0 = Math.floor(cx / MW * W), px1 = Math.ceil((cx + 1) / MW * W);
        const py0 = Math.floor(cy / MH * H), py1 = Math.ceil((cy + 1) / MH * H);
        for (let y = py0; y < py1; y++) for (let x = px0; x < px1; x++) sel.push(y * W + x);
      }
      selMask = sel;
    }
    // ascii map 100x45 (approx) whole frame
    const CW = 100, CH = 44;
    let map = '';
    for (let cy = 0; cy < CH; cy++) {
      let row = '';
      for (let cx = 0; cx < CW; cx++) {
        const x0 = Math.floor(cx / CW * W), x1 = Math.ceil((cx + 1) / CW * W);
        const y0 = Math.floor(cy / CH * H), y1 = Math.ceil((cy + 1) / CH * H);
        let s = 0, wcnt = 0, n = 0, pcnt = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = y * W + x; s += lum[i]; n++;
          if (warm[i]) wcnt++;
          if (pale[i]) pcnt++;
        }
        const L = s / n;
        const wr = wcnt / n;
        if (wr > 0.06) row += 'W';                       // warm-dot dense cell
        else if (L > 0.7) row += '#';
        else if (L > 0.5) row += '*';
        else if (L > 0.34) row += '+';
        else if (L > 0.2) row += ':';
        else if (L > 0.09) row += '.';
        else row += ' ';
      }
      map += row + '\n';
    }
    return { W, H, mean: +mean.toFixed(4), p50: +pct(0.5).toFixed(4), p90: +pct(0.9).toFixed(4),
      all: stats('all'), mask: selMask ? stats(selMask) : null, map };
  }, b64(p.png), maskData);
  console.log('\n===== ' + p.png + (p.mask ? '  [masked]' : '') + ' =====');
  console.log('size ' + res.W + 'x' + res.H + '  mean=' + res.mean + ' p50=' + res.p50 + ' p90=' + res.p90);
  console.log('ALL  : ' + JSON.stringify(res.all));
  if (res.mask) console.log('FAC  : ' + JSON.stringify(res.mask) + '  <-- city facade region');
  console.log(res.map);
}
await browser.close();
