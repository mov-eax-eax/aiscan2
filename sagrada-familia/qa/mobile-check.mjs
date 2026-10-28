import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-sandbox', '--no-sandbox'],
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
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
await page.goto('http://127.0.0.1:8141/', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(20000);
const state = await page.evaluate(() => ({
  url: location.href,
  ready: window.__sagrada?.ready === true,
  uiReady: window.__sagrada?.uiReady === true,
  fatalHidden: document.getElementById('fatal')?.hidden,
  loader: document.getElementById('loader')?.className,
  canvas: (() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.width, r.height, c.width, c.height]; })(),
  touch: matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
  isTouch: document.querySelector('.sf-root')?.classList.contains('is-touch'),
  splash: !!document.querySelector('.sf-splash') && getComputedStyle(document.querySelector('.sf-splash')).opacity,
  errors: (window.__errors || []).slice(0, 3),
}));
console.log(JSON.stringify({ state, logs: logs.slice(0, 20) }, null, 2));
await page.screenshot({ path: path.join(root, 'qa', 'mobile-check.png'), fullPage: false });
await context.close();
await browser.close();
