/* Functional test: drive the page through a full cock -> hold -> loose ->
   impact cycle and assert the physics it reports matches the analytic model.
   node tools/verify-page.mjs                                                */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildMachine, flight, shotSolution, DESIGN, M2IN, N2LBF } from '../src/core.js';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'F:/repotest2';
const FILE = process.argv[2] || 'crossbow.html';
const OUT = 'F:/repotest2/shots-xbow';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/' + FILE;
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(path.resolve(ROOT)) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 240000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/${FILE}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 90000, polling: 200 });

const { p, curve, shot } = buildMachine();
let pass = 0, fail = 0;
const check = (name, ok, detail) => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/* 1. static mechanism figures come from the page itself */
const st = await page.evaluate(() => window.__STATS__);
check('peak draw weight ~190 lbf', Math.abs(st.peakLbf - 190) < 2, st.peakLbf.toFixed(1) + ' lbf');
check('stroke 11.0 in', Math.abs(st.strokeIn - 11.02) < 0.1, st.strokeIn.toFixed(2) + ' in');
check('let-off 20-45%', st.letOff > 0.20 && st.letOff < 0.45, (st.letOff * 100).toFixed(0) + '%');
check('energy conserved exactly', Math.abs(st.energyResidual) < 1e-9, st.energyResidual.toExponential(1));
check('muzzle velocity 150-220 fps', st.vFps > 150 && st.vFps < 220, st.vFps.toFixed(0) + ' fps');
check('efficiency 40-80%', st.eff > 0.4 && st.eff < 0.8, (st.eff * 100).toFixed(0) + '%');
check('limb travel 2-12 cm', st.tipTravel * 100 > 2 && st.tipTravel * 100 < 12, (st.tipTravel * 100).toFixed(1) + ' cm');

/* 2. the force curve is monotone up to its peak and positive throughout */
let mono = true, neg = 0;
for (let i = 1; i <= curve.stageIndex ?? curve.peakIndex; i++) if (curve.rows[i].F < curve.rows[i - 1].F - 1e-6) mono = false;
for (const r of curve.rows) if (r.F < 0) neg++;
check('force rises monotonically to the peak', mono);
check('draw force never negative', neg === 0, neg + ' bad samples');

/* 3. drive an actual shot and compare with the analytic ballistics.
   (set the draw directly so the test does not depend on frame pacing) */
await page.evaluate(() => { window.__reset(); window.__seek(1); });
/* wait for the phase to settle on "hold" — a previous shot's bolt may still be
   finishing its flight and resetting the machine */
await page.waitForFunction(() => document.getElementById('h-phase').textContent === 'hold', { timeout: 15000, polling: 100 });
const phaseHold = await page.evaluate(() => document.getElementById('h-phase').textContent);
check('reaches full draw (hold)', phaseHold === 'hold', phaseHold);
await page.evaluate(() => { window.__set({ timeScale: 0.05 }); window.__fire(); });
const samples = [];
for (let i = 0; i < 90; i++) {
  await new Promise(r => setTimeout(r, 55));
  const s = await page.evaluate(() => window.__BOLT__);
  if (s && s.z != null && !Number.isNaN(s.z)) samples.push(s);
  if (s && s.phase === 'impact') break;
}
const flying = samples.filter(s => s.v > 1);
if (flying.length) {
  const v0 = flying[0].v;
  check('launch speed matches the model', Math.abs(v0 - shot.v) < 2.5, `${v0.toFixed(1)} vs ${shot.v.toFixed(1)} m/s`);
  // monotone deceleration (drag + gravity projection) — never accelerating
  let accel = false;
  for (let i = 1; i < flying.length; i++) if (flying[i].v > flying[i - 1].v + 0.05) accel = true;
  check('bolt only ever decelerates', !accel);
} else {
  check('bolt flew', false, 'no samples with v > 1');
}
await page.evaluate(() => { window.__set({ slowmo: false, timeScale: 1 }); });

/* 4. cameras all render something (no black frames) */
const views = ['full', 'action', 'side', 'top', 'cam', 'riser', 'trigger', 'string', 'range', 'downrange'];
for (const v of views) {
  await page.evaluate((v) => window.__view(v), v);
  await new Promise(r => setTimeout(r, 260));
  const shotFile = `${OUT}/chk_${v}.png`;
  await page.screenshot({ path: shotFile });
  const sz = fs.statSync(shotFile).size;
  check(`view "${v}" renders`, sz > 12000, (sz / 1024).toFixed(0) + ' KB');
}

/* 5. no runtime errors anywhere */
check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
