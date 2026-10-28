// Side chapels: three against each nave wall and two on each face of the
// transept arms. Each is an aedicule with a marble altar, mosaic retable,
// statue, candles, votive stand, ironwork and framed panels.

import {
  THREE,
  xform,
  boxGeo,
  cylGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  latheGeo,
  archRingGeo,
  mergeGeos,
  circleCollider,
  rng,
  rand,
} from '../lib.js';
import { bucket, DIM, statueGeo, ringBand, bossGeo, flatStar } from './common.js';

/** Local -> world for a chapel placed by {x, z, ry}. */
function tp(tx, x, z) {
  const r = tx.ry || 0;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: (tx.x || 0) + x * c + z * s, z: (tx.z || 0) - x * s + z * c };
}

/** One chapel in local coordinates: wall at x = +2.6, room toward -x. */
function chapel(b, glow, tx, mats, opts) {
  const { seed = 1, mosaic = 'mosaic', altarZ = 1.0 } = opts;
  const rnd = rng(seed);
  const put = (mat, geo) => b.add(mat, xform(geo, tx));
  const putGlow = (mat, geo) => glow.add(mat, xform(geo, tx));
  const W = 2.6; // local wall plane

  // ---- aedicule: two marble columns, arch and entablature
  for (const z of [-2.05, 2.05]) {
    put('marble', xform(cylGeo(0.19, 0.23, 5.5, 10), { x: W - 0.22, y: 3.05, z }));
    put('marble', xform(boxGeo(0.55, 0.22, 0.55, W - 0.22, 0.14, z, Math.PI / 8)));
    put('marble', xform(boxGeo(0.58, 0.3, 0.58, W - 0.22, 5.88, z, Math.PI / 8)));
    put('gold', xform(ringBand(0.22, 0.62, 0.035, 12), { x: W - 0.22, z }));
  }
  {
    const ring = archRingGeo({ w: 3.6, h: 2.9, band: 0.34, depth: 0.42, spring: 0.5 });
    put('stoneLight', xform(ring, { x: W - 0.22, y: 4.35, ry: -Math.PI / 2 }));
    put('stoneLight', xform(boxGeo(0.62, 0.34, 5.0, W - 0.3, 7.35, 0)));
    put('gold', xform(boxGeo(0.5, 0.1, 5.1, W - 0.34, 7.55, 0)));
  }

  // ---- retable and statue
  put(mosaic, xform(boxGeo(0.1, 3.5, 3.0, W - 0.12, 4.1, 0)));
  {
    const fr = [];
    fr.push(boxGeo(0.2, 0.16, 3.3, W - 0.16, 5.86, 0));
    fr.push(boxGeo(0.2, 0.16, 3.3, W - 0.16, 2.34, 0));
    fr.push(boxGeo(0.2, 3.66, 0.16, W - 0.16, 4.1, 1.62));
    fr.push(boxGeo(0.2, 3.66, 0.16, W - 0.16, 4.1, -1.62));
    put('gold', xform(mergeGeos(fr), { x: 0, z: 0 }));
  }
  put('marble', xform(boxGeo(0.9, 0.75, 1.1, W - 0.62, 0.38, 0)));
  put('stoneLight', xform(boxGeo(1.1, 0.1, 1.3, W - 0.62, 0.8, 0)));
  const pose = ['pray', 'hold', 'stand', 'cross'][seed % 4];
  const st = statueGeo({ height: 1.65, pose, seed, halo: seed % 3 === 0, hood: seed % 5 === 0 });
  put('marble', xform(st, { x: W - 0.62, y: 0.76, z: 0 }));

  // ---- altar
  put('marbleDark', xform(boxGeo(1.75, 0.16, 3.5, altarZ, 0.08, 0)));
  put('marble', xform(boxGeo(1.4, 0.16, 3.1, altarZ, 0.22, 0)));
  put('marble', xform(boxGeo(1.0, 0.92, 2.5, altarZ, 0.76, 0)));
  put('gold', xform(boxGeo(1.1, 0.07, 2.65, altarZ, 1.24, 0)));
  put('cloth', xform(boxGeo(0.9, 0.035, 1.9, altarZ, 1.28, 0)));
  put(mosaic, xform(boxGeo(0.06, 0.6, 2.1, altarZ + 0.5, 0.78, 0)));
  put('gold', xform(boxGeo(0.2, 0.22, 0.26, altarZ, 1.4, 0)));

  // ---- candles and flowers
  for (const z of [-0.95, 0.95]) {
    put('bronze', xform(latheGeo([[0.14, 0], [0.17, 0.06], [0.07, 0.14], [0.06, 0.4], [0.13, 0.48], [0.1, 0.52]], 10), { x: altarZ, y: 1.28, z }));
    put('candle', xform(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 7), { x: altarZ, y: 1.28 + 0.52 + 0.21, z }));
    putGlow('flame', xform(new THREE.ConeGeometry(0.06, 0.2, 6), { x: altarZ, y: 1.28 + 0.52 + 0.5, z }));
  }
  put('cloth', xform(new THREE.IcosahedronGeometry(0.22, 1), { x: altarZ, y: 1.42, z: 1.28, sy: 1.25 }));
  put('carpet', xform(new THREE.IcosahedronGeometry(0.16, 1), { x: altarZ, y: 1.38, z: -1.28, sy: 1.2 }));

  // ---- votive candle stand
  const vz = 2.35;
  put('iron', xform(boxGeo(0.62, 0.05, 0.62, 0.25, 0.66, vz)));
  for (const dx of [-0.24, 0.24]) {
    for (const dz of [-0.24, 0.24]) {
      put('iron', xform(boxGeo(0.045, 0.66, 0.045, 0.25 + dx, 0.33, vz + dz)));
    }
  }
  for (let i = 0; i < 6; i++) {
    const dx = -0.2 + (i % 3) * 0.2;
    const dz = i < 3 ? -0.12 : 0.12;
    put('candle', xform(new THREE.CylinderGeometry(0.033, 0.033, 0.2, 6), { x: 0.25 + dx, y: 0.79, z: vz + dz }));
    putGlow('flame', xform(new THREE.ConeGeometry(0.04, 0.15, 5), { x: 0.25 + dx, y: 1.0, z: vz + dz }));
  }
  // second stand on the other side, shorter
  put('iron', xform(boxGeo(0.5, 0.04, 0.5, 0.35, 0.54, -2.2)));
  for (const dx of [-0.2, 0.2]) {
    for (const dz of [-0.2, 0.2]) put('iron', xform(boxGeo(0.04, 0.54, 0.04, 0.35 + dx, 0.27, -2.2 + dz)));
  }
  for (let i = 0; i < 4; i++) {
    const dx = -0.14 + (i % 2) * 0.28;
    const dz = i < 2 ? -0.1 : 0.1;
    put('candle', xform(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), { x: 0.35 + dx, y: 0.66, z: -2.2 + dz }));
    putGlow('flame', xform(new THREE.ConeGeometry(0.038, 0.14, 5), { x: 0.35 + dx, y: 0.86, z: -2.2 + dz }));
  }

  // ---- kneeler and framed panels
  put('wood', xform(boxGeo(0.75, 0.12, 2.2, -0.35, 0.34, 0)));
  put('wood', xform(boxGeo(0.75, 0.42, 0.14, -0.35, 0.14, 0)));
  for (const z of [-3.1, 3.1]) {
    put('mosaicGold', xform(boxGeo(0.1, 2.0, 1.35, W - 0.1, 3.9, z)));
    const fr = [];
    fr.push(boxGeo(0.16, 0.1, 1.55, W - 0.14, 4.95, z));
    fr.push(boxGeo(0.16, 0.1, 1.55, W - 0.14, 2.85, z));
    fr.push(boxGeo(0.16, 2.2, 0.1, W - 0.14, 3.9, z + 0.72));
    fr.push(boxGeo(0.16, 2.2, 0.1, W - 0.14, 3.9, z - 0.72));
    put('gold', xform(mergeGeos(fr), { x: 0, z: 0 }));
  }
  // iron screens: two short runs leaving an open central gate onto the aisle
  for (const sz of [-1, 1]) {
    for (const z of [sz * 1.45, sz * 2.5]) {
      put('iron', xform(cylGeo(0.04, 0.05, 1.25, 6), { x: -0.35, y: 0.62, z }));
      put('gold', xform(new THREE.SphereGeometry(0.06, 6, 4), { x: -0.35, y: 1.28, z }));
    }
    put('iron', xform(boxGeo(0.05, 0.05, 1.12, -0.35, 1.18, sz * 1.98)));
    for (let i = 0; i < 4; i++) {
      put('iron', xform(boxGeo(0.03, 0.55, 0.03, -0.35, 0.9, sz * (1.55 + i * 0.27))));
    }
  }

  // ---- warm light pool
  putGlow('poolWarm', xform(new THREE.CircleGeometry(1.9, 18), { rx: -Math.PI / 2, x: 0.6, y: 0.032, z: 0 }));

  // ---- colliders
  const a = tp(tx, altarZ, 0);
  const v1 = tp(tx, 0.25, 2.35);
  const v2 = tp(tx, 0.35, -2.2);
  opts.out.colliders.push(circleCollider(a.x, a.z, 1.65, { y0: 0, y1: 2 }));
  opts.out.colliders.push(circleCollider(v1.x, v1.z, 0.5, { y0: 0, y1: 1.2 }));
  opts.out.colliders.push(circleCollider(v2.x, v2.z, 0.45, { y0: 0, y1: 1.0 }));
}

export function buildChapels(parent, mats, out) {
  const b = bucket();
  const glow = bucket();

  const spots = [];
  // nave walls, three chapels per side (between the shell's window openings)
  for (const z of [23, 33, 42]) {
    spots.push({ x: DIM.naveWallX - 2.6, z, ry: 0, wall: 'east' }); // x = +15 wall
    spots.push({ x: -(DIM.naveWallX - 2.6), z, ry: Math.PI, wall: 'west' }); // x = -15 wall
  }
  // transept arms: two chapels on each of the four wall faces
  for (const x of [20.5, 26.5]) {
    for (const sz of [-1, 1]) {
      spots.push({ x, z: sz * (DIM.transeptHalfWidth - 2.6), ry: sz > 0 ? -Math.PI / 2 : Math.PI / 2, wall: 'transeptS' });
      spots.push({ x: -x, z: sz * (DIM.transeptHalfWidth - 2.6), ry: sz > 0 ? -Math.PI / 2 : Math.PI / 2, wall: 'transeptS' });
    }
  }

  let i = 0;
  for (const s of spots) {
    chapel(b, glow, s, mats, {
      seed: 13 + i * 11,
      mosaic: i % 3 === 0 ? 'mosaicGold' : i % 3 === 1 ? 'mosaic' : 'mosaicCool',
      altarZ: 0.85 + (i % 3) * 0.12,
      out,
    });
    i++;
  }

  b.flush(parent, mats, { castShadow: true, receiveShadow: true });
  const gm = glow.flush(parent, mats, { castShadow: false, receiveShadow: false });
  gm.forEach((m) => {
    m.renderOrder = 3;
  });
  return { count: spots.length };
}
