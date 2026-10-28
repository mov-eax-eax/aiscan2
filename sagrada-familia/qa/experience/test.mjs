// Programmatic QA for the Sagrada Família experience layer.
// Run from the project root (ONE browser only):  node qa/experience/test.mjs
//
// Rendering under a headless browser can be far slower than real time, so the
// movement checks drive `window.__sagrada.simulate(seconds)` — the experience's
// deterministic fixed-step update — instead of relying on rendered frames.
// The harness intentionally runs a single browser instance and closes it.

import { chromium } from 'playwright-core';

const URL_BASE = process.env.SF_URL || 'http://127.0.0.1:8141/';
const EDGE = process.env.SF_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HEADLESS = process.env.SF_HEADFUL !== '1';

const results = [];
let failures = 0;
const logs = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: HEADLESS,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
    '--disable-gpu-sandbox',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

async function newPage(viewport = { width: 960, height: 620 }, extra = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, ...extra });
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  return page;
}

async function boot(page, query) {
  await page.goto(`${URL_BASE}${query}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__sagrada && window.__sagrada.uiReady === true, null, { timeout: 120000 });
}

const page = await newPage();
const sim = (seconds, step = 1 / 60) => page.evaluate(([s, st]) => window.__sagrada.simulate(s, st), [seconds, step]);
const view = () => page.evaluate(() => window.__sagrada.view());
const mode = () => page.evaluate(() => window.__sagrada.getMode());

const t0 = Date.now();
await boot(page, '?skipSplash=1');
console.log(`booted in ${Date.now() - t0} ms`);
await page.waitForTimeout(600);

check('window.__sagrada.uiReady is true', true);
check('starts in walk mode', (await mode()) === 'walk', await mode());
check('mode() (main.js contract) works', (await page.evaluate(() => window.__sagrada.mode())) === 'walk');
check('modeName getter matches', (await page.evaluate(() => window.__sagrada.modeName)) === 'walk');
check('no page errors during boot', !logs.some((l) => l.startsWith('[pageerror]')), logs.find((l) => l.startsWith('[pageerror]')) || '');

// --- walking ---------------------------------------------------------------
const before = (await view()).pos;
await page.keyboard.down('KeyW');
await sim(1.0);
await page.keyboard.up('KeyW');
const after = (await view()).pos;
const walked = dist(before, after);
check('W moves the walker forward', walked > 1.5, `moved ${walked.toFixed(2)} m`);
const wx = (after[0] - before[0]) / Math.max(0.001, walked);
const wz = (after[2] - before[2]) / Math.max(0.001, walked);
check('movement follows view direction', wx < 0 && wz < 0, `${wx.toFixed(2)},${wz.toFixed(2)}`);

await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
const sprintStart = (await view()).pos;
await sim(1.0);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
const sprintDist = dist(sprintStart, (await view()).pos);
check('Shift sprints', sprintDist > 4.5, `${sprintDist.toFixed(2)} m in 1 s`);

await sim(0.4);
const groundY = (await view()).pos[1];
await page.keyboard.down('Space');
await sim(0.22);
await page.keyboard.up('Space');
const airY = (await view()).pos[1];
check('Space jumps', airY > groundY + 0.15, `y ${groundY.toFixed(2)} → ${airY.toFixed(2)}`);
await sim(1.2);
check('gravity brings the walker back down', Math.abs((await view()).pos[1] - groundY) < 0.08, `y ${(await view()).pos[1].toFixed(2)}`);

// --- fly ---------------------------------------------------------------
await page.keyboard.press('KeyF');
await page.waitForTimeout(120);
check('F switches to fly', (await mode()) === 'fly', await mode());
const flyBefore = (await view()).pos;
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
await sim(0.8);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
const flyMoved = dist(flyBefore, (await view()).pos);
check('boosted fly moves fast', flyMoved > 8, `moved ${flyMoved.toFixed(2)} m`);
const vBefore = (await view()).pos;
await page.keyboard.down('Space');
await sim(0.5);
await page.keyboard.up('Space');
const vAfter = (await view()).pos;
check('Space rises in fly mode', vAfter[1] > vBefore[1] + 1, `y ${vBefore[1].toFixed(1)} → ${vAfter[1].toFixed(1)}`);
await page.keyboard.press('KeyF');
await page.waitForTimeout(120);
check('F returns to walk', (await mode()) === 'walk', await mode());

// --- teleport ----------------------------------------------------------
const teleported = await page.evaluate(() => window.__sagrada.teleport('nave'));
await page.waitForTimeout(180);
const tview = await view();
check('teleport("nave") returns true', teleported === true);
check('teleport lands near the nave stop', dist(tview.pos, [0, 2.1, 39]) < 3.5, `pos ${tview.pos.map((v) => v.toFixed(1)).join(',')}`);
check('teleport sets walk mode', tview.mode === 'walk', tview.mode);

// --- map ---------------------------------------------------------------
await page.keyboard.press('KeyM');
await page.waitForTimeout(260);
check('M opens the plan', await page.evaluate(() => !document.getElementById('sf-map').hidden));
check(
  'plan canvas is painted',
  await page.evaluate(() => {
    const c = document.getElementById('sf-map-canvas');
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return d[3] > 0;
  })
);
check('plan has tour markers', (await page.evaluate(() => window.__sagrada.experienceAPI.minimap.getMarkers().length)) >= 8);
await page.keyboard.press('KeyM');
await page.waitForTimeout(180);
check('M closes the plan', await page.evaluate(() => document.getElementById('sf-map').hidden));

// --- hotspots ----------------------------------------------------------
const hotspots = await page.evaluate(() => window.__sagrada.hotspots());
check('hotspots exist', hotspots.length > 0, `${hotspots.length} hotspots`);
if (hotspots.length) {
  const opened = await page.evaluate((id) => window.__sagrada.openHotspot(id), hotspots[0].id);
  await page.waitForTimeout(150);
  check('hotspot card opens', opened === true && (await page.evaluate(() => !document.getElementById('sf-modal').hidden)), hotspots[0].id);
  const title = await page.evaluate(() => document.querySelector('[data-card-title]').textContent);
  const body = await page.evaluate(() => document.querySelector('[data-card-body]').textContent);
  check('card has a title', title.length > 0, title);
  check('card has body text', body.length > 30, `${body.length} chars`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('Escape closes the card', await page.evaluate(() => document.getElementById('sf-modal').hidden));
}

// --- time / night ------------------------------------------------------
await page.evaluate(() => window.__sagrada.setTime(21.5));
await page.waitForTimeout(200);
const clock = await page.evaluate(() => ({
  time: window.__sagrada.stats().time,
  text: document.querySelector('[data-clock]').textContent,
  period: document.querySelector('[data-period]').textContent,
  slider: Number(document.querySelector('[data-slider]').value),
}));
check('setTime(21.5) updates env', Math.abs(clock.time - 21.5) < 0.05, String(clock.time));
check('clock reads 21:30', clock.text === '21:30', clock.text);
check('clock says Night', clock.period === 'Night', clock.period);
check('time slider follows clock', Math.abs(clock.slider - 21.5) < 0.2, String(clock.slider));
await page.keyboard.press('KeyN');
await page.waitForTimeout(200);
const dayTime = await page.evaluate(() => window.__sagrada.stats().time);
check('N toggles back to daylight', Math.abs(dayTime - 10.35) < 0.05, String(dayTime));

// --- quality -----------------------------------------------------------
await page.evaluate(() => window.__sagrada.app.setQuality('medium'));
await page.waitForTimeout(200);
check('quality setting applies', (await page.evaluate(() => window.__sagrada.stats().quality)) === 'medium');
await page.evaluate(() => window.__sagrada.app.setQuality('low'));

// --- tour --------------------------------------------------------------
await page.evaluate(() => window.__sagrada.startTour('nativity'));
await page.waitForTimeout(200);
await sim(6.0);
const tourState = await page.evaluate(() => ({
  mode: window.__sagrada.getMode(),
  panel: !document.getElementById('sf-tour').hidden,
  title: document.querySelector('[data-tour-title]').textContent,
  camera: window.__sagrada.view().pos,
  stopId: (window.__sagrada.experienceAPI.tour.getState().stop || {}).id,
  stopPos: (() => {
    const stop = window.__sagrada.experienceAPI.tour.getState().stop;
    return stop && stop.posVec ? stop.posVec.toArray() : null;
  })(),
}));
check('tour starts', tourState.mode === 'tour' && tourState.panel, tourState.mode);
check('tour caption has a title', tourState.title.length > 0, tourState.title);
check('tour camera reaches the stop', !!tourState.stopPos && dist(tourState.camera, tourState.stopPos) < 2.5, tourState.stopId);
await page.evaluate(() => document.querySelector('[data-act="tour-next"]').click());
await page.evaluate(() => document.querySelector('[data-act="tour-pause"]').click());
await page.waitForTimeout(150);
const pausedLabel = await page.evaluate(() => document.querySelector('[data-tour-pause]').textContent);
check('tour pause button works', /resume/i.test(pausedLabel), pausedLabel);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Escape exits the tour', (await mode()) !== 'tour', await mode());

// --- photo -------------------------------------------------------------
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
check('P hides the HUD', await page.evaluate(() => getComputedStyle(document.getElementById('sf-hud')).display === 'none'));
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
check('P restores the HUD', await page.evaluate(() => getComputedStyle(document.getElementById('sf-hud')).display !== 'none'));

// --- hideUI / setPose --------------------------------------------------
await page.evaluate(() => window.__sagrada.hideUI(true));
await page.waitForTimeout(120);
check('hideUI(true) hides the interface', await page.evaluate(() => getComputedStyle(document.querySelector('.sf-hud')).display === 'none'));
await page.evaluate(() => window.__sagrada.hideUI(false));
await page.waitForTimeout(120);
check('hideUI(false) restores the interface', await page.evaluate(() => getComputedStyle(document.querySelector('.sf-hud')).display !== 'none'));

await page.evaluate(() => window.__sagrada.setPose([50, 20, 60], [0, 30, 0]));
await page.waitForTimeout(160);
check('setPose moves the camera', dist((await view()).pos, [50, 20, 60]) < 1.5);
check('setPose keeps fly mode', (await mode()) === 'fly', await mode());

// --- resize ------------------------------------------------------------
await page.setViewportSize({ width: 900, height: 700 });
await page.waitForTimeout(260);
const canvasSize = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return [c.width, c.height];
});
check('resize updates the canvas', canvasSize[0] > 0 && canvasSize[1] > 0, canvasSize.join('x'));
await page.close();

// --- splash entry ------------------------------------------------------
const splashPage = await newPage({ width: 900, height: 640 });
await boot(splashPage, '');
check('splash is shown without ?skipSplash', await splashPage.evaluate(() => !document.getElementById('sf-splash').hidden));
check('splash starts in splash mode', (await splashPage.evaluate(() => window.__sagrada.getMode())) === 'splash');
await splashPage.click('[data-splash="walk"]');
await splashPage.evaluate(() => window.__sagrada.simulate(3.2));
await splashPage.waitForTimeout(1350);
const splashAfter = await splashPage.evaluate(() => ({
  mode: window.__sagrada.getMode(),
  splashHidden: document.getElementById('sf-splash').hidden,
  hints: getComputedStyle(document.querySelector('.sf-hints')).display,
}));
check('splash button enters walk mode', splashAfter.mode === 'walk', splashAfter.mode);
check('splash is dismissed', splashAfter.splashHidden);
check('walk hints are shown', splashAfter.hints !== 'none');
await splashPage.close();

// --- mobile layout -----------------------------------------------------
const mobilePage = await newPage({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
await boot(mobilePage, '?skipSplash=1&mode=fly&pos=70,30,100&look=0,50,0');
await mobilePage.waitForTimeout(500);
const mobile = await mobilePage.evaluate(() => {
  const touch = document.getElementById('sf-touch');
  const joy = document.getElementById('sf-joystick');
  const menu = document.querySelector('.sf-mobile-menu');
  const hints = document.querySelector('.sf-hints');
  return {
    touchVisible: touch ? !touch.hidden : false,
    joySize: joy ? joy.getBoundingClientRect().width : 0,
    menuVisible: menu ? getComputedStyle(menu).display !== 'none' : false,
    hintsHidden: hints ? getComputedStyle(hints).display === 'none' : true,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    mode: window.__sagrada.getMode(),
    touchClass: document.querySelector('.sf-root').classList.contains('is-touch'),
  };
});
check('mobile: touch recognized', mobile.touchClass);
check('mobile: touch layer visible', mobile.touchVisible);
check('mobile: joystick present', mobile.joySize >= 90, `${mobile.joySize}px`);
check('mobile: menu button visible', mobile.menuVisible);
check('mobile: keyboard hints hidden', mobile.hintsHidden);
check('mobile: no horizontal overflow', !mobile.overflowX);
check('mobile: fly mode active', mobile.mode === 'fly', mobile.mode);
const mBefore = await mobilePage.evaluate(() => window.__sagrada.view().pos);
await mobilePage.evaluate(() => {
  const joy = document.getElementById('sf-joystick');
  const r = joy.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const opts = { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true };
  joy.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: cx, clientY: cy }));
  joy.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: cx, clientY: cy - 40 }));
});
await mobilePage.evaluate(() => window.__sagrada.simulate(1.0));
await mobilePage.evaluate(() => {
  document.getElementById('sf-joystick').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch' }));
});
check('mobile: joystick moves the camera', dist(mBefore, await mobilePage.evaluate(() => window.__sagrada.view().pos)) > 1);
await mobilePage.close();

const pageErrors = logs.filter((l) => l.startsWith('[pageerror]'));
check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close();
console.log('\n--- console tail ---');
for (const line of logs.slice(-8)) console.log(line);
console.log(`\n${results.length - failures}/${results.length} checks passed, ${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
