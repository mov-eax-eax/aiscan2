import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const SRC = 'F:/repod2/ref-tutorial/Draw-the-Eiffel-Tower-Step-10-Version-3.jpg';
const b64 = readFileSync(SRC).toString('base64');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage(); await page.goto('about:blank');
// measurement space is a 0.5 downscale of the 3200x2400 source -> source = measurement * 2
const AXIS = 841.5, TIP = 120, GROUND = 1133, TH = 1013;
const jobs = [
  { name: 'mid', k0: 25, k1: 50, halfW: 0.27, zoom: 1.4 },
  { name: 'base', k0: -1, k1: 30, halfW: 0.42, zoom: 1.2 },
  { name: 'top', k0: 42, k1: 102, halfW: 0.15, zoom: 1.6 },
];
for (const j of jobs) {
  const y0 = GROUND - (j.k1 / 100) * TH, y1 = GROUND - (j.k0 / 100) * TH;
  const x0 = AXIS - j.halfW * TH, x1 = AXIS + j.halfW * TH;
  const w = x1 - x0, h = y1 - y0;
  const dataUrl = await page.evaluate(async ([src, sx, sy, sw, sh, ox, oy]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = ox; c.height = oy;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ox, oy);
    return c.toDataURL('image/png');
  }, ['data:image/jpeg;base64,' + b64, x0 * 2, y0 * 2, w * 2, h * 2, Math.round(w * 2 * j.zoom / 2), Math.round(h * 2 * j.zoom / 2)]);
  writeFileSync('F:/repod2/tower/shots/ref-' + j.name + '.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote ref-' + j.name + '.png');
}
await browser.close();
