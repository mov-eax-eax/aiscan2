// qa/shoot.mjs — headless render checks. Boots the model in Chromium (SwiftShader),
// captures a set of views and reports every console error.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('file:///C:/Users/angel/AppData/Local/Temp/dshrender/');
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

process.env.PORT = process.env.PORT || '8147';
await import('../serve.js');

const CHROME = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const views = process.argv.slice(2);
const targets = views.length ? views : ['hero', 'front', 'side', 'top', 'cockpit', 'engine', 'gear', 'tail', 'flap', 'winglet'];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,860'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });

const logs = [];
page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

const clean = process.env.CLEAN ? '?clean=1' : '';
await page.goto('http://127.0.0.1:' + process.env.PORT + '/index.html' + clean, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__747__ !== undefined', { timeout: 240000 });
const t0 = Date.now();
await new Promise((r) => setTimeout(r, 2500));
const stats = await page.evaluate(() => {
  const a = window.__747__.aircraft;
  let meshes = 0, tris = 0;
  a.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count : g.attributes.position.count;
    tris += Math.round((n / 3) * (o.isInstancedMesh ? o.count : 1));
  });
  const box = new (window.__747__.THREE.Box3)().setFromObject(a.group);
  return {
    meshes, triangles: tris,
    worldBox: { min: box.min.toArray().map((v) => +v.toFixed(2)), max: box.max.toArray().map((v) => +v.toFixed(2)) },
    size: { length: +(box.max.x - box.min.x).toFixed(2), span: +(box.max.z - box.min.z).toFixed(2), height: +(box.max.y - box.min.y).toFixed(2) },
  };
});
console.log('booted in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's, stats ' + JSON.stringify(stats));

for (const id of targets) {
  await page.evaluate((v) => { window.__747__.applyPreset(v, true); }, id);
  await new Promise((r) => setTimeout(r, 2600));
  const cam = await page.evaluate(() => window.__747__.scene.camera.position.toArray().map((v) => +v.toFixed(1)));
  console.log('  camera ' + id + ' ' + JSON.stringify(cam));
  const file = path.join(SHOTS, id + '.png');
  await page.screenshot({ path: file });
  console.log('shot ' + id + ' -> ' + file);
}

// one configuration pass: gear down, flaps out, speedbrake, reverser, exploded
await page.evaluate(() => {
  const a = window.__747__.aircraft;
  a.setFlaps(1); a.setSpoilers(1); a.setGear(1); a.setReverser(0.6); a.setExplode(0.45);
  window.__747__.applyPreset('hero', true);
});
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: path.join(SHOTS, 'configured.png') });
console.log('shot configured');

// cruise configuration: gear and flaps up, everything clean
await page.evaluate(() => {
  const a = window.__747__.aircraft;
  a.setFlaps(0); a.setSpoilers(0); a.setReverser(0); a.setExplode(0);
  a.setGear(0); a.setRudder(0); a.setElevator(0); a.setAileron(0);
  a.setSpool(0.75);
  window.__747__.applyPreset('hero', true);
});
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: path.join(SHOTS, 'cruise.png') });
console.log('shot cruise');

await browser.close();
if (logs.length) { console.log('--- console ---'); console.log(logs.slice(0, 60).join('\n')); }
else console.log('no console output');
process.exit(0);
