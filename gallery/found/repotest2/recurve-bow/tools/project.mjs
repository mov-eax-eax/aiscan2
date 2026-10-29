/* Project each riser bar into screen space and print its band, so a render's
   scanline can be checked against what the geometry SHOULD occupy.

   usage: node tools/project.mjs riser- "0,0,2600" "0,0,0" */
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const [prefix, posArg, tgtArg] = process.argv.slice(2);
const pos = posArg.split(',').map(Number);
const tgt = tgtArg.split(',').map(Number);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 120000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
    '--allow-file-access-from-files', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1400 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto('file:///' + path.join(ROOT, 'recurve.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000, polling: 250 });

const rows = await page.evaluate((prefix, pos, tgt) => {
  const THREE = window.__THREE;
  const bow = window.__bow;
  bow.updateMatrixWorld(true);
  const oc = new THREE.OrthographicCamera(
    -720 * (1400 / 1400), 720 * (1400 / 1400), 720, -720, 1, 12000);
  oc.position.set(...pos);
  oc.lookAt(new THREE.Vector3(...tgt));
  oc.updateMatrixWorld(true);
  oc.updateProjectionMatrix();
  const W = 1400, H = 1400;
  const out = [];
  bow.traverse((o) => {
    if (!o.isMesh || !o.name.startsWith(prefix)) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    /* project all 8 corners, keep the screen-space y band */
    let top = 1e9, bot = -1e9, l = 1e9, r = -1e9;
    for (const xs of [bb.min.x, bb.max.x]) for (const ys of [bb.min.y, bb.max.y])
      for (const zs of [bb.min.z, bb.max.z]) {
        const v = new THREE.Vector3(xs, ys, zs).applyMatrix4(o.matrixWorld).project(oc);
        const sy = (1 - v.y) / 2 * H, sx = (v.x + 1) / 2 * W;
        top = Math.min(top, sy); bot = Math.max(bot, sy);
        l = Math.min(l, sx); r = Math.max(r, sx);
      }
    out.push([o.name, Math.round(top), Math.round(bot), Math.round(l), Math.round(r)]);
  });
  return out;
}, prefix, pos, tgt);

console.log('name'.padEnd(28) + 'screen y band'.padEnd(20) + 'x band');
for (const [n, t, b, l, r] of rows) {
  console.log(String(n).padEnd(28) + (t + ' .. ' + b).padEnd(20) + l + ' .. ' + r);
}
await browser.close();
