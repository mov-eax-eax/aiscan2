import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const [file, X, Y, W, H, Z, out] = process.argv.slice(2);
const b64 = readFileSync(file).toString('base64');
const ext = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage(); await page.goto('about:blank');
const url = await page.evaluate(async ([src, x, y, w, h, z]) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.round(w * z); c.height = Math.round(h * z);
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}, ['data:' + ext + ';base64,' + b64, +X, +Y, +W, +H, +Z]);
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote', out);
await browser.close();
