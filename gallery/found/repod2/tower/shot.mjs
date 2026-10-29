import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'file:///F:/repod2/eiffel-simple.html';
const OUT = process.argv[3] || 'F:/repod2/tower/shots';
const W = +(process.env.SHOT_W || 1600), H = +(process.env.SHOT_H || 1000);
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--no-sandbox',
    '--disable-dev-shm-usage', '--window-size=' + W + ',' + H, '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1200));

const profiles = await page.evaluate(() => window.__profiles());
const views = await page.evaluate(() => window.__views());
for (const p of profiles) {
  await page.evaluate((id) => window.__profile(id), p);
  for (const v of views) {
    await page.evaluate((n) => window.__snap(n), v);
    await new Promise((r) => setTimeout(r, 450));
    await page.screenshot({ path: OUT + '/' + p + '-' + v + '.png' });
  }
  console.log(p, JSON.stringify(await page.evaluate(() => window.__stats())));
}
if (errs.length) console.log('PAGE ERRORS:\n' + errs.slice(0, 12).join('\n'));
else console.log('no page errors');
await browser.close();
