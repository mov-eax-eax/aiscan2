// The four evangelist towers: one at each corner of the crossing, rising from
// the roof (DIM.evangelistBaseY) to 135 m and framing the tower of Jesus.
// Each is a tapering ribbed shaft with lancet windows, a balustraded symbol
// stage at DIM.evangelistSymbolY carrying the evangelist's emblem (angel,
// lion, ox, eagle), then a compact pinnacled crown and finial.

import { DIM } from '../config.js';
import {
  THREE,
  xform,
  boxGeo,
  sphereGeo,
  coneGeo,
  mergeGeos,
  matrixAt,
  figureGeo,
  animalGeo,
  birdGeo,
  pinnacleGeo,
  rng,
} from '../lib.js';
import {
  FACES4,
  frustum4,
  frustumN,
  corniceGeo,
  windowUnit,
  nicheUnit,
  faceMatrix,
  balustradeSquare,
  widthAt,
  simplePinnacleGeo,
} from './common.js';

const SECTIONS = [
  { y0: 46.6, y1: 70, w0: 9.2, w1: 8.8 },
  { y0: 70, y1: 94, w0: 8.8, w1: 8.3 },
  { y0: 94, y1: 112, w0: 8.3, w1: 7.7 },
];
const SYMBOL_BASE_Y = DIM.evangelistSymbolY + 0.6;
const CROWN_Y = 121.5;

export function buildEvangelists(b, mats) {
  const win = windowUnit({ w: 2.05, h: 8.0, band: 0.3, depth: 0.4 });
  const niche = nicheUnit({ w: 3.0, h: 5.4, band: 0.36, depth: 0.5 });
  const pinn = simplePinnacleGeo({ base: 0.85, height: 5.2 });
  const key = 'evangelist';

  for (const t of DIM.evangelistTowers) {
    const cx = t.x;
    const cz = t.z;
    const r = rng(9100 + Math.abs(cx) * 31 + Math.abs(cz) * 17);
    const add = (g) => b.add(key, g);
    const addF = (w0, w1, h, y0) => add(xform(frustum4(w0, w1, h, y0), { x: cx, z: cz }));
    const addC = (w, y, opts) => b.add('trim', xform(corniceGeo(w, y, opts), { x: cx, z: cz }));

    // -------------------------------------------------------------- pedestal
    addF(11.6, 11.0, 1.0, DIM.evangelistBaseY);
    addF(11.0, 9.9, 1.6, DIM.evangelistBaseY + 1.0);
    addC(11.7, DIM.evangelistBaseY + 0.12, { out: 0.55, h: 0.34 });
    addC(10.0, DIM.evangelistBaseY + 2.5, { out: 0.42, h: 0.4 });

    // ----------------------------------------------------------------- shaft
    for (const s of SECTIONS) addF(s.w0, s.w1, s.y1 - s.y0, s.y0);
    for (const s of SECTIONS) {
      const len = s.y1 - s.y0;
      addC(s.w1 + 0.24, s.y1 + 0.08, { out: 0.4, h: 0.42 });
      addC(s.w1 + 0.1, s.y1 + 0.34, { out: 0.16, h: 0.15 });
      addC(s.w0 + (s.w1 - s.w0) * 0.3, s.y0 + len * 0.3, { out: 0.24, h: 0.22 });
    }

    // corner buttresses up to the symbol stage
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(xform(frustum4(1.3, 1.0, CROWN_Y - 46.6, 46.6), {
          x: cx + sx * 4.36,
          z: cz + sz * 4.36,
        }));
      }
    }

    // ribs and windows per face
    for (const face of FACES4) {
      for (const s of SECTIONS) {
        const halfW = (s.w0 + s.w1) / 4;
        const h = s.y1 - s.y0;
        const yMid = (s.y0 + s.y1) / 2;
        for (const off of [-2.6, 0, 2.6]) {
          const tx = face.nz;
          const tz = -face.nx;
          b.add('trim', boxGeo(0.48, h, 0.48, cx + face.nx * halfW + tx * off, yMid, cz + face.nz * halfW + tz * off));
        }
        const len = s.y1 - s.y0;
        const wh = Math.min(8.0, len * 0.6);
        const wy = s.y0 + (len - wh) * 0.7;
        const wHalf = s.w0 / 2 + ((s.w1 - s.w0) / 2) * ((wy - s.y0) / len);
        for (const off of [-1.85, 1.85]) {
          const m = faceMatrix(cx, cz, wHalf, face, wy, { off, extra: 0.03 });
          b.instance('winEvangelistStone', win.stone, mats.trim, m);
          b.instance('winEvangelistGlass', win.glass, mats.glass, m);
        }
      }
    }

    // -------------------------------------------------- symbol / crown stage
    addF(9.5, 9.1, 4.6, 112.2);
    addC(9.65, 112.3, { out: 0.48, h: 0.42 });
    addF(8.9, 8.6, CROWN_Y - 116.8, 116.8);
    addC(9.9, 116.95, { out: 0.6, h: 0.36 });
    balustradeSquare(b, mats, { cx, cz, halfW: 4.52, y: 117.4, spacing: 1.4 });

    // outward direction from the crossing
    const nl = Math.hypot(cx, cz) || 1;
    const nx = cx / nl;
    const nz = cz / nl;
    const ry = Math.atan2(nx, nz); // local +Z faces outward
    const ryAnimal = Math.atan2(-nz, nx); // local +X faces outward (quadrupeds)
    // corbel + emblem, pushed out past the square corner of the stage
    // (the corner lies at halfWidth*sqrt(2) ~= 6.3 m on the diagonal)
    add(xform(boxGeo(3.2, 1.1, 2.4), { ry, x: cx + nx * 6.2, y: SYMBOL_BASE_Y - 0.45, z: cz + nz * 6.2 }));
    let emblem;
    let emblemRy = ry;
    if (t.symbol === 'angel') {
      emblem = figureGeo({ height: 4.6, pose: 'armsUp', kind: 'angel', wings: true, halo: true, seed: 3 });
    } else if (t.symbol === 'eagle') {
      emblem = birdGeo({ size: 3.8, wings: true, seed: 5 });
      xform(emblem, { y: 1.1 });
    } else {
      emblem = animalGeo({ kind: t.symbol, length: 4.3, height: 3.0, seed: 7 });
      emblemRy = ryAnimal;
    }
    xform(emblem, { ry: emblemRy, x: cx + nx * 6.9, y: SYMBOL_BASE_Y, z: cz + nz * 6.9 });
    add(emblem);
    // shallow canopy above the emblem
    add(xform(boxGeo(5.6, 0.5, 3.0), { ry, x: cx + nx * 6.4, y: CROWN_Y - 0.2, z: cz + nz * 6.4 }));

    // ------------------------------------------------------------ upper crown
    addC(9.1, CROWN_Y, { out: 0.55, h: 0.5 });
    b.add('gold', frustumOct(4.15, 4.15, 0.14, CROWN_Y + 0.55, cx, cz));
    add(frustumOct(3.95, 2.05, 9.6, CROWN_Y + 0.5, cx, cz));
    const crownBot = CROWN_Y + 0.5;
    const crownTop = crownBot + 9.6;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rx = Math.sin(a);
      const rz = Math.cos(a);
      for (let si = 0; si < 3; si++) {
        const tMid = (si + 0.5) / 3;
        const rr = 3.95 + (2.05 - 3.95) * tMid + 0.2;
        const g = boxGeo(0.34, (9.6 / 3) * 1.04, 0.44);
        xform(g, { ry: a, x: cx + rx * rr, y: crownBot + 9.6 * tMid, z: cz + rz * rr });
        b.add('trim', g);
      }
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.instance('pinnacle', pinn, mats.trim, matrixAt(cx + sx * 4.2, CROWN_Y + 0.55, cz + sz * 4.2, { ry: Math.PI / 4 }), {
          castShadow: true,
        });
      }
    }
    // finial
    const ballR = 1.2;
    const ballY = t.top - 1.5;
    const needleBottom = crownTop - 0.3;
    if (ballY - ballR > needleBottom) {
      const nat = new THREE.CylinderGeometry(0.3, 0.8, ballY - ballR - needleBottom, 8);
      xform(nat, { ry: Math.PI / 8, x: cx, y: (ballY - ballR + needleBottom) / 2, z: cz });
      add(nat);
    }
    add(xform(sphereGeo(ballR, 12), { x: cx, y: ballY, z: cz, sy: 1.05 }));
    b.add('gold', xform(coneGeo(0.3, 1.0, 6), { x: cx, y: ballY + ballR + 0.4, z: cz }));
  }
}

function frustumOct(rBottom, rTop, h, y0, cx, cz) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1, false);
  g.rotateY(-Math.PI / 8);
  g.translate(cx, y0 + h / 2, cz);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
