/* Print raw pixel colours on a scanline, plus the live camera state, so a
   mismatch between geometry and render can be pinned down.

   usage: node tools/pix.mjs <image> <x> <y0> <y1> [step] */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const [file, xArg, y0Arg, y1Arg, stepArg] = process.argv.slice(2);
const X = Number(xArg), Y0 = Number(y0Arg), Y1 = Number(y1Arg), ST = Number(stepArg || 10);
const b64 = fs.readFileSync(path.resolve(ROOT, file)).toString('base64');

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 120000,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
const out = await page.evaluate(async (b64, X, Y0, Y1, ST) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const rows = [];
  for (let y = Y0; y <= Y1; y += ST) {
    const i = (y * c.width + X) * 4;
    rows.push([y, d[i], d[i + 1], d[i + 2]]);
  }
  return rows;
}, b64, X, Y0, Y1, ST);

console.log('=== ' + file + '  x=' + X + ' ===');
for (const [y, r, g, b] of out) {
  const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  console.log('  y=' + String(y).padStart(4) + '   rgb(' +
    String(r).padStart(3) + ',' + String(g).padStart(3) + ',' + String(b).padStart(3) +
    ')   lum ' + String(lum).padStart(3) + (lum < 174 ? '   METAL' : ''));
}
await browser.close();
