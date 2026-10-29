import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--window-size=1600,1000', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
await page.goto('file:///F:/repod2/eiffel-simple.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });
await new Promise((r) => setTimeout(r, 700));
await page.evaluate(() => window.__snap('photo'));
const cases = [
  ['X', { shadow: true, extent: 150, mapSize: 4096, normalBias: 3, bias: -0.0004 }],
  ['Y', { shadow: true, extent: 150, mapSize: 2048, normalBias: 5, bias: -0.0005 }],
];
for (const [name, o] of cases) {
  await page.evaluate((cfg) => window.__tune(cfg), o);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'F:/repod2/tower/shots/f-' + name + '.png' });
  console.log('tuned', name);
}
await browser.close();
