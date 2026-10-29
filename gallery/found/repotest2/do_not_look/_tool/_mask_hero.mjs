// _mask_hero.mjs — project every city-facade InstancedMesh onto a coarse
// screen mask (hero camera) so pixel stats can target just the city region.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--disable-gpu', '--window-size=1600,900', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900 }
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message || e)));
await page.goto('http://127.0.0.1:8080/_probe2.html?view=hero&intro=0&night=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const t = await page.title().catch(() => '');
  if (/^EIFFEL-/.test(t)) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log('TITLE: ' + await page.title());
await new Promise(r => setTimeout(r, 8000)); // let the preset camera settle
const out = await page.evaluate(() => window.__facadeMask());
console.log('MASK viewport=' + out.viewport + ' cam=' + JSON.stringify(out.cam) + ' filled=' + out.count + '/' + out.W * out.H);
writeFileSync('F:/repotest2/_tool/_facade_mask_hero.json', JSON.stringify(out));
console.log('MASK json written');
if (errs.length) console.log('pageerrors: ' + errs.join(' | '));
await browser.close();
