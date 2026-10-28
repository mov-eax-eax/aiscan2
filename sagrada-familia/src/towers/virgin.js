// The tower of the Virgin Mary behind the apse.
//
// It rises from the apse roof (baseY = 45), not from the ground: the apse
// interior and its half-dome occupy the volume below. The visible shaft carries
// blue-and-gold trencadís mosaic bands, lancet windows, a niche with the Virgin,
// and an "AVE MARIA" inscription. It is crowned by the openwork lantern and the
// twelve-pointed Star of Bethlehem at DIM.virginTower.starY.

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
  starGeo,
  figureGeo,
  rng,
  rand,
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
  textPlaneGeo,
  simplePinnacleGeo,
} from './common.js';

const V = DIM.virginTower;
const CX = V.x;
const CZ = V.z;
const BASE_Y = V.baseY;
const START = BASE_Y + 1.9;

const SECTIONS = [
  { y0: 46.9, y1: 64, w0: 10.2, w1: 9.6 },
  { y0: 64, y1: 82, w0: 9.6, w1: 8.9 },
  { y0: 82, y1: 100, w0: 8.9, w1: 8.1 },
  { y0: 100, y1: 114, w0: 8.1, w1: 6.9 },
  { y0: 114, y1: 122, w0: 6.9, w1: 5.0 },
];

function widthAt(y) {
  for (const s of SECTIONS) {
    if (y <= s.y1) {
      const t = (y - s.y0) / (s.y1 - s.y0);
      return s.w0 + (s.w1 - s.w0) * t;
    }
  }
  return SECTIONS[SECTIONS.length - 1].w1;
}

export function buildVirgin(b, mats) {
  const key = 'virgin';
  const r = rng(3311);
  const add = (g) => b.add(key, g);
  const addF = (w0, w1, h, y0) => add(xform(frustum4(w0, w1, h, y0), { x: CX, z: CZ }));
  const addC = (w, y, opts) => b.add('trim', xform(corniceGeo(w, y, opts), { x: CX, z: CZ }));
  const win = windowUnit({ w: 1.9, h: 7.6, band: 0.26, depth: 0.36 });
  const niche = nicheUnit({ w: 3.3, h: 6.6, band: 0.38, depth: 0.55 });
  const pinn = simplePinnacleGeo({ base: 0.85, height: 4.8 });

  // --------------------------------------------- roof / lantern transition
  // a skirt reaching down into the apse roof so the base is properly supported
  addF(11.6, 10.8, 3.2, 41.6);
  addC(11.9, 41.75, { out: 0.4, h: 0.3 });
  addC(11.0, 44.75, { out: 0.35, h: 0.3 });
  addF(12.6, 12.0, 0.6, BASE_Y);
  addF(12.0, 11.4, 0.6, BASE_Y + 0.6);
  addF(11.4, 10.6, 1.1, BASE_Y + 1.2);
  addC(12.8, BASE_Y + 0.14, { out: 0.5, h: 0.32 });
  addC(11.6, BASE_Y + 0.85, { out: 0.35, h: 0.26 });
  addC(10.9, BASE_Y + 2.4, { out: 0.4, h: 0.34 });
  // low terrace balustrade around the tower foot (sits on the apse roof)
  balustradeSquare(b, mats, { cx: CX, cz: CZ, halfW: 6.1, y: BASE_Y + 0.55, height: 0.8, spacing: 1.5 });

  // ------------------------------------------------------------------ shaft
  for (const s of SECTIONS) addF(s.w0, s.w1, s.y1 - s.y0, s.y0);
  // corner buttresses over the lower two thirds
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(xform(frustum4(1.25, 0.95, 100 - START, START), {
        x: CX + sx * 4.7,
        z: CZ + sz * 4.7,
      }));
    }
  }
  // string courses, ribs and windows
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    const len = s.y1 - s.y0;
    addC(s.w1 + 0.26, s.y1 + 0.1, { out: 0.42, h: 0.4 });
    addC(s.w1 + 0.1, s.y1 + 0.36, { out: 0.16, h: 0.15 });
    addC(s.w0 + (s.w1 - s.w0) * 0.32, s.y0 + len * 0.32, { out: 0.24, h: 0.22 });
    for (const face of FACES4) {
      const halfW = (s.w0 + s.w1) / 4;
      const yMid = (s.y0 + s.y1) / 2;
      for (const off of [-3.0, 0, 3.0]) {
        const tx = face.nz;
        const tz = -face.nx;
        b.add('trim', boxGeo(0.5, len, 0.5, CX + face.nx * halfW + tx * off, yMid, CZ + face.nz * halfW + tz * off));
      }
      // window row; the south face of the second section is kept free for the
      // niche holding the Virgin
      if (face.nz === 1 && i === 1) continue;
      const wh = Math.min(7.6, len * 0.6);
      const wy = s.y0 + (len - wh) * 0.68;
      const wHalf = widthAt(wy + wh * 0.5) / 2;
      for (const off of [-1.55, 1.55]) {
        const m = faceMatrix(CX, CZ, wHalf, face, wy, { off, extra: 0.03 });
        b.instance('winVirginStone', win.stone, mats.trim, m);
        b.instance('winVirginGlass', win.glass, mats.glass, m);
      }
    }
  }

  // ------------------------------------------------ blue / gold mosaic bands
  // placed in the clear bands between the window rows
  const bands = [
    { y: BASE_Y + 2.6, h: 1.4, w: 10.9 },
    { y: 65.2, h: 1.55, w: 9.9 },
    { y: 83.6, h: 1.5, w: 9.2 },
    { y: 100.5, h: 1.4, w: 8.35 },
  ];
  bands.forEach((bd, i) => {
    b.add(i % 2 ? 'mosaicDark' : 'mosaic', boxGeo(bd.w, bd.h, bd.w, CX, bd.y, CZ));
    addC(bd.w + 0.25, bd.y + bd.h / 2 + 0.12, { out: 0.3, h: 0.22 });
    addC(bd.w + 0.25, bd.y - bd.h / 2 - 0.12, { out: 0.3, h: 0.22 });
    // slim gilded lines framing each mosaic band
    b.add('gold', boxGeo(bd.w + 0.55, 0.1, bd.w + 0.55, CX, bd.y + bd.h / 2 + 0.36, CZ));
    b.add('gold', boxGeo(bd.w + 0.55, 0.1, bd.w + 0.55, CX, bd.y - bd.h / 2 - 0.36, CZ));
  });

  // --------------------------------------------------------- niche + Virgin
  const nicheY = 68.0;
  const faceHalf = widthAt(nicheY + 3.3) / 2;
  const m = faceMatrix(CX, CZ, faceHalf, FACES4[0], nicheY, { extra: 0.04 });
  b.instance('nicheVirginStone', niche.stone, mats.trim, m);
  b.instance('nicheVirginGlass', niche.glass, mats.glass, m);
  const virgin = figureGeo({ height: 3.9, pose: 'pray', kind: 'human', halo: true, seed: 17 });
  xform(virgin, { x: CX, y: nicheY + 0.75, z: CZ + faceHalf + 0.28 });
  add(virgin);
  // corbel the figure stands on
  add(boxGeo(2.3, 0.7, 1.2, CX, nicheY + 0.38, CZ + faceHalf + 0.2));
  // canopy over the niche
  add(boxGeo(4.6, 0.4, 1.5, CX, nicheY + 7.3, CZ + faceHalf - 0.1));

  // --------------------------------------------------------- AVE MARIA panel
  const ave = textPlaneGeo(mats.textMaria, 7.0);
  xform(ave, { x: CX, y: 46.85, z: CZ + 5.62 });
  b.add('textMaria', ave);

  // ----------------------------------------------------------------- crown
  addC(6.4, 122.0, { out: 0.55, h: 0.45 });
  b.add('gold', frustumOct(3.78, 3.78, 0.13, 122.05, CX, CZ));
  add(frustumOct(3.6, 2.7, 4.6, 122.3, CX, CZ));
  addC(4.0, 127.0, { out: 0.8, h: 0.4 });
  b.add('gold', frustumOct(2.86, 2.86, 0.13, 126.9, CX, CZ));
  balustradeSquare(b, mats, { cx: CX, cz: CZ, halfW: 3.3, y: 122.4, height: 0.75, spacing: 1.15 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    b.instance(
      'pinnacle',
      pinn,
      mats.trim,
      matrixAt(CX + Math.sin(a) * 3.3, 122.4, CZ + Math.cos(a) * 3.3, { ry: a }),
      { castShadow: true }
    );
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const g = boxGeo(0.4, 4.4, 0.5);
    xform(g, { ry: a, x: CX + Math.sin(a) * 3.6, y: 124.3, z: CZ + Math.cos(a) * 3.6 });
    b.add('trim', g);
  }

  // ------------------------------------------------- Star of Bethlehem
  const starY = V.starY;
  const starR = V.starR;
  // slender gilded needle carrying the star
  const starNeck = new THREE.CylinderGeometry(0.32, 0.72, starY - 126.6, 8);
  b.add('gold', xform(starNeck, { x: CX, y: (127.2 + starY - 0.9) / 2, z: CZ }));
  b.add('gold', xform(torusGeo(0.9, 0.2, 13, 6), { rx: Math.PI / 2, x: CX, y: 128.0, z: CZ }));
  // the twelve-pointed star, facing the city (+Z)
  const star = starGeo(12, starR, starR * 0.27, 0.9);
  b.add('star', xform(star, { x: CX, y: starY, z: CZ }));
  // inner bright star for depth
  const star2 = starGeo(12, starR * 0.5, starR * 0.13, 0.5);
  b.add('star', xform(star2, { x: CX, y: starY, z: CZ + 0.65 }));
  // gilded halo at the hub
  b.add('gold', xform(torusGeo(1.55, 0.22, 16, 6), { x: CX, y: starY, z: CZ + 0.5, ry: 0 }));
  b.add('gold', xform(sphereGeo(1.15, 12), { x: CX, y: starY, z: CZ - 0.5 }));
}

function frustumOct(rBottom, rTop, h, y0, cx, cz) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1, false);
  g.rotateY(-Math.PI / 8);
  g.translate(cx, y0 + h / 2, cz);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
