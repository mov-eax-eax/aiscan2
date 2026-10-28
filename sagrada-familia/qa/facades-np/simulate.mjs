// Headless runtime validation for the Nativity & Passion façade builders.
// Runs the real builder code in Node with a minimal canvas/document stub (lib.js
// only needs a 2d context to generate textures), then walks the resulting scene
// graph and reports triangles, mesh count, NaN vertices, collider and hotspot
// sanity. No browser, no GPU, a couple of seconds of CPU.
//
//   node qa/facades-np/simulate.mjs
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);

// ---------------------------------------------------------------------------
// Minimal DOM used by lib.js procedural textures
// ---------------------------------------------------------------------------
const noop = () => {};
function makeCtx(canvas) {
  const grad = { addColorStop: noop };
  return {
    canvas,
    measureText: (t) => ({ width: Math.max(8, String(t == null ? '' : t).length * 30) }),
    fillRect: noop,
    clearRect: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    setTransform: noop,
    clip: noop,
    fillText: noop,
    strokeText: noop,
    drawImage: noop,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    putImageData: noop,
  };
}
globalThis.document = {
  createElement(tag) {
    const canvas = {
      tagName: String(tag).toUpperCase(),
      width: 1,
      height: 1,
      style: {},
      getContext: () => makeCtx(canvas),
    };
    return canvas;
  },
  createElementNS(_ns, tag) {
    return this.createElement(tag);
  },
};
globalThis.window = globalThis;

// ---------------------------------------------------------------------------
const t0 = performance.now();
const { buildFacadesNP } = await import('../../src/facades-np.js');
const { DIM } = await import('../../src/config.js');
const THREE = await import('three');
const result = buildFacadesNP({});
const buildMs = performance.now() - t0;

const V = new THREE.Vector3();
let tris = 0;
let meshes = 0;
let vertices = 0;
let nan = 0;
const names = [];
const emptyBounds = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const bounds = { nativity: emptyBounds(), passion: emptyBounds(), other: emptyBounds() };
const negativeY = new Map(); // meshName -> { count, min, max }
const recordNegative = (name, x, y, z) => {
  let e = negativeY.get(name);
  if (!e) {
    e = { count: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    negativeY.set(name, e);
  }
  e.count++;
  e.min = [Math.min(e.min[0], x), Math.min(e.min[1], y), Math.min(e.min[2], z)];
  e.max = [Math.max(e.max[0], x), Math.max(e.max[1], y), Math.max(e.max[2], z)];
};

// Door clearances: any vertex inside a generous box through each opening would
// mean geometry in the passage. Local façade coords (u, y, w).
const sideOf = (groupName) => (groupName.startsWith('nativity') ? 1 : -1);
const doorsOf = (side) =>
  (side === 1 ? DIM.doors.nativity : DIM.doors.passion).map((d) => ({
    ...d,
    u: side * -d.coord,
    // clearance test stops below the carved tympanum inside the porch
    maxY: d.w > 7 ? (side === 1 ? 10.6 : 13.6) : side === 1 ? 7.7 : 9.3,
  }));
const doorStats = { nativity: 0, passion: 0 };
const doorOffenders = new Map();
let lowest = { y: Infinity, where: null };

result.group.updateWorldMatrix(true, true);
result.group.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  meshes++;
  names.push(o.name || '(unnamed)');
  const g = o.geometry;
  const pos = g.attributes.position;
  const count = pos ? pos.count : 0;
  vertices += count;
  tris += g.index ? g.index.count / 3 : count / 3;
  if (!pos) return;
  // world transform once per mesh, then classify vertices into façade bounds
  let facade = null;
  let p = o.parent;
  while (p) {
    if (p.name === 'nativity-facade' || p.name === 'passion-facade') {
      facade = p.name;
      break;
    }
    p = p.parent;
  }
  const side = facade ? sideOf(facade) : 0;
  const doors = side ? doorsOf(side) : [];
  const bb = facade === 'nativity-facade' ? bounds.nativity : facade === 'passion-facade' ? bounds.passion : bounds.other;
  for (let i = 0; i < pos.count; i++) {
    V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    if (!Number.isFinite(V.x) || !Number.isFinite(V.y) || !Number.isFinite(V.z)) nan++;
    if (V.y < lowest.y) lowest = { y: V.y, where: o.name, world: [V.x, V.y, V.z] };
    if (V.y < -1.2) recordNegative(o.name, V.x, V.y, V.z);
    bb.min[0] = Math.min(bb.min[0], V.x);
    bb.min[1] = Math.min(bb.min[1], V.y);
    bb.min[2] = Math.min(bb.min[2], V.z);
    bb.max[0] = Math.max(bb.max[0], V.x);
    bb.max[1] = Math.max(bb.max[1], V.y);
    bb.max[2] = Math.max(bb.max[2], V.z);
    if (!side) continue;
    // local façade coordinates
    const u = side === 1 ? -V.z : V.z;
    const w = side === 1 ? V.x - 30.8 : -30.8 - V.x;
    const y = V.y;
    for (const d of doors) {
      const half = d.w / 2 - 0.2;
      if (Math.abs(u - d.u) < half && Math.abs(w) < 0.62 && y > 0.25 && y < d.maxY) {
        doorStats[side === 1 ? 'nativity' : 'passion']++;
        const k = `${o.name} @door ${d.id}`;
        doorOffenders.set(k, (doorOffenders.get(k) || 0) + 1);
        break;
      }
    }
  }
});

const colliderProblems = [];
for (const c of result.colliders) {
  const nums = c.type === 'box' ? [c.x, c.z, c.hw, c.hd, c.y0, c.y1, c.ry] : [c.x, c.z, c.r, c.y0, c.y1];
  if (nums.some((v) => typeof v === 'number' && !Number.isFinite(v))) colliderProblems.push(c);
}

// Walkable-passage checks: every collider is reduced to an XZ AABB and tested
// against the three door passages and against the interior floor path.
const colliderDoors = [];
const colliderInterior = [];
const doorPassages = (side) =>
  (side === 1 ? DIM.doors.nativity : DIM.doors.passion).map((d) => ({
    id: d.id,
    z0: d.coord - d.w / 2 + 0.05,
    z1: d.coord + d.w / 2 - 0.05,
    x0: side === 1 ? 30.0 : -31.6,
    x1: side === 1 ? 31.6 : -30.0,
  }));
for (const c of result.colliders) {
  const x0 = c.type === 'box' ? c.x - c.hw : c.x - c.r;
  const x1 = c.type === 'box' ? c.x + c.hw : c.x + c.r;
  const z0 = c.type === 'box' ? c.z - c.hd : c.z - c.r;
  const z1 = c.type === 'box' ? c.z + c.hd : c.z + c.r;
  if ((c.y0 ?? 0) > 6 || (c.y1 ?? 200) < 0.5) continue; // does not block a walking body
  for (const side of [1, -1]) {
    for (const p of doorPassages(side)) {
      if (x1 > p.x0 && x0 < p.x1 && z1 > p.z0 && z0 < p.z1) {
        colliderDoors.push({ type: c.type, x: c.x, z: c.z, atDoor: p.id });
      }
    }
  }
  // interior side: nativity interior is x < 30, passion interior x > -30
  if (x0 < 29.9 && x1 > 29.0 && z1 > -30 && z0 < 30) {
    colliderInterior.push({ side: 'nativity', type: c.type, x: c.x, z: c.z, x0 });
  }
  if (x1 > -29.9 && x0 < -29.0 && z1 > -30 && z0 < 30) {
    colliderInterior.push({ side: 'passion', type: c.type, x: c.x, z: c.z, x1 });
  }
}
const hotspotProblems = [];
for (const h of result.hotspots) {
  if (!h.id || !h.title || !h.body) hotspotProblems.push(`hotspot ${h.id} missing fields`);
  if (!Array.isArray(h.position) || h.position.length !== 3 || h.position.some((v) => !Number.isFinite(v)))
    hotspotProblems.push(`hotspot ${h.id} bad position`);
  if (!(h.radius >= 10 && h.radius <= 16)) hotspotProblems.push(`hotspot ${h.id} radius ${h.radius}`);
  // must be discoverable by a walking visitor standing in front of the façade
  if (Math.abs(h.position[1] - 1.72) > h.radius - 1) {
    hotspotProblems.push(`hotspot ${h.id} is not reachable on foot (y ${h.position[1]}, r ${h.radius})`);
  }
  const side = h.position[0] > 0 ? 1 : -1;
  if (side === 1 && h.position[0] < 31.7) hotspotProblems.push(`hotspot ${h.id} inside the east wall`);
  if (side === -1 && h.position[0] > -31.7) hotspotProblems.push(`hotspot ${h.id} inside the west wall`);
}

// ---------------------------------------------------------------------------
// Collision audit — walk a player capsule through the façade walls using the
// app's real collide.js. Solid bands must block from both sides; door gaps must
// stay passable. Also probes the wall centre line directly.
// ---------------------------------------------------------------------------
const { prepareColliders, resolveCollisions, isClear } = await import('../../src/experience/collide.js');
const prepared = prepareColliders(result.colliders);
const PLAYER_R = 0.42;
const PLAYER_H = 1.7;
const wallBoxes = result.colliders
  .filter((c) => c.type === 'box' && Math.abs(Math.abs(c.x) - 30.8) < 0.01)
  .map((c) => ({ x: c.x, z: c.z, hw: c.hw, hd: c.hd, y0: c.y0, y1: c.y1, covers: [c.z - c.hd, c.z + c.hd] }));

const solidZs = [-22, -20, -18, -17.2, -8.6, -7.5, -6.4, 6.0, 7.5, 8.6, 17.2, 18, 20, 22];
const doorZs = [0, -3, 3, -12.5, 12.5, -11, 11, -14, 14];
const gapIntervals = [
  [-4.5, 4.5],
  [-15.25, -9.75],
  [9.75, 15.25],
];
const collisionFailures = [];
const walksThrough = (side, z, fromInterior) => {
  const dir = fromInterior ? side : -side;
  const p = { x: fromInterior ? side * 20 : side * 45, z };
  for (let i = 0; i < 500; i++) {
    p.x += dir * 0.06;
    resolveCollisions(p, PLAYER_R, prepared, 0, PLAYER_H);
  }
  if (side === 1) return fromInterior ? p.x > 31.75 : p.x < 29.85;
  return fromInterior ? p.x < -31.75 : p.x > -29.85;
};
let solidBlocked = 0;
for (const side of [1, -1]) {
  for (const z of solidZs) {
    for (const fromInterior of [true, false]) {
      if (walksThrough(side, z, fromInterior)) {
        collisionFailures.push({ side, z, from: fromInterior ? 'interior' : 'exterior', expected: 'blocked' });
      } else {
        solidBlocked++;
      }
    }
  }
}
let doorsPassed = 0;
for (const side of [1, -1]) {
  for (const z of doorZs) {
    for (const fromInterior of [true, false]) {
      if (walksThrough(side, z, fromInterior)) doorsPassed++;
      else collisionFailures.push({ side, z, from: fromInterior ? 'interior' : 'exterior', expected: 'passable' });
    }
  }
}
const wallProbeFailures = [];
for (const side of [1, -1]) {
  for (const z of solidZs) {
    if (isClear(side * 30.8, z, PLAYER_R, prepared, 0, PLAYER_H)) {
      wallProbeFailures.push({ side, z, x: side * 30.8, expected: 'blocked' });
    }
  }
  for (const z of doorZs) {
    if (!isClear(side * 30.8, z, PLAYER_R, prepared, 0, PLAYER_H)) {
      wallProbeFailures.push({ side, z, x: side * 30.8, expected: 'clear' });
    }
  }
}
// Fine sweep across the whole wall: the capsule must be blocked everywhere
// except inside the three door gaps (with a capsule-radius margin).
const sweepFailures = [];
for (const side of [1, -1]) {
  for (let z = -23.9; z <= 23.9; z += 0.1) {
    const inGap = gapIntervals.some(([a, b]) => z > a + PLAYER_R + 0.02 && z < b - PLAYER_R - 0.02);
    const clear = isClear(side * 30.8, z, PLAYER_R, prepared, 0, PLAYER_H);
    if (clear !== inGap) sweepFailures.push({ side, z: Math.round(z * 10) / 10, clear, expected: inGap ? 'clear' : 'blocked' });
  }
}
// Tunnelling check: march at a coarse 0.5 m step (fast sprint) through z = ±18.
const coarseFailures = [];
for (const side of [1, -1]) {
  for (const z of [-18, 18]) {
    for (const fromInterior of [true, false]) {
      const dir = fromInterior ? side : -side;
      const p = { x: fromInterior ? side * 20 : side * 45, z };
      for (let i = 0; i < 80; i++) {
        p.x += dir * 0.5;
        resolveCollisions(p, PLAYER_R, prepared, 0, PLAYER_H);
      }
      const crossedWall = side === 1 ? (fromInterior ? p.x > 31.75 : p.x < 29.85) : fromInterior ? p.x < -31.75 : p.x > -29.85;
      if (crossedWall) coarseFailures.push({ side, z, from: fromInterior ? 'interior' : 'exterior', finalX: p.x });
    }
  }
}

const payload = {
  buildMs: Math.round(buildMs),
  meshes,
  triangles: Math.round(tris),
  vertices,
  nanVertices: nan,
  colliders: result.colliders.length,
  bounds,
  lowestVertex: lowest,
  negativeVertices: Object.fromEntries(negativeY),
  doorClearanceViolations: doorStats,
  doorOffenders: [...doorOffenders.entries()],
  hotspots: result.hotspots.map((h) => ({ id: h.id, radius: h.radius, at: h.position })),
  walkables: result.walkables.length,
  groups: result.group.children.map((g) => g.name),
  meshNames: names,
  colliderProblems,
  colliderDoors,
  colliderInterior,
  hotspotProblems,
  wallBoxes,
  collisionAudit: {
    solidBlocked,
    doorsPassed,
    failures: collisionFailures,
    wallProbeFailures,
    sweepFailures,
    coarseFailures,
  },
};
console.log(JSON.stringify(payload, null, 2));

if (nan > 0 || colliderProblems.length || hotspotProblems.length) process.exit(1);
if (colliderDoors.length > 0) {
  console.log('[simulate] FAIL — collider(s) inside a door passage', colliderDoors);
  process.exit(1);
}
if (colliderInterior.length > 0) {
  console.log('[simulate] FAIL — collider(s) on the interior floor path', colliderInterior);
  process.exit(1);
}
if (doorStats.nativity > 0 || doorStats.passion > 0) {
  console.log('[simulate] FAIL — geometry inside a door passage');
  process.exit(1);
}
if (result.colliders.length < 8) process.exit(1);
if (result.hotspots.length < 5) process.exit(1);
if (collisionFailures.length > 0) {
  console.log('[simulate] FAIL — capsule crossed a solid wall or failed a door', JSON.stringify(collisionFailures.slice(0, 20)));
  process.exit(1);
}
if (wallProbeFailures.length > 0) {
  console.log('[simulate] FAIL — wall centre-line probe wrong', JSON.stringify(wallProbeFailures.slice(0, 20)));
  process.exit(1);
}
if (sweepFailures.length > 0) {
  console.log('[simulate] FAIL — wall collider sweep found a gap', JSON.stringify(sweepFailures.slice(0, 20)));
  process.exit(1);
}
if (coarseFailures.length > 0) {
  console.log('[simulate] FAIL — capsule tunnelled through z=±18', JSON.stringify(coarseFailures));
  process.exit(1);
}
console.log('[simulate] OK');
