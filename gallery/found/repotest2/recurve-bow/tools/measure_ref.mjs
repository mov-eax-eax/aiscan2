/* Measure the Wiawis ATF-X reference itself: isolate the two-tone anodised
   metal (its red interior is near-unique in the image) and report the body's
   true side-profile proportions - overall aspect, where it pinches, how wide
   the window field is.

   usage: node tools/measure_ref.mjs refs/wiawis_atfx_1.png */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const file = process.argv[2] || 'refs/wiawis_atfx_1.png';
const b64 = fs.readFileSync(path.resolve(ROOT, file)).toString('base64');

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 120000,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage();

const out = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;

  /* "part" = anything clearly darker than the near-white studio background,
     OR strongly saturated (the red interior). */
  const isPart = (i) => {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    return lum < 205 || (sat > 0.28 && mx > 70);
  };

  let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (isPart((y * c.width + x) * 4)) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  const bw = maxx - minx, bh = maxy - miny;
  const prof = [], lefts = [], rights = [];
  for (let i = 0; i <= 20; i++) {
    const y = Math.round(miny + bh * (i / 20));
    let l = -1, r = -1;
    for (let x = minx; x <= maxx; x++) if (isPart((y * c.width + x) * 4)) { if (l < 0) l = x; r = x; }
    prof.push(l < 0 ? 0 : r - l + 1);
    lefts.push(l < 0 ? null : +((l - minx) / bw).toFixed(3));
    rights.push(r < 0 ? null : +((r - minx) / bw).toFixed(3));
  }
  return { w: c.width, h: c.height, minx, miny, maxx, maxy, bw, bh,
    aspect: +(bw / bh).toFixed(4), prof, lefts, rights };
}, b64);

console.log('=== ' + file + ' ===');
console.log('image      ' + out.w + 'x' + out.h);
console.log('part bbox  x ' + out.minx + '..' + out.maxx + '  y ' + out.miny + '..' + out.maxy);
console.log('part       ' + out.bw + ' x ' + out.bh + '   aspect(w/h) ' + out.aspect);
console.log('\nheight   width(px)  widthfrac   left      right');
for (let i = 0; i <= 20; i++) {
  const s = (i / 20).toFixed(2);
  console.log('  ' + s + '    ' + String(out.prof[i]).padStart(5) + '     ' +
    (out.prof[i] / out.bw).toFixed(3).padStart(5) + '     ' +
    String(out.lefts[i]).padStart(5) + '    ' + String(out.rights[i]).padStart(5));
}
await browser.close();
