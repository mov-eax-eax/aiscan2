/* bowlab / tools/shot2.js — like shot.js but can switch bow type first.
   Usage: node tools/shot2.js <out> <kind> <draw> <cam> */
'use strict';
const puppeteer = require('puppeteer-core');
const path = require('path'); const fs = require('fs');
const CHROME = ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
(async () => {
  const [out, kind, drawS, cam] = process.argv.slice(2);
  const url = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  const info = await page.evaluate((kindSel, draw, camSel) => {
    const b = document.querySelector(`#kindSwitch button[data-kind="${kindSel}"]`);
    if (b) b.click();
    return new Promise(res => setTimeout(() => {
      const sim = window.BowLab.sim();
      if (draw > 0) sim.setDraw(draw);
      const cb = document.querySelector(`#camSwitch button[data-cam="${camSel}"]`);
      if (cb) cb.click();
      const m = sim.bp && sim.bp.metrics;
      const bad = [];
      window.BowLab.scene().traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const a = o.geometry.attributes.position.array;
        for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) { bad.push(o.name || o.geometry.type); break; }
      });
      res({ phase: sim.phase, kind: sim.bp && sim.bp.kind,
        peak: m && +m.peakForce.toFixed(1), hold: m && +m.holdForce.toFixed(1),
        E: m && +m.energyFtLb.toFixed(1), fps: m && +m.fps.toFixed(0),
        T: m && +m.stringTensionFull.toFixed(1), tip: m && +m.limbTipTravel.toFixed(2),
        nan: bad.slice(0, 6) });
    }, 700));
  }, kind, parseFloat(drawS || '0'), cam || 'side');
  await new Promise(r => setTimeout(r, 3200));
  const file = path.resolve(__dirname, '..', 'shots', out + '.png');
  await page.screenshot({ path: file });
  console.log('state:', JSON.stringify(info));
  console.log(logs.length ? 'errors:\n' + logs.slice(0, 10).join('\n') : 'no errors');
  console.log('saved', file);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
