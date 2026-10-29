/* bowlab / tools/shot.js — headless render check.
   Usage: node tools/shot.js [outName] [drawFraction] [cameraPreset] [waitMs]
   Prints page console errors and saves a PNG into shots/. */
'use strict';
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = [
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

(async () => {
  const out = process.argv[2] || 'view';
  const draw = process.argv[3] ? parseFloat(process.argv[3]) : 0;
  const cam = process.argv[4] || 'side';
  const wait = process.argv[5] ? parseInt(process.argv[5]) : 1400;
  const url = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
           '--use-angle=swiftshader', '--window-size=1600,950', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
  page.on('requestfailed', r => logs.push(`[requestfailed] ${r.url()} ${r.failure() && r.failure().errorText}`));

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, wait));

  const info = await page.evaluate((draw, cam) => {
    if (!window.BowLab) return { ok: false, why: 'BowLab missing' };
    const sim = window.BowLab.sim();
    if (draw > 0) sim.setDraw(draw);
    const btn = document.querySelector(`#camSwitch button[data-cam="${cam}"]`);
    if (btn) btn.click();
    const bp = sim.bp;
    const m = bp && bp.metrics;
    // scan for NaN geometry + report the offender
    const bad = [];
    const sc = window.BowLab.scene();
    sc.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const a = o.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i++) {
        if (!isFinite(a[i])) {
          let p = o, chain = [o.name || o.type];
          while (p && p !== sc) { chain.push(p.type + (p.geometry ? ':' + (p.geometry.type || '') : '')); p = p.parent; }
          bad.push(chain.join(' < '));
          break;
        }
      }
    });
    return {
      ok: true, phase: sim.phase, draw: sim.t,
      peak: m && m.peakForce, hold: m && m.holdForce, fps: m && m.fps,
      camTurns: m && m.camTurns, arm: m && m.cableArmFull,
      nan: bad.slice(0, 8), nanCount: bad.length,
      errors: window.__err || null
    };
  }, draw, cam).catch(e => ({ ok: false, why: e.message }));

  await new Promise(r => setTimeout(r, 3000));
  const camInfo = await page.evaluate(() => {
    const c = window.BowLab.camera(), ctl = window.BowLab.controls(), bow = window.BowLab.bow();
    const cam = bow.parts && bow.parts.cams && bow.parts.cams.top;
    const wp = new THREE.Vector3();
    if (cam) cam.outer.getWorldPosition(wp);
    return {
      camPos: [+c.position.x.toFixed(3), +c.position.y.toFixed(3), +c.position.z.toFixed(3)],
      target: [+ctl.target.x.toFixed(3), +ctl.target.y.toFixed(3), +ctl.target.z.toFixed(3)],
      topCamWorld: [+wp.x.toFixed(3), +wp.y.toFixed(3), +wp.z.toFixed(3)]
    };
  }).catch(e => ({ err: e.message }));
  console.log('camera:', JSON.stringify(camInfo));
  fs.mkdirSync(path.resolve(__dirname, '..', 'shots'), { recursive: true });
  const file = path.resolve(__dirname, '..', 'shots', out + '.png');
  await page.screenshot({ path: file });
  console.log('state:', JSON.stringify(info));
  console.log(logs.length ? '--- console ---\n' + logs.slice(0, 40).join('\n') : 'no console output');
  console.log('saved', file);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
