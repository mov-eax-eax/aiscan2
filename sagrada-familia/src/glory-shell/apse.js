// Sagrada Família — apse exterior.
//
// Semicircular wall centred (0, -45) with radius 16.2 over the northern half
// (angles π..2π), height 40. Seven radial chapels project outward to r = 22.5,
// each with an arched axial window, stepped/conical roof and a gilded finial.
// Eight radial buttress fins between the chapels rise to pinnacles; blind
// lancets above the chapel roofs light the clerestory band. The Virgin tower
// (0, -52) rises from y = 45, so everything above y = 41 is kept clear of its
// r ≈ 8 footprint — the roof/lantern transition belongs to the towers builder.

import { DIM, PALETTE } from '../config.js';
import {
  THREE,
  boxGeo,
  coneGeo,
  sphereGeo,
  xform,
} from '../lib.js';
import { addLancet } from './windows.js';
import { addPinnacle, addFigure } from './ornaments.js';

const CZ = DIM.apseCenterZ; // -45
const R = DIM.apseWallRadius; // 16.2
const RIN = DIM.apseRadius; // 15
const ROUT = DIM.apseOuterRadius; // 22.5
const H = 40;
const CHAPELS = DIM.apseChapelCount; // 7

const APSE_COLORS = [
  PALETTE.glassCool[0],
  PALETTE.glassRose[3],
  PALETTE.glassCool[2],
  PALETTE.glassRose[5],
  PALETTE.glassCool[4],
  PALETTE.glassRose[6],
  PALETTE.glassCool[1],
];

// Shape coordinates for the apse: shape X = world X, shape Y = -world Z.
const sx = (r, a) => r * Math.cos(a);
const sy = (r, a) => -CZ - r * Math.sin(a);

function arcShape(r0, r1, steps = 64) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * Math.PI;
    if (i === 0) shape.moveTo(sx(r1, a), sy(r1, a));
    else shape.lineTo(sx(r1, a), sy(r1, a));
  }
  for (let i = steps; i >= 0; i--) {
    const a = Math.PI + (i / steps) * Math.PI;
    shape.lineTo(sx(r0, a), sy(r0, a));
  }
  shape.closePath();
  return shape;
}

function standingGeo(shape, height, y = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  if (y) geo.translate(0, y, 0);
  return geo;
}

export function buildApseExterior(kit) {
  // ---------------------------------------------------------- curved wall
  // The plaza is at y = -0.055, so the wall is sunk slightly to close the seam.
  kit.add('shell', standingGeo(arcShape(RIN, R), H + 0.3, -0.3));

  // Horizontal bands (cornice at the wall head, band above the chapels).
  kit.add('trim', standingGeo(arcShape(RIN - 0.2, R + 0.9), 0.8, 39.2));
  kit.add('trim2', standingGeo(arcShape(RIN - 0.3, R + 1.05), 0.26, 39.98));
  kit.add('mosaic', standingGeo(arcShape(R + 0.32, R + 0.5), 0.22, 38.9));
  kit.add('trim2', standingGeo(arcShape(RIN - 0.1, R + 0.45), 0.5, 20.3));
  // Base plinth around the apse.
  kit.add('aisle', standingGeo(arcShape(RIN - 0.2, R + 0.5), 1.5, -0.3));
  kit.add('trim2', standingGeo(arcShape(RIN - 0.1, R + 0.62), 0.24, 1.24));

  // ------------------------------------------------------ buttress fins
  for (let i = 0; i <= CHAPELS; i++) {
    const a = Math.PI + (i * Math.PI) / CHAPELS;
    const rr = 17.4;
    const px = rr * Math.cos(a);
    const pz = CZ + rr * Math.sin(a);
    const ry = Math.PI / 2 - a;
    kit.add('aisle', xform(boxGeo(0.95, 34.4, 2.6, 0, 0, 0), { x: px, y: 16.85, z: pz, ry }));
    kit.add('aisle', xform(boxGeo(1.5, 2.5, 3.1, 0, 0, 0), { x: px * 1.005, y: 0.95, z: pz * 1.005, ry }));
    kit.add('trim2', xform(boxGeo(1.25, 0.3, 2.9, 0, 0, 0), { x: px, y: 34.1, z: pz, ry }));
    addPinnacle(kit, 'trim', px, 34.2, pz, {
      base: 0.8,
      height: 4.3,
      seed: 700 + i,
      goldTip: true,
      goldR: 0.14,
    });
    kit.circle(px, pz, 1.35, 0, 40);
  }

  // ------------------------------------------------------------ chapels
  for (let i = 0; i < CHAPELS; i++) {
    const a = Math.PI + ((i + 0.5) * Math.PI) / CHAPELS;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ox = R * ca;
    const oz = CZ + R * sa;
    const ry = Math.PI / 2 - a;
    const put = (key, geo, lx = 0, ly = 0, lz = 0) => {
      // rotate the local offset into world
      const wx = ox + lx * Math.cos(ry) + lz * Math.sin(ry);
      const wz = oz - lx * Math.sin(ry) + lz * Math.cos(ry);
      kit.add(key, xform(geo, { x: wx, y: ly, z: wz, ry }));
    };
    // body / plinth / side pilasters / cornice
    put('aisle', boxGeo(5.8, 20.25, 6.3, 0, 9.9, 3.15));
    put('aisle', boxGeo(6.3, 2.0, 6.8, 0, 0.6, 3.4));
    put('trim2', boxGeo(0.62, 22.2, 6.5, -3.0, 10.9, 3.25));
    put('trim2', boxGeo(0.62, 22.2, 6.5, 3.0, 10.9, 3.25));
    put('dark', boxGeo(6.0, 0.45, 6.55, 0, 20.1, 3.3));
    put('trim', boxGeo(6.15, 0.55, 6.7, 0, 20.55, 3.35));
    put('trim2', boxGeo(6.3, 0.22, 6.85, 0, 20.92, 3.35));
    // mosaic band
    put('mosaic', boxGeo(6.2, 0.32, 6.72, 0, 19.25, 3.35));
    // stepped / conical roof
    put('trim', boxGeo(5.3, 1.5, 5.9, 0, 21.95, 3.2));
    put('trim2', boxGeo(4.3, 1.25, 4.9, 0, 23.3, 3.2));
    put('trim', boxGeo(3.2, 1.15, 3.8, 0, 24.5, 3.2));
    put('roof', coneGeo(2.0, 3.1, 8, 0, 26.6, 3.2));
    put('gold', sphereGeo(0.3, 10, 0, 28.35, 3.2));
    // axial window
    const wx = ROUT * ca;
    const wz = CZ + ROUT * sa;
    addLancet(kit, {
      frame: { x: wx, y: 10.8, z: wz, ry },
      w: 3.2,
      h: 7.6,
      colors: APSE_COLORS,
      seed: 750 + i * 13,
      bands: 2,
      region: 'apse',
      depth: 0.9,
      sill: true,
      innerRing: false,
      proud: true,
    });
    // Blind lancet above the chapel roof, on the apse wall.
    addLancet(kit, {
      frame: {
        x: R * ca * 1.0,
        y: 28.6,
        z: CZ + R * sa,
        ry,
      },
      w: 2.1,
      h: 8.4,
      colors: APSE_COLORS,
      seed: 790 + i * 5,
      bands: 2,
      region: 'apse',
      depth: 1.2,
      sill: false,
      innerRing: false,
      proud: true,
    });
    // Two angels on the cornice of the axial chapel (the chapel facing north).
    const localXZ = (lx, lz) => ({
      x: ox + lx * Math.cos(ry) + lz * Math.sin(ry),
      z: oz - lx * Math.sin(ry) + lz * Math.cos(ry),
    });
    if (i === Math.floor(CHAPELS / 2)) {
      for (const s of [-1, 1]) {
        const p = localXZ(s * 1.5, 5.9);
        addFigure(kit, 'trim', {
          x: p.x,
          y: 21.0,
          z: p.z,
          ry,
          height: 2.0,
          pose: 'armsUp',
          kind: 'angel',
          wings: true,
          seed: 810 + s,
        });
      }
    }
    // Pinnacle on the chapel cornice edge.
    addPinnacle(kit, 'trim', wx, 20.9, wz, {
      base: 0.55,
      height: 2.6,
      seed: 830 + i,
    });
    kit.circle(19.4 * ca, CZ + 19.4 * sa, 3.5, 0, 30);
  }

  // (The crown of pinnacles around the apse rim is owned by the towers builder,
  // whose roof cone covers this wall head — no second crown here.)

  // ------------------------------------------- nave / apse corner pilasters
  for (const s of [-1, 1]) {
    kit.add('trim2', boxGeo(1.35, 40.3, 1.75, s * 15.65, 19.85, -45.05));
    kit.add('trim', boxGeo(1.65, 0.7, 2.0, s * 15.65, 40.2, -45.05));
    kit.box(s * 15.65, -45.05, 0.78, 0.98, 0, 40);
  }

  // ------------------------------------------------------ apse colliders
  // Small overlapping boxes hugging r = 15.6: no gap between them and only a
  // shallow intrusion into the ambulatory.
  const NCOL = 40;
  const rc = (R + RIN) / 2;
  for (let i = 0; i < NCOL; i++) {
    const a = Math.PI + ((i + 0.5) / NCOL) * Math.PI;
    kit.box(rc * Math.cos(a), CZ + rc * Math.sin(a), 0.68, 0.68, 0, H);
  }
}
