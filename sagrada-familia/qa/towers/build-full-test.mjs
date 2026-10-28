// Full buildTowers() smoke test with a DOM stub: exercises the real material
// creation (procedural canvas textures), merging, instancing and the returned
// colliders/hotspots contract, without a browser or GPU.

function makeCtx() {
  const noop = () => {};
  const base = { measureText: (t) => ({ width: String(t).length * 30 }) };
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      return noop;
    },
    set() {
      return true;
    },
  });
}
function makeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => makeCtx(),
  };
}
globalThis.document = { createElement: () => makeCanvas() };

const { buildTowers } = await import('../../src/towers.js');
const { DIM } = await import('../../src/config.js');

const warnings = [];
const origWarn = console.warn;
console.warn = (...args) => {
  warnings.push(args.map(String).join(' '));
  origWarn(...args);
};

const result = buildTowers({});
console.warn = origWarn;

const group = result.group;
let meshes = 0;
let instanced = 0;
let triangles = 0;
let missingMaterial = 0;
const rows = [];
group.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  if (o.isInstancedMesh) instanced++;
  if (!o.material) missingMaterial++;
  const geo = o.geometry;
  const n = geo.index ? geo.index.count : geo.attributes.position.count;
  const count = o.isInstancedMesh ? o.count : 1;
  const t = (n / 3) * count;
  triangles += t;
  rows.push([o.name, Math.round(t), o.isInstancedMesh ? o.count : 1, o.material && o.material.type]);
});

// contract checks
const problems = [];
if (!group || group.name !== 'towers') problems.push('group missing/name');
if (!Array.isArray(result.colliders) || result.colliders.length !== 6) {
  problems.push(`expected 6 ground colliders, got ${result.colliders && result.colliders.length}`);
}
if (!Array.isArray(result.hotspots) || result.hotspots.length < 6) {
  problems.push(`expected >=6 hotspots, got ${result.hotspots && result.hotspots.length}`);
}
if (!Array.isArray(result.walkables) || result.walkables.length !== 0) problems.push('walkables must be []');
for (const c of result.colliders) {
  if (!['box', 'circle'].includes(c.type)) problems.push(`bad collider type ${c.type}`);
  if (c.y0 !== 0) problems.push(`collider y0 ${c.y0}`);
}
for (const h of result.hotspots) {
  if (!h.id || !h.title || !h.body || !Array.isArray(h.position) || h.position.length !== 3) {
    problems.push(`bad hotspot ${JSON.stringify(h)}`);
  }
}
if (warnings.length) problems.push(`warnings: ${warnings.join(' | ')}`);
if (missingMaterial) problems.push(`${missingMaterial} meshes without material`);

// ground towers must have colliders, raised towers must not
const ground = DIM.apostleTowers.filter((t) => t.ground);
if (result.colliders.length !== ground.length) problems.push('collider count mismatch');

console.log('meshes:', meshes, 'instanced:', instanced, 'triangles:', Math.round(triangles));
console.log('top batches:', rows.sort((a, b) => b[1] - a[1]).slice(0, 8).map((r) => r[0] + ':' + r[1]).join(', '));
console.log('colliders:', JSON.stringify(result.colliders.map((c) => [c.x, c.z, c.hw])));
console.log('hotspots:', result.hotspots.map((h) => h.id).join(', '));
if (problems.length) {
  console.error('PROBLEMS:', problems);
  process.exit(1);
}
console.log('OK');
