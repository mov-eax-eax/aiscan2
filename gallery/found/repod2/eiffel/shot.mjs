import puppeteer from 'puppeteer-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// usage: node shot.mjs <out.png> [query] [w] [h] [waitMs]
const out = process.argv[2] || resolve(here, 'shots/shot.png');
const query = process.argv[3] || '';
const W = parseInt(process.argv[4] || '1280', 10);
const H = parseInt(process.argv[5] || '800', 10);
const waitMs = parseInt(process.argv[6] || '2500', 10);
const target = process.argv[7] || resolve(root, 'eiffel-tower.html');

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--headless=new',
    '--use-angle=d3d11',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--no-sandbox',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

const url = 'file:///' + target.replace(/\\/g, '/') + (query ? (query.startsWith('?') ? query : '?' + query) : '');
await page.goto(url, { waitUntil: 'load', timeout: 60000 });

try {
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
} catch (e) {
  logs.push('[warn] window.__ready never became true: ' + e.message);
}
await new Promise((r) => setTimeout(r, waitMs));

// let the app render N frames if it exposes a manual hook (deterministic capture)
try {
  // let the page's own loop paint (calling __capture here produced stale frames)
} catch (e) { logs.push('[warn] capture hook failed: ' + e.message); }
await new Promise((r) => setTimeout(r, 350));

mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });

const diag = await page.evaluate(() => {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'none'),
      stats: window.__stats ? window.__stats() : null,
    };
  } catch (e) { return { error: String(e) }; }
});

// de-duplicate the log spam so a single shader error stays visible
const seen = new Map();
for (const l of logs) {
  const key = l.slice(0, 220);
  seen.set(key, (seen.get(key) || 0) + 1);
}
const errs = logs.filter((l) => l.startsWith('[error]')).map((l) => l.slice(0, 7000));
const warns = logs.filter((l) => !l.startsWith('[error]')).slice(0, 6);
console.log(JSON.stringify({ out, url, diag, logCount: logs.length, errors: errs.slice(0, 3), warns }, null, 1));
await browser.close();
