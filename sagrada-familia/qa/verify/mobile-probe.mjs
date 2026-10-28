// qa/verify/mobile-probe.mjs — isolate the mobile-boot failure (QA-only).
// One browser, one 390x844 isMobile/hasTouch page at dsf 2.
// Prints URL, title, HTTP status, console/pageerror, DOM/canvas state, screenshot.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..', '..');
const QA_DIR = path.join(PROJECT, 'qa');
const pauseFile = path.join(QA_DIR, '.paused');
const lockFile = path.join(QA_DIR, '.shot.lock');
const EDGE = process.env.SF_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_BASE = `http://127.0.0.1:${process.env.SF_PORT || 8145}/`;
const outFile = path.join(HERE, 'shots', 'mobile-probe.png');

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
const out = { url: null, title: null, httpStatus: null, console: [], pageErrors: [], requestFailures: [], ready: null, dom: null, screenshot: outFile };
let browser;
try {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-sandbox', '--no-sandbox', '--disable-dev-shm-usage'],
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
    timezoneId: 'Europe/Madrid',
  });
  const page = await context.newPage();
  page.on('console', (m) => out.console.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => out.pageErrors.push(e.message));
  page.on('requestfailed', (r) => out.requestFailures.push(`${r.url()} ${r.failure()?.errorText || ''}`));
  page.on('response', (r) => {
    if (r.url() === URL_BASE || r.url() === URL_BASE.replace(/\/$/, '')) out.httpStatus = r.status();
  });
  const t0 = Date.now();
  await page.goto(URL_BASE, { waitUntil: 'load', timeout: 60000 });
  out.gotoMs = Date.now() - t0;
  out.url = page.url();
  out.title = await page.title().catch(() => null);
  const ready = await Promise.race([
    page
      .waitForFunction(() => window.__sagrada && window.__sagrada.ready === true && window.__sagrada.uiReady === true, null, { timeout: 45000, polling: 200 })
      .then(() => true)
      .catch(() => false),
    sleep(50000).then(() => 'timeout'),
  ]);
  out.ready = ready;
  out.dom = await page
    .evaluate(() => ({
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyText: (document.body.innerText || '').slice(0, 200),
      hasLoader: !!document.getElementById('loader'),
      loaderDisplay: document.getElementById('loader') ? getComputedStyle(document.getElementById('loader')).display : null,
      hasCanvas: !!document.querySelector('canvas'),
      canvas: (() => {
        const c = document.querySelector('canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return [c.width, c.height, Math.round(r.width), Math.round(r.height)];
      })(),
      hasSagrada: !!window.__sagrada,
      sagradaReady: window.__sagrada?.ready ?? null,
      uiReady: window.__sagrada?.uiReady ?? null,
      errors: (window.__errors || []).map((e) => `${e.where}: ${String(e.message).slice(0, 200)}`),
      rootClasses: document.querySelector('.sf-root')?.className || null,
      isTouch: matchMedia('(pointer: coarse)').matches,
      vp: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
    }))
    .catch((e) => ({ evalError: String(e).slice(0, 300) }));
  await page.screenshot({ path: outFile });
} catch (e) {
  out.fatal = String(e.message || e).slice(0, 800);
} finally {
  try {
    await browser?.close();
  } catch {
    /* ignore */
  }
  releaseLock();
}
console.log(JSON.stringify(out, null, 2));
process.exitCode = out.ready === true ? 0 : 1;
