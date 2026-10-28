// Offline geometry probe for the interior builder — runs in Node, no browser,
// no GPU. It stubs the handful of DOM APIs the procedural textures touch,
// resolves the bare 'three' specifier to the vendored module, builds the whole
// interior and reports triangle counts, colliders, NaN vertices and which
// meshes sit near given eye points.
//
// Usage: node qa/interior/offline-probe.mjs [x,y,z ...]
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, '../../vendor/three.module.min.js');

// --- resolve the bare 'three' specifier to the vendor build -------------------
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: pathToFileURL(vendor).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

// --- minimal canvas/2d-context stub for the procedural textures ---------------
function makeCtx() {
  const grad = { addColorStop() {} };
  const ctx = {
    canvas: null,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createPattern: () => null,
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    arc() {},
    ellipse() {},
    rect() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    drawImage() {},
    fillText() {},
    strokeText() {},
    measureText: (t) => ({ width: String(t).length * 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData() {},
  };
  return ctx;
}
function makeCanvas() {
  const c = { width: 1, height: 1, style: {}, getContext: () => makeCtx() };
  c.getContext = () => {
    const ctx = makeCtx();
    ctx.canvas = c;
    return ctx;
  };
  return c;
}
globalThis.document = { createElement: () => makeCanvas(), createElementNS: () => makeCanvas() };

// --- build -------------------------------------------------------------------
const THREE = await import(pathToFileURL(vendor).href);
const { buildInterior } = await import(pathToFileURL(path.resolve(here, '../../src/interior.js')).href);

globalThis.__INTERIOR_TRACE = [];
const t0 = Date.now();
const interior = buildInterior({});
const buildMs = Date.now() - t0;

let tris = 0;
let meshCount = 0;
let nanVerts = 0;
const perMesh = [];
const box = new THREE.Box3();
const size = new THREE.Vector3();

interior.group.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  meshCount++;
  const g = o.geometry;
  const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
  const t = (n / 3) * (o.isInstancedMesh ? o.count : 1);
  tris += t;
  const p = g.attributes.position;
  if (p) {
    for (let i = 0; i < p.count * 3; i++) if (!Number.isFinite(p.array[i])) nanVerts++;
  }
  g.computeBoundingBox();
  box.copy(g.boundingBox || new THREE.Box3());
  box.getSize(size);
  perMesh.push({
    name: o.name || o.type,
    tris: Math.round(t),
    size: [size.x, size.y, size.z],
    min: box.min.toArray(),
    max: box.max.toArray(),
    bb: box.clone(),
  });
});

const points = process.argv.slice(2).length
  ? process.argv.slice(2).map((s) => s.split(',').map(Number))
  : [[0, 1.7, 33], [0, 1.7, 22], [0, 3, 8], [0, 2.2, -2]];

console.log(`build: ${buildMs} ms`);
console.log(`group userData.triangles = ${interior.group.userData.triangles}`);
console.log(`counted triangles = ${Math.round(tris)}   meshes = ${meshCount}`);
console.log(`NaN vertices = ${nanVerts}`);
console.log(`colliders = ${interior.colliders.length}  walkables = ${interior.walkables.length}  hotspots = ${interior.hotspots.length}`);
const instanced = perMesh.filter((m) => m.name.includes('Instanced'));
if (instanced.length) console.log('instanced meshes:', instanced.map((m) => m.name).join(', '));

console.log('\ntop meshes by triangles:');
for (const m of [...perMesh].sort((a, b) => b.tris - a.tris).slice(0, 12)) {
  console.log(`  ${m.tris.toString().padStart(7)}  ${m.name}  size ${m.size.map((v) => v.toFixed(1)).join('x')}`);
}

console.log('\nmeshes within 2.6 m of the probe points:');
for (const pt of points) {
  const v = new THREE.Vector3(pt[0], pt[1], pt[2]);
  console.log(`  point (${pt.join(',')})`);
  const hits = perMesh
    .map((m) => ({ m, d: m.bb.distanceToPoint(v) }))
    .filter((h) => h.d <= 2.6)
    .sort((a, b) => a.d - b.d);
  if (!hits.length) console.log('    (clear)');
  for (const h of hits.slice(0, 12)) {
    console.log(
      `    d=${h.d.toFixed(2)}  ${h.m.name}  size ${h.m.size.map((x) => x.toFixed(1)).join('x')}  ` +
      `min (${h.m.min.map((x) => x.toFixed(1)).join(',')})  max (${h.m.max.map((x) => x.toFixed(1)).join(',')})`
    );
  }
}

// --- per-geometry trace: which individual pieces are near an eye point? ------
const trace = globalThis.__INTERIOR_TRACE || [];
console.log(`\ngeometry trace: ${trace.length} pieces`);
for (const pt of points) {
  const near = trace
    .filter((g) => {
      if (!g.min || !g.max) return false;
      return (
        g.min[0] - 1.0 <= pt[0] && pt[0] <= g.max[0] + 1.0 &&
        g.min[1] - 1.0 <= pt[1] && pt[1] <= g.max[1] + 1.0 &&
        g.min[2] - 1.0 <= pt[2] && pt[2] <= g.max[2] + 1.0
      );
    })
    .map((g) => {
      const sx = g.max[0] - g.min[0];
      const sy = g.max[1] - g.min[1];
      const sz = g.max[2] - g.min[2];
      return { g, vol: sx * sy * sz, size: [sx, sy, sz] };
    })
    .sort((a, b) => b.vol - a.vol);
  console.log(`  point (${pt.join(',')}) — ${near.length} pieces`);
  for (const n of near.slice(0, 8)) {
    console.log(
      `    ${n.g.key} ${n.g.type} verts=${n.g.verts} size=${n.size.map((x) => x.toFixed(1)).join('x')} ` +
      `min=(${n.g.min.map((x) => x.toFixed(1)).join(',')}) max=(${n.g.max.map((x) => x.toFixed(1)).join(',')})`
    );
  }
}

// sanity: the walkable floor must be flat at y ~ 0 across the nave/transept/apse
const floorMeshes = interior.walkables.filter((w) => w.isMesh);
const floorBox = new THREE.Box3();
for (const f of floorMeshes) {
  f.geometry.computeBoundingBox();
  floorBox.union(f.geometry.boundingBox);
}
console.log('\nwalkable meshes:', floorMeshes.length, 'union bbox min', floorBox.min.toArray().map((v) => v.toFixed(2)), 'max', floorBox.max.toArray().map((v) => v.toFixed(2)));

// collider sanity: types, ranges, radius spread
const types = {};
let badColliders = 0;
for (const c of interior.colliders) {
  types[c.type] = (types[c.type] || 0) + 1;
  if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) badColliders++;
  if (c.type === 'circle' && !(c.r > 0)) badColliders++;
}
console.log('collider types:', JSON.stringify(types), 'bad:', badColliders);

// hotspots sanity
for (const h of interior.hotspots) {
  console.log(`hotspot ${h.id}: pos ${h.position.join(',')} radius ${h.radius} body ${h.body.length} chars`);
}
process.exit(0);
