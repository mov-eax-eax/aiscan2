/* Load a page, wait for the model, report errors and stats. */
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const target = process.argv[2] || 'file:///F:/repotest2/compound-bow/mathews.html';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 180000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
         '--disable-dev-shm-usage', '--allow-file-access-from-files', '--window-size=1400,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
page.on('requestfailed', r => errs.push('[reqfail] ' + r.url().slice(0, 120)));
let ready = false;
try {
  await page.goto(target, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 90000, polling: 200 });
  ready = true;
} catch (e) { console.log('FAILED: ' + e.message); }
if (ready) {
  const s = await page.evaluate(() => window.__STATS__);
  console.log('READY  ' + target.replace('file:///F:/repotest2/compound-bow/', ''));
  console.log('  triangles ' + s.triangles + ', labels ' + s.labels + ', parts ' + s.parts);
  for (const d of [0, 0.5, 1]) {
    await page.evaluate((x) => window.__set({ draw: x }), d);
    await page.evaluate(() => window.__settle(2));
  }
  console.log('  draw sweep 0/0.5/1 rendered without error');
}
if (errs.length) console.log('errors:\n' + errs.slice(0, 15).join('\n'));
else console.log('  no page errors');
await browser.close();
process.exit(ready && !errs.length ? 0 : 1);
