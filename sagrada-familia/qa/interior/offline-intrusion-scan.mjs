// Dense vertical-ray scan of the whole interior footprint: for each sample, find
// the closest non-interior geometry above it (roof/trim/tower bases poking into
// the interior). If that y is below the interior's own ceiling, it will be seen
// from inside. No browser needed.
//
// Usage: node qa/interior/offline-intrusion-scan.mjs
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, '../../vendor/three.module.min.js');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: pathToFileURL(vendor).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

function makeCtx() {
  const grad = { addColorStop() {} };
  return {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    font: '10px sans-serif', textAlign: 'left', textBaseline: 'top',
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    fillRect() {}, clearRect() {}, strokeRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {},
    ellipse() {}, rect() {}, fill() {}, stroke() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, setTransform() {}, drawImage() {},
    fillText() {}, strokeText() {}, measureText: (t) => ({ width: String(t).length * 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {},
  };
}
function makeCanvas() {
  const c = { width: 1, height: 1, style: {} };
  c.getContext = () => { const ctx = makeCtx(); ctx.canvas = c; return ctx; };
  return c;
}
globalThis.document = { createElement: () => makeCanvas(), createElementNS: () => makeCanvas() };

const THREE = await import(pathToFileURL(vendor).href);
const { DIM, TOUR } = await import(pathToFileURL(path.resolve(here, '../../src/config.js')).href);
const LIB = await import(pathToFileURL(path.resolve(here, '../../src/lib.js')).href);
const { buildGloryShell } = await import(pathToFileURL(path.resolve(here, '../../src/glory-shell.js')).href);
const { buildFacadesNP } = await import(pathToFileURL(path.resolve(here, '../../src/facades-np.js')).href);
const { buildTowers } = await import(pathToFileURL(path.resolve(here, '../../src/towers.js')).href);
const { buildInterior } = await import(pathToFileURL(path.resolve(here, '../../src/interior.js')).href);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1.7, 0.1, 3000);
const env = { time: 10.35, auto: false, night: 0, sunDir: new THREE.Vector3(0, 1, 0), sun: null, moonDir: new THREE.Vector3(0, 1, 0), exposure: 1, quality: 'high', elapsed: 0, fps: 60, ready: false };
const app = { qualityHooks: [], onQuality(fn) { app.qualityHooks.push(fn); }, getStats: () => ({}) };
const ctx = { scene, camera, renderer: { info: { render: {} } }, env, app, DIM, TOUR, LIB, quality: 'high', onQuality: (fn) => app.onQuality(fn) };

const groups = new Map();
for (const [name, fn] of [['glory-shell', buildGloryShell], ['facades-np', buildFacadesNP], ['towers', buildTowers], ['interior', buildInterior]]) {
  const res = fn(ctx);
  if (res && res.group) {
    res.group.updateMatrixWorld(true);
    scene.add(res.group);
    groups.set(name, res.group);
  }
}

const info = new Map();
let interiorCheeks = 0;
const all = [];
for (const [name, g] of groups) {
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    all.push(o);
    info.set(o, { group: name, mat: o.material && (o.material.name || (o.material.map ? 'textured' : o.material.type)) });
  });
}

const raycaster = new THREE.Raycaster();
raycaster.far = 300;
const up = new THREE.Vector3(0, 1, 0);
function firstHitOf(objs, x, y, z) {
  raycaster.set(new THREE.Vector3(x, y, z), up);
  raycaster.near = 0.02;
  const hits = raycaster.intersectObjects(objs, false);
  for (const h of hits) {
    const i = info.get(h.object);
    if (!i) continue;
    return { y: h.point.y, group: i.group, mat: i.mat, name: h.object.name || '' };
  }
  return null;
}

const interiorObjs = [...info.keys()].filter((o) => info.get(o).group === 'interior');
const otherObjs = [...info.keys()].filter((o) => info.get(o).group !== 'interior');

const rows = [];
let worst = null;
for (let x = -29; x <= 29; x += 1.5) {
  for (let z = -59; z <= 45; z += 1.5) {
    const inNave = Math.abs(x) <= 14.6 && z >= -44.5 && z <= 44.5;
    const inTransept = Math.abs(x) <= 29.5 && Math.abs(z) <= 14.5;
    const inApse = z < -44.5 && z > -62 && Math.hypot(x, z + 45) <= 21.5;
    if (!inNave && !inTransept && !inApse) continue;
    const mine = firstHitOf(interiorObjs, x, 1.8, z);
    const other = firstHitOf(otherObjs, x, 1.8, z);
    if (!other) continue;
    // visible from inside when the foreign geometry is closer than my ceiling
    const myY = mine ? mine.y : Infinity;
    if (other.y < myY - 0.02) {
      rows.push({ x, z, ...other, myY });
      if (!worst || other.y < worst.y) worst = { x, z, ...other, myY };
    }
  }
}

const by = {};
for (const r of rows) by[r.group + '/' + r.mat] = (by[r.group + '/' + r.mat] || 0) + 1;
console.log('visible foreign geometry samples:', rows.length);
console.log(JSON.stringify(by, null, 0));
if (worst) console.log('closest foreign intrusion:', JSON.stringify(worst));
const mins = {};
for (const r of rows) {
  const k = r.group + '/' + r.mat;
  if (mins[k] === undefined || r.y < mins[k].y) mins[k] = r;
}
for (const k of Object.keys(mins)) {
  const m = mins[k];
  console.log(`lowest ${k}: y=${m.y.toFixed(2)} at x=${m.x} z=${m.z} (my ceiling there ${Number.isFinite(m.myY) ? m.myY.toFixed(2) : 'none'})`);
}
const cells = new Map();
for (const r of rows) {
  const k = `${Math.round(r.x)},${Math.round(r.z)}`;
  cells.set(k, r);
}
console.log('sample cells:', [...cells.keys()].slice(0, 80).join(' '));
process.exit(0);
