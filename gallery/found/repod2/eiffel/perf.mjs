import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'] });
for (const [label, q, w, h] of [['1080p high', 'high', 1920, 1080], ['900p high', 'high', 1600, 900]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto('file:///F:/repod2/eiffel-tower.html?view=champ&q=' + q + '&hour=13', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t = performance.now();
    const tick = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(tick); else res(n / ((performance.now() - t) / 1000)); };
    requestAnimationFrame(tick);
  }));
  const st = await page.evaluate(() => window.__stats());
  console.log(JSON.stringify({ label, fps: +fps.toFixed(1), calls: st.calls, mtris: +(st.tris / 1e6).toFixed(2) }));
  await page.close();
}
await browser.close();
