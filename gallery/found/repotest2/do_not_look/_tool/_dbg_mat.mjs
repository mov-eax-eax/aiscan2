// _dbg_mat.mjs — verify live material state at full night on the real page.
import puppeteer from 'puppeteer-core';
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
await page.goto('http://127.0.0.1:8080/_probe3.html?view=hero&intro=0&night=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const t = await page.title().catch(() => '');
  if (/^EIFFEL-/.test(t)) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log('TITLE: ' + await page.title());
await page.evaluate(() => window.__setNight(1));
await new Promise(r => setTimeout(r, 6000));
console.log('DBG: ' + await page.evaluate(() => JSON.stringify(window.__dbg())));
console.log('MAT: ' + await page.evaluate(() => JSON.stringify(window.__dbgMat())));
if (errs.length) console.log('pageerrors: ' + errs.join(' | '));
await browser.close();
