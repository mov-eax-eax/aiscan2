// _verify.mjs — drives the installed Edge/Chrome headless via puppeteer-core,
// waits for the EIFFEL-OK/EIFFEL-ERROR self-test and reports + screenshots.
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const exePath = process.env.VERIFY_BROWSER === 'chrome' ? CHROME : EDGE;
const url = process.argv[2] || 'http://127.0.0.1:8080/eiffel-tower.html?view=hero&intro=0';
const shot = process.argv[3] || 'F:/repotest2/_verify_shot.png';
const timeoutMs = Number(process.argv[4] || 120000);
const settleMs = Number(process.argv[5] || 1200);

const browser = await puppeteer.launch({
  executablePath: exePath,
  headless: 'new',
  args: [
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--disable-gpu', '--window-size=1600,900', '--hide-scrollbars'
  ],
  defaultViewport: { width: 1600, height: 900 }
});
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push('[console.' + m.type() + '] ' + m.text()));
page.on('pageerror', e => logs.push('[pageerror] ' + (e && e.message ? e.message : e)));

let okLine = '';
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
while (Date.now() - t0 < timeoutMs) {
  const title = await page.title().catch(() => '');
  if (/^EIFFEL-(OK|ERROR)/.test(title)) { okLine = title; break; }
  await new Promise(r => setTimeout(r, 400));
}
const state = await page.evaluate(() => window.__EIFFEL_STATE__ || null).catch(() => null);
console.log('TITLE: ' + okLine);
console.log('STATE: ' + JSON.stringify(state));
if (settleMs > 0) await new Promise(r => setTimeout(r, settleMs));
if (shot) {
  mkdirSync('F:/repotest2', { recursive: true });
  await page.screenshot({ path: shot, type: 'png' });
  console.log('SHOT: ' + shot);
}
if (logs.length) {
  const tail = logs.slice(-12).join('\n');
  console.log('LOGS:\n' + tail);
  writeFileSync('F:/repotest2/_verify_logs.txt', logs.join('\n'));
}
await browser.close();
process.exit(okLine.startsWith('EIFFEL-OK') ? 0 : 2);
