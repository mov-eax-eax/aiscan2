// _probe_deep.mjs — bucket totals, audit breakdown, and night-transition state.
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const base = 'http://127.0.0.1:8080/_probe.html';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--disable-gpu', '--window-size=1200,800', '--hide-scrollbars'],
  defaultViewport: { width: 1200, height: 800 }
});

for (const [name, qs, settle] of [['day', '?view=hero&intro=0', 3000], ['night', '?view=hero&intro=0&night=1', 18000]]) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.goto(base + qs, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const t = await page.title().catch(() => '');
    if (/^EIFFEL-/.test(t)) break;
    await new Promise(r => setTimeout(r, 400));
  }
  await new Promise(r => setTimeout(r, settle));
  const out = await page.evaluate(() => JSON.stringify({
    dbg: window.__dbg ? window.__dbg() : null,
    buckets: window.__fbInfo ? window.__fbInfo() : null,
    audit: window.__auditFB ? window.__auditFB() : null
  })).catch(e => 'EVAL FAILED: ' + e.message);
  console.log('--- ' + name + ' ' + qs);
  console.log(out);
  if (errs.length) console.log('pageerrors: ' + errs.slice(0, 4).join(' | '));
  await page.close();
}
await browser.close();
