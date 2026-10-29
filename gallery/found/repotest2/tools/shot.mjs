/* Deterministic offline capture: headless Chrome + SwiftShader WebGL.
   Usage: node tools/shot.mjs [nameFilter] */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const URL    = 'file:///F:/repotest2/eiffel-tower.html';
const OUT    = 'F:/repotest2/shots';
const W = 1600, H = 1000;

const SHOTS = [
  { n: '01_full',      cam: 'full'  },
  { n: '02_elev',      cam: 'elev'  },
  { n: '03_base',      cam: 'base'  },
  { n: '04_under',     cam: 'under' },
  { n: '05_f1',        cam: 'f1'    },
  { n: '06_f2',        cam: 'f2'    },
  { n: '07_top',       cam: 'top'   },
  { n: '08_arch',      cam: 'arch'  },
  { n: '09_night',     cam: 'full',  st: { night: true, spin: false } },
  { n: '10_sparkle',   cam: 'full',  st: { night: true, sparkle: true, spin: false } },
  { n: '11_topnight',  cam: 'top',   st: { night: true, sparkle: true, spin: false } },
  { n: '12_dims',      cam: 'elev',  st: { dims: true, spin: false } },
  { n: '13_legdetail', cam: null, pos: [58, 40, 62], tgt: [22, 40, 24] },
  { n: '14_crown',     cam: null, pos: [10, 44, 96], tgt: [0, 40, 30] },
  { n: '15_frieze',    cam: null, pos: [0, 56.9, 62], tgt: [0, 56.4, 35], fov: 26 },
  { n: '16_summitday', cam: null, pos: [14, 292, 26], tgt: [0, 284, 0], fov: 40 },
];
const only = process.argv[2] || null;
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 240000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
         '--disable-dev-shm-usage', '--allow-file-access-from-files',
         '--hide-scrollbars', '--window-size=' + W + ',' + H],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const logs = [];
page.on('console', m => { const t = m.text(); if (!/Download the React/.test(t)) logs.push('[' + m.type() + '] ' + t); });
page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', r => logs.push('[reqfail] ' + r.url().slice(0, 120) + ' ' + (r.failure() ? r.failure().errorText : '')));

const t0 = Date.now();
let ok = true;
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 90000, polling: 250 });
} catch (e) {
  ok = false;
  console.log('LOAD FAILED after ' + ((Date.now()-t0)/1000).toFixed(1) + 's: ' + e.message);
}
console.log('ready in ' + ((Date.now()-t0)/1000).toFixed(1) + 's  ok=' + ok);
if (ok) console.log('STATS ' + JSON.stringify(await page.evaluate(() => window.__STATS__)));

if (ok){
  for (const s of SHOTS){
    if (only && !s.n.includes(only)) continue;
    const ts = Date.now();
    await page.evaluate((sh) => {
      window.__set({ night: false, sparkle: false, dims: false, spin: false, wire: false });
      if (sh.st) window.__set(sh.st);
      if (sh.cam) window.__view(sh.cam, sh.pos ? { pos: sh.pos, tgt: sh.tgt } : {});
      else window.__view('full', { pos: sh.pos, tgt: sh.tgt });
    }, s);
    await new Promise(r => setTimeout(r, 350));
    await page.evaluate(() => window.__settle());
    await new Promise(r => setTimeout(r, 700));
    await page.screenshot({ path: OUT + '/' + s.n + '.png' });
    console.log('shot ' + s.n + '  ' + ((Date.now()-ts)/1000).toFixed(1) + 's');
  }
}
if (logs.length) console.log('--- page log ---\n' + logs.slice(0, 25).join('\n'));
await browser.close();
process.exit(ok ? 0 : 1);
