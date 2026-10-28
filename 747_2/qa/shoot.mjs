// qa/shoot.mjs — boot the 747-8 in headless Chromium (SwiftShader) and capture views.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('F:/repodsh/shotgen/package.json');
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

process.env.PORT = process.env.PORT || '8148';
await import('../serve.js');
await new Promise((r) => setTimeout(r, 400));

const FAST = process.env.QA_FAST === '1';
const args = process.argv.slice(2);
const targets = args.length ? args : ['hero', 'front', 'side', 'top', 'low', 'cockpit', 'engine', 'gear', 'tail', 'wingtip', 'flap', 'titles', 'nose'];

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);

const logs = [];
page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

const url = 'http://127.0.0.1:' + process.env.PORT + '/?clean=1';
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__747__ && window.__747__.ready === true', { timeout: 240000 });
console.log('booted in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
await page.waitForTimeout(1500);

const stats = await page.evaluate(() => {
  const w = window.__747__;
  const a = w.aircraft;
  let meshes = 0, tris = 0;
  a.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count : g.attributes.position.count;
    tris += Math.round((n / 3) * (o.isInstancedMesh ? o.count : 1));
  });
  const box = new w.THREE.Box3().setFromObject(a.group);
  return {
    meshes, triangles: tris,
    size: { length: +(box.max.x - box.min.x).toFixed(2), span: +(box.max.z - box.min.z).toFixed(2), height: +(box.max.y - box.min.y).toFixed(2) },
    minY: +box.min.y.toFixed(3), groundY: a.groundY,
  };
});
console.log('stats ' + JSON.stringify(stats));

for (const id of targets) {
  await page.evaluate((v) => window.__747__.applyPreset(v, true), id);
  await page.waitForTimeout(1400);
  const cam = await page.evaluate(() => window.__747__.scene.camera.position.toArray().map((v) => +v.toFixed(1)));
  console.log('  ' + id + ' cam ' + JSON.stringify(cam));
  await page.screenshot({ path: path.join(SHOTS, id + '.png'), timeout: 120000 });
}

if (!FAST) {
// configured: gear down, flaps out, speedbrake, reversers, lit cabin
await page.evaluate(() => {
  const a = window.__747__.aircraft;
  a.setFlaps(1); a.setSpoilers(0.55); a.setReverser(0.45); a.setGear(1);
  window.__747__.applyPreset('titles', true);
});
await page.waitForTimeout(1600);
await page.screenshot({ path: path.join(SHOTS, 'configured.png') });

// livery pass
for (const i of [1, 2, 3]) {
  await page.evaluate((v) => window.__747__.setLivery(v), i);
  await page.evaluate(() => window.__747__.applyPreset('hero', true));
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(SHOTS, 'livery-' + i + '.png') });
}

// UI shot without clean
const uiPage = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
uiPage.on('pageerror', (e) => logs.push('[ui pageerror] ' + e.message));
await uiPage.goto('http://127.0.0.1:' + process.env.PORT + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await uiPage.waitForFunction('window.__747__ && window.__747__.ready === true', { timeout: 240000 });
await uiPage.waitForTimeout(2200);
await uiPage.screenshot({ path: path.join(SHOTS, 'ui-full.png') });
}

await browser.close();
if (logs.length) { console.log('--- console ---'); console.log(logs.slice(0, 80).join('\n')); }
else console.log('no console output');
process.exit(0);
