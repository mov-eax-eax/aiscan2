/**
 * shots.mjs — render the built page from a set of fixed viewpoints.
 * Useful for reviewing the city, the landmarks and the tower without clicking.
 *
 *   node tools/build.mjs --out ../.eif3-team/review.html
 *   node tools/shots.mjs ../.eif3-team/review.html ../.eif3-team/review
 *   node tools/shots.mjs <html> <outDir> --only tower-close-night,ecole-day
 *
 * Each view pins the camera (auto-orbit off) by rewriting the camera defaults in
 * a temporary copy of the built HTML, then screenshots it with headless Chrome.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const VIEWS = [
  { name: 'day-wide',             target: [0, 172, 0],      radius: 555, phi: 1.44, theta: 0.63 },
  { name: 'night-wide',           target: [0, 172, 0],      radius: 555, phi: 1.44, theta: 0.63, hash: '#night' },
  { name: 'tower-close-day',      target: [0, 88, 0],       radius: 150, phi: 1.40, theta: 0.55 },
  { name: 'tower-close-night',    target: [0, 88, 0],       radius: 150, phi: 1.40, theta: 0.55, hash: '#night' },
  { name: 'ecole-day',            target: [0, 40, 830],     radius: 560, phi: 1.34, theta: Math.PI },
  { name: 'ecole-night',          target: [0, 40, 830],     radius: 560, phi: 1.34, theta: Math.PI, hash: '#night' },
  { name: 'trocadero-day',        target: [0, 40, -640],    radius: 620, phi: 1.32, theta: 0 },
  { name: 'trocadero-night',      target: [0, 40, -640],    radius: 620, phi: 1.32, theta: 0, hash: '#night' },
  { name: 'montparnasse-day',     target: [980, 70, -260],  radius: 720, phi: 1.30, theta: -Math.PI / 2 },
  { name: 'defense-day',          target: [-1280, 90, -880], radius: 900, phi: 1.30, theta: Math.PI / 2 },
  { name: 'seine-night',          target: [0, 20, -330],    radius: 430, phi: 1.30, theta: 0.5, hash: '#night' },
  { name: 'mall-night',           target: [0, 30, 480],     radius: 430, phi: 1.34, theta: Math.PI, hash: '#night' },
];

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('usage: node tools/shots.mjs <built.html> <outDir> [--only name,name] [--size 1600x1000] [--budget 25000]');
  process.exit(2);
}
const htmlFile = resolve(args[0]);
const outDir = resolve(args[1]);
let only = null;
let size = '1600x1000';
let budget = '25000';
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--only') only = args[++i].split(',').map((s) => s.trim());
  else if (args[i] === '--size') size = args[++i];
  else if (args[i] === '--budget') budget = args[++i];
}
if (!CHROME) {
  console.error('shots.mjs: no Chrome or Edge installation found');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const source = await readFile(htmlFile, 'utf8');
const views = VIEWS.filter((v) => !only || only.includes(v.name));
const workDir = join(tmpdir(), 'eif3-shots');
await mkdir(workDir, { recursive: true });

for (const view of views) {
  const [tx, ty, tz] = view.target;
  const html = source
    .replace(/const cameraTarget = new THREE\.Vector3\([^)]*\);/, `const cameraTarget = new THREE.Vector3(${tx}, ${ty}, ${tz});`)
    .replace(/radius: [\d.]+, phi: [\d.]+, theta: [\d.]+,/, `radius: ${view.radius}, phi: ${view.phi}, theta: ${view.theta},`)
    .replace(/tr: [\d.]+, tphi: [\d.]+, ttheta: [\d.]+,/, `tr: ${view.radius}, tphi: ${view.phi}, ttheta: ${view.theta},`)
    .replace('auto: true', 'auto: false');

  const tmpHtml = join(workDir, view.name + '.html');
  await writeFile(tmpHtml, html, 'utf8');
  const out = join(outDir, view.name + '.png');
  const url = 'file:///' + tmpHtml.replace(/\\/g, '/') + (view.hash || '');
  const result = spawnSync(CHROME, [
    '--headless=new', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--hide-scrollbars', '--window-size=' + size, '--virtual-time-budget=' + budget,
    '--screenshot=' + out, url,
  ], { stdio: 'ignore', windowsHide: true });
  if (result.error) {
    console.error(view.name + ': ' + result.error.message);
    continue;
  }
  console.log('shot ' + view.name + ' → ' + out);
}
