// _verify_all.mjs — capture several camera presets / day-night states in ONE browser
// session, waiting for the page's own EIFFEL-OK/EIFFEL-ERROR self-test each time.
// usage: node _verify_all.mjs [baseUrl]
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const base = process.argv[2] || 'http://127.0.0.1:8080/eiffel-tower.html';
const cases = [
  ['hero',   '?view=hero&intro=0'],
  ['base',   '?view=base&intro=0'],
  ['top',    '?view=top&intro=0'],
  ['night',  '?view=hero&intro=0&night=1'],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking',
         '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--disable-gpu', '--window-size=1600,900', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900 }
});

const report = [];
for (const [name, qs] of cases) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message ? e.message : e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  const t0 = Date.now();
  let title = '';
  try {
    await page.goto(base + qs, { waitUntil: 'domcontentloaded', timeout: 60000 });
    while (Date.now() - t0 < 180000) {
      title = await page.title().catch(() => '');
      if (/^EIFFEL-(OK|ERROR)/.test(title)) break;
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2500)); // let a few frames settle
    const state = await page.evaluate(() => window.__EIFFEL_STATE__ || null).catch(() => null);
    const shot = 'F:/repotest2/_shot_' + name + '.png';
    await page.screenshot({ path: shot, type: 'png' });
    report.push({ name, qs, title, ms: Date.now() - t0, state, errors: errs.slice(0, 6), shot });
  } catch (e) {
    report.push({ name, qs, title, ms: Date.now() - t0, fatal: String(e && e.message || e), errors: errs.slice(0, 6) });
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
writeFileSync('F:/repotest2/_verify_all.json', JSON.stringify(report, null, 1));
const bad = report.filter(r => !/^EIFFEL-OK/.test(r.title || ''));
process.exit(bad.length ? 2 : 0);
