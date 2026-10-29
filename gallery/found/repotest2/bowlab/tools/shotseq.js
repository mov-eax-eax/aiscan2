/* bowlab / tools/shotseq.js — draw, release, and follow the shot through the
   power stroke into flight; saves frames and reports the timing. */
'use strict';
const puppeteer = require('puppeteer-core');
const path = require('path'); const fs = require('fs');
const CHROME = ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
(async () => {
  const url = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 760, deviceScaleFactor: 1 });
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  // start a shot trace inside the page
  await page.evaluate(() => {
    const sim = window.BowLab.sim();
    window.__trace = [];
    sim.setDraw(1);
    setTimeout(() => sim.release(), 200);
    window.__t0 = performance.now();
    const id = setInterval(() => {
      window.__trace.push({
        t: +((performance.now() - window.__t0) / 1000).toFixed(3),
        phase: sim.phase, x: +sim.x.toFixed(2), v: +sim.vx.toFixed(1),
        az: +sim.arrow.z.toFixed(1), ay: +sim.arrow.y.toFixed(2), ts: +sim.t.toFixed(3)
      });
      if (window.__trace.length > 60) clearInterval(id);
    }, 60);
  });
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: path.resolve(__dirname, '..', 'shots', 'seq_power.png') });
  await new Promise(r => setTimeout(r, 1400));
  await page.screenshot({ path: path.resolve(__dirname, '..', 'shots', 'seq_flight.png') });
  const trace = await page.evaluate(() => window.__trace);
  console.log('trace (t, phase, nock x, arrow v, arrow z, arrow y):');
  trace.forEach(r => console.log(' ', JSON.stringify(r)));
  console.log(logs.length ? 'errors:\n' + logs.join('\n') : 'no errors');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
