/* Throwaway inspection shots: isolate a group, put the camera somewhere
   specific, capture. Not part of the normal build - this is the "look at the
   thing I am unsure about" tool.

   usage: node tools/probe.mjs <outName> <group|all> <px,py,pz> <tx,ty,tz> <fov> */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(process.cwd());
const [outName, groupName, pArg, tArg, fovArg] = process.argv.slice(2);
if (!outName) { console.log('usage: node tools/probe.mjs <name> <group|all> <pos> <tgt> <fov>'); process.exit(1); }

const pos = pArg.split(',').map(Number);
const tgt = tArg.split(',').map(Number);
const fov = Number(fovArg || 18);
const W = 1400, H = 1400;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 300000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
    '--disable-dev-shm-usage', '--allow-file-access-from-files', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
await page.goto('file:///' + path.join(ROOT, 'recurve.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000, polling: 250 });
await page.evaluate((g, p, t, f) => {
  window.__only(g);
  window.__cam(p, t, f);
  document.querySelectorAll('.panel,#hint').forEach(e => { e.style.display = 'none'; });
}, groupName, pos, tgt, fov);
await new Promise(r => setTimeout(r, 400));
const out = path.join(ROOT, 'shots', '_probe_' + outName + '.png');
await page.screenshot({ path: out });
console.log('wrote ' + out);
if (logs.length) console.log(logs.join('\n'));
await browser.close();
