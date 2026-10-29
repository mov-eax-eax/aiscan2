import puppeteer from 'puppeteer-core';
const CHROME='C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 240000,
  args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox','--allow-file-access-from-files','--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 765, height: 1020, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('file:///F:/repotest2/eiffel-tower.html', { waitUntil:'load', timeout:60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 90000, polling: 250 });
const views = [
  { n: 'P1', pos: [0, 1.8, 225], tgt: [0, 128, 0], fov: 60 },
  { n: 'P2', pos: [0, 1.8, 300], tgt: [0, 140, 0], fov: 52 },
  { n: 'P3', pos: [0, 1.8, 165], tgt: [0, 120, 0], fov: 72 },
];
for (const v of views){
  await page.evaluate((vv) => {
    window.__set({ night:false, sparkle:false, dims:false, spin:false });
    document.getElementById('hud').style.display = 'none';
    window.__view('full', { pos: vv.pos, tgt: vv.tgt, fov: vv.fov });
  }, v);
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: 'F:/repotest2/shots/P_' + v.n + '.png' });
  console.log('shot', v.n);
}
await browser.close();
