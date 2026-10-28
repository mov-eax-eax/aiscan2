import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- shared QA gate ---------------------------------------------------------
// Only one headless render at a time, and a global pause switch for the Lead.
// This exists because several parallel headless browsers can peg every CPU core.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pauseFile = path.join(projectRoot, 'qa', '.paused');
const lockFile = path.join(projectRoot, 'qa', '.shot.lock');
if (fs.existsSync(pauseFile)) {
  console.error('[qa] rendering is globally paused by the Lead (remove qa/.paused to resume)');
  process.exit(3);
}
function acquireLock(timeoutMs = 90000) {
  const start = Date.now();
  for (;;) {
    try {
      fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
      return;
    } catch {
      try {
        const st = fs.statSync(lockFile);
        if (Date.now() - st.mtimeMs > 180000) {
          fs.unlinkSync(lockFile);
          continue;
        }
      } catch { /* ignore */ }
      if (Date.now() - start > timeoutMs) {
        console.error('[qa] another render has held the QA lock for too long; giving up');
        process.exit(4);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1200);
    }
  }
}
function releaseLock() {
  try {
    if (fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8') === String(process.pid)) fs.unlinkSync(lockFile);
  } catch { /* ignore */ }
}
acquireLock();

const url = process.argv[2] || 'http://127.0.0.1:8141/qa/probe.html';
const out = process.argv[3] || 'F:/repo-aiscan2/sagrada-familia/qa/probe.png';
const waitMs = Number(process.argv[4] || 4000);
const width = Number(process.env.SHOT_W || 1280);
const height = Number(process.env.SHOT_H || 720);

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let browser;
try {
  // Use the real GPU (D3D11/ANGLE) for headless rendering. Software SwiftShader
  // rendering pegs every CPU core, which is unacceptable on a working machine.
  browser = await chromium.launch({
    executablePath: edge,
    headless: true,
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-angle=d3d11',
      '--disable-gpu-sandbox',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: out });
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const app = window.__app;
    const sag = window.__sagrada;
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    let gpu = 'n/a';
    try {
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    } catch { /* ignore */ }
    return {
      title: document.title,
      canvas: c ? [c.width, c.height] : null,
      ready: window.__ready === true || sag?.ready === true,
      gpu,
      stats: app?.getStats ? app.getStats() : (sag?.stats ? sag.stats() : null),
      errors: (window.__errors || []).slice(0, 8),
    };
  });
  console.log(JSON.stringify({ info, logs }, null, 2));
} catch (e) {
  console.error('[qa] screenshot failed:', e.message);
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* ignore */ }
  releaseLock();
}
