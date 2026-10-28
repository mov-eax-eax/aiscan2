// Interior columns: the twelve nave tree-columns, eight transept tree-columns,
// the four giant red-porphyry crossing columns, the apse responds and the wall
// pilasters. Every floor-standing column contributes a circle collider.

import {
  THREE,
  treeColumnGeo,
  xform,
  rng,
  rand,
  tubeGeo,
  boxGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  mergeGeos,
  circleCollider,
  boxCollider,
} from '../lib.js';
import { bucket, DIM, PALETTE, octPlinth, capitalGeo, ringBand, bossGeo, crossingDomeY } from './common.js';

/** Extra stone branch reaching out over the aisle to the outer wall. */
function aisleArm(sx, x, z, dz, y0, y1, radius = 0.19) {
  const pts = [
    [x, y0, z + dz * 1.2],
    [x + sx * 1.9, y0 + (y1 - y0) * 0.34, z + dz * 2.0],
    [x + sx * 4.4, y0 + (y1 - y0) * 0.72, z + dz * 2.7],
    [sx * 14.55, y1, z + dz * 3.0],
  ];
  return tubeGeo(pts, radius, { tubularSegments: 20, radialSegments: 5 });
}

export function buildColumns(parent, mats, out) {
  const b = bucket();
  const detail = bucket();
  const rnd = rng(90210);

  // ----------------------------------------------------- nave tree columns (12)
  const naveSeeds = [7, 19, 31, 43, 57, 71, 83, 97, 109, 127, 139, 151];
  let ni = 0;
  for (const z of DIM.naveColumnZ) {
    for (const sx of [-1, 1]) {
      const x = sx * DIM.centralNaveHalf;
      const seed = naveSeeds[ni++ % naveSeeds.length];
      const leanX = -sx * rand(rnd, 1.3, 1.8);
      const leanZ = rand(rnd, -0.8, 0.8);
      const spread = rand(rnd, 3.2, 3.7);

      b.add(
        'basaltLight',
        xform(
          treeColumnGeo({
            height: DIM.treeColumnTopY,
            branchY: DIM.treeBranchY + rand(rnd, -0.5, 0.6),
            branches: 4,
            radius: DIM.naveColumnRadius * rand(rnd, 1.08, 1.2),
            spreadX: spread,
            spreadZ: spread * rand(rnd, 0.8, 1.0),
            seed,
            leanX,
            leanZ,
            topY: 45 + rand(rnd, -0.8, 0.4),
          }),
          { x, z }
        )
      );
      // Base: octagonal plinth + a low stone bench ring.
      b.add('basalt', xform(octPlinth(1.42, 0.95), { x, z }));
      b.add('stone', xform(new THREE.CylinderGeometry(1.5, 1.56, 0.16, 8), { y: 0.08, x, z, ry: Math.PI / 8 }));
      // White stone rings and a carved capital where the tree forks.
      for (let k = 0; k < 3; k++) {
        b.add('stoneLight', xform(ringBand(DIM.naveColumnRadius * (1.05 - k * 0.035), 3.4 + k * 3.9, 0.11, 20), { x, z }));
      }
      const by = DIM.treeBranchY - 0.35;
      b.add('stoneLight', xform(capitalGeo(1.28, { y: by, h: 0.95 }), { x, z }));
      // three thick structural limbs carry the canopy up to the vault
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + rand(rnd, 0.15, 0.9);
        const rr = spread * 0.9;
        const lx = Math.cos(a) * rr;
        const lz = Math.sin(a) * rr;
        b.add('basaltLight', tubeGeo([
          [x + lx * 0.12, DIM.treeBranchY + 0.3, z + lz * 0.12],
          [x + lx * 0.45, DIM.treeBranchY + 7.5, z + lz * 0.45],
          [x + lx * 0.85, 34.5, z + lz * 0.85],
          [x + lx * 1.3 - sx * 1.0, 41.8, z + lz * 1.3],
        ], 0.3, { tubularSegments: 22, radialSegments: 6 }));
        b.add('stoneLight', xform(new THREE.SphereGeometry(0.44, 9, 6), {
          x: x + lx * 0.12,
          y: DIM.treeBranchY + 0.5,
          z: z + lz * 0.12,
        }));
      }
      // Carved medallions on the trunk (both faces of the nave).
      for (let k = 0; k < 2; k++) {
        const a = Math.PI / 2 + Math.PI * k + sx * 0.4;
        const rr = DIM.naveColumnRadius * 1.06;
        const g = bossGeo(0.36, seed + k);
        xform(g, { x: Math.cos(a) * rr, y: 7.2 + k * 6.4, z: Math.sin(a) * rr });
        b.add('stoneLight', xform(g, { x, z }));
      }
      // Branch arms crossing the aisle to the outer wall. The two columns at
      // |z| = 12 stand in the transept opening where there is no nave wall, so
      // they keep their arms to themselves.
      if (Math.abs(z) > 15) {
        for (const dz of [-1, 1]) {
          b.add('basaltLight', xform(aisleArm(sx, x, z, dz * 0.72, 29.4, 35.6), { x: 0, z: 0 }));
          b.add('stoneLight', boxGeo(0.7, 0.55, 0.95, sx * 14.55, 35.6, z + dz * 1.75, 0));
          // high flyer from the canopy to the clerestory wall
          const hi = [
            [x, 42.0, z + dz * 0.9],
            [x + sx * 2.4, 43.2, z + dz * 1.9],
            [x + sx * 5.4, 42.4, z + dz * 2.4],
            [sx * 14.5, 38.0, z + dz * 1.75],
          ];
          b.add('basaltLight', tubeGeo(hi, 0.17, { tubularSegments: 20, radialSegments: 5 }));
          b.add('stoneLight', boxGeo(0.72, 0.6, 0.98, sx * 14.5, 38.0, z + dz * 1.75));
        }
      }
      out.colliders.push(circleCollider(x, z, 1.52, { y0: 0, y1: 4 }));
    }
  }

  // -------------------------------------------------- transept tree columns (8)
  let ti = 220;
  for (const x of [-24, -15, 15, 24]) {
    for (const sz of [-1, 1]) {
      const z = sz * DIM.centralNaveHalf;
      const sx = Math.sign(x);
      const seed = ti++;
      b.add(
        'basaltLight',
        xform(
          treeColumnGeo({
            height: DIM.treeColumnTopY,
            branchY: DIM.treeBranchY + rand(rnd, -0.4, 0.5),
            branches: 4,
            radius: DIM.naveColumnRadius * rand(rnd, 1.05, 1.16),
            spreadX: rand(rnd, 3.0, 3.5),
            spreadZ: rand(rnd, 3.0, 3.6),
            seed,
            leanX: -sx * rand(rnd, 0.9, 1.4) * (Math.abs(x) < 20 ? 1 : 0.4),
            leanZ: -sz * rand(rnd, 1.1, 1.6),
            topY: 45 + rand(rnd, -0.8, 0.4),
          }),
          { x, z }
        )
      );
      b.add('basalt', xform(octPlinth(1.42, 0.95), { x, z }));
      for (let k = 0; k < 2; k++) {
        b.add('stoneLight', xform(ringBand(DIM.naveColumnRadius * (1.04 - k * 0.04), 4.2 + k * 5.4, 0.11, 20), { x, z }));
      }
      b.add('stoneLight', xform(capitalGeo(1.26, { y: DIM.treeBranchY - 0.35, h: 0.95 }), { x, z }));
      // thick limbs supporting the transept vault
      for (let k = 0; k < 2; k++) {
        const a = (k / 2) * Math.PI * 2 + rand(rnd, 0.2, 0.9);
        const rr = 3.0;
        const lx = Math.cos(a) * rr;
        const lz = Math.sin(a) * rr;
        b.add('basaltLight', tubeGeo([
          [x + lx * 0.12, DIM.treeBranchY + 0.3, z + lz * 0.12],
          [x + lx * 0.5, DIM.treeBranchY + 8.5, z + lz * 0.5],
          [x + lx * 0.9, 35.0, z + lz * 0.9],
          [x + lx * 1.3, 42.0, z + lz * 1.3],
        ], 0.28, { tubularSegments: 20, radialSegments: 6 }));
        b.add('stoneLight', xform(new THREE.SphereGeometry(0.4, 8, 6), {
          x: x + lx * 0.12,
          y: DIM.treeBranchY + 0.5,
          z: z + lz * 0.12,
        }));
      }
      // Arms across the transept aisle toward the z = +/-15 walls. The columns
      // at |x| = 15 stand on the crossing edge, so only the outward arm exists.
      const dxs = Math.abs(x) > 20 ? [-1, 1] : [sx];
      for (const dx of dxs) {
        const pts = [
          [x + dx * 1.2, 29.2, z],
          [x + dx * 2.2, 31.6, z + sz * 2.2],
          [x + dx * 2.8, 34.2, z + sz * 4.6],
          [x + dx * 3.0, 35.4, sz * 14.55],
        ];
        b.add('basaltLight', tubeGeo(pts, 0.19, { tubularSegments: 18, radialSegments: 5 }));
        b.add('stoneLight', boxGeo(0.9, 0.55, 0.7, x + dx * 3.0, 35.4, sz * 14.55));
        // high flyer into the void above the transept aisle
        const hi = [
          [x + dx * 0.9, 42.0, z],
          [x + dx * 2.2, 43.0, z + sz * 2.4],
          [x + dx * 2.8, 42.2, z + sz * 4.6],
          [x + dx * 2.9, 38.2, sz * 14.4],
        ];
        b.add('basaltLight', tubeGeo(hi, 0.16, { tubularSegments: 18, radialSegments: 5 }));
        b.add('stoneLight', boxGeo(0.7, 0.55, 0.9, x + dx * 2.9, 38.2, sz * 14.4));
      }
      out.colliders.push(circleCollider(x, z, 1.52, { y0: 0, y1: 4 }));
    }
  }

  // --------------------------------------------- giant porphyry crossing columns
  // Smooth, lighter porphyry shafts with white bands, gold medallions and big
  // white capitals; four branch arms rise to the crossing dome. Kept visually
  // slimmer than the nave trees so the crossing reads as open space.
  let pi = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * DIM.crossingColumn;
      const z = sz * DIM.crossingColumn;
      const seed = 401 + pi++ * 17;
      const R = DIM.crossingColumnRadius;
      // Stepped octagonal base: dark porphyry plinth, white stone bands.
      b.add('porphyryDark', xform(new THREE.CylinderGeometry(R * 1.44, R * 1.58, 0.3, 8), { x, z, y: 0.15, ry: Math.PI / 8 }));
      b.add('marble', xform(ringBand(R * 1.36, 0.4, 0.09, 24), { x, z }));
      b.add('porphyryLight', xform(new THREE.CylinderGeometry(R * 1.1, R * 1.22, 0.42, 8), { x, z, y: 0.65, ry: Math.PI / 8 }));
      b.add('marble', xform(ringBand(R * 1.13, 0.92, 0.1, 24), { x, z }));
      // smooth tapering shaft
      b.add('porphyryLight', xform(new THREE.CylinderGeometry(R * 0.88, R * 0.98, 27.2, 24), { x, z, y: 14.5 }));
      // eight pale reeds give the shaft a lit edge without bulk
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        b.add('porphyry', xform(new THREE.CylinderGeometry(0.13, 0.14, 27.0, 6), {
          x: x + Math.cos(a) * R * 0.88,
          y: 14.5,
          z: z + Math.sin(a) * R * 0.88,
        }));
      }
      // white stone rings, gold band, big white capital
      for (const y of [8.5, 16.5, 24.0]) b.add('marble', xform(ringBand(R * 0.92, y, 0.14, 24), { x, z }));
      b.add('gold', xform(ringBand(R * 0.94, 26.6, 0.09, 24), { x, z }));
      b.add('marble', xform(new THREE.CylinderGeometry(R * 1.04, R * 0.88, 0.6, 16), { x, z, y: 28.45 }));
      b.add('marble', xform(new THREE.CylinderGeometry(R * 1.2, R * 1.04, 0.52, 16), { x, z, y: 29.0 }));
      b.add('gold', xform(ringBand(R * 1.18, 29.3, 0.07, 24), { x, z }));
      // gold rosettes on the shaft, facing the crossing
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        b.add('gold', xform(bossGeo(0.5, seed + k), {
          x: x + Math.cos(a) * R * 0.92,
          y: 7 + k * 5.2,
          z: z + Math.sin(a) * R * 0.92,
        }));
      }
      // Two great branch ribs per column converge cleanly on the lantern ring:
      // the crossing canopy reads as four trees meeting, not a web of tubes.
      const toCentre = Math.atan2(-sz * DIM.crossingColumn, -sx * DIM.crossingColumn);
      for (const da of [-0.2, 0.2]) {
        const a = toCentre + da;
        const tx2 = Math.cos(a) * 6.95;
        const tz2 = Math.sin(a) * 6.95;
        const stem = [x + (tx2 - x) * 0.24, 33.5, z + (tz2 - z) * 0.24];
        const p1 = [x + (tx2 - x) * 0.46, 37.5, z + (tz2 - z) * 0.46];
        const p2 = [x + (tx2 - x) * 0.82, 42.9, z + (tz2 - z) * 0.82];
        b.add('stoneLight', tubeGeo(
          [[x, 29.6, z], stem, p1, p2, [tx2, 45.2, tz2]],
          0.46,
          { tubularSegments: 28, radialSegments: 6 }
        ));
        b.add('gold', tubeGeo([p1, p2, [tx2, 45.1, tz2]], 0.08, { tubularSegments: 16, radialSegments: 4 }));
        b.add('marble', xform(new THREE.SphereGeometry(0.58, 10, 8), { x, y: 30.0, z }));
      }
      out.colliders.push(circleCollider(x, z, 2.9, { y0: 0, y1: 6 }));
      // small marble pedestal blocks against the crossing side of each column
      b.add('marble', boxGeo(1.1, 0.5, 1.1, x - sx * (R + 0.4), 0.25, z - sz * (R + 0.4), Math.PI / 8));
    }
  }

  // ------------------------------------------------------ apse responds (8 at r)
  const apseResponds = [];
  for (let k = 0; k <= DIM.apseChapelCount; k++) {
    const a = (k / DIM.apseChapelCount) * Math.PI;
    const r = DIM.apseWallRadius - 0.35;
    const x = Math.cos(a) * r;
    const z = DIM.apseCenterZ - Math.sin(a) * r;
    const rot = -a; // face the apse centre
    // Engaged respond: half-round shaft, base and capital.
    const parts = [];
    parts.push(xform(new THREE.CylinderGeometry(0.56, 0.6, 24.6, 10), { y: 12.3 }));
    parts.push(xform(new THREE.CylinderGeometry(0.78, 0.86, 0.5, 8), { y: 0.25 }));
    parts.push(xform(new THREE.CylinderGeometry(0.9, 0.72, 0.7, 8), { y: 24.9 }));
    b.add('stone', xform(mergeGeos(parts), { x, z, ry: rot }));
    b.add('stoneLight', xform(ringBand(0.66, 23.8, 0.1, 16), { x, z }));
    b.add('mosaicGold', xform(bossGeo(0.32, k), { x, z, y: 25.4 }));
    apseResponds.push({ x, z, a });
    out.colliders.push(circleCollider(x, z, 0.85, { y0: 0, y1: 4 }));
  }
  out.apseResponds = apseResponds;

  // ---------------------------------------------------------- wall pilasters
  // Aisle level pilasters on the nave walls at the bay divisions.
  for (const sx of [-1, 1]) {
    for (const z of [-36, -24, -16.5, 16.5, 24, 36]) {
      const x = sx * (DIM.naveWallX - 0.22);
      b.add('stone', boxGeo(0.46, 29.4, 0.95, x, 14.7, z));
      b.add('stone', boxGeo(0.62, 0.5, 1.25, x, 0.25, z));
      b.add('stoneLight', boxGeo(0.7, 0.7, 1.3, x, 29.35, z));
      b.add('stoneLight', boxGeo(0.5, 14.4, 0.5, x, 37.1, z)); // clerestory rib
      b.add('stoneLight', boxGeo(0.58, 0.4, 0.66, x, 44.4, z));
    }
    // Corner pilasters at the Glory end and the apse end.
    for (const z of [44.5, -44.5]) {
      b.add('stone', boxGeo(0.5, 29.4, 1.3, sx * (DIM.naveWallX - 0.22), 14.7, z));
      b.add('stoneLight', boxGeo(0.72, 0.8, 1.5, sx * (DIM.naveWallX - 0.22), 29.4, z));
    }
  }
  // Transept wall pilasters.
  for (const sz of [-1, 1]) {
    for (const x of [-24, -18, 18, 24]) {
      b.add('stone', boxGeo(0.95, 29.4, 0.46, x, 14.7, sz * (DIM.transeptHalfWidth - 0.22)));
      b.add('stoneLight', boxGeo(1.3, 0.7, 0.7, x, 29.35, sz * (DIM.transeptHalfWidth - 0.22)));
    }
  }

  const meshes = b.flush(parent, mats, { castShadow: true, receiveShadow: true });
  const dmeshes = detail.flush(parent, mats, { castShadow: true, receiveShadow: true });
  return { meshes: meshes.concat(dmeshes), apseResponds };
}
