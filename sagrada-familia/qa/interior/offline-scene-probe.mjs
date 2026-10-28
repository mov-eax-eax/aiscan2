// Offline full-scene probe (no browser, no GPU): builds every builder, then
// raycasts upward from inside the nave/transept/apse to find where the green
// roof is visible through the interior ceilings, and whether roof geometry
// pokes below the vaults.
//
// Usage: node qa/interior/offline-scene-probe.mjs
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

// --- canvas stub -------------------------------------------------------------
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
const { buildEnvironment } = await import(pathToFileURL(path.resolve(here, '../../src/environment.js')).href);
const { buildGloryShell } = await import(pathToFileURL(path.resolve(here, '../../src/glory-shell.js')).href);
const { buildFacadesNP } = await import(pathToFileURL(path.resolve(here, '../../src/facades-np.js')).href);
const { buildTowers } = await import(pathToFileURL(path.resolve(here, '../../src/towers.js')).href);
const { buildInterior } = await import(pathToFileURL(path.resolve(here, '../../src/interior.js')).href);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1.7, 0.1, 3000);
const renderer = { info: { render: {} } };
const env = { time: 10.35, auto: false, night: 0, sunDir: new THREE.Vector3(0, 1, 0), sun: null, moonDir: new THREE.Vector3(0, 1, 0), exposure: 1, quality: 'high', elapsed: 0, fps: 60, ready: false };
const app = { qualityHooks: [], onQuality(fn) { app.qualityHooks.push(fn); }, getStats: () => ({}) };
const ctx = { scene, camera, renderer, env, app, DIM, TOUR, LIB, quality: 'high', onQuality: (fn) => app.onQuality(fn) };

const builders = [
  ['environment', buildEnvironment],
  ['glory-shell', buildGloryShell],
  ['facades-np', buildFacadesNP],
  ['towers', buildTowers],
  ['interior', buildInterior],
];

const groups = new Map();
for (const [name, fn] of builders) {
  try {
    const t0 = Date.now();
    const res = fn(ctx);
    if (res && res.group) {
      res.group.updateMatrixWorld(true);
      scene.add(res.group);
      groups.set(name, res.group);
      console.log(`[built] ${name} (${Date.now() - t0} ms)`);
    } else {
      console.log(`[built] ${name} (no group)`);
    }
  } catch (e) {
    console.log(`[FAIL] ${name}: ${e && e.message}`);
  }
}

// --- inventory ---------------------------------------------------------------
const meshInfo = new Map(); // mesh -> { group, mat }
function materialName(m) {
  if (!m) return '?';
  return m.name || (m.map ? 'textured' : '') || m.type;
}
for (const [name, g] of groups) {
  const rows = [];
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const mat = o.material;
    meshInfo.set(o, { group: name, mat: materialName(mat), matRef: mat });
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    rows.push({ o, tris: Math.round(tris * (o.isInstancedMesh ? o.count : 1)), minY: bb.min.y, maxY: bb.max.y, mat: materialName(mat) });
  });
  rows.sort((a, b) => b.tris - a.tris);
  console.log(`\n${name}: ${rows.length} meshes`);
  for (const r of rows.slice(0, 14)) {
    console.log(`  ${r.tris.toString().padStart(7)}  ${r.mat.padEnd(18)} y ${r.minY.toFixed(1)}..${r.maxY.toFixed(1)}  ${r.o.name || ''}`);
  }
}

// --- where does the roof sit over the interior? ------------------------------
let roofMin = Infinity;
let roofMinAt = null;
for (const [o, info] of meshInfo) {
  const isRoof = /roof/i.test(info.mat) || /roof/i.test(o.name || '');
  if (!isRoof) continue;
  o.geometry.computeBoundingBox();
  const bb = o.geometry.boundingBox;
  if (bb.min.y < roofMin) { roofMin = bb.min.y; roofMinAt = { group: info.group, mat: info.mat, name: o.name, bb }; }
}
if (roofMinAt) {
  console.log(`\nlowest roof mesh: group=${roofMinAt.group} mat=${roofMinAt.mat} name=${roofMinAt.name} bbox y ${roofMinAt.bb.min.y.toFixed(2)}..${roofMinAt.bb.max.y.toFixed(2)} x ${roofMinAt.bb.min.x.toFixed(1)}..${roofMinAt.bb.max.x.toFixed(1)} z ${roofMinAt.bb.min.z.toFixed(1)}..${roofMinAt.bb.max.z.toFixed(1)}`);
} else {
  console.log('\nno mesh matched /roof/i in name or material');
}


// --- where exactly does other builders' geometry intrude into the crossing? ---
console.log('\n=== intrusions in the crossing box |x|,|z| < 13, y 43..58 ===');
for (const [o, info] of meshInfo) {
  if (info.group === 'interior') continue;
  const pos = o.geometry.attributes.position;
  if (!pos) continue;
  const grid = new Map();
  let hits = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(x) > 13 || Math.abs(z) > 13 || y < 43 || y > 58) continue;
    hits++;
    const key = [Math.round(x / 3) * 3, Math.round(z / 3) * 3, Math.round(y)].join(',');
    grid.set(key, (grid.get(key) || 0) + 1);
  }
  if (hits > 0) {
    const cells = [...grid.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(info.group + '/' + info.mat + ' ' + (o.name || '') + ': ' + hits + ' verts in box; top cells ' + cells.map((c) => c[0]).join(' | '));
  }
}
// --- upward rays: what is visible from inside the ceilings? -------------------
const raycaster = new THREE.Raycaster();
raycaster.far = 400;
const up = new THREE.Vector3(0, 1, 0);
const roots = [...groups.values()];
const meshList = [...meshInfo.keys()].filter((m) => m.isMesh);
const skip = new Set(['environment']);
const date = new Date();

function firstHit(x, y, z, dir) {
  raycaster.set(new THREE.Vector3(x, y, z), dir);
  raycaster.near = 0.01;
  const hits = raycaster.intersectObjects(meshList, false);
  for (const h of hits) {
    if (!h.object.isMesh) continue;
    const info = meshInfo.get(h.object);
    if (!info) continue;
    if (skip.has(info.group)) continue;
    if (info.group === 'environment') continue;
    return { ...h, info };
  }
  return null;
}

const gapRows = [];
const roofHitRows = [];
let tested = 0;
const xs = [];
for (let x = -14; x <= 14; x += 3) xs.push(x);
const zs = [];
for (let z = -58; z <= 44; z += 3) zs.push(z);
const t0 = Date.now();
for (const x of xs) {
  for (const z of zs) {
    // only sample inside the church footprint
    const inNave = Math.abs(x) <= 14 && z >= -44 && z <= 44;
    const inTransept = Math.abs(x) <= 29 && Math.abs(z) <= 14;
    const inApse = z < -44 && Math.hypot(x, z + 45) <= 21;
    if (!inNave && !inTransept && !inApse) continue;
    tested++;
    const h = firstHit(x, 1.8, z, up);
    if (!h) {
      gapRows.push({ x, z, what: 'NOTHING' });
      continue;
    }
    const gy = h.point.y;
    if (h.info.group !== 'interior') {
      roofHitRows.push({ x, z, y: gy, group: h.info.group, mat: h.info.mat, name: h.object.name || '' });
    } else if (gy > 46.5) {
      // impossible for interior ceilings over the nave, but flag it
      roofHitRows.push({ x, z, y: gy, group: h.info.group, mat: h.info.mat, name: h.object.name || '' });
    }
  }
}
console.log(`\nupward rays: ${tested} tested in ${Date.now() - t0} ms`);
console.log(`rays that saw NO interior ceiling: ${gapRows.length}`);
for (const r of gapRows.slice(0, 40)) console.log(`  gap at x=${r.x} z=${r.z} ${r.what}`);
const byGroup = {};
for (const r of roofHitRows) byGroup[r.group + '/' + r.mat] = (byGroup[r.group + '/' + r.mat] || 0) + 1;
console.log(`rays whose first hit was NOT my interior: ${roofHitRows.length}`, JSON.stringify(byGroup));
for (const r of roofHitRows.slice(0, 40)) {
  console.log(`  x=${r.x} z=${r.z} y=${r.y.toFixed(2)} <- ${r.group}/${r.mat} ${r.name}`);
}
process.exit(0);
