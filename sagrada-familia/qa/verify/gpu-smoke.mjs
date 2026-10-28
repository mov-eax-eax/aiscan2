// qa/verify/gpu-smoke.mjs — minimal single-page smoke test (QA-only).
//
// Purpose: prove the harness launch configuration uses the real GPU (ANGLE /
// D3D11) and not SwiftShader, then boot the app, walk for ~1 s and take one
// screenshot. This is deliberately tiny: ONE browser, ONE page, ~20 s total.
//
//   node qa/verify/gpu-smoke.mjs
//
// Respects the shared QA gate (qa/.paused, qa/.shot.lock) exactly like qa/shot.mjs.

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..', '..');
const QA_DIR = path.join(PROJECT, 'qa');
const pauseFile = path.join(QA_DIR, '.paused');
const lockFile = path.join(QA_DIR, '.shot.lock');
const shotFile = path.join(HERE, 'shots', 'gpu-smoke.png');
const EDGE = process.env.SF_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_BASE = `http://127.0.0.1:${process.env.SF_PORT || 8145}/`;

// --- shared QA gate (mirrors qa/shot.mjs) -----------------------------------
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
      } catch {
        /* ignore */
      }
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
  } catch {
    /* ignore */
  }
}
acquireLock();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const out = { ok: false, gpu: null, bootMs: null, walkedM: null, shot: shotFile, errors: [], console: [] };
try {
  fs.mkdirSync(path.dirname(shotFile), { recursive: true });
  browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-angle=d3d11',
      '--disable-gpu-sandbox',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    // Playwright adds --enable-unsafe-swiftshader by default; strip it so the
    // command line contains no SwiftShader flag whatsoever.
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') out.console.push(m.text().slice(0, 300));
  });
  const t0 = Date.now();
  await page.goto(URL_BASE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__sagrada && window.__sagrada.ready === true && window.__sagrada.uiReady === true, null, {
    timeout: 60000,
    polling: 150,
  });
  out.bootMs = Date.now() - t0;

  out.gpu = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    let ext = null;
    try {
      ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    } catch {
      /* ignore */
    }
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null,
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      canvas: c ? [c.width, c.height] : null,
    };
  });

  // enter on foot through the real splash button
  await page.click('[data-splash="walk"]', { timeout: 15000 }).catch(() => {});
  await page
    .waitForFunction(() => window.__sagrada.experienceAPI?.controls?.isEnabled?.() === true, null, { timeout: 30000, polling: 150 })
    .catch(() => {});
  const before = await page.evaluate(() => window.__sagrada.view().pos);
  await page.keyboard.down('KeyW');
  await sleep(1200);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__sagrada.view().pos);
  out.walkedM = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
  out.builderErrors = await page.evaluate(() => (window.__sagrada.errors ? window.__sagrada.errors() : []).map((e) => `${e.where}: ${String(e.message).slice(0, 160)}`));

  await page.screenshot({ path: shotFile });
  const r = String(out.gpu.renderer || '');
  out.ok = /direct3d11|d3d11/i.test(r) && !/swiftshader|llvmpipe/i.test(r) && out.walkedM > 1 && out.errors.length === 0;
  // Optional hold so an external observer can inspect this browser's command line
  // (used to prove --enable-unsafe-swiftshader is really gone).
  const holdMs = Number(process.env.SF_HOLD_MS || 0);
  if (holdMs > 0) {
    console.log(`[gpu-smoke] holding browser ${holdMs} ms for external command-line inspection…`);
    await sleep(holdMs);
  }
} catch (e) {
  out.error = String(e.message || e).slice(0, 800);
} finally {
  try {
    await browser?.close();
  } catch {
    /* ignore */
  }
  releaseLock();
}

console.log(JSON.stringify(out, null, 2));
process.exitCode = out.ok ? 0 : 1;
