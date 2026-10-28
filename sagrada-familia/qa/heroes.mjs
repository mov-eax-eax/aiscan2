// Final hero captures at 1600x900 in one GPU browser.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, 'qa', '.paused'))) { console.error('paused'); process.exit(3); }
const W = 1600, H = 900;
const views = [
  ['hero-exterior', '?skipSplash=1&mode=fly&pos=132,50,160&look=0,62,0&time=16.5&adaptive=0&fov=60'],
  ['hero-nativity', '?skipSplash=1&mode=fly&pos=76,26,44&look=30,33,0&time=16.5&adaptive=0'],
  ['hero-glory', '?skipSplash=1&mode=fly&pos=0,27,112&look=0,33,45&time=16.5&adaptive=0'],
  ['hero-nave', '?skipSplash=1&mode=walk&pos=0,2,40&look=0,19,-8&time=16.5&adaptive=0'],
  ['hero-altar', '?skipSplash=1&mode=walk&pos=0,2,-24&look=0,8,-44&time=16.5&adaptive=0'],
  ['hero-night', '?skipSplash=1&mode=fly&pos=118,40,142&look=0,58,0&time=21.4&adaptive=0'],
  ['hero-towers', '?skipSplash=1&mode=fly&pos=66,116,70&look=0,100,0&time=16.5&adaptive=0'],
  ['hero-splash', ''],
];
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-sandbox', '--no-sandbox'],
});
const outDir = path.join(root, 'qa', 'heroes');
fs.mkdirSync(outDir, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const [name, qs] of views) {
    await page.goto('http://127.0.0.1:8141/' + qs, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => {
      const l = document.getElementById('loader');
      if (!l) return true;
      const cs = getComputedStyle(l);
      return l.classList.contains('hidden') || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
    }, null, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(name === 'hero-splash' ? 6000 : 2600);
    await page.screenshot({ path: path.join(outDir, name + '.png') });
    console.log(name, 'ok');
  }
} finally {
  await browser.close();
}
