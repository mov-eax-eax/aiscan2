// Multi-view screenshot capture in a single GPU-backed browser.
// Usage: node qa/views.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, 'qa', '.paused'))) {
  // The Lead controls the pause switch. For deliberate multi-view runs, remove
  // qa/.paused first; this script re-creates it at the end.
  console.error('qa/.paused present — remove it before running views.');
  process.exit(3);
}
const W = Number(process.env.SHOT_W || 1280);
const H = Number(process.env.SHOT_H || 720);
const base = 'http://127.0.0.1:8141/';
const views = [
  ['ext-se', '?skipSplash=1&mode=fly&pos=138,55,165&look=0,62,0&time=16.5&adaptive=0&fov=62'],
  ['nativity', '?skipSplash=1&mode=fly&pos=82,28,44&look=30,33,0&time=16.5&adaptive=0'],
  ['nativity-tree', '?skipSplash=1&mode=fly&pos=54,18,10&look=30,35,0&time=16.5&adaptive=0'],
  ['nativity-portal', '?skipSplash=1&mode=fly&pos=43,7,3&look=31,11,0&time=16.5&adaptive=0&fov=68'],
  ['passion', '?skipSplash=1&mode=fly&pos=-78,28,44&look=-30,33,0&time=16.5&adaptive=0'],
  ['passion-oculus', '?skipSplash=1&mode=fly&pos=-48,20,4&look=-31,24,0&time=16.5&adaptive=0&fov=62'],
  ['glory', '?skipSplash=1&mode=fly&pos=0,26,112&look=0,34,45&time=16.5&adaptive=0'],
  ['glory-rose', '?skipSplash=1&mode=fly&pos=0,32,42&look=0,31,46&time=16.5&adaptive=0&fov=55'],
  ['nave', '?skipSplash=1&mode=walk&pos=0,2,40&look=0,20,-8&time=16.5&adaptive=0'],
  ['crossing', '?skipSplash=1&mode=walk&pos=0,2,6&look=0,36,-4&time=16.5&adaptive=0'],
  ['altar', '?skipSplash=1&mode=walk&pos=0,2,-26&look=0,7,-55&time=16.5&adaptive=0'],
  ['towers', '?skipSplash=1&mode=fly&pos=66,116,70&look=0,100,0&time=16.5&adaptive=0'],
  ['night-ext', '?skipSplash=1&mode=fly&pos=118,40,142&look=0,58,0&time=21.4&adaptive=0'],
  ['night-nave', '?skipSplash=1&mode=walk&pos=0,2,40&look=0,20,-8&time=21.4&adaptive=0'],
];
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-sandbox', '--no-sandbox'],
});
const outDir = path.join(root, 'qa', 'views');
fs.mkdirSync(outDir, { recursive: true });
const report = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  for (const [name, qs] of views) {
    const t0 = Date.now();
    await page.goto(base + qs, { waitUntil: 'load', timeout: 90000 });
    // wait for the loader to dismiss, then let a few frames settle
    await page.waitForFunction(() => {
      const l = document.getElementById('loader');
      if (!l) return true;
      const cs = getComputedStyle(l);
      return l.classList.contains('hidden') || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
    }, null, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2600);
    await page.screenshot({ path: path.join(outDir, name + '.png') });
    const info = await page.evaluate(() => ({
      ready: window.__sagrada?.ready === true,
      stats: window.__app?.getStats?.() || null,
      errs: (window.__errors || []).slice(0, 4),
      pos: window.__app?.camera?.position?.toArray(),
    }));
    report.push({ name, ms: Date.now() - t0, ...info });
    console.log(name, JSON.stringify(info));
  }
  console.log('LOGS', JSON.stringify([...new Set(logs)].slice(0, 40), null, 2));
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
