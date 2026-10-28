// Vaults and ceilings: ribbed "hyperboloid / star" bays over the nave, transept
// and side aisles; the 60 m crossing dome with its lantern ring; the four great
// crossing spandrel walls. The exterior roof belongs to the towers builder.
//
// The vault surfaces are groin-like shells: the intersection of two barrel
// vaults, so the webbing curves up to two ridges and four flanking arches, and
// every bay carries groins, transverse arches, ridge ribs and a glowing oculus.

import {
  THREE,
  xform,
  tubeGeo,
  boxGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  latheGeo,
  starGeo,
  clamp,
  rng,
  rand,
  mergeGeos,
  shapeGeo,
  scaleUV,
  archShape,
  circleCollider,
} from '../lib.js';
import { bucket, DIM, L, gridSurface, crossingDomeY, downCone, flatStar, bossGeo, ringBand, oculusDisc, glowRing, shaftGeo, vaultEdgeY } from './common.js';

const TAU = Math.PI * 2;

function vaultPoint(U, V, hw, hb, ySpring, rise) {
  const cu = 1 - U * U;
  const cv = 1 - V * V;
  const h = Math.max(0, cu, cv);
  return [U * hw, ySpring + rise * h, V * hb];
}

/**
 * One ribbed vault bay. Local frame: x across (+/-hw), z along (+/-hb), then
 * transformed by tx ({x, z, ry}).
 */
function addBay(b, glow, opts) {
  const { hw, hb, ySpring, rise, tx, seed = 1, oculus = true, oculusR = 1.55, ribs = 6, socket = true } = opts;
  const rnd = rng(seed);
  const P = (U, V) => vaultPoint(U, V, hw, hb, ySpring, rise);
  const put = (mat, geo) => b.add(mat, xform(geo, tx));
  const putGlow = (mat, geo) => glow.add(mat, xform(geo, tx));

  // ---- webbing
  const surf = gridSurface(22, 16, (u, v) => P(u * 2 - 1, v * 2 - 1), { flip: true, uv: [hw * 0.55, hb * 0.55] });
  put('vault', surf);

  // ---- ribs
  const ribR = Math.max(0.2, Math.min(hw, hb) * 0.052);
  const addRib = (pts, r = ribR) => put('rib', tubeGeo(pts, r, { tubularSegments: 20, radialSegments: 5 }));
  const sample = (fn, n = 18) => {
    const out = [];
    for (let i = 0; i <= n; i++) out.push(fn(-1 + (2 * i) / n));
    return out;
  };
  // groins (the two diagonals, crossing at the oculus)
  addRib(sample((t) => P(t, t)).map((p) => [p[0], p[1] - ribR * 0.55, p[2]]), ribR * 1.12);
  addRib(sample((t) => P(t, -t)).map((p) => [p[0], p[1] - ribR * 0.55, p[2]]), ribR * 1.12);
  // flanking arches / transverse arches
  for (const U of [-1, 1]) addRib(sample((V) => P(U, V)).map((p) => [p[0], p[1] - ribR * 0.5, p[2]]));
  for (const V of [-1, 1]) addRib(sample((U) => P(U, V)).map((p) => [p[0], p[1] - ribR * 0.5, p[2]]));
  // ridge ribs from the oculus out to the four edge midpoints
  if (oculus) {
    const ridge = (axis, sign) => {
      const half = axis === 'x' ? hw : hb;
      const t0 = oculusR / half + 0.03;
      const pts = [];
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const t = sign * (t0 + (1 - t0) * (i / n));
        const p = axis === 'x' ? P(t, 0) : P(0, t);
        pts.push([p[0], p[1] - ribR * 0.45, p[2]]);
      }
      return pts;
    };
    for (const sign of [-1, 1]) {
      addRib(ridge('x', sign), ribR * 0.85);
      addRib(ridge('z', sign), ribR * 0.85);
    }
  }
  // secondary ribs halfway to the edges, for a denser canopy
  if (ribs >= 6) {
    for (const s of [-1, 1]) {
      addRib(sample((t) => P(t, s * 0.52), 12).map((p) => [p[0], p[1] - ribR * 0.4, p[2]]), ribR * 0.62);
      addRib(sample((t) => P(s * 0.52, t), 12).map((p) => [p[0], p[1] - ribR * 0.4, p[2]]), ribR * 0.62);
    }
  }

  const crown = ySpring + rise;

  // ---- oculus: stone lip, glowing glass, gold tracery and an additive glow
  if (oculus) {
    put('rib', xform(torusGeo(oculusR, oculusR * 0.13, 22, 6), { rx: Math.PI / 2, y: crown - 0.26 }));
    putGlow('vaultGlow', xform(oculusDisc(oculusR * 0.94), { y: crown - 0.22 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      put(
        'gold',
        xform(boxGeo(oculusR * 1.5, 0.05, 0.09, Math.cos(a) * oculusR * 0.47, crown - 0.28, Math.sin(a) * oculusR * 0.47), { ry: -a })
      );
    }
    putGlow('poolWarm', xform(new THREE.CircleGeometry(oculusR * 2.4, 20), { rx: Math.PI / 2, y: crown - 0.75 }));
    // opaque cap above the webbing: if any seam ever opens, it shows cream stone
    put('stoneLight', xform(new THREE.CircleGeometry(oculusR * 2.6, 20), { rx: Math.PI / 2, y: crown + 0.3 }));
    // radiating gold points around the oculus
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      put('gold', downCone(0.09, 0.42, 4, Math.cos(a) * oculusR * 1.16, crown - 0.32, Math.sin(a) * oculusR * 1.16));
    }
  }

  // ---- gold bosses at the groin quarter points + small stars on the webbing
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      const p = P(s * 0.5, t * 0.5);
      put('gold', xform(bossGeo(0.2, seed + t), { x: p[0], y: p[1] - 0.2, z: p[2] }));
      const q = P(s * 0.42, t * 0.72);
      put('mosaicGold', xform(flatStar(8, 0.34, 0.14, 0.04), { x: q[0], y: q[1] - 0.16, z: q[2] }));
    }
  }

  // ---- corbel socket where the bay meets the columns
  if (socket) {
    for (const U of [-1, 1]) {
      for (const V of [-1, 1]) {
        const p = P(U, V);
        put('stoneLight', downCone(0.5, 1.1, 6, p[0] * 0.985, p[1] - 0.5, p[2] * 0.985));
      }
    }
  }
  return { crown };
}

/** Simple cross-vault bay over a side aisle (lower, plainer). */
function addAisleBay(b, glow, opts) {
  const { hw, hb, ySpring, rise, tx, seed = 1 } = opts;
  const P = (U, V) => vaultPoint(U, V, hw, hb, ySpring, rise);
  const put = (mat, geo) => b.add(mat, xform(geo, tx));
  put('vault', gridSurface(10, 12, (u, v) => P(u * 2 - 1, v * 2 - 1), { flip: true, uv: [hw * 0.5, hb * 0.5] }));
  // ribs on the extrados: this side is visible from the nave through the
  // triforium opening above the aisle
  for (const U of [-0.55, 0.55]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const p = P(U, -1 + 2 * i / 10);
      pts.push([p[0], p[1] + 0.16, p[2]]);
    }
    put('stoneLight', tubeGeo(pts, 0.13, { tubularSegments: 12, radialSegments: 4 }));
  }
  const ribR = 0.19;
  const sample = (fn, n = 14) => {
    const out = [];
    for (let i = 0; i <= n; i++) out.push(fn(-1 + (2 * i) / n));
    return out;
  };
  const low = (p) => [p[0], p[1] - ribR * 0.5, p[2]];
  put('rib', tubeGeo(sample((t) => P(t, t)).map(low), ribR * 1.1, { tubularSegments: 18, radialSegments: 5 }));
  put('rib', tubeGeo(sample((t) => P(t, -t)).map(low), ribR * 1.1, { tubularSegments: 18, radialSegments: 5 }));
  for (const U of [-1, 1]) put('rib', tubeGeo(sample((V) => P(U, V)).map(low), ribR, { tubularSegments: 16, radialSegments: 4 }));
  for (const V of [-1, 1]) put('rib', tubeGeo(sample((U) => P(U, V)).map(low), ribR, { tubularSegments: 16, radialSegments: 4 }));
  const crown = ySpring + rise;
  put('rib', xform(torusGeo(0.75, 0.11, 16, 5), { rx: Math.PI / 2, y: crown - 0.16 }));  glow.add('vaultGlowCool', xform(oculusDisc(0.68), { y: crown - 0.13, ...tx }));
  put('gold', xform(bossGeo(0.16, seed), { y: crown - 0.24 }));
  put('stoneLight', xform(new THREE.CircleGeometry(1.9, 16), { rx: Math.PI / 2, y: crown + 0.28 }));
  return { crown };
}

/**
 * Gallery soffits over the side aisles. Above each aisle vault (30 m) and below
 * roof springing (45 m) there is a tall clerestory gallery, lit by the upper
 * windows. These ruled ceilings close that gallery at 45 m — rising from the
 * edge of the nave vault to the outer wall — so the interior never shows raw
 * sky or an open roof void, and the clerestory windows stay fully visible.
 */
function galleryCeilings(b) {
  const Y = 45.0;
  const spring = L.naveVaultSpring;
  const rise = L.naveVaultCrown - L.naveVaultSpring;
  /** Transverse ribs (rafters) across one gallery soffit. */
  const rafters = (pointAt, fracs) => {
    for (const f of fracs) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const v = i / 8;
        const p = pointAt(f, v);
        pts.push([p[0], p[1] - 0.12, p[2]]);
      }
      b.add('rib', tubeGeo(pts, 0.13, { tubularSegments: 10, radialSegments: 4 }));
    }
  };
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [...L.naveBays, ...L.naveBaysNorth]) {
      const zm = (z0 + z1) / 2;
      const hb = (z1 - z0) / 2;
      const pointAt = (u, v) => {
        const z = z0 + (z1 - z0) * u;
        const V = (z - zm) / hb;
        const edge = spring + rise * Math.max(0, 1 - V * V);
        const x = sx * (DIM.centralNaveHalf - 0.15 + (DIM.naveWallX + 0.85 - DIM.centralNaveHalf) * v);
        return [x, edge + 0.12 + (Y - edge - 0.12) * v, z];
      };
      b.add('vault', gridSurface(10, 4, pointAt, { flip: true, uv: [3, 1] }));
      rafters(pointAt, [0.18, 0.5, 0.82]);
      // wall-top cornice: seals the soffit/wall/roof junction and hides any
      // seam where the shell's roof meets the interior
      b.add('stoneLight', boxGeo(0.9, 0.5, z1 - z0, sx * (DIM.naveWallX + 0.16), 44.62, (z0 + z1) / 2));
      b.add('gold', boxGeo(0.95, 0.07, z1 - z0, sx * (DIM.naveWallX + 0.16), 44.34, (z0 + z1) / 2));
    }
  }
  for (const sz of [-1, 1]) {
    for (const [x0, x1] of [...L.transeptAisleBays, ...L.transeptBaysWest]) {
      const xm = (x0 + x1) / 2;
      const hb = Math.abs(x1 - x0) / 2;
      const pointAt = (u, v) => {
        const x = x0 + (x1 - x0) * u;
        const U = (x - xm) / hb;
        const edge = spring + rise * Math.max(0, 1 - U * U);
        const z = sz * (DIM.centralNaveHalf - 0.15 + (DIM.transeptHalfWidth + 0.85 - DIM.centralNaveHalf) * v);
        return [x, edge + 0.12 + (Y - edge - 0.12) * v, z];
      };
      b.add('vault', gridSurface(10, 4, pointAt, { flip: true, uv: [3, 1] }));
      rafters(pointAt, [0.18, 0.5, 0.82]);
      b.add('stoneLight', boxGeo(x1 - x0, 0.5, 0.9, (x0 + x1) / 2, 44.62, sz * (DIM.transeptHalfWidth + 0.16)));
      b.add('gold', boxGeo(x1 - x0, 0.07, 0.95, (x0 + x1) / 2, 44.34, sz * (DIM.transeptHalfWidth + 0.16)));
    }
  }
}

// ---------------------------------------------------------------------------
// Great crossing
// ---------------------------------------------------------------------------

const CROSS_R = 15.4; // square boundary radius used by the dome
const CROSS_R0 = 6.4; // lantern oculus radius at the top

function domePoint(th, rr) {
  const m = Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th)));
  const rEdge = CROSS_R / m;
  const r = CROSS_R0 + (rEdge - CROSS_R0) * rr;
  const h = clamp((r - CROSS_R0) / (rEdge - CROSS_R0), 0, 1);
  const y = DIM.crossingVaultY - 15 * Math.pow(h, 1.55);
  return [Math.cos(th) * r, y, Math.sin(th) * r];
}

/** y of the dome surface at a point on the |z| = or |x| = boundary planes. */
function domeYAt(x, z) {
  return crossingDomeY(x, z);
}

// ---------------------------------------------------------------------------
// Sealed crossing lantern.
// The shell/towers roofscape dips into the crossing volume (lowest foreign
// geometry found by QA rays is at y = 43.95), so the interior closes itself with
// a coffered stone soffit at 43.6 m: flat from the four spandrel walls inward to
// r = 8.4, then rising as a shallow bowl to a glowing lantern ring at 46.15.
// Everything above that — the towers' roof, tower bases, the gutter trims — is
// hidden from inside by opaque stone and a luminous ceiling panel.
// ---------------------------------------------------------------------------
const SOFFIT = {
  boundary: 12.4, // square half-width of the soffit (inside the spandrel walls)
  edgeY: 43.6,
  bowlR: 8.4,
  ringR: 6.4,
  ringY: 46.15,
};

function soffitYAtR(r) {
  if (r >= SOFFIT.bowlR) return SOFFIT.edgeY;
  const t = clamp((SOFFIT.bowlR - r) / (SOFFIT.bowlR - SOFFIT.ringR), 0, 1);
  return SOFFIT.edgeY + (SOFFIT.ringY - SOFFIT.edgeY) * Math.pow(t, 1.3);
}

function soffitPoint(th, rr) {
  const m = Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th)));
  const rEdge = SOFFIT.boundary / m;
  const r = rEdge + (SOFFIT.ringR - rEdge) * rr;
  return [Math.cos(th) * r, soffitYAtR(r), Math.sin(th) * r];
}

/** Outline of the adjacent vaults where they meet the crossing planes. */

function spandrelWall(b, glow, side) {
  // Local wall spans x -15.4..15.4, bottom follows the vaulted bays, top
  // follows the crossing dome; a lunette opening lets the lantern be seen.
  const half = 15.4;
  const steps = 24;
  const bottom = [];
  const top = [];
  for (let i = 0; i <= steps; i++) {
    const x = -half + (2 * half * i) / steps;
    bottom.push([x, vaultEdgeY(x)]);
    top.push([x, domeYAt(x, L.crossingHalf)]);
  }
  const pts = bottom.concat(top.reverse());
  // lunette opening
  const hole = [];
  hole.push([-5.6, 46.2], [5.6, 46.2], [5.6, 47.8]);
  for (let i = 1; i < 14; i++) {
    const a = (i / 14) * Math.PI;
    hole.push([5.6 * Math.cos(a), 47.8 + 2.2 * Math.sin(a)]);
  }
  hole.push([-5.6, 47.8]);
  const geo = shapeGeo(pts, 0.8, [hole]);
  scaleUV(geo, 1 / 6, 1 / 6);
  const ry = side === 'south' ? 0 : side === 'north' ? Math.PI : side === 'east' ? -Math.PI / 2 : Math.PI / 2;
  const x = side === 'east' ? L.crossingHalf : side === 'west' ? -L.crossingHalf : 0;
  const z = side === 'south' ? L.crossingHalf : side === 'north' ? -L.crossingHalf : 0;
  // Which local Z sign points into the crossing differs between the N/S walls
  // (local -Z) and the E/W walls (local +Z); everything face-mounted uses this.
  const inward = side === 'south' || side === 'north' ? -1 : 1;
  b.add('plaster', xform(geo, { x, z, ry }));
  // decorative moulding around the lunette plus a gold star on the wall face
  const archPts = [
    [-5.6, 46.2, 0],
    [5.6, 46.2, 0],
    [5.6, 47.8, 0],
  ];
  for (let i = 1; i < 20; i++) {
    const a = (i / 20) * Math.PI;
    archPts.push([5.6 * Math.cos(a), 47.8 + 2.2 * Math.sin(a), 0]);
  }
  archPts.push([-5.6, 47.8, 0]);
  const band = tubeGeo(archPts.map((p) => [p[0] * 1.02, p[1], 0]), 0.16, { tubularSegments: 30, radialSegments: 4 });
  b.add('rib', xform(band, { x, z, ry }));
  b.add('gold', xform(starGeo(12, 1.25, 0.55, 0.16), { x, y: 51.4, z, ry }));
  // glowing lunette: the lantern's light spilling through the crossing walls
  {
    const glazing = new THREE.ShapeGeometry(archShape(10.4, 3.8, 0.5), 10);
    glazing.translate(0, 46.2, inward * 0.46);
    glow.add('lanternGlow', xform(glazing, { x, z, ry }));
    const mull = [];
    for (const mx of [-3.4, -0.9, 1.6]) mull.push(boxGeo(0.16, 3.4, 0.22, mx, 47.9, 0));
    b.add('marble', xform(mergeGeos(mull), { x, z, ry }));
  }
  // horizontal string courses break up the large plaster fields: the lower one
  // runs under the lunette, the upper one above it (both trimmed where the
  // wall has already ended)
  for (const [y, len] of [[45.55, 29.6], [50.65, 22.4]]) {
    b.add('stoneLight', xform(boxGeo(len, 0.32, 0.66, 0, y, 0), { x, z, ry }));
    b.add('gold', xform(boxGeo(len, 0.07, 0.7, 0, y - 0.2, 0), { x, z, ry }));
  }
  // vertical ribs on the solid parts of the spandrel
  for (const sx of [-1, 1]) {
    for (const px of [5.95, 8.4, 11.2, 13.6].map((v) => sx * v)) {
      const yb = vaultEdgeY(px) + 0.7;
      const yt = domeYAt(px, 12) - 0.35;
      if (yt > yb + 0.5) {
        b.add('rib', xform(boxGeo(0.3, yt - yb, 0.6, px, (yt + yb) / 2, 0), { x, z, ry }));
        b.add('gold', xform(boxGeo(0.07, yt - yb, 0.66, px, (yt + yb) / 2, 0), { x, z, ry }));
      }
    }
    // glowing oculus high in each spandrel, facing into the crossing
    const ox = sx * 8.2;
    const oy = 49.6;
    const wx = x + inward * 0.45 * Math.sin(ry);
    const wz = z + inward * 0.45 * Math.cos(ry);
    const face = ry + (inward > 0 ? 0 : Math.PI);
    glow.add('vaultGlow', xform(new THREE.CircleGeometry(0.5, 18), { x: wx, y: oy, z: wz, ry: face }));
    b.add('gold', xform(torusGeo(0.6, 0.08, 16, 5), { x: wx, y: oy, z: wz, ry: face }));
  }
}

function crossing(b, glow, out) {
  // ---- sealed coffered soffit with a luminous lantern at its centre
  const soffit = gridSurface(64, 9, (u, v) => soffitPoint(u * TAU, v), { flip: true, uv: [10, 2] });
  b.add('vaultDeep', soffit);
  // sixteen radial ribs following the soffit (eight major, gold-inlaid)
  for (let k = 0; k < 16; k++) {
    const th = (k / 16) * TAU;
    const major = k % 2 === 0;
    const pts = [];
    const gpts = [];
    for (let i = 0; i <= 16; i++) {
      const p = soffitPoint(th, i / 16);
      pts.push([p[0], p[1] - (major ? 0.28 : 0.18), p[2]]);
      if (major) gpts.push([p[0], p[1] - 0.42, p[2]]);
    }
    b.add('stoneLight', tubeGeo(pts, major ? 0.3 : 0.18, { tubularSegments: 22, radialSegments: 5 }));
    if (major) b.add('gold', tubeGeo(gpts, 0.09, { tubularSegments: 22, radialSegments: 4 }));
  }
  // two latitudinal rings and gold bosses break the soffit into coffers
  for (const rr of [0.4, 0.72]) {
    const ring = [];
    for (let i = 0; i < 64; i++) {
      const p = soffitPoint((i / 64) * TAU, rr);
      ring.push([p[0], p[1] - 0.2, p[2]]);
    }
    b.add('stoneLight', tubeGeo(ring, 0.13, { tubularSegments: 64, radialSegments: 4, closed: true }));
    b.add('gold', tubeGeo(ring.map((p) => [p[0], p[1] - 0.08, p[2]]), 0.045, {
      tubularSegments: 64,
      radialSegments: 4,
      closed: true,
    }));
  }
  for (let k = 0; k < 16; k++) {
    const th = (k / 16) * TAU;
    const p = soffitPoint(th, 0.96);
    b.add('gold', xform(bossGeo(0.3, k), { x: p[0], y: p[1] - 0.36, z: p[2] }));
    const q = soffitPoint(th + 0.2, 0.85);
    b.add('mosaicGold', xform(flatStar(8, 0.46, 0.2, 0.05), { x: q[0], y: q[1] - 0.28, z: q[2] }));
  }
  // cornice around the soffit springing (square, at the wall faces)
  for (const z of [-1, 1]) {
    b.add('stoneLight', boxGeo(25.2, 0.5, 0.55, 0, SOFFIT.edgeY - 0.1, z * (SOFFIT.boundary - 0.3)));
    b.add('stoneLight', boxGeo(0.55, 0.5, 25.2, z * (SOFFIT.boundary - 0.3), SOFFIT.edgeY - 0.1, 0));
    b.add('gold', boxGeo(25.3, 0.07, 0.6, 0, SOFFIT.edgeY - 0.38, z * (SOFFIT.boundary - 0.3)));
    b.add('gold', boxGeo(0.6, 0.07, 25.3, z * (SOFFIT.boundary - 0.3), SOFFIT.edgeY - 0.38, 0));
  }
  // ---- lantern: a glowing ceiling panel recessed inside the ring. This is the
  // light source of the crossing and the visual cap of the interior: nothing
  // above the panel can be seen from below.
  const r0 = SOFFIT.ringR;
  const ringY = SOFFIT.ringY;
  b.add('marble', xform(torusGeo(r0 * 1.04, 0.16, 40, 6), { rx: Math.PI / 2, y: ringY - 0.12 }));
  b.add('gold', xform(torusGeo(r0, 0.11, 40, 5), { rx: Math.PI / 2, y: ringY + 0.06 }));
  // glowing bowl filling the ring (faces down)
  glow.add('lanternGlow', xform(latheGeo(
    [
      [r0 * 1.0, 0],
      [r0 * 0.9, -0.14],
      [r0 * 0.6, -0.26],
      [r0 * 0.001, -0.32],
    ],
    32
  ), { y: ringY }));
  glow.add('poolWarm', xform(new THREE.CircleGeometry(r0 * 1.05, 24), { rx: Math.PI / 2, y: ringY - 0.62 }));
  // gold rays and pendants under the rim
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    b.add('gold', boxGeo(1.2, 0.06, 0.1, Math.cos(a) * r0 * 0.5, ringY - 0.45, Math.sin(a) * r0 * 0.5, -a));
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI / 8;
    const px = Math.cos(a) * (r0 + 1.0);
    const pz = Math.sin(a) * (r0 + 1.0);
    b.add('bronze', xform(tubeGeo([[px, ringY - 0.1, pz], [px, ringY - 0.9, pz]], 0.02, { tubularSegments: 4, radialSegments: 3 })));
    b.add('gold', xform(latheGeo([[0.16, 0], [0.2, 0.08], [0.12, 0.2], [0.03, 0.26], [0.001, 0.28]], 8), { x: px, y: ringY - 1.16, z: pz }));
    glow.add('lampRed', xform(new THREE.SphereGeometry(0.09, 6, 5), { x: px, y: ringY - 1.1, z: pz }));
  }
  // lantern light shaft down to the crossing floor
  glow.add('shaftGold', shaftGeo([0, ringY - 0.8, 0], [0, 0.5, 0], 2.2, 8.0, 14));
  // ---- spandrel walls
  for (const side of ['south', 'north', 'east', 'west']) spandrelWall(b, glow, side);
}

// ---------------------------------------------------------------------------

export function buildVaults(parent, mats, out) {
  const b = bucket();
  const glow = bucket();
  const rnd = rng(1337);

  // ---------------------------------------------------------- nave central bays
  const naveBays = [
    ...L.naveBays.map(([z0, z1]) => ({ z0, z1, ry: 0 })),
    ...L.naveBaysNorth.map(([z0, z1]) => ({ z0, z1, ry: 0 })),
  ];
  let seed = 10;
  for (const { z0, z1 } of naveBays) {
    addBay(b, glow, {
      hw: DIM.centralNaveHalf,
      hb: (z1 - z0) / 2,
      ySpring: L.naveVaultSpring,
      rise: L.naveVaultCrown - L.naveVaultSpring,
      tx: { x: 0, z: (z0 + z1) / 2 },
      seed: seed++,
      oculusR: 1.5,
      socket: (z0 + z1) / 2 !== 0,
    });
  }

  // -------------------------------------------------------------- side aisles
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [...L.naveBays, ...L.naveBaysNorth]) {
      addAisleBay(b, glow, {
        hw: (DIM.naveWallX - DIM.centralNaveHalf) / 2,
        hb: (z1 - z0) / 2,
        ySpring: L.aisleVaultSpring,
        rise: L.aisleVaultCrown - L.aisleVaultSpring,
        tx: { x: sx * 11.25, z: (z0 + z1) / 2 },
        seed: seed++,
      });
    }
  }

  // ------------------------------------------------------------ transept bays
  for (const [x0, x1] of [...L.transeptBays, ...L.transeptBaysWest]) {
    addBay(b, glow, {
      hw: DIM.centralNaveHalf,
      hb: (x1 - x0) / 2,
      ySpring: L.naveVaultSpring,
      rise: L.naveVaultCrown - L.naveVaultSpring,
      tx: { x: (x0 + x1) / 2, z: 0, ry: Math.PI / 2 },
      seed: seed++,
      oculusR: 1.5,
      socket: false,
    });
  }
  // transept side aisles
  for (const sz of [-1, 1]) {
    for (const [x0, x1] of [...L.transeptAisleBays, ...L.transeptBaysWest]) {
      addAisleBay(b, glow, {
        hw: (DIM.transeptHalfWidth - DIM.centralNaveHalf) / 2,
        hb: Math.abs(x1 - x0) / 2,
        ySpring: L.aisleVaultSpring,
        rise: L.aisleVaultCrown - L.aisleVaultSpring,
        tx: { x: (x0 + x1) / 2, z: sz * 11.25, ry: Math.PI / 2 },
        seed: seed++,
      });
    }
  }

  // ------------------------------------------------------------- the crossing
  galleryCeilings(b);
  crossing(b, glow, out);

  // Dark shafts of light from the nave oculi: subtle additive cones.
  for (const { z0, z1 } of naveBays) {
    const cz = (z0 + z1) / 2;
    glow.add(
      'shaftGold',
      shaftGeo([0, L.naveVaultCrown - 0.6, cz], [cz * 0.06, 0.6, cz], 1.1, 5.6, 12)
    );
  }
  let aisleShaft = 0;
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [...L.naveBays, ...L.naveBaysNorth]) {
      const cz = (z0 + z1) / 2;
      if (aisleShaft++ % 2 === 0) {
        glow.add(
          'shaftGold',
          shaftGeo([sx * 11.25, L.aisleVaultCrown - 0.5, cz], [sx * 9.0, 0.5, cz], 0.7, 3.2, 10)
        );
      }
    }
  }

  const meshes = b.flush(parent, mats, { castShadow: false, receiveShadow: true });
  const glowMeshes = glow.flush(parent, mats, { castShadow: false, receiveShadow: false });
  glowMeshes.forEach((m) => {
    m.renderOrder = 3;
  });
  return { meshes, glowMeshes };
}
