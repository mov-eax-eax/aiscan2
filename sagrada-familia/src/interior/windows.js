// Interior window dressing: stone tracery, sills and reveals inside every
// clerestory and aisle window, cool glass on +X and warm glass on -X, plus
// subtle additive light shafts and pools of coloured light on the floor.

import {
  THREE,
  xform,
  boxGeo,
  torusGeo,
  archRingGeo,
  mergeGeos,
  lancetWindowParts,
} from '../lib.js';
import { bucket, DIM, PALETTE, shaftGeo, lightPool, bossGeo } from './common.js';

const WALL_INSET = 0.18; // tracery sits this far inside the shell's inner face
const SIDES = [
  { sx: 1, ry: -Math.PI / 2, glass: 'glassCool', shaft: 'shaftCool', pool: 'poolCool', colors: PALETTE.glassCool },
  { sx: -1, ry: Math.PI / 2, glass: 'glassWarm', shaft: 'shaftWarm', pool: 'poolWarm', colors: PALETTE.glassWarm },
];

/** One dressed window: tracery, glass, sill, reveal, interior frame. */
function dressWindow(b, glow, side, opts) {
  const { z, y0, w, h, seed, frame = true } = opts;
  const sx = side.sx;
  const x = sx * (DIM.naveWallX - WALL_INSET);
  const tx = { x, y: y0, z, ry: side.ry };
  const parts = lancetWindowParts({ w, h, colors: side.colors, seed, bands: 2 });
  b.add('stoneLight', xform(parts.stone, tx));
  if (parts.glass) glow.add(side.glass, xform(parts.glass, tx));
  // interior reveal frame, proud of the tracery
  if (frame) {
    const ring = archRingGeo({ w: w + 0.55, h: h * 0.99, band: 0.3, depth: 0.5, spring: 0.55 });
    b.add('stone', xform(ring, { x: sx * (DIM.naveWallX - WALL_INSET - 0.32), y: y0, z, ry: side.ry }));
  }
  // sill
  b.add('stone', xform(boxGeo(w + 0.9, 0.26, 0.9, 0, -0.13, 0.34), tx));
  // jambs
  for (const s of [-1, 1]) {
    b.add('stoneLight', xform(boxGeo(0.34, h * 0.92, 0.75, s * (w / 2 + 0.3), h * 0.46, 0.3), tx));
  }

  return { x, z };
}

export function buildWindows(parent, mats, out) {
  const b = bucket();
  const glow = bucket();

  for (const side of SIDES) {
    const sx = side.sx;
    // ------------------------------------------------------- clerestory windows
    let k = 0;
    for (const z of DIM.clerestory.coords) {
      const { w, h, y0 } = DIM.clerestory;
      dressWindow(b, glow, side, { z, y0, w, h, seed: 200 + k * 7 + (sx > 0 ? 0 : 50), frame: true });
      // shafts from the visible upper part of the window into the clerestory
      // gallery (between the aisle vault at 30 m and the gallery soffit at 45 m)
      if (k % 2 === 0) {
        const start = [sx * (DIM.naveWallX - 0.9), y0 + h * 0.74, z];
        const end = [sx * 10.2, y0 + 6.4, z + 1.8];
        glow.add(side.shaft, shaftGeo(start, end, 0.85, 2.4, 10));
      }
      k++;
    }
    // ------------------------------------------------------------ aisle windows
    k = 0;
    for (const z of DIM.aisleWindows.coords) {
      const { w, h, y0 } = DIM.aisleWindows;
      dressWindow(b, glow, side, { z, y0, w, h, seed: 300 + k * 5 + (sx > 0 ? 0 : 40), frame: false });
      if (k % 2 === 0) {
        const start = [sx * (DIM.naveWallX - 0.9), y0 + h * 0.82, z];
        const end = [sx * 9.4, 0.45, z + 2.4];
        glow.add(side.shaft, shaftGeo(start, end, 0.9, 3.6, 12));
        glow.add(side.pool, lightPool(2.7, sx * 10.2, z + 2.2, 0.035));
      }
      k++;
    }
  }

  // Extra light pools where the clerestory shafts land on the aisle / arcade
  // (these read as reflected light rather than direct sun).
  for (const side of SIDES) {
    for (let i = 0; i < DIM.clerestory.coords.length; i += 2) {
      const z = DIM.clerestory.coords[i];
      glow.add(side.pool, lightPool(2.2, side.sx * 8.6, z + 1.0, 0.032));
    }
  }

  // Coloured light spilling onto the aisle walls beneath the windows: soft
  // additive washes, vertical against the stone, never strong enough to wash
  // out the tracery above them.
  for (const side of SIDES) {
    for (const z of DIM.aisleWindows.coords) {
      const wash = new THREE.CircleGeometry(2.4, 18);
      glow.add(
        side.pool,
        xform(wash, { x: side.sx * (DIM.naveWallX - 0.06), y: 3.2, z, ry: side.ry })
      );
    }
    for (const z of DIM.clerestory.coords) {
      const wash = new THREE.CircleGeometry(2.0, 16);
      glow.add(
        side.pool,
        xform(wash, { x: side.sx * (DIM.naveWallX - 0.06), y: 33, z, ry: side.ry })
      );
    }
  }

  // ------------------------------------------------------------ rose windows
  // Interior stone mouldings around the three great roses (Nativity, Passion,
  // Glory), offset 0.15 m inside the shell's inner face.
  const roses = [
    {
      r: DIM.roseWindows.nativity.r,
      y: DIM.roseWindows.nativity.y,
      p: [DIM.facadeInner.nativityX - 0.15, DIM.roseWindows.nativity.y, 0],
      ry: -Math.PI / 2,
    },
    {
      r: DIM.roseWindows.passion.r,
      y: DIM.roseWindows.passion.y,
      p: [DIM.facadeInner.passionX + 0.15, DIM.roseWindows.passion.y, 0],
      ry: Math.PI / 2,
    },
    {
      r: DIM.roseWindows.glory.r,
      y: DIM.roseWindows.glory.y,
      p: [0, DIM.roseWindows.glory.y, DIM.facadeInner.gloryZ - 0.15],
      ry: Math.PI,
    },
  ];
  for (const rose of roses) {
    const parts = [];
    parts.push(torusGeo(rose.r + 0.5, 0.3, 48, 6));
    parts.push(torusGeo(rose.r + 0.1, 0.12, 48, 5));
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const g = bossGeo(0.32, k + 3);
      xform(g, { rx: -Math.PI / 2, x: Math.cos(a) * (rose.r + 0.9), y: Math.sin(a) * (rose.r + 0.9) });
      parts.push(g);
    }
    b.add('stoneLight', xform(mergeGeos(parts), { x: rose.p[0], y: rose.p[1], z: rose.p[2], ry: rose.ry }));
  }

  b.flush(parent, mats, { castShadow: false, receiveShadow: true });
  const gm = glow.flush(parent, mats, { castShadow: false, receiveShadow: false });
  gm.forEach((m) => {
    m.renderOrder = 3;
  });
  return { count: SIDES.length * (DIM.clerestory.coords.length + DIM.aisleWindows.coords.length) };
}
