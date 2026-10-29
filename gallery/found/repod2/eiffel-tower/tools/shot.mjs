/**
 * Optional dev tool: drives a real Chrome with puppeteer-core, prints every
 * console message / page error, waits for the app to be ready and saves a
 * screenshot.  Needs a Chrome install and `npm i -D puppeteer-core`.
 *
 *   node tools/shot.mjs "http://127.0.0.1:8123/?sky=night&frames=2" out.png
 */
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://127.0.0.1:8123/?frames=2&dpr=1';
const OUT = process.argv[3] || 'preview/shot.png';
const CHROME =
  process.env.CHROME ||
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--disable-gpu',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--window-size=1000,700',
    '--no-sandbox',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 700, deviceScaleFactor: 1 });

page.on('console', (m) => console.log(`[console:${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('error', (e) => console.log('[crash]', e.message));
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

const ready = await page
  .waitForFunction('window.__APP_READY === true', { timeout: 180000, polling: 250 })
  .then(() => true)
  .catch(() => false);

const info = await page.evaluate(() => ({
  stage: window.__STAGE || '?',
  ready: !!window.__APP_READY,
  errorShown: !document.getElementById('error')?.hidden,
  errmsg: document.getElementById('errmsg')?.textContent || '',
  hud: document.getElementById('stats')?.textContent || '',
  webgl: (() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'no context';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.VERSION);
    } catch (e) {
      return 'error: ' + e.message;
    }
  })(),
}));

console.log('ready:', ready);
console.log('info:', JSON.stringify(info, null, 2));

// let the loader fade out (0.6 s transition) before capturing
await new Promise((r) => setTimeout(r, 2500));

await page.screenshot({ path: OUT });
console.log('screenshot ->', OUT);
await browser.close();
