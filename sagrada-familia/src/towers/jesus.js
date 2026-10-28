// The tower of Jesus Christ over the crossing: the tallest silhouette.
// Octagonal, ribbed and tapering: a lantern transition at the roof, a tall
// shaft pierced by lancet windows and carved inscription bands ("ALLELUIA",
// "SANCTUS"), a pinnacled crown, and the great gilded four-armed cross at
// DIM.jesusTower.crossTop.

import { DIM } from '../config.js';
import {
  THREE,
  xform,
  boxGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  matrixAt,
  pinnacleGeo,
  crossGeo,
  rng,
  rand,
} from '../lib.js';
import {
  frustumN,
  windowUnit,
  balustradeOctagon,
  textPlaneGeo,
  simplePinnacleGeo,
} from './common.js';

const J = DIM.jesusTower;
const CX = J.x;
const CZ = J.z;
const ROOF_START = 47.0; // buried in the crossing roof, hides the base

const SHAFT = [
  { y0: 66, y1: 90, r0: 8.5, r1: 7.9 },
  { y0: 90, y1: 114, r0: 7.9, r1: 7.0 },
  { y0: 114, y1: 134, r0: 7.0, r1: 5.7 },
  { y0: 134, y1: 150, r0: 5.7, r1: 4.4 },
];

const faceR = (circumR) => circumR * Math.cos(Math.PI / 8);

function radiusAt(y) {
  if (y <= 66) return 8.7;
  for (const s of SHAFT) {
    if (y <= s.y1) {
      const t = (y - s.y0) / (s.y1 - s.y0);
      return s.r0 + (s.r1 - s.r0) * t;
    }
  }
  return SHAFT[SHAFT.length - 1].r1;
}

export function buildJesus(b, mats) {
  const key = 'jesus';
  const r = rng(5533);
  const add = (g) => b.add(key, g);
  const win = windowUnit({ w: 2.9, h: 12.0, band: 0.36, depth: 0.46 });
  const winLantern = windowUnit({ w: 2.8, h: 6.2, band: 0.32, depth: 0.42 });
  const pinn = simplePinnacleGeo({ base: 0.95, height: 5.0 });

  // ------------------------------------------------------------- base / plinth
  add(frustumOct(9.6, 9.2, 2.4, ROOF_START, CX, CZ));
  add(frustumOct(9.2, 8.55, 8.6, 49.4, CX, CZ));
  b.add('trim', frustumOct(9.85, 9.85, 0.4, ROOF_START + 0.15, CX, CZ));
  b.add('trim', frustumOct(9.45, 9.45, 0.5, J.baseY - 0.35, CX, CZ));
  // eight buttress ribs on the base
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const g = boxGeo(0.75, J.baseY - ROOF_START, 0.95);
    xform(g, { ry: a, x: CX + Math.sin(a) * 9.55, y: (ROOF_START + J.baseY) / 2, z: CZ + Math.cos(a) * 9.55 });
    add(g);
  }

  // ---------------------------------------------------------------- lantern
  add(frustumOct(8.9, 8.5, 8, J.baseY, CX, CZ));
  b.add('trim', frustumOct(9.25, 9.25, 0.45, J.baseY + 0.05, CX, CZ));
  b.add('trim', frustumOct(9.55, 9.55, 0.5, J.baseY + 8.05, CX, CZ));
  b.add('gold', frustumOct(9.6, 9.6, 0.16, J.baseY + 8.32, CX, CZ));
  // eight tall glazed lancets around the lantern + corner ribs
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rad = faceR(8.7) + 0.02;
    const m = matrixAt(CX + Math.sin(a) * rad, J.baseY + 0.95, CZ + Math.cos(a) * rad, { ry: a });
    b.instance('winJesusLanternStone', winLantern.stone, mats.trim, m);
    b.instance('winJesusLanternGlass', winLantern.glass, mats.glass, m);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const g = boxGeo(0.6, 8.0, 0.85);
    xform(g, { ry: a, x: CX + Math.sin(a) * 8.85, y: J.baseY + 4, z: CZ + Math.cos(a) * 8.85 });
    add(g);
  }
  balustradeOctagon(b, mats, { cx: CX, cz: CZ, radius: 9.15, y: J.baseY + 8.1, height: 0.9 });

  // ------------------------------------------------------------------ shaft
  for (const s of SHAFT) add(frustumOct(s.r0, s.r1, s.y1 - s.y0, s.y0, CX, CZ));
  // string courses at the section joints and a mid band each
  for (const s of SHAFT) {
    const len = s.y1 - s.y0;
    const rMid = (s.r0 + s.r1) / 2;
    b.add('trim', frustumOct(rMid + 0.22, rMid + 0.22, 0.42, s.y0 + 0.04, CX, CZ));
    b.add('trim', frustumOct(rMid + 0.06, rMid + 0.06, 0.2, s.y0 + 0.5, CX, CZ));
    b.add('trim', frustumOct(rMid + 0.3, rMid + 0.3, 0.38, s.y0 + len * 0.5, CX, CZ));
  }
  // eight vertical corner ribs, one segment per shaft section
  for (const s of SHAFT) {
    const rMid = (s.r0 + s.r1) / 2 + 0.22;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const g = boxGeo(0.55, s.y1 - s.y0, 0.8);
      xform(g, { ry: a, x: CX + Math.sin(a) * rMid, y: (s.y0 + s.y1) / 2, z: CZ + Math.cos(a) * rMid });
      b.add('trim', g);
    }
  }
  // lancet windows on the four cardinal faces of the shaft
  const rows = [
    { y: 70.5, h: 11.5 },
    { y: 94.5, h: 11.5 },
    { y: 118.0, h: 11.0 },
    { y: 137.0, h: 9.5 },
  ];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    for (const row of rows) {
      const rad = faceR(radiusAt(row.y + row.h * 0.5)) + 0.02;
      const m = matrixAt(CX + Math.sin(a) * rad, row.y, CZ + Math.cos(a) * rad, { ry: a });
      b.instance('winJesusStone', win.stone, mats.trim, m);
      b.instance('winJesusGlass', win.glass, mats.glass, m);
    }
  }

  // -------------------------------------------------- inscription bands
  // "ALLELUIA" faces east and west, "SANCTUS" faces south and north
  const alleluia = textPlaneGeo(mats.textAlleluia, 7.2);
  const sanctus = textPlaneGeo(mats.textSanctus, 6.4);
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const y = 100.5;
    const rad = faceR(radiusAt(y)) + 0.16;
    const g = alleluia.clone();
    xform(g, { ry: a, x: CX + Math.sin(a) * rad, y, z: CZ + Math.cos(a) * rad });
    b.add('textAlleluia', g);
  }
  for (const a of [0, Math.PI]) {
    const y = 125.0;
    const rad = faceR(radiusAt(y)) + 0.16;
    const g = sanctus.clone();
    xform(g, { ry: a, x: CX + Math.sin(a) * rad, y, z: CZ + Math.cos(a) * rad });
    b.add('textSanctus', g);
  }

  // ------------------------------------------------------------------ crown
  const crownY = 150.2;
  add(frustumOct(4.4, 1.9, J.top - crownY, crownY, CX, CZ));
  b.add('trim', frustumOct(4.85, 4.85, 0.5, crownY - 0.3, CX, CZ));
  b.add('gold', frustumOct(4.9, 4.9, 0.16, crownY - 0.02, CX, CZ));
  balustradeOctagon(b, mats, { cx: CX, cz: CZ, radius: 4.7, y: crownY - 0.1, height: 0.85 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let si = 0; si < 3; si++) {
      const tMid = (si + 0.5) / 3;
      const rr = 4.4 + (1.9 - 4.4) * tMid + 0.2;
      const g = boxGeo(0.34, ((J.top - crownY) / 3) * 1.05, 0.46);
      xform(g, { ry: a, x: CX + Math.sin(a) * rr, y: crownY + (J.top - crownY) * tMid, z: CZ + Math.cos(a) * rr });
      b.add('trim', g);
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    b.instance(
      'pinnacle',
      pinn,
      mats.trim,
      matrixAt(CX + Math.sin(a) * 4.85, crownY + 0.1, CZ + Math.cos(a) * 4.85, { ry: a }),
      { castShadow: true }
    );
  }
  // gold collar and boss under the cross
  const collar = torusGeo(1.9, 0.34, 16, 6);
  add(xform(collar, { rx: Math.PI / 2, x: CX, y: J.top - 0.55, z: CZ }));
  add(xform(sphereGeo(1.65, 12), { x: CX, y: J.top + 0.55, z: CZ }));

  // ------------------------------------------------------------- the cross
  const crossCenterY = J.crossTop - J.crossArm; // 164
  // one thick, volumetric four-armed cross, turned 45 degrees so it reads as a
  // cross from the plaza (south-east) and from both transept façades
  const cross = crossGeo({ arm: J.crossArm, thickness: 1.7, depth: 1.35 });
  xform(cross, { ry: Math.PI / 4, x: CX, y: crossCenterY, z: CZ });
  b.add('goldGlow', cross);
  // little gold boss at the crossing of the arms
  b.add('goldGlow', xform(sphereGeo(1.2, 12), { x: CX, y: crossCenterY + J.crossArm * 0.12, z: CZ }));
}

/** Octagonal prism/frustum centred at (cx, cz), flat face toward +Z. */
function frustumOct(rBottom, rTop, h, y0, cx, cz) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1, false);
  g.rotateY(-Math.PI / 8);
  g.translate(cx, y0 + h / 2, cz);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
