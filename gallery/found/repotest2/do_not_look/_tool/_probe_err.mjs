// _probe_err.mjs — dump overlay fatal error text + page errors from the probe page.
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--disable-gpu', '--window-size=1200,800', '--hide-scrollbars'],
  defaultViewport: { width: 1200, height: 800 }
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message ? e.message : String(e))));
page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') errs.push('console.' + t + ': ' + m.text()); });
await page.goto('http://127.0.0.1:8080/_probe.html?view=hero&intro=0', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 12000));
const dump = await page.evaluate(() => JSON.stringify({
  title: document.title,
  ovErr: (document.getElementById('ovErr') || {}).textContent || '',
  overlayShown: !!document.getElementById('overlay'),
  state: window.__EIFFEL_STATE__ || null,
  fbErr: (typeof window.__fbInfo === 'function') ? window.__fbInfo() : 'no-fbInfo'
})).catch(e => 'EVAL FAILED ' + e.message);
console.log(dump);
console.log('ERRORS:\n' + (errs.slice(0, 10).join('\n') || '(none)'));
await browser.close();
