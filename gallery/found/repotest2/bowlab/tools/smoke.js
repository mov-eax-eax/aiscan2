/* bowlab / tools/smoke.js — click every UI control in both bow types and check
   that nothing throws, that the solver stays consistent, and that geometry
   never goes NaN. */
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
  await page.setViewport({ width: 1100, height: 700 });
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 160)); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));

  const out = await page.evaluate(async () => {
    const log = [];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const check = (tag) => {
      const bow = window.BowLab.bow(), sim = window.BowLab.sim();
      let nan = 0;
      bow.group.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const a = o.geometry.attributes.position.array;
        for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) { nan++; break; }
      });
      const m = sim.bp.metrics;
      log.push(`${tag}: peak=${m.peakForce.toFixed(1)} hold=${m.holdForce.toFixed(1)} ` +
        `let=${(m.letOff * 100).toFixed(0)}% E=${m.energyFtLb.toFixed(1)} fps=${m.fps.toFixed(0)} nanMeshes=${nan}`);
      return nan;
    };
    // camera presets
    for (const c of ['side', 'three', 'cam', 'grip', 'front', 'wide']) {
      document.querySelector(`#camSwitch button[data-cam="${c}"]`).click();
      await sleep(60);
    }
    // toggles
    for (const label of ['X-ray', 'Force vectors', 'Explode', 'Force vectors', 'X-ray', 'Explode']) {
      [...document.querySelectorAll('#playback .btn')].find(b => b.textContent === label).click();
      await sleep(120);
    }
    let bad = check('after toggles');
    // parameter sweep on the compound
    const sweep = async () => {
      const inputs = [...document.querySelectorAll('#controls input[type=range]')];
      for (const inp of inputs) {
        const min = parseFloat(inp.min), max = parseFloat(inp.max), step = parseFloat(inp.step) || 1;
        for (const v of [min, (min + max) / 2, max, (min + max) / 2]) {
          inp.value = v;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(90);
          bad += check(`  ${inp.previousSibling.firstChild.textContent} = ${v}`);
        }
      }
    };
    await sweep();
    // switch to recurve and sweep again
    document.querySelector('#kindSwitch button[data-kind="recurve"]').click();
    await sleep(600);
    bad += check('recurve defaults');
    await sweep();
    // draw + release on the recurve
    const sim = window.BowLab.sim();
    sim.setDraw(1); await sleep(300); sim.release(); await sleep(2500);
    bad += check('recurve after shot, phase=' + sim.phase);
    document.querySelector('#kindSwitch button[data-kind="compound"]').click();
    await sleep(600);
    sim.setDraw(1); await sleep(300); sim.release(); await sleep(2500);
    bad += check('compound after shot, phase=' + sim.phase);
    return { log, bad };
  });

  console.log(out.log.join('\n'));
  console.log('\nNaN total:', out.bad);
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 20).join('\n') : 'no page errors');
  await browser.close();
  process.exit((errs.length || out.bad) ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
