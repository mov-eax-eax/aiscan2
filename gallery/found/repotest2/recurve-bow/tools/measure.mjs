/* Measure the bow's real proportions from a render, in Chromium, and compare
   them with the reference. Pixels, not opinions.

   usage: node tools/measure.mjs <image> [<image> ...]
          node tools/measure.mjs --crop=300,70,980,980 <image> */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const cropArg = process.argv.find((a) => a.startsWith('--crop='));
const CROP = cropArg ? cropArg.slice(7).split(',').map(Number) : null;
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 120000,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage();

for (const f of files) {
  const abs = path.resolve(ROOT, f);
  if (!fs.existsSync(abs)) { console.log('missing ' + f); continue; }
  const b64 = fs.readFileSync(abs).toString('base64');
  const ext = path.extname(f).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const out = await page.evaluate(async (b64, mime, CROP) => {
    const img = new Image();
    img.src = 'data:' + mime + ';base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;

    /* window we are allowed to look at */
    const X0 = CROP ? CROP[0] : 0, Y0 = CROP ? CROP[1] : 0;
    const X1 = CROP ? Math.min(c.width, CROP[0] + CROP[2]) : c.width;
    const Y1 = CROP ? Math.min(c.height, CROP[1] + CROP[3]) : c.height;

    const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

    /* Background colour: the brightest common value in the window, by coarse
       histogram. Robust to a dark surround and to UI panels at the edges. */
    const hist = new Array(64).fill(0);
    for (let y = Y0; y < Y1; y += 2) for (let x = X0; x < X1; x += 2) {
      hist[(lum((y * c.width + x) * 4) >> 2)]++;
    }
    let best = 0, bestN = -1;
    for (let i = 0; i < 64; i++) if (hist[i] > bestN) { bestN = hist[i]; best = i; }
    const bg = best * 4 + 2;
    const thr = bg - 40;

    let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    const rowW = new Array(c.height).fill(0);
    const rowInk = new Array(c.height).fill(0);
    const rowSeg = new Array(c.height).fill(0);
    for (let y = Y0; y < Y1; y++) {
      let l = -1, r = -1, ink = 0, seg = 0, wasIn = false;
      for (let x = X0; x < X1; x++) {
        const on = lum((y * c.width + x) * 4) < thr;
        if (on) { if (l < 0) l = x; r = x; ink++; if (!wasIn) seg++; }
        wasIn = on;
      }
      if (l >= 0) {
        rowW[y] = r - l + 1;
        rowInk[y] = ink;
        rowSeg[y] = seg;
        if (l < minx) minx = l; if (r > maxx) maxx = r;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
    if (maxx < 0) return { empty: true, bg: Math.round(bg) };
    const prof = [], fill = [];
    for (let i = 0; i <= 20; i++) {
      const y = Math.round(miny + (maxy - miny) * (i / 20));
      prof.push(rowW[y] || 0);
      fill.push(rowW[y] ? +(rowInk[y] / rowW[y]).toFixed(2) : 0);
    }

    /* Every row, not a sample: windows in a skeletonised riser can be far
       narrower than a 5%-of-height sampling step. */
    const allRows = [];
    const allSegs = [];
    for (let y = miny; y <= maxy; y++) {
      allRows.push(rowW[y] ? +(rowInk[y] / rowW[y]).toFixed(2) : -1);
      allSegs.push(rowSeg[y]);
    }
    const multiSeg = allSegs.filter((s) => s >= 2).length;
    const maxSeg = Math.max(...allSegs);
    const openRows = allRows.filter((f) => f >= 0 && f < 0.85).length;
    /* longest run of consecutive open rows, in px */
    let run = 0, bestRun = 0, bestAt = -1;
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i] >= 0 && allRows[i] < 0.85) {
        run++; if (run > bestRun) { bestRun = run; bestAt = i - run + 1; }
      } else run = 0;
    }
    return {
      w: c.width, h: c.height, bg: Math.round(bg),
      bbox: { minx, miny, maxx, maxy },
      bw: maxx - minx, bh: maxy - miny,
      aspect: +((maxx - minx) / (maxy - miny)).toFixed(4),
      widthProfile: prof,
      fillProfile: fill,
      rows: allRows.length,
      openRows,
      longestOpenRun: bestRun,
      longestOpenAt: bestAt,
      minFill: Math.min(...allRows.filter((f) => f >= 0)),
      multiSegRows: multiSeg,
      maxSegments: maxSeg,
      segProfile: Array.from({ length: 21 }, (_, i) =>
        allSegs[Math.round((allSegs.length - 1) * (i / 20))]),
    };
  }, b64, mime, CROP);

  console.log('\n=== ' + f + ' ===');
  if (out.empty) { console.log('no ink found (bg lum ' + out.bg + ')'); continue; }
  console.log('image     ' + out.w + 'x' + out.h + '   bg lum ' + out.bg);
  console.log('ink bbox  ' + out.bw + ' x ' + out.bh + '   aspect(w/h) ' + out.aspect);
  console.log('row span  (top -> bottom, 21 samples):');
  console.log('  ' + out.widthProfile.join(' '));
  console.log('row fill  (1.00 = solid across the span, low = open window):');
  console.log('  ' + out.fillProfile.join(' '));
  console.log('rows measured      ' + out.rows);
  console.log('rows with fill<.85 ' + out.openRows + '  (' +
    (100 * out.openRows / out.rows).toFixed(1) + '% of the part height)');
  console.log('longest open run   ' + out.longestOpenRun + ' px at y=' +
    (out.longestOpenAt >= 0 ? out.longestOpenAt : '-'));
  console.log('minimum fill       ' + out.minFill);
  console.log('metal segments per row, 21 samples (>=2 means the lattice is open):');
  console.log('  ' + out.segProfile.join(' '));
  console.log('rows with 2+ segments ' + out.multiSegRows + '   max segments ' + out.maxSegments);
}

await browser.close();
