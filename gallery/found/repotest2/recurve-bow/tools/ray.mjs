/* Raycast diagnostic: fire a ray straight down the Z axis at a chosen (x,y)
   and list what it hits. This is how we find out WHAT is covering a window
   that should be empty space.

   usage: node tools/ray.mjs <x,y> [<x,y> ...] */
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const probes = process.argv.slice(2).map((s) => s.split(',').map(Number));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 120000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
    '--allow-file-access-from-files'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto('file:///' + path.join(ROOT, 'recurve.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000, polling: 250 });

const res = await page.evaluate((probes) => {
  const THREE = window.__THREE;
  if (!THREE) return [['ERROR', 'THREE not exposed']];
  const bow = window.__bow;
  const rc = new THREE.Raycaster();
  const out = [];
  for (const [x, y] of probes) {
    rc.set(new THREE.Vector3(x, y, 3000), new THREE.Vector3(0, 0, -1));
    const hits = rc.intersectObject(bow, true)
      .filter(h => h.object.visible)
      .map(h => h.object.name + '@z' + h.point.z.toFixed(1));
    out.push([x + ',' + y, hits.length ? hits.join('  |  ') : '(EMPTY - ray passes through)']);
  }
  return out;
}, probes);

for (const [p, hits] of res) console.log(String(p).padEnd(14) + hits);
await browser.close();
