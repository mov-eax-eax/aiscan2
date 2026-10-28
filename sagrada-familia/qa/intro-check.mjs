import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, 'qa', '.paused'))) { console.error('paused'); process.exit(3); }
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const url = 'http://127.0.0.1:8141/?skipSplash=1&mode=walk&pos=0,2,40&look=0,19,-8&time=16.5&adaptive=0';
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(12000);
const state1 = await page.evaluate(() => {
  const s = window.__sagrada;
  const c = s?.app?.camera;
  return { mode: s?.mode?.(), pose: s?.app?.camera ? { p: c.position.toArray(), q: c.quaternion.toArray() } : null, ui: s?.uiReady, errs: (window.__errors || []).slice(0, 3) };
});
console.log('after load', JSON.stringify(state1));
await page.screenshot({ path: path.join(root, 'qa', 'debug-nave-url.png') });
const afterSet = await page.evaluate(() => {
  const s = window.__sagrada;
  s.setPose([0, 1.72, 40], [0, 19, -8]);
  return { mode: s.mode?.() };
});
await page.waitForTimeout(1200);
const state2 = await page.evaluate(() => {
  const c = window.__sagrada.app.camera;
  return { p: c.position.toArray(), q: c.quaternion.toArray() };
});
console.log('after setPose', JSON.stringify(afterSet), JSON.stringify(state2));
await page.screenshot({ path: path.join(root, 'qa', 'debug-nave-setpose.png') });
await page.evaluate(() => window.__sagrada.teleport('nave'));
await page.waitForTimeout(1800);
const state3 = await page.evaluate(() => {
  const c = window.__sagrada.app.camera;
  return { mode: window.__sagrada.mode?.(), p: c.position.toArray(), q: c.quaternion.toArray() };
});
console.log('after teleport nave', JSON.stringify(state3));
await page.screenshot({ path: path.join(root, 'qa', 'debug-nave-teleport.png') });
await browser.close();
