#!/usr/bin/env node
// ============================================================================
// Sagrada Família — independent QA harness (task-6)
// ============================================================================
// Unattended Playwright suite for the walkable Sagrada Família model.
//
//   node qa/verify/harness.mjs
//
// What it does
//   1. Ensures a dedicated static server on 127.0.0.1:8145 (starts one if absent;
//      never touches port 8141 or any other server).
//   2. Boots the app in ONE headless Edge browser using the real GPU
//      (ANGLE / D3D11 — never SwiftShader; software rendering pegs the CPU).
//   3. Runs a test matrix through the real UI wherever possible and the
//      window.__sagrada debug API for setup (URL params / teleport / setPose).
//   4. Saves screenshots to qa/verify/shots/ and a machine-readable
//      qa/verify/results.json.
//   5. Regenerates qa/verify/REPORT.md from the results, including the
//      curated visual review in qa/verify/visual-notes.json when present.
//
// Honesty rules baked in
//   - A black canvas, missing builder group, stuck splash or failed boot is a
//     FAIL, never a pass.
//   - Builder errors recorded by src/main.js (window.__sagrada.errors()) fail
//     the boot section.
//   - Screenshots are decoded and measured (mean/std/max luminance) so a run
//     that produced only black frames cannot be reported as passing.
//   - Every skip or untested item is listed explicitly in the report.
//
// Env overrides
//   SF_PORT=8145              static-server port (do not change lightly)
//   SF_BROWSER=...            Edge/Chrome executable
//   SF_CAPTURE_W/H=1280/720   screenshot + performance pass viewport
//   SF_HERO_W/H=1600/900      hero screenshots viewport
//   SF_INTERACT_W/H=800/450   interaction test viewport (fast, light)
//   SF_MOBILE_W/H=390/844     mobile viewport
//   SF_SKIP_CAPTURE=1         skip screenshots + perf (harness-only smoke run)
//   SF_SKIP_MOBILE=1          skip the mobile section
//   SF_SKIP_URLPARAMS=1       skip the extra URL-parameter page loads
//   SF_NO_REPORT=1            phase smoke run: write results.json but not REPORT.md
//   SF_HEADED=1               show the browser (debugging only)
//   SF_REPORT_ONLY=1          rewrite REPORT.md from the last results.json
//
// This file is QA-only: it lives under qa/verify/ and writes nothing outside it
// except the dedicated static-server process it may start.
// ============================================================================

import { chromium } from 'playwright-core';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir, open, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..', '..');
const SHOTS = path.join(HERE, 'shots');
const STOP_SHOTS = path.join(SHOTS, 'stops');
const RESULTS_JSON = path.join(HERE, 'results.json');
const REPORT_MD = path.join(HERE, 'REPORT.md');
const VISUAL_NOTES = path.join(HERE, 'visual-notes.json');

const PORT = Number(process.env.SF_PORT || 8145);
const BASE = `http://127.0.0.1:${PORT}/`;
const EDGE =
  process.env.SF_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CAP_W = Number(process.env.SF_CAPTURE_W || 1280);
const CAP_H = Number(process.env.SF_CAPTURE_H || 720);
// Hero screenshots are captured at 1600x900 (Lead's CPU-aware plan: a handful of
// hero frames at full size, everything else at 1280x720).
const HERO_W = Number(process.env.SF_HERO_W || 1600);
const HERO_H = Number(process.env.SF_HERO_H || 900);
const INT_W = Number(process.env.SF_INTERACT_W || 800);
const INT_H = Number(process.env.SF_INTERACT_H || 500);
const MOB_W = Number(process.env.SF_MOBILE_W || 390);
const MOB_H = Number(process.env.SF_MOBILE_H || 844);
const READY_TIMEOUT = Number(process.env.SF_READY_TIMEOUT || 120000);
const SKIP_CAPTURE = process.env.SF_SKIP_CAPTURE === '1';
const SKIP_MOBILE = process.env.SF_SKIP_MOBILE === '1';
const SKIP_URLPARAMS = process.env.SF_SKIP_URLPARAMS === '1';
const NO_REPORT = process.env.SF_NO_REPORT === '1'; // phase smoke runs: keep only results.json
const HEADLESS = process.env.SF_HEADED !== '1';
const REPORT_ONLY = process.env.SF_REPORT_ONLY === '1';
// --- shared QA gate (same convention as qa/shot.mjs) -------------------------
// `qa/.paused` is the Lead's global pause switch; `qa/.shot.lock` serializes
// every headless render on this machine so two QA processes can never render
// at the same time. Only one browser is ever launched by this harness.
const QA_DIR = path.join(PROJECT, 'qa');
const PAUSE_FILE = path.join(QA_DIR, '.paused');
const LOCK_FILE = process.env.SF_QA_LOCK_FILE || path.join(QA_DIR, '.shot.lock');
const LOCK_WAIT_MS = Number(process.env.SF_LOCK_WAIT_MS || 90000);
const LOCK_STALE_MS = Number(process.env.SF_LOCK_STALE_MS || 180000);

// Real GPU only. SwiftShader software rendering starves the machine, so it is
// deliberately not an option here.
const LAUNCH_ARGS = [
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  '--use-angle=d3d11',
  '--disable-gpu-sandbox',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

const TOUR_STOP_EXPECTED = 12;

// ----------------------------------------------------------------------------
// Small utilities
// ----------------------------------------------------------------------------
const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rel = (p) => path.relative(PROJECT, p).replace(/\\/g, '/');
const mdEscape = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '—');

const R = {
  meta: {
    startedAt: nowIso(),
    finishedAt: null,
    base: BASE,
    project: PROJECT,
    host: process.env.COMPUTERNAME || '',
    node: process.version,
    viewports: { interact: [INT_W, INT_H], capture: [CAP_W, CAP_H], hero: [HERO_W, HERO_H], mobile: [MOB_W, MOB_H] },
    browser: null,
    gpu: null,
    skipped: [],
    aborted: null,
    portStartedByHarness: false,
  },
  tests: [],
  console: [],
  pageErrors: [],
  requestFailures: [],
  responses404: [],
  shots: [],
  stops: [],
  perf: [],
};

/** The one page currently under test (used for failure screenshots). */
let ACTIVE_PAGE = null;

function log(msg) {
  console.log(msg);
}

function record({ id, group, name, status, detail = '', severity = null, repro = '', shots = [], ms = 0 }) {
  const t = { id, group, name, status, detail: String(detail ?? '').slice(0, 2000), severity, repro, shots, ms };
  R.tests.push(t);
  const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'SKIP';
  log(`  ${icon}  [${group}] ${name}${detail ? `  — ${String(detail).slice(0, 300)}` : ''}`);
  return t;
}

const pass = (id, group, name, detail, extra = {}) =>
  record({ id, group, name, status: 'PASS', detail, ...extra });
const fail = (id, group, name, detail, extra = {}) =>
  record({ id, group, name, status: 'FAIL', detail, ...extra });
const skip = (id, group, name, detail, extra = {}) =>
  record({ id, group, name, status: 'SKIP', detail, ...extra });

/** Run one test step; never throw into the suite. */
async function step(id, group, name, fn, opts = {}) {
  const t0 = Date.now();
  const { severity = 'MAJOR', repro = '' } = opts;
  let t;
  try {
    const res = await fn();
    const ms = Date.now() - t0;
    if (res && typeof res === 'object') {
      const status = res.status || (res.ok === false ? 'FAIL' : 'PASS');
      t = record({
        id,
        group,
        name,
        status,
        detail: res.detail ?? '',
        severity: res.severity ?? severity,
        repro: res.repro ?? repro,
        shots: res.shots ?? [],
        ms,
      });
    } else {
      t = record({ id, group, name, status: res === false ? 'FAIL' : 'PASS', detail: '', severity, repro, ms });
    }
  } catch (e) {
    const ms = Date.now() - t0;
    t = record({
      id,
      group,
      name,
      status: 'FAIL',
      detail: `EXCEPTION ${e && e.name ? e.name + ': ' : ''}${String((e && e.message) || e).slice(0, 800)}`,
      severity,
      repro,
      ms,
    });
  }
  // Evidence for failures: capture the live page so every bug reported from a
  // smoke run has a screenshot, even without the full capture pass.
  if (t.status === 'FAIL' && ACTIVE_PAGE && !ACTIVE_PAGE._crashed) {
    try {
      const res = await capture(ACTIVE_PAGE, `fail-${id}`, { phase: 'failure' });
      if (res && res.file) t.shots = [...(t.shots || []), res.file];
    } catch {
      /* evidence is best-effort; never let it fail the suite */
    }
  }
  return t;
}

// ----------------------------------------------------------------------------
// Static server
// ----------------------------------------------------------------------------
function httpProbe(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, reason: 'timeout' });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, reason: e.message }));
  });
}

async function ensureServer() {
  const first = await httpProbe(BASE);
  if (first.ok) {
    log(`· static server already up on ${BASE}`);
    return null;
  }
  log(`· starting dedicated static server: node serve.mjs ${PORT} (cwd=${PROJECT})`);
  const proc = spawn(process.execPath, ['serve.mjs', String(PORT)], {
    cwd: PROJECT,
    stdio: 'ignore',
    windowsHide: true,
  });
  proc.on('error', (e) => log(`  ! server spawn error: ${e.message}`));
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await sleep(300);
    const probe = await httpProbe(BASE);
    if (probe.ok) {
      R.meta.portStartedByHarness = true;
      log(`· server ready on ${BASE}`);
      return proc;
    }
  }
  try {
    proc.kill();
  } catch {}
  throw new Error(`static server did not come up on ${BASE} (start it with: node serve.mjs ${PORT})`);
}

// ----------------------------------------------------------------------------
// Shared QA gate (pause + serialized lock), matching qa/shot.mjs
// ----------------------------------------------------------------------------
/**
 * Take the shared QA lock so no other headless render can run at the same time.
 * Mirrors qa/shot.mjs: `qa/.shot.lock` holds the PID, locks older than 180 s are
 * treated as stale, and we wait up to 90 s before giving up (exit code 4).
 */
async function acquireQALock() {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      const fh = await open(LOCK_FILE, 'wx');
      await fh.writeFile(String(process.pid));
      await fh.close();
      R.meta.lock = { file: LOCK_FILE, acquired: true, pid: process.pid };
      log(`· QA lock acquired: ${rel(LOCK_FILE)} (pid ${process.pid})`);
      return LOCK_FILE;
    } catch (e) {
      if (e.code !== 'EEXIST') throw new Error(`cannot create QA lock ${LOCK_FILE}: ${e.message}`);
      try {
        const st = await stat(LOCK_FILE);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          log(`· removing stale QA lock (${Math.round((Date.now() - st.mtimeMs) / 1000)} s old)`);
          await unlink(LOCK_FILE).catch(() => {});
          continue;
        }
      } catch {
        /* ignore */
      }
      if (Date.now() >= deadline) {
        const err = new Error(
          `another render has held the QA lock for too long; giving up (${LOCK_FILE}). ` +
            `Make sure no other harness/shot run is alive, or delete the lock file.`
        );
        err.exitCode = 4;
        throw err;
      }
      log(`· QA lock held by another render, waiting… (${LOCK_FILE})`);
      await sleep(1200);
    }
  }
}

async function releaseQALock() {
  try {
    const holder = await readFile(LOCK_FILE, 'utf8').catch(() => null);
    if (holder !== null && holder.trim() === String(process.pid)) await unlink(LOCK_FILE).catch(() => {});
  } catch {
    /* ignore */
  }
}

// ----------------------------------------------------------------------------
// Browser / page helpers
// ----------------------------------------------------------------------------
async function launchBrowser() {
  if (!existsSync(EDGE)) throw new Error(`browser executable not found: ${EDGE}`);
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: HEADLESS,
    args: LAUNCH_ARGS,
    // Playwright injects --enable-unsafe-swiftshader into EVERY launch by default.
    // That flag only permits a software fallback (it does not select SwiftShader —
    // the renderer check below verifies the real D3D11 renderer), but it is
    // removed here so the browser command line contains no SwiftShader flag at all.
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
    timeout: 60000,
  });
  R.meta.browser = `Edge (playwright-core ${(await readPkgVersion()) || '?'})`;
  return browser;
}

async function readPkgVersion() {
  try {
    const pkg = JSON.parse(await readFile(path.join(PROJECT, 'node_modules/playwright-core/package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

async function newPage(browser, { width, height, mobile = false, touch = false, dsf = 1 }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: mobile,
    hasTouch: touch,
    locale: 'en-GB',
    timezoneId: 'Europe/Madrid',
  });
  const page = await context.newPage();
  page._ctx = context;
  page._logs = { console: [], errors: [], reqFail: [], res404: [] };
  page._crashed = false;
  page.on('console', (m) => {
    const line = `[${m.type()}] ${m.text()}`;
    if (page._logs.console.length < 500) page._logs.console.push(line);
    if (R.console.length < 1500) R.console.push(line);
  });
  page.on('pageerror', (e) => {
    page._logs.errors.push(e.message);
    if (R.pageErrors.length < 200) R.pageErrors.push({ message: e.message, stack: String(e.stack || '').slice(0, 2000) });
  });
  page.on('requestfailed', (r) => {
    const line = `${r.url()} ${r.failure()?.errorText || ''}`.trim();
    if (page._logs.reqFail.length < 200) page._logs.reqFail.push(line);
    if (R.requestFailures.length < 200) R.requestFailures.push(line);
  });
  page.on('response', (resp) => {
    if (resp.status() === 404) {
      page._logs.res404.push(resp.url());
      R.responses404.push(resp.url());
    }
  });
  page.on('crash', () => {
    page._crashed = true;
    page._logs.errors.push('PAGE CRASHED');
    R.pageErrors.push({ message: 'PAGE CRASHED' });
  });
  await page.bringToFront().catch(() => {});
  ACTIVE_PAGE = page;
  return page;
}

async function closePage(page) {
  if (!page) return;
  if (ACTIVE_PAGE === page) ACTIVE_PAGE = null;
  try {
    await page._ctx?.close();
  } catch {
    /* ignore */
  }
}

async function goto(page, url, { waitUntil = 'load', timeout = 90000 } = {}) {
  await page.goto(url, { waitUntil, timeout });
  await page.bringToFront().catch(() => {});
}

/**
 * Wait for the app's own ready flag. Returns { ok, ms, error }.
 * Honest boot: window.__sagrada.ready is set by main.js only after every
 * builder and the experience layer have run.
 */
async function waitReady(page, timeout = READY_TIMEOUT) {
  const t0 = Date.now();
  try {
    await page.waitForFunction(
      () => window.__sagrada && window.__sagrada.ready === true && window.__sagrada.uiReady === true,
      null,
      { timeout, polling: 200 }
    );
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: String(e.message || e).slice(0, 400) };
  }
}

/** Snapshot of a failing boot: what the page is showing and what went wrong. */
async function bootFailureSnapshot(page) {
  const state = await page
    .evaluate(() => ({
      url: location.href,
      ready: !!(window.__sagrada && window.__sagrada.ready),
      uiReady: !!(window.__sagrada && window.__sagrada.uiReady),
      app: !!window.__app,
      fatal: !document.getElementById('fatal')?.hidden,
      fatalMsg: document.getElementById('fatal-msg')?.textContent || '',
      loaderClass: document.getElementById('loader')?.className || '',
      loaderDisplay: document.getElementById('loader') ? getComputedStyle(document.getElementById('loader')).display : null,
      canvas: (() => {
        const c = document.querySelector('canvas');
        return c ? [c.width, c.height] : null;
      })(),
      errors: (window.__errors || []).map((e) => `${e.where}: ${String(e.message).slice(0, 400)}`),
      bodyText: (document.body.innerText || '').slice(0, 800),
    }))
    .catch((e) => ({ evaluateError: String(e).slice(0, 400) }));
  return state;
}

// ---- app API wrappers ------------------------------------------------------
const api = {
  view: (page) => page.evaluate(() => window.__sagrada.view()),
  mode: (page) => page.evaluate(() => window.__sagrada.getMode()),
  stats: (page) => page.evaluate(() => window.__sagrada.stats()),
  pos: async (page) => (await api.view(page)).pos,
  setPose: (page, pos, look) => page.evaluate(([p, l]) => window.__sagrada.setPose(p, l), [pos, look]),
  teleport: (page, id) => page.evaluate((i) => window.__sagrada.teleport(i), id),
  setMode: (page, m) => page.evaluate((m) => window.__sagrada.setMode(m), m),
  setTime: (page, h) => page.evaluate((h) => window.__sagrada.setTime(h), h),
  startTour: (page, id) => page.evaluate((i) => window.__sagrada.startTour(i), id ?? 0),
  hideUI: (page, v) => page.evaluate((v) => window.__sagrada.hideUI(v), v),
  setPhoto: (page, v) => page.evaluate((v) => window.__sagrada.setPhoto(v), v),
  openHotspot: (page, id) => page.evaluate((i) => window.__sagrada.openHotspot(i), id),
  toggleMap: (page) => page.evaluate(() => window.__sagrada.toggleMap()),
  hotspots: (page) => page.evaluate(() => window.__sagrada.hotspots()),
  errors: (page) => page.evaluate(() => window.__sagrada.errors()),
  canLock: (page) =>
    page.evaluate(() => {
      try {
        return !!window.__sagrada.experienceAPI.controls.isEnabled();
      } catch {
        return false;
      }
    }),
  scene: (page) =>
    page.evaluate(() => {
      const app = window.__app;
      if (!app) return null;
      const names = ['environment', 'glory-shell', 'facades-np', 'towers', 'interior'];
      const groups = {};
      for (const name of names) {
        const g = app.scene.getObjectByName(name);
        let meshes = 0;
        let tris = 0;
        if (g) {
          g.traverse((o) => {
            if (o.isMesh && o.geometry) {
              meshes++;
              const geo = o.geometry;
              tris += (geo.index ? geo.index.count : geo.attributes.position ? geo.attributes.position.count : 0) / 3;
            }
          });
        }
        groups[name] = { present: !!g, meshes, tris: Math.round(tris) };
      }
      return { groups, children: app.scene.children.length };
    }),
  rendererInfo: (page) =>
    page.evaluate(() => {
      try {
        const r = window.__app?.renderer;
        const gl = r?.getContext?.();
        const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
        return {
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null,
          vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
          webgl2: !!(gl && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext),
          pixelRatio: r?.getPixelRatio ? r.getPixelRatio() : null,
        };
      } catch (e) {
        return { error: String(e).slice(0, 300) };
      }
    }),
  /** Scan every drawable geometry for NaN/Infinity positions (bounding-sphere NaN source). */
  sceneNaN: (page) =>
    page.evaluate(() => {
      const app = window.__app;
      if (!app) return null;
      const bad = [];
      let meshes = 0;
      let vertices = 0;
      app.scene.traverse((o) => {
        if (!(o.isMesh || o.isInstancedMesh || o.isLine || o.isPoints) || !o.geometry) return;
        meshes++;
        const pos = o.geometry.attributes && o.geometry.attributes.position;
        if (!pos) return;
        vertices += pos.count;
        const arr = pos.array;
        let nan = 0;
        let inf = 0;
        let first = -1;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (Number.isNaN(v)) {
            nan++;
            if (first < 0) first = i;
          } else if (!Number.isFinite(v)) inf++;
        }
        if (nan || inf) {
          bad.push({
            mesh: o.name || '(unnamed)',
            parent: (o.parent && o.parent.name) || '',
            geometry: o.geometry.name || '',
            instanced: !!o.isInstancedMesh,
            nan,
            inf,
            firstIndex: first,
            vertices: pos.count,
          });
        }
      });
      return { meshes, vertices, badCount: bad.length, bad: bad.slice(0, 60) };
    }),
};

// ---- keyboard / pointer helpers -------------------------------------------
async function holdKey(page, code, ms) {
  await page.keyboard.down(code);
  try {
    await sleep(ms);
  } finally {
    await page.keyboard.up(code).catch(() => {});
  }
}

/** Hold a key and sample the camera pose so collisions can be observed. */
async function trackWhileHolding(page, code, ms, interval = 250) {
  const samples = [];
  await page.keyboard.down(code);
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      await sleep(interval);
      const v = await api.view(page).catch(() => null);
      if (v) samples.push({ t: Date.now() - t0, pos: v.pos, mode: v.mode });
    }
  } finally {
    await page.keyboard.up(code).catch(() => {});
  }
  return samples;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function closeOverlays(page) {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(140);
  }
}

async function ensureWalk(page) {
  const m = await api.mode(page);
  if (m !== 'walk') {
    await api.setMode(page, 'walk');
    await sleep(400);
  }
}

// ---- canvas/screenshot pixel analysis --------------------------------------
/**
 * Draw the live WebGL canvas into a 2D canvas inside a rAF callback (after the
 * app's own render for that frame) and measure luminance. Works with the
 * default preserveDrawingBuffer:false because the read happens in-frame.
 */
async function canvasStats(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const src = document.querySelector('canvas');
        if (!src) return resolve(null);
        requestAnimationFrame(() => {
          try {
            const w = 160;
            const h = Math.max(1, Math.round((w * src.height) / src.width));
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.drawImage(src, 0, 0, w, h);
            const d = g.getImageData(0, 0, w, h).data;
            // NOTE: this computation must live inside the page context (it cannot
            // reference Node-side helpers). Duplicated deliberately in pngStats.
            const n = w * h;
            let sum = 0;
            let sum2 = 0;
            let dark = 0;
            let max = 0;
            let min = 255;
            const hist = new Array(16).fill(0);
            for (let i = 0; i < d.length; i += 4) {
              const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
              sum += l;
              sum2 += l * l;
              if (l < 6) dark++;
              if (l > max) max = l;
              if (l < min) min = l;
              hist[Math.min(15, Math.floor(l / 16))]++;
            }
            const mean = sum / n;
            const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
            resolve({
              mean: +mean.toFixed(2),
              std: +std.toFixed(2),
              min: Math.round(min),
              max: Math.round(max),
              darkFrac: +(dark / n).toFixed(3),
              levels: hist.filter((v) => v / n > 0.002).length,
              w: src.width,
              h: src.height,
            });
          } catch (e) {
            resolve({ error: String(e).slice(0, 300) });
          }
        });
      })
  );
}

/** Decode a PNG screenshot in-page and measure it (honest black-frame check). */
async function pngStats(page, buffer) {
  const b64 = buffer.toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const w = 240;
    const h = Math.max(1, Math.round((w * img.height) / img.width));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const n = w * h;
    let sum = 0;
    let sum2 = 0;
    let dark = 0;
    let max = 0;
    let min = 255;
    const hist = new Array(16).fill(0);
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l;
      sum2 += l * l;
      if (l < 6) dark++;
      if (l > max) max = l;
      if (l < min) min = l;
      hist[Math.min(15, Math.floor(l / 16))]++;
    }
    const mean = sum / n;
    const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    return {
      mean: +mean.toFixed(2),
      std: +std.toFixed(2),
      min: Math.round(min),
      max: Math.round(max),
      darkFrac: +(dark / n).toFixed(3),
      levels: hist.filter((v) => v / n > 0.002).length,
      w: img.width,
      h: img.height,
    };
  }, b64);
}

/**
 * Luminance of the live frame. Primary path reads the WebGL canvas in-frame;
 * if that comes back perfectly black (some GPU/headless combinations clear the
 * drawing buffer before readback), fall back to decoding a screenshot so a
 * readable scene can never be reported as black.
 */
async function liveStats(page, kind = 'day') {
  const st = await canvasStats(page);
  if (st && !st.error && !(st.mean < 1 && st.std < 1 && st.max < 8)) return st;
  try {
    const buf = await page.screenshot({ type: 'png', timeout: 25000 });
    const alt = await pngStats(page, buf);
    return { ...alt, source: 'screenshot-fallback', canvasReadback: st };
  } catch (e) {
    return st || { error: String(e).slice(0, 300) };
  }
}

/** Not-black gate for a captured screenshot. Returns null when OK, else reason. */
function shotIsLive(stats, kind = 'day') {
  if (!stats || stats.error) return 'no pixel statistics';
  const limits =
    kind === 'night'
      ? { mean: 1.2, std: 2.0, max: 40 }
      : kind === 'interior'
        ? { mean: 3.0, std: 2.5, max: 55 }
        : { mean: 5.0, std: 3.5, max: 70 };
  if (stats.mean < limits.mean) return `mean luminance ${stats.mean} < ${limits.mean} (black/blank frame)`;
  if (stats.std < limits.std) return `luminance std ${stats.std} < ${limits.std} (flat/blank frame)`;
  if (stats.max < limits.max) return `max luminance ${stats.max} < ${limits.max} (black frame)`;
  if (stats.darkFrac > 0.97) return `${(stats.darkFrac * 100).toFixed(0)}% near-black pixels`;
  return null;
}

// ----------------------------------------------------------------------------
// Screenshot capture
// ----------------------------------------------------------------------------
async function capture(page, name, { kind = 'day', subdir = '', phase = 'capture' } = {}) {
  const fileName = name.endsWith('.png') ? name : `${name}.png`;
  const file = path.join(SHOTS, subdir, fileName);
  await mkdir(path.dirname(file), { recursive: true });
  let stats = null;
  let err = null;
  try {
    const buf = await page.screenshot({ path: file, timeout: 30000 });
    try {
      stats = await pngStats(page, buf);
    } catch (e) {
      err = `png stats failed: ${String(e).slice(0, 200)}`;
    }
  } catch (e) {
    err = `screenshot failed: ${String(e).slice(0, 300)}`;
  }
  const entry = { name: fileName, file: rel(file), phase, kind, stats, error: err };
  R.shots.push(entry);
  const live = err ? err : shotIsLive(stats, kind);
  if (live) log(`  ! shot ${fileName} — ${live}`);
  return { ...entry, live };
}

// ============================================================================
// SECTION 1 — boot + splash (interaction viewport)
// ============================================================================
async function sectionBootAndSplash(page) {
  log('\n[1/8] boot + splash + enter');
  const boot = await step(
    'boot-ready',
    'boot',
    'app boots and signals window.__sagrada.ready',
    async () => {
      const ready = await waitReady(page);
      if (!ready.ok) {
        const snap = await bootFailureSnapshot(page);
        await capture(page, 'fail-boot', { phase: 'boot' });
        return {
          ok: false,
          severity: 'BLOCKER',
          detail: `ready=${JSON.stringify(snap.ready)} uiReady=${JSON.stringify(snap.uiReady)} fatal=${snap.fatal} loader=${snap.loaderClass}/${snap.loaderDisplay} canvas=${JSON.stringify(snap.canvas)} errors=${JSON.stringify(snap.errors)} fatalMsg="${snap.fatalMsg}" wait=${ready.error}`,
          repro: 'open / (default) and wait for window.__sagrada.ready; if this fails the page is stuck in boot.',
        };
      }
      return { ok: true, detail: `ready in ${ready.ms} ms` };
    },
    { severity: 'BLOCKER' }
  );
  const bootOk = boot.status === 'PASS';
  if (!bootOk) {
    R.meta.aborted = 'boot failed';
    return false;
  }

  await step(
    'boot-renderer',
    'boot',
    'real GPU renderer active (ANGLE D3D11, not SwiftShader)',
    async () => {
      const info = await api.rendererInfo(page);
      R.meta.gpu = info;
      const r = String(info.renderer || '');
      log(`  · WebGL renderer: ${r}`);
      const software = /swiftshader|llvmpipe|softpipe|software rasterizer/i.test(r);
      const d3d11 = /direct3d11|d3d11/i.test(r);
      return {
        ok: !software && d3d11,
        severity: 'MAJOR',
        detail: `${JSON.stringify(info)}${!d3d11 ? ' — expected an ANGLE Direct3D11 renderer' : ''}${software ? ' — SOFTWARE RENDERER DETECTED' : ''}`,
        repro: 'launch args must be exactly --enable-gpu --ignore-gpu-blocklist --use-angle=d3d11 --disable-gpu-sandbox --no-sandbox; read WEBGL_debug_renderer_info after boot.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'boot-canvas',
    'boot',
    'renderer canvas exists at viewport size',
    async () => {
      const c = await page.evaluate(() => {
        const el = document.querySelector('canvas');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: el.width, h: el.height, cw: Math.round(r.width), ch: Math.round(r.height) };
      });
      return { ok: !!c && c.w > 0 && c.h > 0 && c.cw === INT_W && c.ch === INT_H, detail: JSON.stringify(c), repro: `canvas should fill the viewport at ${INT_W}x${INT_H}` };
    },
    { severity: 'BLOCKER' }
  );

  await step(
    'boot-loader-dismissed',
    'boot',
    'loading screen is dismissed',
    async () => {
      // #loader fades over ~1.1 s and main.js sets display:none after; wait for
      // the actual dismissal, not just the class flip (a class-only check races
      // the CSS transition and produces a false failure).
      await page
        .waitForFunction(
          () => {
            const l = document.getElementById('loader');
            if (!l) return true;
            const cs = getComputedStyle(l);
            return cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05;
          },
          null,
          { timeout: 25000, polling: 150 }
        )
        .catch(() => {});
      const st = await page.evaluate(() => {
        const l = document.getElementById('loader');
        if (!l) return { absent: true };
        const cs = getComputedStyle(l);
        return { cls: l.className, display: cs.display, visibility: cs.visibility, opacity: cs.opacity };
      });
      const gone = st.absent || st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05;
      return { ok: gone, severity: 'BLOCKER', detail: JSON.stringify(st), repro: 'boot should hide #loader within a few seconds of ready' };
    },
    { severity: 'BLOCKER' }
  );

  await step(
    'boot-no-page-errors',
    'boot',
    'no uncaught page errors during boot',
    async () => {
      const errs = page._logs.errors.slice();
      const nonFavicon404 = page._logs.res404.filter((u) => !/favicon/i.test(u));
      const badReq = page._logs.reqFail.filter((u) => !/favicon/i.test(u));
      const detail = errs.length ? errs.join(' | ').slice(0, 1200) : nonFavicon404.length ? `404: ${nonFavicon404.join(', ')}` : badReq.length ? `request failed: ${badReq.join(', ')}` : 'clean';
      return { ok: errs.length === 0 && nonFavicon404.length === 0 && badReq.length === 0, severity: 'BLOCKER', detail, repro: 'check the browser console on a normal load' };
    },
    { severity: 'BLOCKER' }
  );

  await step(
    'boot-builder-errors',
    'boot',
    'all builders completed without recorded errors',
    async () => {
      const errs = await api.errors(page);
      return {
        ok: errs.length === 0,
        severity: 'BLOCKER',
        detail: errs.length ? errs.map((e) => `${e.where}: ${String(e.message).slice(0, 220)}`).join(' || ') : 'no builder errors',
        repro: 'window.__sagrada.errors() after boot; a non-empty list means a builder threw and its geometry is missing.',
      };
    },
    { severity: 'BLOCKER' }
  );

  await step(
    'boot-scene-groups',
    'boot',
    'all five builder groups are present and non-empty',
    async () => {
      const scene = await api.scene(page);
      if (!scene) return { ok: false, severity: 'BLOCKER', detail: 'window.__app missing' };
      const missing = Object.entries(scene.groups)
        .filter(([, g]) => !g.present || g.meshes === 0)
        .map(([n, g]) => `${n}${g.present ? '(no meshes)' : '(missing)'}`);
      const summary = Object.fromEntries(Object.entries(scene.groups).map(([n, g]) => [n, `${g.meshes} meshes/${fmt(g.tris)} tris`]));
      return {
        ok: missing.length === 0,
        severity: 'BLOCKER',
        detail: missing.length ? `missing: ${missing.join(', ')} | ${JSON.stringify(summary)}` : JSON.stringify(summary),
        repro: 'inspect window.__app.scene children by name after boot; every builder group must exist.',
      };
    },
    { severity: 'BLOCKER' }
  );

  await step(
    'boot-nan-geometry',
    'boot',
    'no geometry contains NaN/Infinity vertex positions',
    async () => {
      const scan = await api.sceneNaN(page);
      if (!scan) return { ok: false, severity: 'MAJOR', detail: 'window.__app missing' };
      const names = scan.bad.map((b) => `${b.mesh}${b.parent ? `<${b.parent}>` : ''}${b.geometry ? `[${b.geometry}]` : ''}: ${b.nan} NaN / ${b.inf} Inf of ${b.vertices} verts`);
      return {
        ok: scan.badCount === 0,
        severity: 'MAJOR',
        detail: scan.badCount ? `${scan.badCount} geometry(ies) of ${scan.meshes} meshes: ${names.join(' | ')}` : `${scan.meshes} meshes / ${fmt(scan.vertices)} vertices clean`,
        repro: 'after boot, traverse window.__app.scene and scan every geometry position attribute for non-finite values; this is the source of "Computed radius is NaN" console errors.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'boot-debug-api',
    'boot',
    'window.__sagrada debug API is complete',
    async () => {
      const info = await page.evaluate(() => {
        const g = window.__sagrada || {};
        const keys = ['setPose', 'teleport', 'setMode', 'startTour', 'setTime', 'hideUI', 'stats', 'getMode', 'view', 'openHotspot', 'setPhoto', 'toggleMap', 'hotspots', 'errors'];
        const fns = {};
        for (const k of keys) fns[k] = typeof g[k];
        return {
          ready: g.ready,
          uiReady: g.uiReady,
          modeName: typeof g.modeName,
          appGetStats: typeof window.__app?.getStats,
          fns,
        };
      });
      const missing = Object.entries(info.fns).filter(([, t]) => t !== 'function').map(([k]) => k);
      return {
        ok: missing.length === 0 && info.appGetStats === 'function',
        severity: 'MAJOR',
        detail: missing.length ? `missing/invalid: ${missing.join(', ')} (modes ${JSON.stringify(info.fns)})` : 'complete',
        repro: 'read the QA contract; window.__sagrada must expose the debug API.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'boot-canvas-live',
    'boot',
    'the rendered canvas is not black',
    async () => {
      const st = await liveStats(page, 'day');
      const live = shotIsLive(st, 'day');
      return { ok: !live, severity: 'BLOCKER', detail: `${JSON.stringify(st)}${live ? ' — ' + live : ''}`, repro: 'read the WebGL canvas after boot; a black frame means nothing rendered.' };
    },
    { severity: 'BLOCKER' }
  );

  // ---- splash --------------------------------------------------------------
  log('\n[2/8] splash screen and entering');
  await step(
    'splash-visible',
    'splash',
    'splash screen with title and three entry buttons is visible',
    async () => {
      const s = await page.evaluate(() => {
        const splash = document.getElementById('sf-splash');
        const title = document.querySelector('.sf-splash-title');
        const btns = Array.from(document.querySelectorAll('[data-splash]'));
        const visible = (el) => {
          if (!el || el.hidden) return false;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.05) return false;
          const r = el.getBoundingClientRect();
          return r.width > 2 && r.height > 2;
        };
        return {
          splash: visible(splash),
          title: title ? title.textContent.replace(/\s+/g, ' ').trim() : null,
          buttons: btns.map((b) => b.getAttribute('data-splash')),
          buttonsVisible: btns.filter(visible).length,
          btnRects: btns.map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }),
        };
      });
      const ok = s.splash && !!s.title && /Sagrada/i.test(s.title || '') && s.buttonsVisible === 3 && ['walk', 'fly', 'tour'].every((m) => s.buttons.includes(m));
      return { ok, severity: 'MAJOR', detail: JSON.stringify(s), repro: 'load / without URL params; the splash with Enter on foot / Fly over / Guided tour must be shown.' };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'splash-enter-walk',
    'splash',
    'clicking "Enter on foot" enters walk mode',
    async () => {
      await page.click('[data-splash="walk"]', { timeout: 15000 });
      await page
        .waitForFunction(() => window.__sagrada.experienceAPI?.controls?.isEnabled?.() === true, null, { timeout: 30000, polling: 150 })
        .catch(() => {});
      const st = await page.evaluate(() => ({
        mode: window.__sagrada.getMode(),
        splashHidden: (() => {
          const el = document.getElementById('sf-splash');
          return !el || el.hidden || getComputedStyle(el).display === 'none' || el.classList.contains('is-leaving');
        })(),
        enabled: window.__sagrada.experienceAPI?.controls?.isEnabled?.(),
        entered: document.querySelector('.sf-root')?.classList.contains('is-entered'),
      }));
      const v = await api.view(page).catch(() => null);
      return {
        ok: st.mode === 'walk' && st.splashHidden && st.enabled && st.entered,
        severity: 'MAJOR',
        detail: `${JSON.stringify(st)} pos=${v ? v.pos.map((n) => n.toFixed(1)).join(',') : '?'}`,
        repro: 'load /, click the "Enter on foot" button; mode must become walk, splash must hide, controls must enable.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'splash-default-pose',
    'splash',
    'enter-on-foot lands at the authored plaza start pose',
    async () => {
      const v = await api.view(page);
      const near = dist(v.pos, [84, 1.72, 116]) < 30;
      const horizontal = Math.hypot(v.pos[0] - 84, v.pos[2] - 116) < 25;
      return {
        ok: v.mode === 'walk' && near && horizontal && Math.abs(v.pos[1] - 1.72) < 1.2,
        severity: 'MINOR',
        detail: `pos=${v.pos.map((n) => n.toFixed(2)).join(',')} mode=${v.mode}`,
        repro: 'enter on foot; defaultPose in src/experience.js is [84, EYE, 116]',
      };
    },
    { severity: 'MINOR' }
  );

  return true;
}

// ============================================================================
// SECTION 2 — walking, ground, collision, doors
// ============================================================================
async function sectionWalk(page) {
  log('\n[3/8] walking, ground, collision, façade doors');
  await closeOverlays(page);
  await ensureWalk(page);
  await api.setPose(page, [84, 1.72, 116], [0, 30, 0]);
  await sleep(500);

  await step(
    'walk-forward',
    'walk',
    'holding W moves the camera forward',
    async () => {
      const before = (await api.view(page)).pos;
      const samples = await trackWhileHolding(page, 'KeyW', 1800, 300);
      const after = (await api.view(page)).pos;
      const moved = dist(before, after);
      const vertical = Math.abs(after[1] - before[1]);
      return {
        ok: moved > 1.0,
        severity: 'MAJOR',
        detail: `moved ${moved.toFixed(2)} m (vertical ${vertical.toFixed(2)} m), ${samples.length} samples, fps≈${(await api.stats(page)).fps}`,
        repro: 'walk mode, hold W for ~2 s; the camera position must change.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'walk-eye-height',
    'walk',
    'eye height and ground contact are sane',
    async () => {
      const info = await page.evaluate(() => {
        const c = window.__sagrada.experienceAPI.controls;
        return { ...c.getInfo(), dimEye: window.__app?.DIM?.eyeHeight };
      });
      const eye = info.eyeHeight;
      const y = info.pos.y;
      const ground = info.feet.y;
      return {
        ok: Math.abs(y - (ground + eye)) < 0.25 && y > 1.2 && y < 3.0 && eye > 1.5 && eye < 2.0,
        severity: 'MAJOR',
        detail: `camera y=${y.toFixed(2)} feet y=${ground.toFixed(2)} eye=${eye} dim=${info.dimEye} onGround=${info.onGround}`,
        repro: 'walk on the plaza; the camera must sit one eye-height above the walkable ground.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'walk-jump',
    'walk',
    'Space jumps',
    async () => {
      const before = (await api.view(page)).pos;
      await page.keyboard.press('Space');
      await sleep(180);
      const mid = (await api.view(page)).pos;
      await sleep(900);
      const after = (await api.view(page)).pos;
      return {
        ok: mid[1] > before[1] + 0.05 || after[1] > before[1] + 0.02,
        severity: 'MINOR',
        detail: `y ${before[1].toFixed(2)} → ${mid[1].toFixed(2)} → ${after[1].toFixed(2)}`,
        repro: 'walk mode, press Space; the camera should rise and land back.',
      };
    },
    { severity: 'MINOR' }
  );

  // ---- collision -----------------------------------------------------------
  await step(
    'collision-facade-wall',
    'collision',
    'Nativity façade wall blocks the walker (no pass-through)',
    async () => {
      await ensureWalk(page);
      await api.setPose(page, [24, 1.72, 18], [31, 1.72, 18]);
      await sleep(350);
      const start = (await api.view(page)).pos;
      const samples = await trackWhileHolding(page, 'KeyW', 3000, 250);
      const end = (await api.view(page)).pos;
      const maxX = Math.max(start[0], ...samples.map((s) => s.pos[0]), end[0]);
      const zs = [start[2], ...samples.map((s) => s.pos[2]), end[2]];
      const zMin = Math.min(...zs);
      const zMax = Math.max(...zs);
      // façade collider: centre x=30.8, half-width 0.82, player radius 0.42 → stop ≈29.56
      // (segment [15.25,24] in z covers the probe at z=18)
      return {
        ok: maxX < 30.05 && end[0] < 30.05 && end[0] > start[0] + 0.5 && zMax - zMin < 2,
        severity: 'MAJOR',
        detail: `start=(${start.map((n) => n.toFixed(2)).join(',')}) end=(${end.map((n) => n.toFixed(2)).join(',')}) max x=${maxX.toFixed(2)} z-range ${zMin.toFixed(2)}..${zMax.toFixed(2)} mode=${(await api.mode(page))} (wall inner face ≈29.98, expected stop ≈29.56)`,
        repro: 'setPose([24,1.72,18],[31,1.72,18]) in walk mode then hold W; the façade wall collider at x≈30.8 (z segment 15.25..24) must stop the walker.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'collision-tower',
    'collision',
    'ground-standing apostle tower blocks the walker',
    async () => {
      await api.setPose(page, [17.5, 1.72, -21], [26, 1.72, -21]);
      await sleep(350);
      const start = (await api.view(page)).pos;
      const samples = await trackWhileHolding(page, 'KeyW', 3000, 250);
      const end = (await api.view(page)).pos;
      const maxX = Math.max(start[0], ...samples.map((s) => s.pos[0]), end[0]);
      // tower n1 at (26,-21), half width 4.8 → west face 21.2, stop ≈20.78
      return {
        ok: maxX < 21.4 && end[0] > start[0] + 0.4,
        severity: 'MAJOR',
        detail: `start x=${start[0].toFixed(2)} end x=${end[0].toFixed(2)} max x=${maxX.toFixed(2)} (tower west face 21.2, expected stop ≈20.78)`,
        repro: 'setPose([17.5,1.72,-21],[26,1.72,-21]) then hold W toward the Nativity apostle tower n1 at (26,-21).',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'collision-column',
    'collision',
    'crossing porphyry column blocks the walker',
    async () => {
      await api.setPose(page, [8, 1.72, 14], [14, 1.72, 14]);
      await sleep(350);
      const start = (await api.view(page)).pos;
      const samples = await trackWhileHolding(page, 'KeyW', 2800, 250);
      const end = (await api.view(page)).pos;
      const maxX = Math.max(start[0], ...samples.map((s) => s.pos[0]), end[0]);
      // crossing column (14,14) r=2.15 + player 0.42 → stop ≈11.43
      return {
        ok: maxX < 11.95 && end[0] > start[0] + 0.4,
        severity: 'MAJOR',
        detail: `start x=${start[0].toFixed(2)} end x=${end[0].toFixed(2)} max x=${maxX.toFixed(2)} (column surface 11.85, expected stop ≈11.43)`,
        repro: 'setPose([8,1.72,14],[14,1.72,14]) then hold W into the crossing column at (14,14).',
      };
    },
    { severity: 'MAJOR' }
  );

  // ---- doors ---------------------------------------------------------------
  const doors = [
    {
      id: 'door-nativity',
      name: 'Nativity façade door is passable (walk in from the east)',
      start: [38, 1.72, 0],
      look: [20, 1.72, 0],
      check: (end) => end[0] < 27.5,
      describe: (end) => `x=${end[0].toFixed(2)} (must be < 27.5, wall plane x≈30.8)`,
    },
    {
      id: 'door-passion',
      name: 'Passion façade door is passable (walk in from the west)',
      start: [-38, 1.72, 0],
      look: [-20, 1.72, 0],
      check: (end) => end[0] > -27.5,
      describe: (end) => `x=${end[0].toFixed(2)} (must be > -27.5, wall plane x≈-30.8)`,
    },
    {
      id: 'door-glory',
      name: 'Glory façade central door is passable (walk in from the south)',
      start: [0, 1.72, 53],
      look: [0, 1.72, 20],
      check: (end) => end[2] < 42.5,
      describe: (end) => `z=${end[2].toFixed(2)} (must be < 42.5, wall plane z≈45.8)`,
    },
  ];
  for (const d of doors) {
    await step(
      d.id,
      'doors',
      d.name,
      async () => {
        await api.setPose(page, d.start, d.look);
        await sleep(400);
        const start = (await api.view(page)).pos;
        const samples = await trackWhileHolding(page, 'KeyW', 5000, 400);
        const end = (await api.view(page)).pos;
        const passedWall = d.check(end);
        const ySane = end[1] > 0.8 && end[1] < 3.0;
        const moved = dist(start, end) > 4;
        return {
          ok: passedWall && ySane && moved,
          severity: 'MAJOR',
          detail: `start=(${start.map((n) => n.toFixed(1)).join(',')}) end=(${end.map((n) => n.toFixed(2)).join(',')}) moved ${dist(start, end).toFixed(1)} m; ${d.describe(end)}; y sane=${ySane}`,
          repro: `setPose([${d.start.join(',')}],[${d.look.join(',')}]) then hold W ~5 s; the open portal must let the walker through.`,
        };
      },
      { severity: 'MAJOR' }
    );
  }

  // interior reachability: after walking through the Glory door, keep going to the crossing.
  // WALK_SPEED is 4.6 m/s (src/experience/controls.js), and z=53 → crossing (z≈0..20) is
  // 33-53 m, so allow 10-12 s of held W rather than the old 5 s (which was too tight).
  await step(
    'walk-to-interior',
    'doors',
    'walker can reach the crossing from the Glory entrance',
    async () => {
      await api.setPose(page, [0, 1.72, 53], [0, 1.72, 0]);
      await sleep(400);
      await holdKey(page, 'KeyW', 11000);
      const v = await api.view(page);
      return {
        ok: Math.abs(v.pos[0]) < 6 && v.pos[2] < 20 && v.pos[1] > 0.8 && v.pos[1] < 3.2,
        severity: 'MAJOR',
        detail: `pos=(${v.pos.map((n) => n.toFixed(2)).join(',')}) after 11 s walking south→north (4.6 m/s walk)`,
        repro: 'from the Glory entrance at z=53 walk straight in (W) for ~11 s; you should be inside the nave/crossing (z<20).',
      };
    },
    { severity: 'MAJOR' }
  );
}

// ============================================================================
// SECTION 3 — fly + teleport to every tour stop
// ============================================================================
async function sectionFly(page) {
  log('\n[4/8] fly mode + teleport to every tour stop');
  await closeOverlays(page);
  await ensureWalk(page);

  await step(
    'fly-toggle',
    'fly',
    'F toggles walk → fly',
    async () => {
      await api.setPose(page, [84, 1.72, 116], [0, 30, 0]);
      await sleep(300);
      await page.keyboard.press('KeyF');
      await sleep(400);
      const mode = await api.mode(page);
      const label = await page.evaluate(() => document.querySelector('[data-mode-label]')?.textContent);
      return { ok: mode === 'fly' && label === 'FLY', severity: 'MAJOR', detail: `mode=${mode} label=${label}`, repro: 'press F in walk mode; mode must become fly and the HUD label FLY.' };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'fly-rise',
    'fly',
    'Space rises in fly mode',
    async () => {
      await api.setPose(page, [90, 20, 110], [0, 40, 0]);
      await sleep(350);
      const before = (await api.view(page)).pos;
      await holdKey(page, 'Space', 900);
      await sleep(250);
      const after = (await api.view(page)).pos;
      const mode = await api.mode(page);
      return {
        ok: mode === 'fly' && after[1] > before[1] + 1.0,
        severity: 'MAJOR',
        detail: `fly mode=${mode}, y ${before[1].toFixed(2)} → ${after[1].toFixed(2)} while holding Space`,
        repro: 'in fly mode hold Space; the camera must rise (HUD hint and README both promise Space = rise).',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'fly-descend-ctrl',
    'fly',
    'Ctrl descends in fly mode',
    async () => {
      await api.setPose(page, [90, 40, 110], [0, 40, 0]);
      await sleep(350);
      const before = (await api.view(page)).pos;
      await holdKey(page, 'ControlLeft', 800);
      await sleep(250);
      const after = (await api.view(page)).pos;
      return {
        ok: after[1] < before[1] - 0.8,
        severity: 'MAJOR',
        detail: `y ${before[1].toFixed(2)} → ${after[1].toFixed(2)} while holding Ctrl`,
        repro: 'in fly mode hold Ctrl; the camera must descend.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'fly-vertical-qe',
    'fly',
    'Q descends / E rises in fly mode (as documented)',
    async () => {
      await api.setPose(page, [90, 40, 110], [0, 40, 0]);
      await sleep(350);
      const y0 = (await api.view(page)).pos[1];
      await holdKey(page, 'KeyQ', 700);
      await sleep(250);
      const yQ = (await api.view(page)).pos[1];
      await holdKey(page, 'KeyE', 700);
      await sleep(250);
      const yE = (await api.view(page)).pos[1];
      // Documented mapping (Lead-confirmed): Q = fall, E = rise.
      return {
        ok: yQ < y0 - 0.5 && yE > yQ + 0.5,
        severity: 'MINOR',
        detail: `y ${y0.toFixed(2)} → Q (fall) ${yQ.toFixed(2)} → E (rise) ${yE.toFixed(2)}`,
        repro: 'in fly mode hold Q (descend) then E (rise); both should move the camera vertically.',
      };
    },
    { severity: 'MINOR' }
  );

  await step(
    'fly-boost',
    'fly',
    'Shift boosts fly speed',
    async () => {
      await api.setPose(page, [90, 40, 110], [0, 40, 0]);
      await sleep(300);
      const a0 = (await api.view(page)).pos;
      await holdKey(page, 'KeyW', 600);
      const a1 = (await api.view(page)).pos;
      await api.setPose(page, [90, 40, 110], [0, 40, 0]);
      await sleep(300);
      await page.keyboard.down('ShiftLeft');
      try {
        await holdKey(page, 'KeyW', 600);
      } finally {
        await page.keyboard.up('ShiftLeft').catch(() => {});
      }
      const a2 = (await api.view(page)).pos;
      const normal = dist(a0, a1);
      const boosted = dist(a0, a2);
      return {
        ok: boosted > normal * 1.3 && boosted > 1.0,
        severity: 'MINOR',
        detail: `normal ${normal.toFixed(2)} m vs boosted ${boosted.toFixed(2)} m in 0.6 s`,
        repro: 'fly mode: hold W then Shift+W; boosted distance should be clearly larger.',
      };
    },
    { severity: 'MINOR' }
  );

  const stops = await page.evaluate(() => window.__app.TOUR.map((s) => ({ id: s.id, pos: s.pos, target: s.target, mode: s.mode, time: s.time ?? null })));
  await step(
    'teleport-all-stops',
    'teleport',
    `teleport() works for every TOUR stop (${stops.length} stops)`,
    async () => {
      const failures = [];
      const results = [];
      for (const s of stops) {
        const ok = await api.teleport(page, s.id);
        await sleep(320);
        const v = await api.view(page);
        const d = dist(v.pos, s.pos);
        const modeOk = v.mode === (s.mode === 'walk' ? 'walk' : 'fly');
        const rec = { id: s.id, ok, dist: +d.toFixed(2), mode: v.mode, modeOk };
        results.push(rec);
        if (!ok || d > 2.0 || !modeOk) failures.push(`${s.id}(ok=${ok},dist=${d.toFixed(2)},mode=${v.mode}/${s.mode})`);
        if (s.time != null) {
          const t = (await api.stats(page)).time;
          if (Math.abs(t - s.time) > 0.05) failures.push(`${s.id}(time ${t} != ${s.time})`);
        }
      }
      R.stops = results;
      return {
        ok: failures.length === 0,
        severity: 'MAJOR',
        detail: failures.length ? failures.join(', ') : `${stops.length} stops teleported correctly`,
        repro: 'for each id in __app.TOUR call __sagrada.teleport(id) and compare the camera to stop.pos.',
      };
    },
    { severity: 'MAJOR' }
  );
}

// ============================================================================
// SECTION 4 — guided tour
// ============================================================================
async function sectionTour(page) {
  log('\n[5/8] guided tour');
  await closeOverlays(page);

  await step(
    'tour-start',
    'tour',
    'T starts the guided tour with a caption',
    async () => {
      await api.setMode(page, 'walk');
      await sleep(300);
      await page.keyboard.press('KeyT');
      await sleep(700);
      const st = await page.evaluate(() => ({
        mode: window.__sagrada.getMode(),
        panelVisible: (() => {
          const el = document.getElementById('sf-tour');
          return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
        })(),
        title: document.querySelector('[data-tour-title]')?.textContent || '',
        body: document.querySelector('[data-tour-body]')?.textContent || '',
        index: document.querySelector('[data-tour-index]')?.textContent || '',
      }));
      return {
        ok: st.mode === 'tour' && st.panelVisible && st.title.length > 2 && st.body.length > 40 && /\d+\s*\/\s*\d+/.test(st.index),
        severity: 'MAJOR',
        detail: JSON.stringify({ ...st, body: st.body.slice(0, 80) + '…' }),
        repro: 'enter the experience, press T; the tour caption panel must appear with a title and body.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'tour-advance',
    'tour',
    'tour advances between stops',
    async () => {
      const before = await page.evaluate(() => ({
        index: document.querySelector('[data-tour-index]')?.textContent,
        title: document.querySelector('[data-tour-title]')?.textContent,
      }));
      await page.click('[data-act="tour-next"]', { timeout: 10000 }).catch(() => {});
      await sleep(1400);
      const after = await page.evaluate(() => ({
        index: document.querySelector('[data-tour-index]')?.textContent,
        title: document.querySelector('[data-tour-title]')?.textContent,
        state: window.__sagrada.experienceAPI?.tour?.getState?.(),
      }));
      const changed = before.index !== after.index || before.title !== after.title || (after.state?.index ?? -1) > 0;
      return {
        ok: changed && !!after.title && after.title.length > 2,
        severity: 'MAJOR',
        detail: `before=${JSON.stringify(before)} after=${JSON.stringify({ index: after.index, title: after.title })}`,
        repro: 'in tour mode click "Next →"; the stop index/title must advance.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'tour-pause',
    'tour',
    'pause button toggles to Resume',
    async () => {
      // Wait until dwell phase (pause only has an effect while dwelling).
      await page
        .waitForFunction(() => {
          const s = window.__sagrada.experienceAPI?.tour?.getState?.();
          return s && s.phase === 'dwell';
        }, null, { timeout: 12000, polling: 200 })
        .catch(() => {});
      await page.click('[data-act="tour-pause"]', { timeout: 10000 }).catch(() => {});
      await sleep(350);
      const label = await page.evaluate(() => document.querySelector('[data-tour-pause]')?.textContent);
      await page.click('[data-act="tour-pause"]', { timeout: 10000 }).catch(() => {});
      await sleep(300);
      const label2 = await page.evaluate(() => document.querySelector('[data-tour-pause]')?.textContent);
      return {
        ok: /resume/i.test(label || '') && /pause/i.test(label2 || ''),
        severity: 'MAJOR',
        detail: `paused label="${label}" resumed label="${label2}"`,
        repro: 'in tour mode during a dwell, click Pause; the button must change to Resume and back.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'tour-exit',
    'tour',
    'Escape exits the tour to free look',
    async () => {
      await page.keyboard.press('Escape');
      await sleep(500);
      const st = await page.evaluate(() => ({
        mode: window.__sagrada.getMode(),
        panelHidden: (() => {
          const el = document.getElementById('sf-tour');
          return !el || el.hidden || getComputedStyle(el).display === 'none';
        })(),
        enabled: window.__sagrada.experienceAPI?.controls?.isEnabled?.(),
      }));
      return {
        ok: st.mode !== 'tour' && st.panelHidden && st.enabled,
        severity: 'MAJOR',
        detail: JSON.stringify(st),
        repro: 'during the tour press Escape; the tour panel must hide and free-look must be enabled.',
      };
    },
    { severity: 'MAJOR' }
  );
}

// ============================================================================
// SECTION 5 — hotspots
// ============================================================================
async function sectionHotspots(page) {
  log('\n[6/8] hotspots and info card');
  await closeOverlays(page);
  await ensureWalk(page);

  const hotspots = await api.hotspots(page).catch(() => []);
  await step(
    'hotspots-present',
    'hotspots',
    'builder hotspots are registered',
    async () => ({
      ok: Array.isArray(hotspots) && hotspots.length >= 8,
      severity: 'MAJOR',
      detail: `${hotspots.length} hotspots: ${hotspots.slice(0, 12).map((h) => h.id).join(', ')}`,
      repro: 'window.__sagrada.hotspots() should list the architectural labels from the builders.',
    }),
    { severity: 'MAJOR' }
  );

  // Aim the camera at a low hotspot so the reticle label appears, then use E.
  let aimed = null;
  const candidates = [...hotspots].sort((a, b) => a.position[1] - b.position[1]);
  for (const hs of candidates.slice(0, 12)) {
    const [hx, hy, hz] = hs.position;
    const off = Math.max(6, Math.min(12, (hs.radius || 14) * 0.55));
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      try {
        await api.setPose(page, [hx + dx * off, 1.72, hz + dz * off], [hx, hy, hz]);
      } catch {
        continue;
      }
      await sleep(450);
      const shown = await page.evaluate(() => {
        const el = document.getElementById('sf-hotspot');
        return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
      });
      if (shown) {
        aimed = { hs, shot: null };
        break;
      }
    }
    if (aimed) break;
  }

  await step(
    'hotspot-reticle',
    'hotspots',
    'aiming at a hotspot shows the reticle label',
    async () => {
      if (!aimed) return { ok: false, severity: 'MAJOR', detail: 'no hotspot could be made active by aiming at it (projection/radius test failed for the first 12 hotspots)', repro: 'teleport near a hotspot position and look at it; the label with "E to read" should appear.' };
      const label = await page.evaluate(() => ({
        title: document.querySelector('[data-hotspot-title]')?.textContent,
        hint: document.querySelector('[data-hotspot-hint]')?.textContent,
      }));
      return { ok: (label.title || '').length > 0, severity: 'MAJOR', detail: `active="${aimed.hs.id}" title="${label.title}" hint="${label.hint}"`, repro: 'aim at a registered hotspot; the reticle label must show its title.' };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'hotspot-open-e',
    'hotspots',
    'E opens the info card with content',
    async () => {
      if (!aimed) return { ok: false, severity: 'MAJOR', detail: 'no active hotspot to open', repro: 'aim at a hotspot then press E.' };
      await page.keyboard.press('KeyE');
      await sleep(450);
      const card = await page.evaluate(() => {
        const modal = document.getElementById('sf-modal');
        return {
          visible: !!modal && !modal.hidden && getComputedStyle(modal).display !== 'none',
          title: document.querySelector('[data-card-title]')?.textContent || '',
          kicker: document.querySelector('[data-card-kicker]')?.textContent || '',
          body: document.querySelector('[data-card-body]')?.textContent || '',
        };
      });
      return {
        ok: card.visible && card.title.length > 1 && card.body.length > 40,
        severity: 'MAJOR',
        detail: JSON.stringify({ visible: card.visible, title: card.title, bodyLen: card.body.length }),
        repro: 'aim at a hotspot label and press E; the card must open with a title and body text.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'hotspot-close',
    'hotspots',
    'Escape closes the info card and restores control',
    async () => {
      await page.keyboard.press('Escape');
      await sleep(400);
      const st = await page.evaluate(() => ({
        hidden: document.getElementById('sf-modal')?.hidden,
        enabled: window.__sagrada.experienceAPI?.controls?.isEnabled?.(),
      }));
      return { ok: !!st.hidden && st.enabled, severity: 'MINOR', detail: JSON.stringify(st), repro: 'with the card open press Escape; it must close and movement must re-enable.' };
    },
    { severity: 'MINOR' }
  );
}

// ============================================================================
// SECTION 6 — time of day
// ============================================================================
async function sectionTime(page) {
  log('\n[7/8] day / night');
  await closeOverlays(page);
  await ensureWalk(page);

  const readClock = () =>
    page.evaluate(() => ({
      time: window.__app?.env?.time,
      night: window.__app?.env?.night,
      clock: document.querySelector('[data-clock]')?.textContent,
      period: document.querySelector('[data-period]')?.textContent,
      slider: Number(document.querySelector('[data-slider]')?.value),
      sun: window.__app?.env?.sun ? 1 : 0,
    }));

  await step(
    'time-day',
    'time',
    'setTime(10.35) gives a morning scene',
    async () => {
      await api.setTime(page, 10.35);
      await sleep(900);
      const c = await readClock();
      const ok = Math.abs(c.time - 10.35) < 0.05 && c.clock === '10:21' && /morning/i.test(c.period || '') && c.night < 0.2 && Math.abs(c.slider - 10.35) < 0.3;
      return { ok, severity: 'MAJOR', detail: JSON.stringify(c), repro: '__sagrada.setTime(10.35); HUD clock must read 10:21 Morning and env.night≈0.' };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'time-night',
    'time',
    'setTime(21.5) gives a night scene with floodlights',
    async () => {
      await api.setTime(page, 21.5);
      await sleep(1200);
      const c = await readClock();
      const ok = Math.abs(c.time - 21.5) < 0.05 && c.clock === '21:30' && /night/i.test(c.period || '') && c.night > 0.6;
      return { ok, severity: 'MAJOR', detail: JSON.stringify(c), repro: '__sagrada.setTime(21.5); HUD clock must read 21:30 Night and env.night→1.' };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'time-n-key',
    'time',
    'N toggles between day and night',
    async () => {
      const before = (await readClock()).time;
      await page.keyboard.press('KeyN');
      await sleep(700);
      const after = (await readClock()).time;
      const crossed = (before > 18 && after < 12) || (before < 12 && after > 18);
      return { ok: crossed, severity: 'MINOR', detail: `time ${before} → ${after}`, repro: 'press N; the clock should jump between 10.35 and 21.5.' };
    },
    { severity: 'MINOR' }
  );

  await step(
    'time-night-render-bright',
    'time',
    'night scene renders lit content (not a black frame)',
    async () => {
      const st = await liveStats(page, 'night');
      const live = shotIsLive(st, 'night');
      return { ok: !live, severity: 'MAJOR', detail: `${JSON.stringify(st)}${live ? ' — ' + live : ''}`, repro: 'set 21:30 and read the canvas; a black frame means the night lighting/emissive glass is missing.' };
    },
    { severity: 'MAJOR' }
  );

  await api.setTime(page, 10.35);
  await sleep(600);
}

// ============================================================================
// SECTION 7 — UI / controls
// ============================================================================
async function sectionUI(page) {
  log('\n[8/8] UI: plan, help, photo, quality, audio, layout');
  await closeOverlays(page);
  await ensureWalk(page);
  await api.setTime(page, 10.35);
  await sleep(500);
  await api.setPose(page, [0, 2.1, 39], [0, 24, -8]);
  await sleep(400);

  // At 800 px the HUD is in its responsive layout: the desktop nav is hidden and
  // a "Menu" button opens a sheet instead. The nav-item tests must use the sheet
  // so they exercise the real UI path at this viewport width.
  const narrowUI = INT_W <= 820;
  const openSheet = async () => {
    const hidden = await page.evaluate(() => document.getElementById('sf-mobile-sheet')?.hidden !== false);
    if (hidden) {
      await page.click('#sf-controls [data-act="sheet"]', { timeout: 8000 }).catch(async () => {
        await page.evaluate(() => document.querySelector('#sf-controls [data-act="sheet"]')?.click());
      });
      await sleep(350);
    }
  };
  const clickNavAct = async (act) => {
    if (!narrowUI) {
      await page.click(`#sf-controls [data-act="${act}"]`, { timeout: 8000 }).catch(async () => {
        await page.evaluate((a) => document.querySelector(`#sf-controls [data-act="${a}"]`)?.click(), act);
      });
      await sleep(300);
      return;
    }
    await openSheet();
    await page.click(`#sf-mobile-sheet [data-act="${act}"]`, { timeout: 8000 }).catch(async () => {
      await page.evaluate((a) => document.querySelector(`#sf-mobile-sheet [data-act="${a}"]`)?.click(), act);
    });
    await sleep(350);
  };
  const closeSheet = async () => {
    await page.evaluate(() => {
      const s = document.getElementById('sf-mobile-sheet');
      if (s && !s.hidden) document.querySelector('#sf-mobile-sheet [data-act="sheet-close"]')?.click();
    });
    await sleep(250);
  };

  await step(
    'ui-minimap',
    'ui',
    'M opens the plan/minimap and it is painted',
    async () => {
      await page.keyboard.press('KeyM');
      await sleep(600);
      const st = await page.evaluate(() => {
        const el = document.getElementById('sf-map');
        const c = document.getElementById('sf-map-canvas');
        let painted = false;
        if (c && c.width) {
          try {
            const g = c.getContext('2d');
            const d = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
            painted = d[3] > 0;
          } catch {
            painted = false;
          }
        }
        return { visible: !!el && !el.hidden, painted, size: c ? [c.width, c.height] : null };
      });
      await page.keyboard.press('KeyM');
      await sleep(350);
      const closed = await page.evaluate(() => document.getElementById('sf-map')?.hidden);
      return { ok: st.visible && st.painted && closed, severity: 'MAJOR', detail: JSON.stringify({ ...st, closed }), repro: 'press M; the plan panel must open with a painted canvas, and M must close it.' };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'ui-help',
    'ui',
    'H opens/closes the help overlay and does not trap control',
    async () => {
      await page.keyboard.press('KeyH');
      await sleep(400);
      const open = await page.evaluate(() => ({ hidden: document.getElementById('sf-help')?.hidden, enabled: window.__sagrada.experienceAPI?.controls?.isEnabled?.() }));
      await page.keyboard.press('KeyH');
      await sleep(400);
      const closed = await page.evaluate(() => ({ hidden: document.getElementById('sf-help')?.hidden, enabled: window.__sagrada.experienceAPI?.controls?.isEnabled?.() }));
      return {
        ok: open.hidden === false && open.enabled === false && closed.hidden === true && closed.enabled === true,
        severity: 'MAJOR',
        detail: `open=${JSON.stringify(open)} closed=${JSON.stringify(closed)}`,
        repro: 'press H; help opens and movement pauses; H again closes it and movement resumes.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'ui-photo-mode',
    'ui',
    'P hides the interface and P restores it',
    async () => {
      await page.keyboard.press('KeyP');
      await sleep(600);
      const hidden = await page.evaluate(() => ({
        root: document.querySelector('.sf-root')?.classList.contains('is-photo'),
        hud: getComputedStyle(document.getElementById('sf-hud')).display,
        controls: window.__sagrada.experienceAPI?.controls?.isEnabled?.(),
      }));
      await page.keyboard.press('KeyP');
      await sleep(600);
      const restored = await page.evaluate(() => ({
        root: document.querySelector('.sf-root')?.classList.contains('is-photo'),
        hud: getComputedStyle(document.getElementById('sf-hud')).display,
        controls: window.__sagrada.experienceAPI?.controls?.isEnabled?.(),
      }));
      return {
        // Photo mode is defined as "hide the interface"; movement staying enabled
        // is intentional (you keep flying for the clean shot), so do not require
        // controls to be disabled here.
        ok: hidden.root && hidden.hud === 'none' && !restored.root && restored.hud !== 'none',
        severity: 'MAJOR',
        detail: `photo=${JSON.stringify(hidden)} restored=${JSON.stringify(restored)}`,
        repro: 'press P; the HUD and overlays must hide (photo mode), P or Esc restores them.',
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'ui-hide-ui-api',
    'ui',
    'hideUI(true/false) hides and restores every overlay',
    async () => {
      await api.hideUI(page, true);
      await sleep(300);
      const hidden = await page.evaluate(() => {
        const root = document.querySelector('.sf-root');
        const hud = document.getElementById('sf-hud');
        return { cls: root?.classList.contains('is-hidden-all'), hudDisplay: getComputedStyle(hud).display };
      });
      await api.hideUI(page, false);
      await sleep(300);
      const restored = await page.evaluate(() => ({
        cls: document.querySelector('.sf-root')?.classList.contains('is-hidden-all'),
        hudDisplay: getComputedStyle(document.getElementById('sf-hud')).display,
      }));
      return {
        ok: hidden.cls && hidden.hudDisplay === 'none' && !restored.cls && restored.hudDisplay !== 'none',
        severity: 'MINOR',
        detail: `hidden=${JSON.stringify(hidden)} restored=${JSON.stringify(restored)}`,
        repro: '__sagrada.hideUI(true) then (false); all UI should hide/restore.',
      };
    },
    { severity: 'MINOR' }
  );

  await step(
    'ui-quality',
    'ui',
    'quality low/high changes the renderer setting',
    async () => {
      // At narrow widths the desktop nav is hidden; clickNavAct opens the Menu
      // sheet and clicks the sheet item, then we close the sheet so the quality
      // popover (which lives in #sf-controls) is reachable.
      const openQuality = async () => {
        await clickNavAct('quality');
        await closeSheet();
        await sleep(250);
      };
      await openQuality();
      const popOpen = await page.evaluate(() => {
        const p = document.querySelector('#sf-controls [data-pop="quality"]');
        return !!p && !p.hidden && getComputedStyle(p).display !== 'none';
      });
      await page.click('#sf-controls [data-quality="low"]', { timeout: 8000 }).catch(async () => {
        await page.evaluate(() => document.querySelector('#sf-controls [data-quality="low"]')?.click());
      });
      await sleep(800);
      const low = await page.evaluate(() => ({ quality: window.__sagrada.stats().quality, pr: window.__app.renderer.getPixelRatio() }));
      await openQuality();
      await page.click('#sf-controls [data-quality="high"]', { timeout: 8000 }).catch(async () => {
        await page.evaluate(() => document.querySelector('#sf-controls [data-quality="high"]')?.click());
      });
      await sleep(800);
      const high = await page.evaluate(() => ({ quality: window.__sagrada.stats().quality, pr: window.__app.renderer.getPixelRatio() }));
      return {
        ok: popOpen && low.quality === 'low' && low.pr < 1 && high.quality === 'high',
        severity: 'MINOR',
        detail: `narrowLayout=${narrowUI} popOpen=${popOpen} low=${JSON.stringify(low)} high=${JSON.stringify(high)}`,
        repro: 'open Quality in the HUD (Menu → Quality at narrow widths), pick Low; stats().quality must be low and the pixel ratio must drop.',
      };
    },
    { severity: 'MINOR' }
  );

  await step(
    'ui-sound-toggle',
    'ui',
    'sound control exists and toggles (audio content not asserted)',
    async () => {
      // Assert the functional mute state and that the control is visible in the
      // layer that this viewport actually uses (desktop nav ≥821 px, Menu sheet
      // below). The sheet must be OPEN when its button visibility is measured.
      const readMuted = () => page.evaluate(() => window.__sagrada.experienceAPI?.audio?.isMuted?.());
      const rectVisible = (sel) =>
        page.evaluate((s) => {
          const b = document.querySelector(s);
          if (!b) return false;
          const r = b.getBoundingClientRect();
          const cs = getComputedStyle(b);
          return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
        }, sel);
      const before = await readMuted();
      if (narrowUI) await openSheet();
      const controlVisible = narrowUI
        ? await rectVisible('#sf-mobile-sheet [data-act="sound"]')
        : await rectVisible('#sf-controls [data-act="sound"]');
      await clickNavAct('sound');
      await closeSheet();
      await sleep(300);
      const after = await readMuted();
      await clickNavAct('sound');
      await closeSheet();
      await sleep(300);
      const restored = await readMuted();
      return {
        ok: controlVisible === true && before === false && after === true && restored === false,
        severity: 'MINOR',
        detail: `narrowLayout=${narrowUI} controlVisible=${controlVisible} muted ${before} → ${after} → ${restored} (headless audio output is not asserted)`,
        repro: 'toggle Sound in the HUD (Menu → Sound at narrow widths); the mute state must change and toggle back.',
      };
    },
    { severity: 'MINOR' }
  );

  await step(
    'ui-layout',
    'ui',
    'HUD fits the viewport without overflow',
    async () => {
      const st = await page.evaluate(() => {
        const root = document.querySelector('.sf-root');
        const hud = document.getElementById('sf-hud');
        const controls = document.getElementById('sf-controls');
        const r = controls?.getBoundingClientRect();
        return {
          scrollW: document.documentElement.scrollWidth,
          innerW: innerWidth,
          scrollH: document.documentElement.scrollHeight,
          innerH: innerHeight,
          controls: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] : null,
          rootVisible: !!root,
          hudDisplay: hud ? getComputedStyle(hud).display : null,
        };
      });
      const fits = st.controls && st.controls[0] >= -2 && st.controls[2] <= st.innerW + 2 && st.controls[1] >= -2 && st.controls[3] <= st.innerH + 2;
      return {
        ok: st.scrollW <= st.innerW + 2 && fits && st.scrollH <= st.innerH + 2,
        severity: 'MAJOR',
        detail: JSON.stringify(st),
        repro: `at ${INT_W}x${INT_H} the HUD controls must stay inside the viewport without scrollbars.`,
      };
    },
    { severity: 'MAJOR' }
  );

  await step(
    'ui-responsive-hud',
    'ui',
    `responsive HUD layout at ${INT_W}px`,
    async () => {
      const st = await page.evaluate(() => {
        const vis = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 2 && r.height > 2;
        };
        return { narrow: innerWidth <= 820, nav: vis('.sf-nav'), menu: vis('.sf-mobile-menu'), innerW: innerWidth };
      });
      const ok = st.narrow ? !st.nav && st.menu : st.nav && !st.menu;
      return {
        ok,
        severity: 'MINOR',
        detail: JSON.stringify(st),
        repro: 'at ≤820 px the desktop nav is replaced by the Menu button; above 820 px the reverse.',
      };
    },
    { severity: 'MINOR' }
  );

  // HUD legibility evidence at the interaction viewport.
  try {
    await closeSheet();
    await sleep(200);
    await capture(page, '19-ui-hud-800', { phase: 'ui' });
  } catch {
    /* evidence is best-effort */
  }

  await step(
    'ui-pointerlock-fallback',
    'ui',
    'clicking the view does not break the experience (pointer-lock fallback)',
    async () => {
      await api.setMode(page, 'walk');
      await sleep(300);
      await page.mouse.click(INT_W / 2, INT_H / 2);
      await sleep(600);
      const st = await page.evaluate(() => ({
        locked: !!document.pointerLockElement,
        toast: document.getElementById('sf-toast')?.textContent || '',
        errors: (window.__errors || []).length,
        enabled: window.__sagrada.experienceAPI?.controls?.isEnabled?.(),
      }));
      const before = (await api.view(page)).pos;
      await holdKey(page, 'KeyW', 700);
      const after = (await api.view(page)).pos;
      return {
        ok: st.enabled && st.errors === 0 && dist(before, after) > 0.2,
        severity: 'MINOR',
        detail: `locked=${st.locked} toast="${st.toast}" moved=${dist(before, after).toFixed(2)} m`,
        repro: 'click the canvas in headless; pointer lock is unavailable, so the drag fallback must leave the app usable.',
      };
    },
    { severity: 'MINOR' }
  );
}

// ============================================================================
// SECTION — URL parameters / debug surface
// ============================================================================
async function sectionURLParams(browser) {
  log('\n[+] URL parameters');
  // (a) skipSplash + mode + pos + look + time + ui
  {
    const page = await newPage(browser, { width: INT_W, height: INT_H });
    const ok = await step(
      'url-params-pose',
      'urlparams',
      'URL params skipSplash/mode/pos/look/time/ui are honoured',
      async () => {
        await goto(page, `${BASE}?skipSplash=1&mode=walk&pos=10,2,60&look=0,2,0&time=21.5&ui=0&hud=0`);
        const ready = await waitReady(page);
        if (!ready.ok) return { ok: false, severity: 'MAJOR', detail: `boot failed with params: ${ready.error}`, repro: 'load /?skipSplash=1&mode=walk&pos=10,2,60&look=0,2,0&time=21.5&ui=0&hud=0' };
        // Cold-start camera/pose settling can take ~12 s (Lead's note), so wait for
        // the authored pose to converge instead of asserting after a fixed sleep.
        const poseSettled = await page
          .waitForFunction(
            () => {
              const v = window.__sagrada?.view?.();
              if (!v) return false;
              return Math.hypot(v.pos[0] - 10, v.pos[1] - 2, v.pos[2] - 60) < 1.2;
            },
            null,
            { timeout: 25000, polling: 250 }
          )
          .then(() => true)
          .catch(() => false);
        await sleep(500);
        const st = await page.evaluate(() => ({
          mode: window.__sagrada.getMode(),
          pos: window.__sagrada.view().pos,
          time: window.__sagrada.stats().time,
          night: window.__app.env.night,
          allHidden: document.querySelector('.sf-root')?.classList.contains('is-hidden-all'),
          hudHidden: document.querySelector('.sf-root')?.classList.contains('is-hud-hidden'),
          splashHidden: (() => {
            const el = document.getElementById('sf-splash');
            return !el || el.hidden || getComputedStyle(el).display === 'none';
          })(),
        }));
        const posOk = dist(st.pos, [10, 2, 60]) < 1.2;
        return {
          ok: st.mode === 'walk' && posOk && Math.abs(st.time - 21.5) < 0.05 && st.allHidden && st.splashHidden,
          severity: 'MAJOR',
          detail: JSON.stringify({ ...st, pos: st.pos.map((n) => +n.toFixed(2)), poseSettled }),
          repro: 'load the app with the documented QA URL params; mode/pose/time/UI must follow them (pose may take ~12 s to settle on a cold start).',
        };
      },
      { severity: 'MAJOR' }
    );
    await closePage(page);
    if (!ok) log('  ! URL pose params test failed');
  }

  // (b) tour param
  {
    const page = await newPage(browser, { width: INT_W, height: INT_H });
    await step(
      'url-params-tour',
      'urlparams',
      'URL params mode=tour&tour=<id> start the tour at that stop',
      async () => {
        await goto(page, `${BASE}?skipSplash=1&mode=tour&tour=nave&time=10.35`);
        const ready = await waitReady(page);
        if (!ready.ok) return { ok: false, severity: 'MAJOR', detail: `boot failed: ${ready.error}`, repro: 'load /?skipSplash=1&mode=tour&tour=nave' };
        await sleep(1200);
        const st = await page.evaluate(() => ({
          mode: window.__sagrada.getMode(),
          title: document.querySelector('[data-tour-title]')?.textContent || '',
          panel: (() => {
            const el = document.getElementById('sf-tour');
            return !!el && !el.hidden;
          })(),
          index: window.__sagrada.experienceAPI?.tour?.getIndex?.(),
        }));
        return {
          ok: st.mode === 'tour' && st.panel && st.title.length > 2 && st.index >= 0,
          severity: 'MAJOR',
          detail: JSON.stringify(st),
          repro: 'load with ?mode=tour&tour=nave; the tour must open on the nave caption.',
        };
      },
      { severity: 'MAJOR' }
    );
    await closePage(page);
  }

  // (c) photo param
  {
    const page = await newPage(browser, { width: INT_W, height: INT_H });
    await step(
      'url-params-photo',
      'urlparams',
      'URL param photo=1 starts in photo mode',
      async () => {
        await goto(page, `${BASE}?skipSplash=1&photo=1`);
        const ready = await waitReady(page);
        if (!ready.ok) return { ok: false, severity: 'MINOR', detail: `boot failed: ${ready.error}`, repro: 'load /?skipSplash=1&photo=1' };
        await sleep(900);
        const st = await page.evaluate(() => ({
          photo: document.querySelector('.sf-root')?.classList.contains('is-photo'),
          hud: getComputedStyle(document.getElementById('sf-hud')).display,
          mode: window.__sagrada.getMode(),
        }));
        return {
          ok: st.photo && st.hud === 'none' && (st.mode === 'walk' || st.mode === 'fly'),
          severity: 'MINOR',
          detail: JSON.stringify(st),
          repro: 'load with ?photo=1; the interface must start hidden.',
        };
      },
      { severity: 'MINOR' }
    );
    await closePage(page);
  }
}

// ============================================================================
// SECTION — capture pass (hero 1600x900, stops 1280x720) + performance
// ============================================================================
async function setViewport(page, w, h) {
  const cur = page.viewportSize();
  if (cur && cur.width === w && cur.height === h) return;
  await page.setViewportSize({ width: w, height: h });
  await page
    .waitForFunction(
      ([w, h]) => {
        const c = document.querySelector('canvas');
        return !!c && Math.abs(c.width - w) <= 2 && Math.abs(c.height - h) <= 2;
      },
      [w, h],
      { timeout: 10000, polling: 100 }
    )
    .catch(() => {});
  await sleep(650);
}

async function poseShot(page, name, { kind = 'day', pos, look, subdir = '', hero = false, perf = false } = {}) {
  await setViewport(page, hero ? HERO_W : CAP_W, hero ? HERO_H : CAP_H);
  if (pos) {
    await api.setPose(page, pos, look);
    await sleep(900);
  }
  const res = await capture(page, name, { kind, subdir });
  const verdict = await step(
    `shot-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    'capture',
    `screenshot ${name} is a live render (not black/blank)`,
    async () => {
      const live = res.error ? res.error : shotIsLive(res.stats, kind);
      return { ok: !live, severity: 'MAJOR', detail: `${JSON.stringify(res.stats)}${live ? ' — ' + live : ''}`, shots: [res.file], repro: `inspect ${res.file}; a black/blank frame means the scene is missing at this pose.` };
    },
    { severity: 'MAJOR' }
  );
  if (perf) {
    const st = await api.stats(page);
    R.perf.push({
      label: name,
      quality: st.quality,
      fps: st.fps,
      sampleFps: [st.fps],
      calls: st.calls,
      triangles: st.triangles,
      geometries: st.geometries,
      textures: st.textures,
      time: st.time,
      viewport: `${hero ? HERO_W : CAP_W}x${hero ? HERO_H : CAP_H}`,
    });
  }
  return { res, verdict };
}

async function sectionCapture(browser) {
  log('\n[9/9] capture pass (hero 1600×900, stops 1280×720) + performance');
  await mkdir(STOP_SHOTS, { recursive: true });
  const page = await newPage(browser, { width: CAP_W, height: CAP_H, dsf: 1 });
  try {
    // ---- splash at hero size, then enter
    await goto(page, BASE);
    const ready = await waitReady(page);
    if (!ready.ok) {
      const snap = await bootFailureSnapshot(page);
      const b = await capture(page, 'fail-capture-boot', { phase: 'capture' });
      fail('capture-boot', 'capture', 'capture pass booted at hero size', `boot failed: ${ready.error} errors=${JSON.stringify(snap.errors)}`, {
        severity: 'BLOCKER',
        shots: [b.file],
        repro: 'load / at hero capture size',
      });
      return;
    }
    await page
      .waitForFunction(() => {
        const l = document.getElementById('loader');
        return !l || l.classList.contains('hidden') || getComputedStyle(l).display === 'none';
      }, null, { timeout: 20000, polling: 200 })
      .catch(() => {});
    await sleep(600);
    await capture(page, '01-splash', { phase: 'capture' });
    // The rest of the set is lighter: 1280x720.
    await setViewport(page, CAP_W, CAP_H);
    await page.click('[data-splash="walk"]', { timeout: 15000 }).catch(() => {});
    await page
      .waitForFunction(() => window.__sagrada.experienceAPI?.controls?.isEnabled?.() === true, null, { timeout: 30000, polling: 150 })
      .catch(() => {});
    await sleep(600);

    // Capture poses sit at height or float away from the ground, so use fly mode;
    // walking mode would immediately drop the camera to the walkable ground.
    await api.setMode(page, 'fly').catch(() => {});
    await sleep(500);

    // ---- key poses (hero frames at 1600x900, the rest at 1280x720) ---------
    const poses = [
      { name: '02-exterior-3q', pos: [95, 26, 110], look: [0, 55, 0], kind: 'day', hero: true, perf: true },
      { name: '03-facade-nativity', pos: [52, 12, 2], look: [30, 26, 0], kind: 'day' },
      { name: '04-facade-passion', pos: [-52, 12, 2], look: [-30, 26, 0], kind: 'day' },
      { name: '05-facade-glory', pos: [0, 14, 62], look: [0, 32, 45], kind: 'day' },
      { name: '06-nave-interior', pos: [0, 2.1, 39], look: [0, 24, -8], kind: 'interior', hero: true },
      { name: '07-crossing', pos: [2.5, 2.1, 8], look: [0, 51, 0], kind: 'interior', hero: true },
      // Altar moved to z≈-36 with four diagonal baldachin columns; frame the
      // sanctuary from the crossing side so altar + baldachin + apse read.
      { name: '08-altar', pos: [0, 3.4, -24], look: [0, 11, -42], kind: 'interior' },
      { name: '09-apse', pos: [0, 3.0, -42], look: [0, 14, -64], kind: 'interior' },
      // Towers + the large gold cross: frame the upper temple so the cross crown
      // (tip 172.5 m) is inside the frame.
      { name: '10-towers', pos: [88, 138, 100], look: [0, 145, 0], kind: 'day' },
      { name: '11-aerial-plan', pos: [74, 196, 82], look: [0, 92, 0], kind: 'day' },
    ];
    for (const p of poses) {
      await poseShot(page, p.name, { kind: p.kind, pos: p.pos, look: p.look, hero: !!p.hero, perf: !!p.perf });
    }

    // ---- night exterior + interior (hero frames) --------------------------
    await api.setTime(page, 21.5);
    await sleep(1400);
    await poseShot(page, '12-night-exterior', { kind: 'night', pos: [95, 24, 112], look: [0, 62, 0], hero: true, perf: true });
    await poseShot(page, '13-night-interior', { kind: 'night', pos: [0, 2.1, 39], look: [0, 24, -8], hero: true });
    await api.setTime(page, 10.35);
    await sleep(900);

    // ---- tour caption -----------------------------------------------------
    await setViewport(page, CAP_W, CAP_H);
    await api.startTour(page, 'nativity');
    // Wait for the travel animation to finish (phase 'dwell') so the caption is
    // readable and the façade behind it is framed, not a mid-transition blur.
    await page
      .waitForFunction(() => window.__sagrada.experienceAPI?.tour?.getState?.().phase === 'dwell', null, {
        timeout: 20000,
        polling: 150,
      })
      .catch(() => {});
    await sleep(700);
    const tourCap = await capture(page, '14-tour-caption', { phase: 'capture' });
    await step(
      'shot-tour-caption',
      'capture',
      'screenshot 14-tour-caption is a live render with caption visible',
      async () => {
        const txt = await page.evaluate(() => ({
          title: document.querySelector('[data-tour-title]')?.textContent || '',
          panel: (() => {
            const el = document.getElementById('sf-tour');
            return !!el && !el.hidden;
          })(),
        }));
        const live = shotIsLive(tourCap.stats, 'day');
        return { ok: !live && txt.panel && txt.title.length > 2, severity: 'MAJOR', detail: `${JSON.stringify(txt)} ${JSON.stringify(tourCap.stats)}`, shots: [tourCap.file] };
      },
      { severity: 'MAJOR' }
    );
    await closeOverlays(page);
    await sleep(500);

    // ---- hotspot card -----------------------------------------------------
    let hotspotShotDone = false;
    const hs = await api.hotspots(page).catch(() => []);
    const hsSorted = [...hs].sort((a, b) => a.position[1] - b.position[1]);
    for (const h of hsSorted.slice(0, 10)) {
      const [hx, hy, hz] = h.position;
      const off = Math.max(6, Math.min(12, (h.radius || 14) * 0.55));
      await api.setPose(page, [hx, 1.72, hz + off], [hx, hy, hz]).catch(() => {});
      await sleep(500);
      const shown = await page.evaluate(() => {
        const el = document.getElementById('sf-hotspot');
        return !!el && !el.hidden;
      });
      if (shown) {
        await page.keyboard.press('KeyE');
        await sleep(600);
        const open = await page.evaluate(() => ({
          modal: (() => {
            const el = document.getElementById('sf-modal');
            return !!el && !el.hidden;
          })(),
          title: document.querySelector('[data-card-title]')?.textContent || '',
        }));
        if (open.modal) {
          const cardShot = await capture(page, '15-hotspot-card', { phase: 'capture' });
          await step(
            'shot-hotspot-card',
            'capture',
            'screenshot 15-hotspot-card shows the open info card',
            async () => {
              const live = shotIsLive(cardShot.stats, 'day');
              return { ok: !live && open.title.length > 1, severity: 'MAJOR', detail: `title="${open.title}" ${JSON.stringify(cardShot.stats)}`, shots: [cardShot.file] };
            },
            { severity: 'MAJOR' }
          );
          await page.keyboard.press('Escape');
          await sleep(400);
          hotspotShotDone = true;
          break;
        }
      }
    }
    if (!hotspotShotDone) {
      fail('shot-hotspot-card', 'capture', 'screenshot 15-hotspot-card shows the open info card', `could not open a hotspot card at ${CAP_W}x${CAP_H}`, { severity: 'MAJOR', repro: 'aim at a hotspot, press E' });
    }

    // ---- minimap ----------------------------------------------------------
    await api.setPose(page, [0, 2.1, 39], [0, 24, -8]).catch(() => {});
    await sleep(500);
    await page.keyboard.press('KeyM');
    await sleep(700);
    const mapShot = await capture(page, '16-minimap', { phase: 'capture' });
    await step(
      'shot-minimap',
      'capture',
      'screenshot 16-minimap shows the plan panel',
      async () => {
        const st = await page.evaluate(() => {
          const el = document.getElementById('sf-map');
          return { visible: !!el && !el.hidden };
        });
        const live = shotIsLive(mapShot.stats, 'day');
        return { ok: !live && st.visible, severity: 'MINOR', detail: JSON.stringify(st), shots: [mapShot.file] };
      },
      { severity: 'MINOR' }
    );
    await page.keyboard.press('KeyM');
    await sleep(400);

    // ---- photo mode clean render -----------------------------------------
    await api.setPose(page, [0, 2.1, 39], [0, 24, -8]).catch(() => {});
    await sleep(500);
    await page.keyboard.press('KeyP');
    await sleep(700);
    const photoShot = await capture(page, '17-photo-mode', { phase: 'capture', kind: 'interior' });
    await step(
      'shot-photo-mode',
      'capture',
      'screenshot 17-photo-mode is a clean render with no HUD',
      async () => {
        const st = await page.evaluate(() => ({
          photo: document.querySelector('.sf-root')?.classList.contains('is-photo'),
          hud: getComputedStyle(document.getElementById('sf-hud')).display,
        }));
        const live = shotIsLive(photoShot.stats, 'interior');
        return { ok: !live && st.photo && st.hud === 'none', severity: 'MINOR', detail: JSON.stringify(st), shots: [photoShot.file] };
      },
      { severity: 'MINOR' }
    );
    await page.keyboard.press('KeyP');
    await sleep(400);

    // ---- every TOUR stop at 1280x720 + per-stop render stats --------------
    await setViewport(page, CAP_W, CAP_H);
    const stops = await page.evaluate(() => window.__app.TOUR.map((s) => ({ id: s.id, pos: s.pos, mode: s.mode })));
    for (const s of stops) {
      const ok = await api.teleport(page, s.id).catch(() => false);
      await sleep(1000);
      const st = await api.stats(page);
      R.perf.push({
        label: `TOUR stop: ${s.id}`,
        stop: s.id,
        quality: st.quality,
        fps: st.fps,
        sampleFps: [st.fps],
        calls: st.calls,
        triangles: st.triangles,
        geometries: st.geometries,
        textures: st.textures,
        time: st.time,
        viewport: `${CAP_W}x${CAP_H}`,
      });
      // name is relative to the subdir: capture() joins shots/<subdir>/<name>
      const name = `${String(stops.indexOf(s) + 1).padStart(2, '0')}-${s.id}`;
      const res = await capture(page, name, { phase: 'stops', kind: s.mode === 'walk' ? 'interior' : 'day', subdir: 'stops' });
      const live = res.error ? res.error : shotIsLive(res.stats, s.mode === 'walk' ? 'interior' : 'day');
      // register a compact per-stop record; failures go to the report table
      if (live) {
        fail(`stop-shot-${s.id}`, 'capture', `tour stop ${s.id} renders`, live, { severity: 'MAJOR', shots: [res.file], repro: `teleport('${s.id}') then screenshot at ${CAP_W}x${CAP_H}` });
      } else {
        pass(`stop-shot-${s.id}`, 'capture', `tour stop ${s.id} renders`, `teleport=${ok} ${fmt(st.calls)} calls / ${fmt(st.triangles)} tris / ${st.fps} fps`, { shots: [res.file] });
      }
    }

    // ---- low-quality comparison at the nave -------------------------------
    await page.click('[data-act="quality"]', { timeout: 10000 }).catch(() => {});
    await sleep(300);
    await page.click('[data-quality="low"]', { timeout: 10000 }).catch(() => {});
    await sleep(1800);
    await api.teleport(page, 'nave').catch(() => {});
    await sleep(1600);
    const lowStats = await api.stats(page);
    R.perf.push({
      label: 'nave (low quality)',
      stop: 'nave',
      quality: lowStats.quality,
      fps: lowStats.fps,
      sampleFps: [lowStats.fps],
      calls: lowStats.calls,
      triangles: lowStats.triangles,
      geometries: lowStats.geometries,
      textures: lowStats.textures,
      time: lowStats.time,
      viewport: `${CAP_W}x${CAP_H}`,
    });

    const fpsList = R.perf.filter((p) => p.quality === 'high').map((p) => p.fps);
    const bestFps = fpsList.length ? Math.max(...fpsList) : 0;
    const worstFps = fpsList.length ? Math.min(...fpsList) : 0;
    await step(
      'perf-fps',
      'perf',
      'frame rate is workable at capture resolution',
      async () => ({
        ok: bestFps >= 24,
        severity: 'MINOR',
        detail: `high-quality fps ${worstFps}–${bestFps} across ${R.perf.length} sampled poses/stops (headless GPU via ANGLE/D3D11; compare relative numbers)`,
        repro: 'capture pass; fps comes from window.__app.env.fps via __sagrada.stats()',
      }),
      { severity: 'MINOR' }
    );
  } finally {
    await closePage(page);
  }
}

// ============================================================================
// SECTION — mobile viewport
// ============================================================================
async function sectionMobile(browser) {
  log('\n[10/10] mobile viewport 390x844');
  const page = await newPage(browser, { width: MOB_W, height: MOB_H, mobile: true, touch: true, dsf: 2 });
  try {
    // NOTE: the mobile page must be navigated to the app first (it starts on
    // about:blank in a fresh context).
    await goto(page, BASE);
    // A fresh browser is launched for this section (see main), but retry once by
    // reloading if the app does not reach ready — this also distinguishes a real
    // app boot failure from a transient renderer/GPU hiccup.
    let ready = await waitReady(page, 45000);
    if (!ready.ok) {
      log('  ! mobile boot did not reach ready; reloading once…');
      await page.reload({ waitUntil: 'load', timeout: 90000 }).catch(() => {});
      ready = await waitReady(page, 60000);
    }
    await step(
      'mobile-boot',
      'mobile',
      'app boots at 390x844 with touch pointer',
      async () => {
        if (!ready.ok) {
          const snap = await bootFailureSnapshot(page);
          const b = await capture(page, 'fail-mobile-boot', { phase: 'mobile' });
          return {
            ok: false,
            severity: 'BLOCKER',
            detail: `boot failed after one reload retry: ${ready.error} | url=${snap.url || '?'} ready=${snap.ready} uiReady=${snap.uiReady} fatal=${snap.fatal} loader=${snap.loaderClass}/${snap.loaderDisplay} canvas=${JSON.stringify(snap.canvas)} errors=${JSON.stringify(snap.errors)}`,
            shots: [b.file],
            repro: 'boot at 390x844 mobile emulation; the harness retries once with a page reload.',
          };
        }
        await sleep(600);
        const href = page.url();
        const st = await page.evaluate(() => ({
          touch: matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0,
          isTouchClass: document.querySelector('.sf-root')?.classList.contains('is-touch'),
          scrollW: document.documentElement.scrollWidth,
          innerW: innerWidth,
          canvas: (() => {
            const c = document.querySelector('canvas');
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return [Math.round(r.width), Math.round(r.height), c.width, c.height];
          })(),
        }));
        return {
          ok: href === BASE && st.touch && st.isTouchClass && st.innerW === MOB_W && st.canvas && st.canvas[0] === MOB_W && st.canvas[1] === MOB_H && st.scrollW <= MOB_W + 2,
          severity: 'BLOCKER',
          detail: `href=${href} ${JSON.stringify(st)}`,
          repro: 'boot at 390x844 with touch emulation; the page must actually navigate to the app (href check), the canvas must fit and the touch UI must engage.',
        };
      },
      { severity: 'BLOCKER' }
    );
    if (!ready.ok) return;

    await step(
      'mobile-splash',
      'mobile',
      'mobile splash fits without horizontal overflow',
      async () => {
        const st = await page.evaluate(() => {
          const splash = document.getElementById('sf-splash');
          const inner = document.querySelector('.sf-splash-inner');
          const btns = Array.from(document.querySelectorAll('[data-splash]'));
          const r = inner?.getBoundingClientRect();
          return {
            splashVisible: !!splash && !splash.hidden && getComputedStyle(splash).display !== 'none',
            buttons: btns.length,
            innerW: r ? Math.round(r.width) : null,
            overflow: btns.some((b) => {
              const br = b.getBoundingClientRect();
              return br.right > innerWidth + 2 || br.left < -2;
            }),
            scrollW: document.documentElement.scrollWidth,
            innerViewportW: innerWidth,
          };
        });
        return {
          ok: st.splashVisible && st.buttons === 3 && !st.overflow && st.scrollW <= st.innerViewportW + 2,
          severity: 'MAJOR',
          detail: JSON.stringify(st),
          repro: 'load / at 390x844; the splash buttons must fit.',
        };
      },
      { severity: 'MAJOR' }
    );

    await step(
      'mobile-enter-touch-ui',
      'mobile',
      'entering on foot reveals the touch controls',
      async () => {
        await page.click('[data-splash="walk"]', { timeout: 15000 }).catch(() => {});
        await page
          .waitForFunction(() => window.__sagrada.experienceAPI?.controls?.isEnabled?.() === true, null, { timeout: 30000, polling: 150 })
          .catch(() => {});
        await sleep(600);
        const st = await page.evaluate(() => {
          const touch = document.getElementById('sf-touch');
          const joy = document.getElementById('sf-joystick');
          const btn = document.querySelector('.sf-touch-mode');
          return {
            mode: window.__sagrada.getMode(),
            touchVisible: !!touch && !touch.hidden && getComputedStyle(touch).display !== 'none',
            joystick: !!joy && joy.getBoundingClientRect().width > 20,
            flyButton: !!btn && btn.offsetParent !== null,
            isTouchClass: document.querySelector('.sf-root')?.classList.contains('is-touch'),
            scene: (() => {
              const app = window.__app;
              return app ? app.scene.children.length : 0;
            })(),
          };
        });
        const b = await capture(page, '18-mobile', { phase: 'mobile' });
        return {
          ok: st.mode === 'walk' && st.touchVisible && st.joystick && st.flyButton,
          severity: 'MAJOR',
          detail: JSON.stringify(st),
          shots: [b.file],
          repro: 'at 390x844 tap "Enter on foot"; joystick and fly/run touch controls must appear.',
        };
      },
      { severity: 'MAJOR' }
    );

    await step(
      'mobile-joystick',
      'mobile',
      'joystick drag moves the walker',
      async () => {
        const box = await page.locator('#sf-joystick').boundingBox();
        if (!box) return { ok: false, severity: 'MAJOR', detail: 'joystick has no box' };
        const before = (await api.view(page)).pos;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx, cy - Math.max(18, box.height * 0.3), { steps: 4 });
        await sleep(1100);
        await page.mouse.up();
        await sleep(300);
        const after = (await api.view(page)).pos;
        const moved = dist(before, after);
        return {
          ok: moved > 0.25,
          severity: 'MAJOR',
          detail: `moved ${moved.toFixed(2)} m after joystick drag`,
          repro: 'drag the on-screen joystick up; the walker must move forward.',
        };
      },
      { severity: 'MAJOR' }
    );

    await step(
      'mobile-no-overflow',
      'mobile',
      'no horizontal overflow and HUD fits in portrait',
      async () => {
        const st = await page.evaluate(() => {
          const controls = document.getElementById('sf-controls');
          const r = controls?.getBoundingClientRect();
          return {
            scrollW: document.documentElement.scrollWidth,
            innerW: innerWidth,
            controls: r ? [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)] : null,
          };
        });
        const fit = st.controls && st.controls[0] >= -2 && st.controls[1] <= st.innerW + 2 && st.controls[2] >= -2;
        return { ok: st.scrollW <= st.innerW + 2 && fit, severity: 'MAJOR', detail: JSON.stringify(st), repro: 'portrait 390x844: the HUD must not overflow the viewport.' };
      },
      { severity: 'MAJOR' }
    );
  } finally {
    await closePage(page);
  }
}

// ============================================================================
// Global health / final checks
// ============================================================================
async function sectionHealth() {
  const fatalPageErrors = R.pageErrors.filter((e) => !/PAGE CRASHED/.test(e.message));
  await step(
    'health-pageerrors',
    'health',
    'no uncaught page errors across the whole run',
    async () => ({
      ok: R.pageErrors.length === 0,
      severity: 'BLOCKER',
      detail: R.pageErrors.length ? R.pageErrors.map((e) => e.message.slice(0, 200)).join(' | ') : 'none',
      repro: 'pageerror events captured during the whole suite',
    }),
    { severity: 'BLOCKER' }
  );
  await step(
    'health-console-errors',
    'health',
    'no unexpected console errors (favicon 404 excluded)',
    async () => {
      const favicon404 = R.responses404.filter((u) => /favicon/i.test(u));
      const serious = R.console.filter(
        (l) => l.startsWith('[error]') && !(/Failed to load resource/i.test(l) && favicon404.length > 0) && !/favicon/i.test(l)
      );
      return {
        ok: serious.length === 0,
        severity: 'MINOR',
        detail: serious.length ? serious.slice(0, 8).join(' | ') : `none${favicon404.length ? ' (favicon 404 ignored)' : ''}`,
        repro: 'console errors during the suite',
      };
    },
    { severity: 'MINOR' }
  );
  await step(
    'health-request-failures',
    'health',
    'no failed asset requests (favicon excluded)',
    async () => {
      const bad = R.requestFailures.filter((u) => !/favicon/i.test(u));
      return { ok: bad.length === 0, severity: 'MAJOR', detail: bad.length ? bad.join(' | ') : 'none', repro: 'requestfailed events during the suite' };
    },
    { severity: 'MAJOR' }
  );
}

// ============================================================================
// Report
// ============================================================================
function verdictOf(tests) {
  const fails = tests.filter((t) => t.status === 'FAIL');
  const blockers = fails.filter((t) => t.severity === 'BLOCKER');
  const majors = fails.filter((t) => t.severity === 'MAJOR');
  if (blockers.length) return { verdict: 'FAIL — NOT SHIPPABLE', why: `${blockers.length} blocker defect(s)` };
  if (majors.length) return { verdict: 'FAIL — NEEDS WORK', why: `${majors.length} major defect(s)` };
  if (fails.length) return { verdict: 'PASS WITH NOTES', why: `${fails.length} minor defect(s)` };
  return { verdict: 'PASS', why: 'all executed checks passed' };
}

/**
 * Combined verdict: automated checks + curated visual defects. A verified
 * functional pass can still be "PASS WITH MAJOR NOTES" when the human review
 * found a significant visual defect, which keeps the report honest.
 */
function combinedVerdict(tests, curated = []) {
  const fails = tests.filter((t) => t.status === 'FAIL');
  const blockerTests = fails.filter((t) => t.severity === 'BLOCKER');
  const majorTests = fails.filter((t) => t.severity === 'MAJOR');
  const blockerCur = curated.filter((d) => d.severity === 'BLOCKER');
  const majorCur = curated.filter((d) => d.severity === 'MAJOR');
  const minorCur = curated.filter((d) => d.severity === 'MINOR');
  if (blockerTests.length || blockerCur.length) {
    return {
      verdict: 'FAIL — NOT SHIPPABLE',
      why: `${blockerTests.length} blocker check(s) and ${blockerCur.length} blocker visual defect(s)`,
    };
  }
  if (majorTests.length || majorCur.length) {
    return {
      verdict: 'PASS WITH MAJOR NOTES',
      why: `${fails.length} failed check(s), ${majorCur.length} major curated visual defect(s)`,
    };
  }
  if (fails.length || minorCur.length) {
    return { verdict: 'PASS WITH NOTES', why: `${fails.length} minor check(s), ${minorCur.length} minor curated visual defect(s)` };
  }
  return { verdict: 'PASS', why: 'all executed checks passed and no curated visual defects' };
}

async function writeResults() {
  R.meta.finishedAt = nowIso();
  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const t of R.tests) {
    if (t.status === 'PASS') counts.pass++;
    else if (t.status === 'FAIL') counts.fail++;
    else counts.skip++;
  }
  const payload = { ...R, counts, verdict: verdictOf(R.tests) };
  await writeFile(RESULTS_JSON, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

async function loadVisualNotes() {
  try {
    return JSON.parse(await readFile(VISUAL_NOTES, 'utf8'));
  } catch {
    return null;
  }
}

function perfTable(perf) {
  if (!perf.length) return '_No performance samples captured._\n';
  const head = '| Pose | Quality | FPS | Draw calls | Triangles | Geometries | Textures | Time | Viewport |\n|---|---|---|---|---|---|---|---|---|\n';
  const rows = perf
    .map(
      (p) =>
        `| ${mdEscape(p.label)} | ${p.quality} | ${p.fps} | ${fmt(p.calls)} | ${fmt(p.triangles)} | ${fmt(p.geometries)} | ${fmt(p.textures)} | ${Number(p.time).toFixed(2)} | ${p.viewport} |`
    )
    .join('\n');
  return head + rows + '\n';
}

function testTable(tests, groups) {
  const wanted = groups || [...new Set(tests.map((t) => t.group))];
  let out = '';
  let n = 0;
  for (const g of wanted) {
    const list = tests.filter((t) => t.group === g);
    if (!list.length) continue;
    out += `\n### ${g}\n\n| # | Check | Result | Detail |\n|---|---|---|---|\n`;
    for (const t of list) {
      n++;
      const res = t.status === 'PASS' ? '✅ pass' : t.status === 'FAIL' ? `❌ **fail** (${t.severity || 'MAJOR'})` : '⏭ skipped';
      out += `| ${n} | ${mdEscape(t.name)} | ${res} | ${mdEscape(t.detail).slice(0, 300)} |\n`;
    }
  }
  return out || '_No tests executed._\n';
}

function defectsSection(tests) {
  const fails = tests.filter((t) => t.status === 'FAIL');
  if (!fails.length) return '_No automated check failed in this run._\n';
  const order = { BLOCKER: 0, MAJOR: 1, MINOR: 2 };
  const sorted = [...fails].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  let out = '';
  for (const t of sorted) {
    out += `\n#### [${t.severity || 'MAJOR'}] ${mdEscape(t.name)}\n\n`;
    out += `- **Check:** \`${t.id}\` (${t.group})\n`;
    out += `- **Observed:** ${mdEscape(t.detail)}\n`;
    if (t.repro) out += `- **Exact repro:** ${mdEscape(t.repro)}\n`;
    if (t.shots && t.shots.length) out += `- **Evidence:** ${t.shots.map((s) => `[${path.basename(s)}](${s})`).join(', ')}\n`;
  }
  return out;
}

function shotsSection(shots = R.shots) {
  if (!shots.length) return '_No screenshots captured._\n';
  const main = shots.filter((s) => !s.file.includes('/stops/'));
  const stops = shots.filter((s) => s.file.includes('/stops/'));
  let out = '\n| Screenshot | Size | Pixels (mean / std / max) | Notes |\n|---|---|---|---|\n';
  for (const s of main) {
    const st = s.stats ? `${s.stats.mean} / ${s.stats.std} / ${s.stats.max}` : '—';
    const size = s.stats && s.stats.w ? `${s.stats.w}×${s.stats.h}` : '—';
    out += `| [${s.name}](${s.file}) | ${size} | ${st} | ${s.error ? mdEscape(s.error) : ''} |\n`;
  }
  if (stops.length) {
    out += `\n**Every TOUR stop (${CAP_W}×${CAP_H}):**\n\n`;
    out += stops.map((s) => `[${s.name}](${s.file})`).join(' · ') + '\n';
  }
  return out;
}

async function writeReport() {
  let results = R;
  if (REPORT_ONLY) {
    try {
      results = JSON.parse(await readFile(RESULTS_JSON, 'utf8'));
    } catch (e) {
      throw new Error(`SF_REPORT_ONLY=1 but ${RESULTS_JSON} could not be read: ${e.message}`);
    }
  }
  const notes = await loadVisualNotes();
  const tests = results.tests || [];
  const curatedDefects = notes && Array.isArray(notes.defects) ? notes.defects : [];
  // The Lead's published verdict is the authoritative functional verdict; the
  // curated visual defects are listed separately in the report.
  const verdict = results.verdict || combinedVerdict(tests, curatedDefects);
  const counts = results.counts || { pass: 0, fail: 0, skip: 0 };
  const shotsFiles = (results.shots || []).map((s) => s.file);
  const failedShots = (results.shots || []).filter((s) => {
    const l = shotIsLive(s.stats, s.kind || 'day');
    return !!l;
  });
  const meta = results.meta || {};

  const groupsOrder = ['boot', 'splash', 'walk', 'collision', 'doors', 'fly', 'teleport', 'tour', 'hotspots', 'time', 'ui', 'urlparams', 'capture', 'perf', 'mobile', 'health'];
  const present = [...new Set(tests.map((t) => t.group))];
  const orderedGroups = [...groupsOrder.filter((g) => present.includes(g)), ...present.filter((g) => !groupsOrder.includes(g))];

  const coverage = `
## Coverage and limitations

What this harness verifies automatically:
- boot through the real app, builder error surface (\`window.__sagrada.errors()\`), all five builder groups present
- splash UI and the "Enter on foot" path
- walking, eye height, jump, collision against the Nativity façade wall / apostle tower / crossing column
- passability of the three open façade doors (Nativity, Passion, Glory)
- fly mode toggle, rise and boost
- \`teleport()\` to every TOUR stop, plus screenshots of every stop (${CAP_W}×${CAP_H}) and five hero frames (${HERO_W}×${HERO_H})
- guided tour start / advance / pause / exit and captions
- hotspot reticle, E-to-open info card and Escape to close
- day/night state (\`env.time\`, \`env.night\`, HUD clock, slider) and non-black night render
- plan/minimap, help, photo mode, \`hideUI\`, quality low/high, sound toggle presence, HUD overflow
- the documented QA URL parameters (skipSplash, mode, pos, look, time, ui, tour, photo)
${meta.mobileSectionDropped
    ? '- **Mobile section:** dropped from this final run per user request; independently verified by the Lead — ready/uiReady true, 390×844 canvas, touch UI active, no errors (`qa/mobile-check.png`, `qa/mobile-check.txt`).'
    : '- mobile 390×844 boot, splash fit, touch controls and joystick movement'}
- frame rate / draw calls / triangles at key poses (final-build fast pass) and per TOUR stop (full matrix run)
- console errors, uncaught page errors and failed requests across the run

What the fast-pass final artifacts cover (recorded in \`meta.fastPassNotes\`):
- boot, all five builder groups, builder-error surface and a full NaN/Inf geometry scan on the final build
- final-build captures: 06-nave-interior, 07-crossing, 08-altar, 13-night-interior, 14-tour-caption and all 12 TOUR stops
- note: the interaction matrix and the remaining exterior/UI captures were produced on the build immediately before the final Glory-wall transform fix; the cross-cutting functional results stand, and the affected interior/exterior hero frames were re-shot on the final build.

Not covered (impossible or deliberately out of scope in headless QA):
- **Audio output** — headless Edge has no audible device; only the mute toggle state is checked.
- **Pointer lock** — headless browsers deny it; the drag-look fallback is exercised instead, and a manual desktop pass should confirm mouse capture.
- **Real-GPU visual quality at full window size** — captures are headless (hero ${HERO_W}×${HERO_H}, stops ${CAP_W}×${CAP_H}); tone mapping/shadows are GPU-correct but a human should confirm on a desktop session.
- **Subjective art direction** — an automated harness can prove a frame is not black, not that it is beautiful; see the visual review section.
- **Long-play stress** — memory growth over a prolonged session is not measured.
- **Cross-browser** — Edge/Chromium only.
- **Collision completeness** — only three representative colliders are probed; a full collider audit is not attempted.
`;

  const checklist = notes && Array.isArray(notes.checklist) ? notes.checklist : [];
  const checklistMd = checklist.length
    ? `\n### Review checklist (themes to verify)\n\n${checklist.map((c) => `- ${c}`).join('\n')}\n`
    : '';

  const visual = notes
    ? `
## Visual review (curated)

${notes.critique ?? '_No critique recorded yet._'}
${checklistMd}
${(notes.observations || [])
  .map(
    (o) =>
      `\n### ${o.title}${o.severity ? ` — ${o.severity}` : ''}\n\n${o.notes}\n${(o.shots || []).map((s) => `\n![${s}](${s})`).join('\n')}\n`
  )
  .join('\n')}
`
    : `
## Visual review (curated)

_Not yet recorded — inspect the screenshots with \`read_image\` and write \`qa/verify/visual-notes.json\`, then re-run with \`SF_REPORT_ONLY=1\`._
`;

  const defectList = notes && Array.isArray(notes.defects) && notes.defects.length
    ? notes.defects
        .map((d, i) => {
          const shots = (d.shots || []).map((s) => `[${path.basename(s)}](${s})`).join(', ');
          return `${i + 1}. **[${d.severity}] ${mdEscape(d.title)}** — ${mdEscape(d.notes)}${d.repro ? `\n   - repro: ${mdEscape(d.repro)}` : ''}${shots ? `\n   - evidence: ${shots}` : ''}`;
        })
        .join('\n')
    : '_No curated visual defects recorded._';

  const autoFails = tests.filter((t) => t.status === 'FAIL');
  const aborted = meta.aborted ? `\n> **RUN ABORTED:** ${meta.aborted}. Checks after the failing section were not executed.\n` : '';

  const gpu = meta.gpu ? `${meta.gpu.renderer || 'unknown'} / ${meta.gpu.vendor || ''}` : 'unknown';
  const md = `# Sagrada Família — independent QA report

**Verdict: ${verdict.verdict}** — ${verdict.why}

${aborted}
| | |
|---|---|
| Run started | ${meta.startedAt || '?'} |
| Run finished | ${meta.finishedAt || '?'} |
| App URL | ${meta.base || BASE} |
| Browser | ${meta.browser || 'Edge headless (real GPU / ANGLE D3D11)'} |
| GPU renderer | ${mdEscape(gpu)} |
| Viewports | interaction ${(meta.viewports?.interact || [INT_W, INT_H]).join('×')}, capture ${(meta.viewports?.capture || [CAP_W, CAP_H]).join('×')}, hero ${(meta.viewports?.hero || [HERO_W, HERO_H]).join('×')}, mobile ${(meta.viewports?.mobile || [MOB_W, MOB_H]).join('×')} |
| Static server | ${meta.portStartedByHarness ? 'started by harness' : 'already running'} on port ${PORT} |
| Final fast pass | ${meta.fastPassAt ? `${meta.fastPassAt} — boot/groups/NaN + final-build captures (mobile section dropped, see coverage)` : '—'} |

## Summary

| Checks | Count |
|---|---|
| Passed | ${counts.pass} |
| Failed | ${counts.fail} |
| Skipped | ${counts.skip} |
| Screenshots | ${shotsFiles.length} |

**Automated failures:** ${autoFails.length ? autoFails.map((f) => `\`${f.id}\` (${f.severity})`).join(', ') : 'none'}.
**Curated visual defects:** ${curatedDefects.length ? curatedDefects.map((d) => `\`${d.severity}\` ${mdEscape(d.title)}`).join('; ') : 'none'}.

## Pass / fail table
${testTable(tests, orderedGroups)}

## Automated defect list (prioritized)
${defectsSection(tests)}

## Curated visual / UX defects (prioritized)

${defectList}

## Performance

${perfTable(results.perf || [])}
_Headless Edge renders through ANGLE/D3D11 to an offscreen surface; these numbers are indicative, compare poses and the low-quality delta rather than absolute values._

## Screenshots

All screenshots are written under \`qa/verify/shots/\`. A frame that could not be verified as live is flagged below.

${shotsSection(results.shots || [])}
${visual}
${coverage}

---
_Generated by \`qa/verify/harness.mjs\` at ${nowIso()}. Machine-readable results: \`qa/verify/results.json\`. Curated notes: \`qa/verify/visual-notes.json\`._
`;
  await writeFile(REPORT_MD, md, 'utf8');
  log(`\n· wrote ${rel(REPORT_MD)}`);
  if (failedShots.length) {
    log(`! ${failedShots.length} screenshot(s) failed the live-frame check:`);
    for (const s of failedShots.slice(0, 10)) log(`    ${s.file} — ${shotIsLive(s.stats, s.kind || 'day')}`);
  }
  return md;
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  log('════════════════════════════════════════════════════════════════');
  log(' Sagrada Família — independent QA harness');
  log(` project: ${PROJECT}`);
  log(` output:  ${rel(HERE)}`);
  log('════════════════════════════════════════════════════════════════');

  if (REPORT_ONLY) {
    await writeReport();
    const results = JSON.parse(await readFile(RESULTS_JSON, 'utf8'));
    const v = results.verdict || verdictOf(results.tests);
    log(`verdict: ${v.verdict} — ${v.why}`);
    return;
  }

  // Lead's global pause switch. Checked before anything touches the renderer.
  if (existsSync(PAUSE_FILE)) {
    console.error('[qa] rendering is globally paused by the Lead (remove qa/.paused to resume)');
    process.exitCode = 3;
    return;
  }

  await mkdir(SHOTS, { recursive: true });
  await mkdir(STOP_SHOTS, { recursive: true });

  let serverProc = null;
  let browser = null;
  let lockHeld = null;
  // Refuse to start when another QA render holds the serialized lock. This is an
  // operational refusal, not a test failure: exit without writing a report.
  try {
    lockHeld = await acquireQALock();
  } catch (e) {
    console.error(`[qa] ${e.message}`);
    process.exitCode = e.exitCode || 4;
    return;
  }
  try {
    serverProc = await ensureServer();
    browser = await launchBrowser();
    log(`· browser launched (headless=${HEADLESS})`);

    // Interaction suite in a single 800x450 page (fast and light).
    const page = await newPage(browser, { width: INT_W, height: INT_H, dsf: 1 });
    let bootOk = false;
    try {
      await goto(page, BASE);
      bootOk = await sectionBootAndSplash(page);
      if (bootOk) {
        await sectionWalk(page);
        await sectionFly(page);
        await sectionTour(page);
        await sectionHotspots(page);
        await sectionTime(page);
        await sectionUI(page);
      }
    } finally {
      await closePage(page);
    }

    if (bootOk) {
      if (!SKIP_URLPARAMS) {
        try {
          await sectionURLParams(browser);
        } catch (e) {
          fail('urlparams-section', 'urlparams', 'URL parameter section completed', String(e.stack || e).slice(0, 800), { severity: 'MINOR' });
        }
      } else {
        skip('urlparams-section', 'urlparams', 'URL parameter checks', 'SF_SKIP_URLPARAMS=1');
      }

      if (!SKIP_CAPTURE) {
        try {
          await sectionCapture(browser);
        } catch (e) {
          fail('capture-section', 'capture', 'capture/performance section completed', String(e.stack || e).slice(0, 800), { severity: 'MAJOR' });
        }
      } else {
        R.meta.skipped.push('capture + performance (SF_SKIP_CAPTURE=1)');
        skip('capture-section', 'capture', 'capture + performance section', 'SF_SKIP_CAPTURE=1');
      }

      if (!SKIP_MOBILE) {
        try {
          // The mobile section runs in a fresh browser process: after ~35 hi-res
          // captures the shared GPU process can end up in a state where a new
          // context renders blank white. A re-launch avoids that flake and keeps
          // exactly one browser alive at a time.
          log('· closing the capture browser and launching a fresh one for the mobile section');
          await browser.close().catch(() => {});
          browser = null;
          browser = await launchBrowser();
          await sectionMobile(browser);
        } catch (e) {
          fail('mobile-section', 'mobile', 'mobile section completed', String(e.stack || e).slice(0, 800), { severity: 'MAJOR' });
        }
      } else {
        R.meta.skipped.push('mobile (SF_SKIP_MOBILE=1)');
        skip('mobile-section', 'mobile', 'mobile section', 'SF_SKIP_MOBILE=1');
      }

      await sectionHealth();
    } else {
      record({
        id: 'suite-aborted',
        group: 'health',
        name: 'suite aborted after boot failure',
        status: 'FAIL',
        severity: 'BLOCKER',
        detail: 'the app never reached window.__sagrada.ready, so no experience checks could run (walk/fly/tour/hotspots/time/UI/capture/mobile skipped)',
        repro: 'fix boot first — see the console/pageerror/builder-error output captured in the boot section and the fail-boot screenshot',
      });
    }
  } catch (e) {
    R.meta.aborted = String(e.message || e);
    log(`\n!! harness error: ${e.stack || e}`);
    try {
      fail('harness-error', 'health', 'harness executed without infrastructure errors', String(e.stack || e).slice(0, 1500), { severity: 'BLOCKER' });
    } catch {}
  } finally {
    await browser?.close().catch(() => {});
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {}
    }
    if (lockHeld) {
      await releaseQALock();
      log('· QA lock released');
    }
  }

  const results = await writeResults();
  if (NO_REPORT) {
    log('\n· REPORT.md not written (SF_NO_REPORT=1 phase run)');
    const fails = results.tests.filter((t) => t.status === 'FAIL');
    if (fails.length) {
      log(`\nFAILURES (${fails.length}):`);
      for (const f of fails) {
        log(`  [${f.severity}] ${f.id} — ${f.name}`);
        log(`      ${f.detail}`);
        if (f.shots && f.shots.length) log(`      evidence: ${f.shots.join(', ')}`);
      }
    }
  } else {
    await writeReport();
  }
  log('\n════════════════════════════════════════════════════════════════');
  log(` verdict: ${results.verdict.verdict} — ${results.verdict.why}`);
  log(` checks: ${results.counts.pass} passed, ${results.counts.fail} failed, ${results.counts.skip} skipped, ${results.shots.length} screenshots`);
  log(` results: ${rel(RESULTS_JSON)}`);
  log('════════════════════════════════════════════════════════════════');
  process.exitCode = results.counts.fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
