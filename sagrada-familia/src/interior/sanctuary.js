// The sanctuary: high altar in the choir beyond the crossing, marble predella, gold
// baldachin on porphyry columns, tabernacle, candles, flowers, carpet,
// suspended crucifix and lamps. Kept clear of the processional axis.

import {
  THREE,
  xform,
  tubeGeo,
  boxGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  latheGeo,
  mergeGeos,
  crossGeo,
  circleCollider,
  boxCollider,
  rng,
  rand,
} from '../lib.js';
import { bucket, DIM, flatStar, bossGeo, statueGeo, shaftGeo, ringBand, downCone } from './common.js';

const CZ = -36.0; // high altar centre, in the choir between crossing and apse
const PLATFORM = 0.52;

function candleStick(h = 1.5, candleH = 1.1) {
  const bronze = latheGeo(
    [
      [0.3, 0],
      [0.34, 0.08],
      [0.16, 0.2],
      [0.1, h * 0.35],
      [0.16, h * 0.62],
      [0.3, h * 0.72],
      [0.34, h * 0.8],
      [0.18, h * 0.85],
      [0.2, h * 0.9],
    ],
    12
  );
  const candle = xform(new THREE.CylinderGeometry(0.075, 0.07, candleH, 8), { y: h * 0.9 + candleH / 2 });
  const flame = xform(new THREE.ConeGeometry(0.075, 0.26, 6), { y: h * 0.9 + candleH + 0.15 });
  return { bronze, candle, flame };
}

function flowerCluster(seed) {
  const r = rng(seed);
  const parts = [];
  parts.push(latheGeo([[0.16, 0], [0.22, 0.12], [0.2, 0.26], [0.12, 0.3]], 10));
  for (let i = 0; i < 10; i++) {
    const a = rand(r, 0, Math.PI * 2);
    const rad = rand(r, 0.05, 0.28);
    const y = rand(r, 0.32, 0.62);
    parts.push(xform(new THREE.IcosahedronGeometry(rand(r, 0.07, 0.11), 0), {
      x: Math.cos(a) * rad,
      y,
      z: Math.sin(a) * rad,
    }));
  }
  // stems / leaves
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(coneGeo(0.03, rand(r, 0.3, 0.5), 4, Math.cos(a) * 0.1, 0.45, Math.sin(a) * 0.1, a));
  }
  return mergeGeos(parts);
}

export function buildSanctuary(parent, mats, out) {
  const b = bucket();
  const glow = bucket();
  const rnd = rng(555);

  // ------------------------------------------------------------------ predella
  b.add('marbleDark', xform(new THREE.CylinderGeometry(6.6, 6.9, 0.16, 16), { x: 0, y: 0.08, z: CZ }));
  b.add('marble', xform(new THREE.CylinderGeometry(6.0, 6.3, 0.16, 16), { x: 0, y: 0.24, z: CZ }));
  b.add('marbleDark', xform(new THREE.CylinderGeometry(5.45, 5.7, 0.16, 16), { x: 0, y: 0.4, z: CZ }));
  b.add('marble', xform(new THREE.CylinderGeometry(5.1, 5.2, 0.15, 16), { x: 0, y: 0.52, z: CZ }));
  b.add('gold', xform(ringBand(5.15, 0.59, 0.035, 40), { x: 0, z: CZ }));
  // carpet up the steps
  b.add('carpet', xform(boxGeo(3.4, 0.03, 19.0, 0, 0.017, CZ + 14.2)));
  b.add('carpet', xform(boxGeo(4.6, 0.03, 2.0, 0, 0.61, CZ + 0.4)));

  // -------------------------------------------------------------- altar table
  b.add('marble', xform(boxGeo(4.9, 1.02, 2.05, 0, PLATFORM + 0.51, CZ)));
  b.add('gold', xform(boxGeo(5.05, 0.1, 2.2, 0, PLATFORM + 1.0, CZ)));
  b.add('gold', xform(boxGeo(5.05, 0.08, 2.2, 0, PLATFORM + 0.06, CZ)));
  b.add('cloth', xform(boxGeo(4.2, 0.04, 1.55, 0, PLATFORM + 1.05, CZ)));
  // front panel mosaic of the altar
  b.add('mosaicGold', xform(boxGeo(4.2, 0.72, 0.06, 0, PLATFORM + 0.55, CZ + 1.04)));
  // tabernacle
  b.add('gold', xform(boxGeo(0.95, 1.15, 0.75, 0, PLATFORM + 1.62, CZ - 0.1)));
  b.add('goldBright', xform(boxGeo(0.62, 0.8, 0.05, 0, PLATFORM + 1.6, CZ + 0.3)));
  b.add('gold', xform(flatStar(6, 0.2, 0.08, 0.05), { y: PLATFORM + 2.29, z: CZ - 0.1 }));
  b.add('gold', xform(crossGeo({ arm: 0.36, thickness: 0.06, depth: 0.05 }), { y: PLATFORM + 2.62, z: CZ - 0.1 }));

  // ------------------------------------------------------------ candlesticks
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = sx * (1.35 + i * 0.45);
      const z = CZ + 0.72;
      const cs = candleStick(1.35 + i * 0.12, 0.9);
      b.add('bronze', xform(cs.bronze, { x, z, y: PLATFORM + 1.06 }));
      glow.add('candle', xform(cs.candle, { x, z, y: PLATFORM + 1.06 }));
      // note: candle geometry already carries its own y offset
      glow.add('flame', xform(cs.flame, { x, z, y: PLATFORM + 1.06 }));
    }
    // flowers
    b.add('cloth', xform(flowerCluster(11 + sx), { x: sx * 2.1, y: PLATFORM + 1.05, z: CZ + 0.4 }));
    b.add('gold', xform(new THREE.CylinderGeometry(0.2, 0.16, 0.5, 10), { x: sx * 2.1, y: PLATFORM + 1.3, z: CZ + 0.4 }));
  }
  // paschal candles on tall stands
  for (const sx of [-1, 1]) {
    const x = sx * 4.55;
    const z = CZ + 2.0;
    b.add('bronze', xform(latheGeo([[0.34, 0], [0.38, 0.1], [0.16, 0.3], [0.1, 1.5], [0.22, 1.9], [0.28, 2.0]], 10), { x, z }));
    b.add('candle', xform(new THREE.CylinderGeometry(0.16, 0.15, 1.5, 8), { x, y: 2.75, z }));
    glow.add('flame', xform(new THREE.ConeGeometry(0.14, 0.5, 6), { x, y: 3.62, z }));
  }

  // ---------------------------------------------------------------- baldachin
  // Four porphyry columns stand on the diagonals so nothing interrupts the
  // central axis: the altar table, tabernacle, candles and apse stay in clear
  // view from the nave approach. The gold canopy is lifted well above eye line.
  const hexR = 4.2;
  const colH = 11.2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * hexR;
    const z = CZ + Math.sin(a) * hexR;
    // white stone base, porphyry shaft, gold capital
    b.add('marble', xform(new THREE.CylinderGeometry(0.36, 0.48, 0.5, 8), { x, y: PLATFORM + 0.25, z, ry: Math.PI / 8 }));
    b.add('porphyry', xform(new THREE.CylinderGeometry(0.24, 0.27, colH, 12), { x, y: PLATFORM + 0.5 + colH / 2, z }));
    for (const t of [0.25, 0.55, 0.85]) {
      b.add('marble', xform(ringBand(0.28, PLATFORM + 0.5 + colH * t, 0.05, 14), { x, z }));
    }
    b.add('gold', xform(new THREE.CylinderGeometry(0.36, 0.27, 0.3, 8), { x, y: PLATFORM + colH + 0.6, z, ry: Math.PI / 8 }));
    b.add('marble', xform(boxGeo(0.72, 0.15, 0.72, x, PLATFORM + colH + 0.8, z, Math.PI / 8)));
  }
  // canopy: a scalloped gold dome with a fringe and a hanging crown
  const canopyY = PLATFORM + colH + 0.88;
  b.add('gold', xform(ringBand(hexR + 0.45, canopyY, 0.1, 30), { x: 0, z: CZ }));
  b.add(
    'gold',
    xform(
      latheGeo(
        [
          [hexR + 0.5, 0],
          [hexR + 0.4, 0.22],
          [hexR + 0.05, 0.55],
          [3.3, 0.95],
          [2.4, 1.25],
          [1.55, 1.5],
          [0.88, 1.68],
          [0.34, 1.78],
          [0.001, 1.8],
        ],
        24
      ),
      { x: 0, y: canopyY, z: CZ }
    )
  );
  // scalloped rim + gold fringe
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    b.add('gold', downCone(0.2, 0.55, 4, Math.cos(a) * (hexR + 0.5), canopyY - 0.2, CZ + Math.sin(a) * (hexR + 0.5)));
  }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    b.add('goldBright', xform(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 4), { x: Math.cos(a) * (hexR + 0.42), y: canopyY - 0.3, z: CZ + Math.sin(a) * (hexR + 0.42) }));
  }
  // crown finial
  b.add('goldBright', xform(crossGeo({ arm: 1.45, thickness: 0.16, depth: 0.14 }), { y: canopyY + 2.5, z: CZ }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add('gold', downCone(0.11, 0.6, 4, Math.cos(a) * 1.1, canopyY + 2.0, CZ + Math.sin(a) * 1.1));
  }

  // suspended crucifix beneath the canopy
  b.add('woodDark', xform(crossGeo({ arm: 1.55, thickness: 0.17, depth: 0.12 }), { y: 8.4, z: CZ }));
  b.add('bronze', xform(tubeGeo([[0, canopyY - 0.1, CZ], [0, canopyY - 1.5, CZ], [0, 9.95, CZ]], 0.03, { tubularSegments: 8, radialSegments: 3 })));
  const corpus = statueGeo({ height: 1.25, pose: 'cross', seed: 5, halo: true });
  b.add('marble', xform(corpus, { x: 0, y: 7.75, z: CZ + 0.16 }));

  // hanging lamps around the baldachin
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 2.9;
    const z = CZ + Math.sin(a) * 2.9;
    b.add('bronze', xform(tubeGeo([[x, canopyY - 0.2, z], [x, 9.6, z]], 0.022, { tubularSegments: 4, radialSegments: 3 })));
    b.add('gold', xform(latheGeo([[0.34, 0], [0.42, 0.1], [0.3, 0.3], [0.12, 0.42], [0.001, 0.48]], 10), { x, y: 9.3, z }));
    glow.add('lampRed', xform(new THREE.SphereGeometry(0.2, 8, 6), { x, y: 9.5, z }));
  }
  // sanctuary lamp on a chain from the canopy
  b.add('bronze', xform(tubeGeo([[0, canopyY - 0.1, CZ - 2.6], [0, 9.2, CZ - 2.6]], 0.022, { tubularSegments: 4, radialSegments: 3 })));
  b.add('gold', xform(latheGeo([[0.3, 0], [0.38, 0.12], [0.26, 0.32], [0.1, 0.44], [0.001, 0.5]], 10), { x: 0, y: 8.9, z: CZ - 2.6 }));
  glow.add('lampRed', xform(new THREE.SphereGeometry(0.17, 8, 6), { x: 0, y: 9.1, z: CZ - 2.6 }));
  b.add('gold', xform(bossGeo(0.26, 3), { y: 8.72, z: CZ - 2.6 }));

  // ambo and lectern (flanking, clear of the central axis)
  b.add('marble', xform(new THREE.CylinderGeometry(0.75, 0.85, 1.18, 8), { x: -5.6, y: 0.59, z: CZ + 5.2, ry: Math.PI / 8 }));
  b.add('marble', xform(boxGeo(1.2, 0.16, 0.9, -5.6, 1.24, CZ + 5.2, 0.4)));
  b.add('gold', xform(boxGeo(1.0, 0.04, 0.66, -5.6, 1.33, CZ + 5.2, 0.4)));
  b.add('marble', xform(new THREE.CylinderGeometry(0.65, 0.75, 1.1, 8), { x: 5.6, y: 0.55, z: CZ + 5.2, ry: Math.PI / 8 }));
  b.add('gold', xform(boxGeo(0.9, 0.06, 0.7, 5.6, 1.12, CZ + 5.2, -0.35)));
  // book on the ambo
  b.add('cloth', xform(boxGeo(0.62, 0.09, 0.44, -5.6, 1.36, CZ + 5.2, 0.4)));

  // soft light shafts falling through the crossing lantern onto the altar
  glow.add('shaftGold', shaftGeo([0, 56, CZ], [0, 0.6, CZ], 2.2, 7.4, 14));

  const meshes = b.flush(parent, mats, { castShadow: true, receiveShadow: true });
  const glowMeshes = glow.flush(parent, mats, { castShadow: false, receiveShadow: false });
  glowMeshes.forEach((m) => {
    m.renderOrder = 3;
  });

  out.colliders.push(boxCollider(0, CZ, 7.0, 5.6, { y0: 0, y1: 4 }));
  out.colliders.push(circleCollider(-5.6, CZ + 5.2, 1.0, { y0: 0, y1: 2 }));
  out.colliders.push(circleCollider(5.6, CZ + 5.2, 1.0, { y0: 0, y1: 2 }));
  return { meshes, glowMeshes };
}
