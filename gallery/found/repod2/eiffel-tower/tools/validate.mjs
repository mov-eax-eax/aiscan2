/**
 * Headless sanity check for the geometry (no DOM, no WebGL).
 *   node tools/validate.mjs
 */
import * as THREE from 'three';
import { buildTower } from '../src/tower.js';
import { DIM, GROUND_Y } from '../src/config.js';
import { halfWidth, legHalf, legCentre } from '../src/profile.js';

let failures = 0;
const near = (a, b, tol, label) => {
  const ok = Math.abs(a - b) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}: ${a.toFixed(3)} (expected ${b} ±${tol})`);
};

console.log('\n— profile —');
near(halfWidth(0), 62.45, 0.01, 'half width at ground (124.9 m square)');
near(halfWidth(DIM.h1) * 2, 63.0, 0.6, 'structure width at 1st floor');
near(halfWidth(DIM.h2) * 2, 35.0, 0.2, 'structure width at 2nd floor');
near(halfWidth(DIM.h3) * 2, 10.4, 0.2, 'structure width at summit');
near(halfWidth(DIM.roof) * 2, 5.8, 0.2, 'campanile width at 300.65 m');
near(legHalf(0) * 2, 13.6, 0.01, 'pillar box at ground');

console.log('\n— key heights —');
near(DIM.h1, 57.63, 0.001, '1st floor');
near(DIM.h2, 115.73, 0.001, '2nd floor');
near(DIM.h3, 276.13, 0.001, 'summit');
near(DIM.roof, 300.65, 0.001, 'roof');
near(DIM.tip, 330.0, 0.001, 'antenna tip');

console.log('\n— build —');
const t0 = Date.now();
const tower = buildTower({});
const ms = Date.now() - t0;
console.log(`built ${tower.counts.total.toLocaleString('en-US')} members in ${ms} ms`);
for (const [k, v] of Object.entries(tower.counts)) {
  if (k !== 'total') console.log(`   ${k.padEnd(10)} ${v.toLocaleString('en-US')}`);
}

console.log('\n— instance data —');
let bad = 0;
for (const [name, part] of Object.entries(tower.parts)) {
  const arr = part.instanceMatrix.array;
  let n = 0;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) n++;
  if (n) {
    failures++;
    console.log(`FAIL  ${name}: ${n} non-finite matrix values`);
  } else {
    console.log(`ok    ${name}: ${part.count} instances, all finite`);
  }
  bad += n;
  if (part.instanceColor) {
    const c = part.instanceColor.array;
    for (let i = 0; i < c.length; i++) if (!Number.isFinite(c[i])) bad++;
  }
}

console.log('\n— world bounding box (tower is rotated 45°) —');
const box = new THREE.Box3().setFromObject(tower.group);
console.log(`   x ${box.min.x.toFixed(2)} … ${box.max.x.toFixed(2)}`);
console.log(`   y ${box.min.y.toFixed(2)} … ${box.max.y.toFixed(2)}`);
console.log(`   z ${box.min.z.toFixed(2)} … ${box.max.z.toFixed(2)}`);
near(box.max.y, 330.0, 2.0, 'total height to antenna tip');
near(box.min.y, GROUND_Y, 0.05, 'masonry reaches the ground plane');
const halfDiag = DIM.halfBase * Math.SQRT2;
const spread = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
const spreadOk = spread >= halfDiag - 1 && spread <= halfDiag + 24;
if (!spreadOk) failures++;
console.log(
  `${spreadOk ? 'ok  ' : 'FAIL'}  ground spread incl. base pavilions: ${spread.toFixed(2)} m ` +
    `(pillar diagonals ${halfDiag.toFixed(2)} m)`,
);
near(legCentre(0), 55.65, 0.01, 'pillar centre at ground');

console.log('\n— lifts —');
for (const l of tower.lifts) {
  const before = l.object.position.clone();
  const { updateLift } = await import('../src/tower.js');
  updateLift(l, 0.5);
  const ok = Number.isFinite(l.object.position.x) && l.object.position.y > l.y0 && l.object.position.y < l.y1;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  lift at mid travel: y=${l.object.position.y.toFixed(1)} m`);
  l.object.position.copy(before);
}

console.log('\n— sparkle bulbs —');
{
  const { createBulbs } = await import('../src/sparkle.js');
  const bulbs = createBulbs(tower.builders, 4000);
  const p = bulbs.geometry.attributes.position.array;
  let bad2 = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxR = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (!Number.isFinite(p[i]) || !Number.isFinite(p[i + 1]) || !Number.isFinite(p[i + 2])) bad2++;
    minY = Math.min(minY, p[i + 1]);
    maxY = Math.max(maxY, p[i + 1]);
    maxR = Math.max(maxR, Math.hypot(p[i], p[i + 2]));
  }
  const ok = bad2 === 0 && minY > -5 && maxY < 335 && maxR < 92;
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  4000 bulbs on the ironwork: y ${minY.toFixed(1)}…${maxY.toFixed(1)} m, ` +
      `max radius ${maxR.toFixed(1)} m, ${bad2} non-finite`,
  );
}

console.log('\n— sky presets / lights —');
{
  const { createWorld } = await import('../src/world.js');
  const { SKIES } = await import('../src/config.js');
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  for (const name of Object.keys(SKIES)) {
    try {
      world.setSky(name);
      console.log(`ok    preset "${name}": sun ${world.sun.intensity}, spotlights ${world.spots.filter((s) => s.visible).length}`);
    } catch (e) {
      failures++;
      console.log(`FAIL  preset "${name}": ${e.message}`);
    }
  }
}

console.log(`\n${failures ? `✗ ${failures} check(s) failed` : '✓ all checks passed'}\n`);
process.exit(failures ? 1 : 0);
