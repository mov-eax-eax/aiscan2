/**
 * shot.mjs — headless-Chrome screenshot helper for the built single-file page.
 *
 *   node tools/build.mjs --out ../.eif3-team/shot.html
 *   node tools/shot.mjs ../.eif3-team/shot.html ../.eif3-team/shot-day.png
 *   node tools/shot.mjs ../.eif3-team/shot.html ../.eif3-team/shot-night.png --hash night
 *
 * Options: --hash night | --size 1600x1000 | --budget 25000
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('usage: node tools/shot.mjs <html-file> <out.png> [--hash night] [--size 1600x1000] [--budget 25000]');
  process.exit(2);
}

const file = resolve(args[0]);
const out = resolve(args[1]);
let hash = '';
let size = '1600x1000';
let budget = '25000';

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--hash') hash = '#' + args[++i];
  else if (args[i] === '--size') size = args[++i];
  else if (args[i] === '--budget') budget = args[++i];
}

const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('shot.mjs: no Chrome or Edge installation found');
  process.exit(1);
}

const url = 'file:///' + file.replace(/\\/g, '/') + hash;
const result = spawnSync(chrome, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--window-size=' + size,
  '--virtual-time-budget=' + budget,
  '--screenshot=' + out,
  url,
], { stdio: 'ignore', windowsHide: true });

if (result.error) {
  console.error('shot.mjs: ' + result.error.message);
  process.exit(1);
}
console.log('shot ' + out);
