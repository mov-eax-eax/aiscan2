import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('file:///C:/Users/angel/AppData/Local/Temp/dshrender/');
const puppeteer = require('puppeteer-core');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
process.env.PORT = '8148';
await import('../serve.js');
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) logs.push('[console] ' + m.text()); });
await page.goto('http://127.0.0.1:8148/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__747__ !== undefined', { timeout: 240000 });
await new Promise((r) => setTimeout(r, 3000));
// exercise the UI: flaps out, gear down, lights on, then a livery switch
await page.evaluate(() => {
  const el = (id) => document.getElementById(id);
  el('flaps').value = '1'; el('flaps').dispatchEvent(new Event('input'));
  el('spoilers').value = '0.35'; el('spoilers').dispatchEvent(new Event('input'));
  document.querySelectorAll('#liveryGrid button')[0].click();
});
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: new URL('./shots/ui-full.png', import.meta.url).pathname.replace(/^\//, '') });

// deployed control surfaces, close up
await page.evaluate(() => {
  const a = window.__747__.aircraft;
  a.setFlaps(1); a.setSpoilers(0.85); a.setGear(1); a.setExplode(0);
  window.__747__.applyPreset('flap', true);
});
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: new URL('./shots/deployed.png', import.meta.url).pathname.replace(/^\//, '') });
console.log('ui shot done, errors: ' + JSON.stringify(logs));
await browser.close();
process.exit(0);
