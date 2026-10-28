// Offline geometry audit for the Glory façade + outer shell.
//
// Runs the real builder modules in Node (three.js geometry maths needs no GPU or
// DOM) against a headless canvas stub, records every geometry each builder adds,
// and asserts the layout invariants that matter for integration:
//
//   1. NOTHING built by the Glory façade builder may sit behind the façade plane:
//      every geometry's bounding box must have min.z > 40 ("the Glory wall and
//      all its attached elements live on the south face"). This catches the
//      class of bug where local-kit geometry is never moved from z≈0 onto the
//      wall plane.
//   2. The nave/transept shell must not put any geometry wholly inside the
//      central temple volume (|x| < 14.6 and |z| < 44.4).
//   3. The apse shell must stay north of the crossing (max.z < -40).
//   4. The Glory wall panel itself must be exactly on z = 45.0..46.6.
//   5. The stained-glass regions must keep per-pane colour variety (the rose
//      must not be a single flat hue).
//
// Usage:
//   node --import ./qa/glory-shell/audit.mjs        (from the project root)
// Exit code 0 = all assertions pass.

import { register } from 'node:module';

register('./three-loader.mjs', import.meta.url);

// ---------------------------------------------------------------- DOM stub
function makeCanvas() {
  const state = { width: 256, height: 256 };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop === 'canvas') return canvas;
      if (prop === 'measureText') return () => ({ width: 120 });
      if (
        prop === 'createRadialGradient' ||
        prop === 'createLinearGradient' ||
        prop === 'createPattern'
      ) {
        return () => ({ addColorStop() {} });
      }
      if (prop in target) return target[prop];
      if (typeof prop === 'string') return () => {};
      return undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  const canvas = {
    get width() {
      return state.width;
    },
    set width(v) {
      state.width = v;
    },
    get height() {
      return state.height;
    },
    set height(v) {
      state.height = v;
    },
    getContext: () => ctx,
    style: {},
  };
  return canvas;
}
globalThis.document = {
  createElement: () => makeCanvas(),
  createElementNS: () => makeCanvas(),
};
globalThis.window = globalThis;

// ---------------------------------------------------------------- imports
const THREE = await import('three');
const { createKit } = await import('../../src/glory-shell/kit.js');
const { buildGloryFacade } = await import('../../src/glory-shell/glory-facade.js');
const { buildNaveShell } = await import('../../src/glory-shell/nave.js');
const { buildApseExterior } = await import('../../src/glory-shell/apse.js');

const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function bboxOf(geo) {
  const p = geo.attributes && geo.attributes.position;
  if (!p) return null;
  const bb = new THREE.Box3();
  bb.setFromBufferAttribute(p);
  return bb;
}

function makeRecordingKit() {
  const kit = createKit();
  const adds = [];
  const glass = [];
  const rawAdd = kit.add.bind(kit);
  const rawGlass = kit.addGlass.bind(kit);
  kit.add = (key, geo) => {
    const bb = geo ? bboxOf(geo) : null;
    if (bb) adds.push({ key, bb });
    return rawAdd(key, geo);
  };
  kit.addGlass = (region, geo, color) => {
    const bb = geo ? bboxOf(geo) : null;
    if (bb) glass.push({ region, bb, color, hasVertexColors: !!(geo.attributes && geo.attributes.color), geo });
    return rawGlass(region, geo, color);
  };
  return { kit, adds, glass };
}

// ------------------------------------------------------- 1. Glory façade
{
  const { kit, adds, glass } = makeRecordingKit();
  buildGloryFacade(kit);
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const behind = [];
  for (const a of adds) {
    minZ = Math.min(minZ, a.bb.min.z);
    maxZ = Math.max(maxZ, a.bb.max.z);
    minX = Math.min(minX, a.bb.min.x);
    maxX = Math.max(maxX, a.bb.max.x);
    minY = Math.min(minY, a.bb.min.y);
    maxY = Math.max(maxY, a.bb.max.y);
    if (a.bb.min.z <= 40) behind.push(a);
  }
  console.log(
    `\nGlory façade: ${adds.length} geometries, x ${minX.toFixed(2)}..${maxX.toFixed(2)}, ` +
      `y ${minY.toFixed(2)}..${maxY.toFixed(2)}, z ${minZ.toFixed(2)}..${maxZ.toFixed(2)}`
  );
  // Diagnostics: anything far below ground or behind the façade plane gets named.
  const low = [...adds].sort((a, b) => a.bb.min.y - b.bb.min.y).slice(0, 3);
  const lowY = adds.filter((a) => a.bb.min.y < -1.2);
  if (lowY.length) {
    console.log(
      `    note: ${lowY.length} geometry(ies) dip below y=-1.2, lowest: ` +
        low.map((a) => `${a.key}@y=${a.bb.min.y.toFixed(2)}`).join(', ')
    );
  }
  check(
    'Glory façade: every geometry lies at the south façade plane (min.z > 40)',
    behind.length === 0,
    behind.length
      ? `${behind.length} geometry(ies) behind the plane, e.g. z=${behind[0].bb.min.z.toFixed(2)} (${behind[0].key})`
      : 'all z > 40'
  );
  // No façade geometry may reach into the nave volume behind the wall (catches
  // local-frame pieces that are missing their world x/y/z translation).
  const intoNave = adds.filter((a) => a.bb.max.x < 14.6 && a.bb.min.x > -14.6 && a.bb.min.z < 44.9);
  check(
    'Glory façade: nothing extends behind the wall inside |x| < 14.6',
    intoNave.length === 0,
    intoNave.length
      ? `${intoNave.length} geometry(ies), e.g. ${intoNave[0].key} z=${intoNave[0].bb.min.z.toFixed(2)} x=${intoNave[0].bb.min.x.toFixed(2)}..${intoNave[0].bb.max.x.toFixed(2)}`
      : 'clean'
  );
  const belowGround = adds.filter((a) => a.bb.min.y < -2.2);
  check(
    'Glory façade: no geometry more than 2 m below the plaza',
    belowGround.length === 0,
    belowGround.length
      ? `${belowGround.length} geometry(ies), e.g. ${belowGround[0].key} y=${belowGround[0].bb.min.y.toFixed(2)}`
      : 'clean (wall panel intentionally starts at y=-2)'
  );
  // The main wall panel is the 48 m wide piece with door + rose holes.
  const wall = adds
    .filter((a) => a.bb.max.x - a.bb.min.x > 47 && a.bb.max.y - a.bb.min.y > 45)
    .sort((a, b) => b.bb.max.x - b.bb.min.x - (a.bb.max.x - a.bb.min.x))[0];
  if (!wall) {
    check('Glory wall panel found', false, 'no 48 m × 47 m panel geometry recorded');
  } else {
    const zOk = Math.abs(wall.bb.min.z - 45.0) < 0.05 && Math.abs(wall.bb.max.z - 46.6) < 0.05;
    check(
      'Glory wall panel sits on z = 45.00..46.60',
      zOk,
      `x ${wall.bb.min.x.toFixed(2)}..${wall.bb.max.x.toFixed(2)}, z ${wall.bb.min.z.toFixed(2)}..${wall.bb.max.z.toFixed(2)}`
    );
  }
  // Glass variety (regression guard for the "flat dark window" bug).
  const rose = glass.filter((g) => g.region === 'rose');
  const cool = glass.filter((g) => g.region === 'cool');
  const warm = glass.filter((g) => g.region === 'warm');
  function distinctColours(entries) {
    const set = new Set();
    for (const e of entries) {
      const c = e.geo.attributes && e.geo.attributes.color;
      if (!c) continue;
      const step = Math.max(1, Math.floor(c.count / 500));
      for (let i = 0; i < c.count; i += step) {
        set.add(`${c.getX(i).toFixed(2)},${c.getY(i).toFixed(2)},${c.getZ(i).toFixed(2)}`);
      }
    }
    return set.size;
  }
  const roseColours = distinctColours(rose);
  console.log(`Glory glass: rose ${rose.length} parts (${roseColours} distinct colours), cool ${cool.length}, warm ${warm.length}`);
  check(
    'Glory rose glass keeps per-pane colour variety (>= 6 distinct colours)',
    roseColours >= 6,
    `${roseColours} distinct colours in the rose region`
  );
}

// ------------------------------------------------------- 2/3. Nave + apse
function auditShell(name, fn, { centralBox = true, expectNorth = false } = {}) {
  const { kit, adds } = makeRecordingKit();
  fn(kit);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const insideCentral = [];
  for (const a of adds) {
    minX = Math.min(minX, a.bb.min.x);
    maxX = Math.max(maxX, a.bb.max.x);
    minZ = Math.min(minZ, a.bb.min.z);
    maxZ = Math.max(maxZ, a.bb.max.z);
    if (
      centralBox &&
      a.bb.max.x < 14.6 &&
      a.bb.min.x > -14.6 &&
      a.bb.max.z < 44.4 &&
      a.bb.min.z > -44.4
    ) {
      insideCentral.push(a);
    }
  }
  console.log(
    `\n${name}: ${adds.length} geometries, x ${minX.toFixed(2)}..${maxX.toFixed(2)}, z ${minZ.toFixed(2)}..${maxZ.toFixed(2)}`
  );
  if (centralBox) {
    check(
      `${name}: no geometry wholly inside the central temple volume (|x| < 14.6, |z| < 44.4)`,
      insideCentral.length === 0,
      insideCentral.length ? `${insideCentral.length} offending geometry(ies)` : 'clean'
    );
  }
  if (expectNorth) {
    check(`${name}: shell stays north of the crossing (max.z < -40)`, maxZ < -40, `max.z = ${maxZ.toFixed(2)}`);
  }
  return adds;
}
auditShell('Nave + transept shell', buildNaveShell);
auditShell('Apse exterior', buildApseExterior, { expectNorth: true });

// ------------------------------------------------------- 4. totals
{
  const { kit } = makeRecordingKit();
  buildGloryFacade(kit);
  buildNaveShell(kit);
  buildApseExterior(kit);
  let triangles = 0;
  for (const [, list] of kit.parts) {
    for (const geo of list) {
      if (!geo) continue;
      triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    }
  }
  for (const [, list] of Object.entries(kit.glass)) {
    for (const part of list) {
      const geo = part && part.geo;
      if (!geo) continue;
      triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    }
  }
  console.log(`\nTotals: ${Math.round(triangles).toLocaleString()} triangles, ${kit.colliders.length} colliders`);
  check('Triangle budget <= 450k', triangles <= 450000, `${Math.round(triangles).toLocaleString()} triangles`);
}

// ------------------------------------------------------- 5. merged build
// Run the public builder end-to-end (materials + merge) and verify the merged
// meshes and the built-in Glory-wall assertion.
{
  const { buildGloryShell } = await import('../../src/glory-shell.js');
  const result = buildGloryShell({});
  const group = result.group;
  let mergedTris = 0;
  let meshes = 0;
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry;
    mergedTris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  const wallMesh = group.getObjectByName('gs:glory');
  let wallZ = null;
  if (wallMesh && wallMesh.geometry) {
    wallMesh.geometry.computeBoundingBox();
    wallZ = wallMesh.geometry.boundingBox;
  }
  const glassMeshes = group.children.filter((c) => c.isMesh && /^gs:glass:/.test(c.name)).length;
  console.log(
    `\nMerged build: ${meshes} meshes, ${Math.round(mergedTris).toLocaleString()} triangles, ` +
      `${glassMeshes} glass meshes, ${result.colliders.length} colliders, ${result.hotspots.length} hotspots`
  );
  check(
    'Merged Glory wall mesh sits at z 45..47 (min.z > 40)',
    !!wallZ && wallZ.min.z > 40,
    wallZ ? `z ${wallZ.min.z.toFixed(2)}..${wallZ.max.z.toFixed(2)}` : 'mesh not found'
  );
  check('Merged build under 450k triangles', mergedTris <= 450000, `${Math.round(mergedTris).toLocaleString()} triangles`);
  check('Hotspots >= 6', result.hotspots.length >= 6, `${result.hotspots.length} hotspots`);
  check('Colliders present', result.colliders.length > 50, `${result.colliders.length} colliders`);
  check('Walkables empty (environment owns the ground)', result.walkables.length === 0);
}

console.log(`\n${failures === 0 ? 'AUDIT PASSED' : `AUDIT FAILED (${failures} assertion(s))`}`);
process.exitCode = failures === 0 ? 0 : 1;
