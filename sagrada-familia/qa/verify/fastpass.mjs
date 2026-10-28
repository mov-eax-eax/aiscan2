// qa/verify/fastpass.mjs — FINAL FAST PASS (QA-only).
//
// Scope agreed with the Lead after the last shell/interior fixes:
//   boot + five builder groups + no builder errors + NaN scan
//   captures: nave interior, crossing, altar, night interior (hero sizes)
//   quick perf at nave/crossing
//   then patches qa/verify/results.json (drops the mobile section per user
//   request, refreshes those capture entries + adds fast-pass checks) so that
//   `SF_REPORT_ONLY=1 node qa/verify/harness.mjs` regenerates REPORT.md.
//
// One browser, one page, real GPU only (ANGLE D3D11, no SwiftShader flags).
// Respects qa/.paused and qa/.shot.lock exactly like the main harness.
//
//   node qa/verify/fastpass.mjs
//   SF_REPORT_ONLY=1 node qa/verify/harness.mjs   (after editing visual-notes.json)

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..', '..');
const QA_DIR = path.join(PROJECT, 'qa');
const SHOTS = path.join(HERE, 'shots');
const pauseFile = path.join(QA_DIR, '.paused');
const lockFile = path.join(QA_DIR, '.shot.lock');
const EDGE = process.env.SF_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = `http://127.0.0.1:${process.env.SF_PORT || 8145}/`;
const RESULTS = path.join(HERE, 'results.json');
const CAP_W = Number(process.env.SF_CAPTURE_W || 1280);
const CAP_H = Number(process.env.SF_CAPTURE_H || 720);
const HERO_W = Number(process.env.SF_HERO_W || 1600);
const HERO_H = Number(process.env.SF_HERO_H || 900);

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
        console.error('[qa] another render holds the QA lock; giving up');
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
const nowIso = () => new Date().toISOString();
const rel = (p) => path.relative(PROJECT, p).replace(/\\/g, '/');

const out = {
  startedAt: nowIso(),
  finishedAt: null,
  gpu: null,
  bootMs: null,
  tests: [],
  shots: [],
  perf: [],
  consoleErrors: [],
  pageErrors: [],
  fatal: null,
};
let browser;
let page;

function test(id, name, ok, detail, severity = 'MAJOR') {
  out.tests.push({ id, group: 'fastpass', name, status: ok ? 'PASS' : 'FAIL', detail, severity, repro: '', shots: [], ms: 0 });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  [fastpass] ${name} — ${detail}`);
  return ok;
}

function failFatal(msg) {
  out.fatal = msg;
  console.error(`[fastpass] FATAL: ${msg}`);
  test('fastpass-boot', 'app boots and reaches ready', false, msg, 'BLOCKER');
}

try {
  fs.mkdirSync(path.join(SHOTS, 'stops'), { recursive: true });
  browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-sandbox', '--no-sandbox', '--disable-dev-shm-usage'],
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: CAP_W, height: CAP_H },
    deviceScaleFactor: 1,
    locale: 'en-GB',
    timezoneId: 'Europe/Madrid',
  });
  page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => out.pageErrors.push(e.message));
  await page.bringToFront().catch(() => {});

  const t0 = Date.now();
  // skipSplash + fly: deterministic camera, no 2.4 s intro needed for captures.
  await page.goto(`${BASE}?skipSplash=1&mode=fly`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sagrada && window.__sagrada.ready === true && window.__sagrada.uiReady === true, null, {
    timeout: 120000,
    polling: 200,
  });
  out.bootMs = Date.now() - t0;
  test('fastpass-boot', 'app boots and reaches ready', true, `ready in ${out.bootMs} ms`, 'BLOCKER');

  out.gpu = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null };
  });
  test(
    'fastpass-renderer',
    'real GPU renderer (ANGLE D3D11, not SwiftShader)',
    /direct3d11|d3d11/i.test(String(out.gpu.renderer)) && !/swiftshader|llvmpipe/i.test(String(out.gpu.renderer)),
    String(out.gpu.renderer),
    'MAJOR'
  );

  const scene = await page.evaluate(() => {
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
    return { groups, errors: (window.__sagrada.errors ? window.__sagrada.errors() : []).map((e) => `${e.where}: ${String(e.message).slice(0, 200)}`) };
  });
  const gMissing = Object.entries(scene.groups)
    .filter(([, g]) => !g.present || g.meshes === 0)
    .map(([n, g]) => `${n}${g.present ? '(no meshes)' : '(missing)'}`);
  const gDetail = Object.fromEntries(Object.entries(scene.groups).map(([n, g]) => [n, `${g.meshes} meshes/${g.tris.toLocaleString('en-US')} tris`]));
  test('fastpass-builders', 'all five builder groups present and non-empty', gMissing.length === 0, gMissing.length ? gMissing.join(', ') : JSON.stringify(gDetail), 'BLOCKER');
  test('fastpass-no-builder-errors', 'no builder errors recorded', scene.errors.length === 0, scene.errors.length ? scene.errors.join(' || ') : 'none', 'BLOCKER');

  const nan = await page.evaluate(() => {
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
      let first = -1;
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (Number.isNaN(v)) {
          nan++;
          if (first < 0) first = i;
        } else if (!Number.isFinite(v)) nan++;
      }
      if (nan) bad.push({ mesh: o.name || '(unnamed)', parent: o.parent?.name || '', nan, vertices: pos.count, first });
    });
    return { meshes, vertices, badCount: bad.length, bad: bad.slice(0, 20) };
  });
  test(
    'fastpass-nan',
    'no NaN/Infinity geometry positions',
    nan && nan.badCount === 0,
    nan && nan.badCount
      ? `${nan.badCount} bad geometry(ies): ${nan.bad.map((b) => `${b.mesh}<${b.parent}> (${b.nan} NaN)`).join(', ')}`
      : `${nan.meshes} meshes / ${nan.vertices.toLocaleString('en-US')} vertices clean`,
    'MAJOR'
  );

  // ---- captures ------------------------------------------------------------
  async function setViewport(w, h) {
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
    await sleep(600);
  }

  async function pngStats(buffer) {
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
      const hist = new Array(16).fill(0);
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += l;
        sum2 += l * l;
        if (l < 6) dark++;
        if (l > max) max = l;
        hist[Math.min(15, Math.floor(l / 16))]++;
      }
      const mean = sum / n;
      const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      return { mean: +mean.toFixed(2), std: +std.toFixed(2), max: Math.round(max), darkFrac: +(dark / n).toFixed(3), levels: hist.filter((v) => v / n > 0.002).length, w: img.width, h: img.height };
    }, b64);
  }

  async function capture(name, { hero = false, kind = 'interior', recordTest = true } = {}) {
    await setViewport(hero ? HERO_W : CAP_W, hero ? HERO_H : CAP_H);
    const file = path.join(SHOTS, `${name}.png`);
    const buf = await page.screenshot({ path: file, timeout: 30000 });
    const stats = await pngStats(buf);
    const live = !stats || stats.mean < 3 || stats.std < 2.5 || stats.max < 55;
    out.shots.push({ name: `${name}.png`, file: rel(file), phase: 'fastpass', kind, stats, error: null });
    if (recordTest) {
      test(`fastpass-shot-${name}`, `capture ${name} is live (not black/blank)`, !live, JSON.stringify(stats), 'MAJOR');
    }
    return stats;
  }

  async function setPose(pos, look) {
    await page.evaluate(([p, l]) => window.__sagrada.setPose(p, l), [pos, look]);
    await sleep(900);
  }
  async function setTime(h) {
    await page.evaluate((h) => window.__sagrada.setTime(h), h);
    await sleep(1300);
  }
  const stats = () => page.evaluate(() => window.__sagrada.stats());

  const saved = [];

  await setPose([0, 2.1, 39], [0, 24, -8]);
  saved.push(await capture('06-nave-interior', { hero: true, kind: 'interior' }));
  saved.push(await capture('07-crossing', { hero: true, kind: 'interior' }));
  await setPose([0, 3.4, -24], [0, 11, -42]);
  saved.push(await capture('08-altar', { hero: false, kind: 'interior' }));

  // perf at nave + crossing (day)
  await setPose([0, 2.1, 39], [0, 24, -8]);
  await sleep(1200);
  const naveStats = await stats();
  await setPose([2.5, 2.1, 8], [0, 51, 0]);
  await sleep(1200);
  const crossStats = await stats();
  out.perf.push(
    { label: 'nave (day, final build)', quality: naveStats.quality, fps: naveStats.fps, calls: naveStats.calls, triangles: naveStats.triangles, geometries: naveStats.geometries, textures: naveStats.textures, time: naveStats.time, viewport: `${HERO_W}x${HERO_H}` },
    { label: 'crossing (day, final build)', quality: crossStats.quality, fps: crossStats.fps, calls: crossStats.calls, triangles: crossStats.triangles, geometries: crossStats.geometries, textures: crossStats.textures, time: crossStats.time, viewport: `${HERO_W}x${HERO_H}` }
  );
  test('fastpass-perf', 'render stats captured at nave + crossing', true, `nave ${naveStats.calls} calls/${naveStats.triangles} tris/${naveStats.fps} fps; crossing ${crossStats.calls} calls/${crossStats.triangles} tris/${crossStats.fps} fps`, 'MINOR');

  // Tour caption: re-captured after waiting for the stop arrival (the earlier
  // capture was taken mid-transition, a timing issue rather than a real blank).
  await page.evaluate(() => window.__sagrada.startTour('nativity')).catch(() => {});
  await page
    .waitForFunction(() => window.__sagrada.experienceAPI?.tour?.getState?.().phase === 'dwell', null, { timeout: 25000, polling: 150 })
    .catch(() => {});
  await sleep(700);
  saved.push(await capture('14-tour-caption', { hero: false, kind: 'day' }));
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(500);
  await page.evaluate(() => window.__sagrada.setMode('fly')).catch(() => {});
  await sleep(400);

  // Refresh every TOUR-stop screenshot on the final build (1280x720 each).
  await page.evaluate(() => window.__sagrada.setMode('fly')).catch(() => {});
  await sleep(400);
  const stops = await page.evaluate(() => window.__app.TOUR.map((s) => ({ id: s.id, mode: s.mode })));
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    await page.evaluate((id) => window.__sagrada.teleport(id), s.id).catch(() => {});
    await sleep(950);
    await setViewport(CAP_W, CAP_H);
    saved.push(await capture(`stops/${String(i + 1).padStart(2, '0')}-${s.id}`, { hero: false, kind: s.mode === 'walk' ? 'interior' : 'day', recordTest: false }));
  }

  // night interior last
  await setTime(21.5);
  await setPose([0, 2.1, 39], [0, 24, -8]);
  saved.push(await capture('13-night-interior', { hero: true, kind: 'night' }));

  // ---- patch results.json --------------------------------------------------
  let results = { meta: {}, tests: [], shots: [], perf: [], counts: {}, verdict: {} };
  if (fs.existsSync(RESULTS)) {
    try {
      results = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
    } catch (e) {
      console.error(`[fastpass] could not parse existing results.json: ${e.message}`);
    }
  }
  const dropped = [];
  results.tests = (results.tests || []).filter((t) => {
    if (t.group === 'mobile' || /^mobile-/.test(t.id || '')) {
      dropped.push(t.id);
      return false;
    }
    return true;
  });
  const replacedNames = new Set(out.shots.map((s) => s.name));
  results.shots = (results.shots || []).filter((s) => !replacedNames.has(s.name) && s.name !== '18-mobile.png');
  results.shots.push(...out.shots);
  // De-duplicate perf rows by label so repeated fast-pass runs replace, not append.
  const newLabels = new Set(out.perf.map((p) => p.label));
  results.perf = [...(results.perf || []).filter((p) => !newLabels.has(p.label)), ...out.perf];
  results.tests = (results.tests || []).filter((t) => !/^fastpass-/.test(t.id || ''));
  results.tests.push(...out.tests);
  results.meta = {
    ...(results.meta || {}),
    gpu: out.gpu,
    finishedAt: nowIso(),
    fastPassAt: nowIso(),
    fastPassBootMs: out.bootMs,
    mobileSectionDropped: true,
    mobileVerifiedExternally: 'qa/mobile-check.png + qa/mobile-check.txt (Lead)',
    fastPassNotes: 'Final shell/interior fix pass: boot, builder groups, NaN scan, nave/crossing/altar/night-interior captures, quick perf. Mobile section dropped per user request and verified externally.',
  };
  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const t of results.tests) {
    if (t.status === 'PASS') counts.pass++;
    else if (t.status === 'FAIL') counts.fail++;
    else counts.skip++;
  }
  results.counts = counts;
  const fails = results.tests.filter((t) => t.status === 'FAIL');
  const blockers = fails.filter((t) => t.severity === 'BLOCKER');
  const majors = fails.filter((t) => t.severity === 'MAJOR');
  results.verdict = blockers.length
    ? { verdict: 'FAIL — NOT SHIPPABLE', why: `${blockers.length} blocker defect(s)` }
    : majors.length
      ? { verdict: 'FAIL — NEEDS WORK', why: `${majors.length} major defect(s)` }
      : fails.length
        ? { verdict: 'PASS WITH NOTES', why: `${fails.length} minor defect(s)` }
        : { verdict: 'PASS', why: 'all executed checks passed' };
  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  out.results = { droppedMobileTests: dropped.length, replacedShots: [...replacedNames], counts, verdict: results.verdict };
  out.ok = out.tests.every((t) => t.status === 'PASS') && out.pageErrors.length === 0;
} catch (e) {
  failFatal(String((e && e.message) || e).slice(0, 1000));
  out.ok = false;
} finally {
  try {
    await browser?.close();
  } catch {
    /* ignore */
  }
  releaseLock();
  out.finishedAt = nowIso();
}

console.log(JSON.stringify(out, null, 2));
process.exitCode = out.ok ? 0 : 1;
