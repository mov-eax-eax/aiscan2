import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const W = 1000, H = 1400;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--window-size=' + W + ',' + H, '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto('file:///F:/repod2/eiffel-simple.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });
await new Promise((r) => setTimeout(r, 700));
await page.evaluate(() => window.__silhouette(true));
const scan = await page.evaluate(() => window.__silhouetteScan());
await page.screenshot({ path: 'F:/repod2/tower/shots/silhouette.png' });
console.log('scan meta', JSON.stringify({ w: scan.w, h: scan.h, left: scan.left, right: scan.right, top: scan.top, bottom: scan.bottom }));
console.log('dbg', JSON.stringify(scan.dbg));
const rows = scan.rows;
const nz = rows.filter((r) => r[3] > 0);
console.log('dark rows', nz.length, 'first', JSON.stringify(nz[0]), 'last', JSON.stringify(nz[nz.length - 1]));
for (const ry of [0, 100, 200, 400, 700, 1000, 1200, 1399]) {
  const r = rows[ry];
  if (r) console.log('ry', ry, JSON.stringify(r));
}
await browser.close();
