// qa/ui.mjs — capture the real interface and report any console errors.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire('F:/repodsh/shotgen/package.json');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');
process.env.PORT = process.env.PORT || '8155';
await import('../serve.js');
await new Promise((r) => setTimeout(r, 400));

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.setDefaultTimeout(120000);
const logs = [];
page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto('http://127.0.0.1:' + process.env.PORT + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__747__ && window.__747__.ready === true', { timeout: 240000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOTS, 'ui.png'), timeout: 120000 });
console.log('errors:', logs.filter((l) => l.includes('pageerror') || l.includes('[error]')).length);
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
process.exit(0);
