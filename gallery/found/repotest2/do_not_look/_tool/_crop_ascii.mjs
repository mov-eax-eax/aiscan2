// _crop_ascii.mjs — per-cell dominant-class ASCII crop of a PNG (mask-filtered).
// usage: node _crop_ascii.mjs <png> <x0> <y0> <x1> <y1> [cellPx] [maskJson]
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const [png, x0, y0, x1, y1, cellS, maskFile] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6], +(process.argv[7] || 10), process.argv[8] || null];
const maskData = maskFile ? JSON.parse(readFileSync(maskFile, 'utf8')) : null;
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=angle',
         '--use-angle=swiftshader', '--window-size=1600,900', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900 }
});
const page = await browser.newPage();
await page.goto('about:blank');
const b64 = readFileSync(png).toString('base64');
const out = await page.evaluate(async (b64, x0, y0, x1, y1, cellS, maskData) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const inMask = maskData ? (px, py) => {
    const mcx = Math.floor(px / img.width * maskData.W), mcy = Math.floor(py / img.height * maskData.H);
    return mcx >= 0 && mcx < maskData.W && mcy >= 0 && mcy < maskData.H && maskData.cells[mcy * maskData.W + mcx] === 1;
  } : null;
  const cls = new Uint8Array(img.width * img.height); // 0 warm 1 pale 2 hi 3 mid 4 low 5 dark
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    const r = d[o] / 255, gg = d[o + 1] / 255, b = d[o + 2] / 255;
    const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
    if (inMask && !inMask(i % img.width, (i / img.width) | 0)) { cls[i] = 5; continue; }
    if (r > 0.4 && r > gg * 1.15 && r > b * 1.4 && sat > 0.13 && L > 0.12) cls[i] = 0;
    else if (L > 0.5 && sat < 0.24) cls[i] = 1;
    else if (L > 0.55) cls[i] = 2;
    else if (L > 0.3) cls[i] = 3;
    else if (L > 0.13) cls[i] = 4;
    else cls[i] = 5;
  }
  const CH = 'wO#*:.'; // warm, pale, bright, mid, dim, dark
  let s = '';
  for (let y = y0; y < y1; y += cellS) {
    for (let x = x0; x < x1; x += cellS) {
      const cnt = new Array(6).fill(0);
      for (let yy = y; yy < Math.min(y + cellS, img.height); yy++)
        for (let xx = x; xx < Math.min(x + cellS, img.width); xx++) cnt[cls[yy * img.width + xx]]++;
      let best = 5;
      for (let c = 0; c < 6; c++) if (cnt[c] > cnt[best]) best = c;
      s += CH[best];
    }
    s += '\n';
  }
  return s;
}, b64, x0, y0, x1, y1, cellS, maskData);
console.log('===== ' + png + '  crop x' + x0 + '-' + x1 + ' y' + y0 + '-' + y1 + ' cell=' + cellS + 'px =====');
console.log('legend: w=warm pixel dominant  O=pale(bright desat)  #=bright  *=mid  :.=dark  space=very dark');
console.log(out);
await browser.close();
