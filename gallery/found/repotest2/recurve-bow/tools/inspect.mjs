/* Dump the real world-space extents of every mesh in a group, so geometry
   problems are read off the scene graph instead of guessed at from pixels.

   usage: node tools/inspect.mjs [groupPrefix] */
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const prefix = process.argv[2] || 'riser';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 120000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
    '--allow-file-access-from-files'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto('file:///' + path.join(ROOT, 'recurve.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000, polling: 250 });

const rows = await page.evaluate((prefix) => {
  const out = [];
  const bow = window.__bow;
  if (!bow) return [['ERR', 'window.__bow not exposed', '', '', '']];
  bow.updateMatrixWorld(true);
  bow.traverse((o) => {
    if (!o.isMesh) return;
    if (prefix !== 'all' && !o.name.startsWith(prefix)) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    out.push([o.name,
      bb.min.x.toFixed(1), bb.max.x.toFixed(1),
      bb.min.y.toFixed(1), bb.max.y.toFixed(1),
      o.visible ? 'vis' : 'HID']);
  });
  return out;
}, prefix);

if (rows.length === 1 && rows[0][0] === 'ERR') {
  console.log(rows[0][1]);
} else {
  console.log('name'.padEnd(30) + 'x range'.padEnd(22) + 'y range'.padEnd(22) + 'y height');
  for (const [n, x0, x1, y0, y1, v] of rows) {
    console.log(String(n).padEnd(30) + (x0 + ' .. ' + x1).padEnd(22) +
      (y0 + ' .. ' + y1).padEnd(22) + (y1 - y0).toFixed(1) + '  ' + v);
  }
}
await browser.close();
