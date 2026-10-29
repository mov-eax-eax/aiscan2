/* Dump the runs of metal and background down a vertical scanline of a render,
   so the gap structure of a skeletonised part is read directly.

   usage: node tools/scan.mjs <image> <x> [y0] [y1] */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const [file, xArg, y0Arg, y1Arg] = process.argv.slice(2);
const X = Number(xArg);
const b64 = fs.readFileSync(path.resolve(ROOT, file)).toString('base64');
const ext = path.extname(file).slice(1).toLowerCase();
const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 120000,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
const out = await page.evaluate(async (b64, mime, X, y0Arg, y1Arg) => {
  const img = new Image();
  img.src = 'data:' + mime + ';base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const lum = (x, y) => {
    const i = (y * c.width + x) * 4;
    return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  };
  const Y0 = y0Arg ? Number(y0Arg) : 0;
  const Y1 = y1Arg ? Number(y1Arg) : c.height - 1;
  const bg = lum(2, 2);
  const thr = bg - 40;
  const runs = [];
  let cur = null;
  for (let y = Y0; y <= Y1; y++) {
    const kind = lum(X, y) < thr ? 'METAL' : 'open ';
    if (!cur || cur.kind !== kind) { cur = { kind, from: y, n: 0 }; runs.push(cur); }
    cur.n++;
  }
  return { bg: Math.round(bg), X, runs: runs.filter((r) => r.n > 1) };
}, b64, mime, X, y0Arg, y1Arg);

console.log('=== ' + file + '   scanline x=' + out.X + '  bg lum ' + out.bg + ' ===');
for (const r of out.runs) {
  console.log('  ' + r.kind + '  y ' + String(r.from).padStart(4) + ' .. ' +
    String(r.from + r.n - 1).padStart(4) + '   (' + r.n + ' px)');
}
await browser.close();
