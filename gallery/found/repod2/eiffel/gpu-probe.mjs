import puppeteer from 'puppeteer-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const target = resolve(root, 'eiffel/dist/eiffel.dev.html');

const CONFIGS = [
  { name: 'headless-d3d11', headless: true, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--enable-gpu', '--ignore-gpu-blocklist'] },
  { name: 'headless-default', headless: true, args: ['--ignore-gpu-blocklist'] },
  { name: 'headful-gpu', headless: false, args: ['--window-position=-32000,-32000', '--ignore-gpu-blocklist'] },
];

for (const cfg of CONFIGS) {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME, headless: cfg.headless,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--window-size=900,600', ...cfg.args],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
    const t0 = Date.now();
    await page.goto('file:///' + target.replace(/\\/g, '/') + '?hud=0&q=med&hour=13', { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('window.__ready === true', { timeout: 90000 });
    const loadMs = Date.now() - t0;
    const info = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'none');
    });
    // measure frames per second over 3 s
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t = performance.now();
      const tick = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(tick); else res(n / ((performance.now() - t) / 1000)); };
      requestAnimationFrame(tick);
    }));
    console.log(JSON.stringify({ config: cfg.name, renderer: String(info).slice(0, 90), loadMs, fps: Number(fps.toFixed(1)) }));
  } catch (e) {
    console.log(JSON.stringify({ config: cfg.name, error: String(e).slice(0, 140) }));
  } finally {
    if (browser) await browser.close();
  }
}
