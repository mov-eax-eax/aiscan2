// qa/live.mjs — smoke check against an ALREADY RUNNING server (no new listener started).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('file:///C:/Users/angel/AppData/Local/Temp/dshrender/');
const puppeteer = require('puppeteer-core');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
const PORT = process.argv[2] || '8147';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,860'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('[console] ' + m.text()); });
const t0 = Date.now();
await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__747__ !== undefined', { timeout: 180000 });
const boot = ((Date.now() - t0) / 1000).toFixed(1);
const info = await page.evaluate(() => {
  const a = window.__747__.aircraft;
  let meshes = 0, tris = 0;
  a.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count : g.attributes.position.count;
    tris += Math.round((n / 3) * (o.isInstancedMesh ? o.count : 1));
  });
  const loaderHidden = document.getElementById('loader').classList.contains('done');
  return { meshes, triangles: tris, loaderHidden, title: document.title, preset: window.__747__.scene.presets.length };
});
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: new URL('./shots/live.png', import.meta.url).pathname.replace(/^\//, '') });
console.log('LIVE OK  url=http://127.0.0.1:' + PORT + '/index.html  boot=' + boot + 's  ' + JSON.stringify(info));
console.log('errors: ' + (errors.length ? errors.join(' | ') : 'none'));
await browser.close();
process.exit(errors.length ? 1 : 0);
