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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:8141/', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__sagrada?.ready && window.__sagrada?.uiReady, null, { timeout: 45000 });
await page.waitForTimeout(1200);
const out = path.join(root, 'qa', 'freefly');
fs.mkdirSync(out, { recursive: true });
const info = {};
info.splashFreeFlyLabel = await page.locator('[data-splash="fly"]').innerText();
await page.locator('[data-splash="fly"]').click();
await page.waitForTimeout(2500);
info.afterSplash = await page.evaluate(() => ({
  mode: window.__sagrada.getMode(),
  modeLabel: document.querySelector('[data-mode-label]')?.textContent,
  sub: document.querySelector('[data-mode-sub]')?.textContent,
  flySpeed: window.__sagrada.experienceAPI.getFlySpeed?.(),
}));
await page.screenshot({ path: path.join(out, '01-free-fly.png') });

// Space should rise in free fly
const y0 = await page.evaluate(() => window.__sagrada.view().pos[1]);
await page.keyboard.down('Space');
await page.waitForTimeout(900);
await page.keyboard.up('Space');
const y1 = await page.evaluate(() => window.__sagrada.view().pos[1]);
info.spaceRise = { y0, y1, ok: y1 > y0 + 1 };

// Wheel should change the speed scale (dispatch on the canvas).
await page.mouse.move(640, 360);
await page.mouse.wheel(0, -400);
await page.waitForTimeout(300);
info.speedAfterWheel = await page.evaluate(() => window.__sagrada.experienceAPI.getFlySpeed?.());

// R resets the free-fly view
await page.keyboard.press('KeyR');
await page.waitForTimeout(700);
info.afterReset = await page.evaluate(() => ({ pos: window.__sagrada.view().pos, mode: window.__sagrada.getMode() }));
await page.screenshot({ path: path.join(out, '02-free-fly-reset.png') });

// Study: mesh (move close so individual triangles are legible)
await page.evaluate(() => {
  window.__sagrada.setMode('fly');
  window.__sagrada.setPose([0, 55, 95], [0, 52, 0]);
  window.__sagrada.setStudy('mesh', true);
});
await page.waitForTimeout(1500);
info.mesh = await page.evaluate(() => window.__sagrada.studyState());
await page.screenshot({ path: path.join(out, '03-mesh.png') });
await page.evaluate(() => window.__sagrada.setStudy('mesh', false));

// Study: section (look at a cutaway from outside)
await page.evaluate(() => {
  window.__sagrada.setMode('fly');
  window.__sagrada.setPose([0, 48, 165], [0, 45, 0]);
  window.__sagrada.setStudy('section', true);
});
await page.waitForTimeout(1400);
info.section = await page.evaluate(() => window.__sagrada.studyState());
await page.screenshot({ path: path.join(out, '04-section.png') });
await page.evaluate(() => window.__sagrada.setStudy('section', false));

// Study: isolate interior
await page.evaluate(() => {
  window.__sagrada.setMode('fly');
  window.__sagrada.setPose([0, 25, 95], [0, 25, 0]);
  window.__sagrada.setStudyPart('interior');
});
await page.waitForTimeout(1400);
info.parts = await page.evaluate(() => window.__sagrada.studyState());
await page.screenshot({ path: path.join(out, '05-isolate-interior.png') });
await page.evaluate(() => window.__sagrada.setStudyPart('all'));

// Open the Study popover for a HUD screenshot.
await page.click('[data-act="study"]');
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, '06-study-panel.png') });
info.studyPanel = await page.evaluate(() => !document.querySelector('[data-pop="study"]')?.hidden);

info.errors = await page.evaluate(() => (window.__errors || []).slice(0, 5));
console.log(JSON.stringify({ info, logs: logs.filter((l) => !l.includes('favicon')).slice(0, 20) }, null, 2));
await browser.close();
