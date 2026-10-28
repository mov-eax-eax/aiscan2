// The apse: half-dome at 45 m with radial ribs, the great apse arch, seven
// radiating chapels with altars, retables, statues, votive candles and warm
// glass, plus the responds that carry the dome.

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
  mergeColored,
  colorize,
  shapeGeo,
  scaleUV,
  starGeo,
  lancetWindowParts,
  circleCollider,
  boxCollider,
  clamp,
  rng,
  rand,
} from '../lib.js';
import {
  bucket,
  gridSurface,
  DIM,
  PALETTE,
  L,
  flatStar,
  bossGeo,
  ringBand,
  oculusDisc,
  shaftGeo,
  downCone,
  statueGeo,
  vaultEdgeY,
  capitalGeo,
  octPlinth,
} from './common.js';

const APSE_R = 16.05; // apse drum radius used by the dome
const SPRING = 26; // dome springing height on the drum
const CROWN = 45; // dome apex

function domeY(r) {
  const t = clamp(r / APSE_R, 0, 1);
  return SPRING + (CROWN - SPRING) * Math.pow(1 - t * t, 0.7);
}

/** World placement helper for a point at radius R, tangential offset u. */
function apseAt(a, R, u = 0, y = 0, dr = 0) {
  return {
    x: (R + dr) * Math.cos(a) - u * Math.sin(a),
    y,
    z: DIM.apseCenterZ - (R + dr) * Math.sin(a) - u * Math.cos(a),
    ry: a - Math.PI / 2,
  };
}

/** Candle with flame helper: returns {body, flame}. */
function candle(h = 0.6, r = 0.05) {
  const body = xform(new THREE.CylinderGeometry(r, r * 0.9, h, 7), { y: h / 2 });
  const flame = xform(new THREE.ConeGeometry(r * 1.1, h * 0.34, 6), { y: h + h * 0.1 });
  return { body, flame };
}

export function buildApse(parent, mats, out) {
  const b = bucket();
  const glow = bucket();
  const rnd = rng(7777);

  // ------------------------------------------------------------- half-dome
  const dome = gridSurface(56, 12, (u, v) => {
    const a = u * Math.PI;
    const r = v * APSE_R;
    return [Math.cos(a) * r, domeY(r), DIM.apseCenterZ - Math.sin(a) * r];
  }, { flip: true, uv: [10, 3] });
  b.add('vault', dome);

  // radial ribs following the dome shell
  for (let k = 0; k <= DIM.apseChapelCount; k++) {
    const a = (k / DIM.apseChapelCount) * Math.PI;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const r = (i / 16) * APSE_R * 0.995;
      pts.push([Math.cos(a) * r, domeY(r) - 0.26, DIM.apseCenterZ - Math.sin(a) * r]);
    }
    b.add('rib', tubeGeo(pts, 0.26, { tubularSegments: 20, radialSegments: 5 }));
  }
  // intermediate ribs for a denser fan
  for (let k = 0; k <= DIM.apseChapelCount; k++) {
    const a = ((k + 0.5) / DIM.apseChapelCount) * Math.PI;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const r = (i / 12) * APSE_R * 0.93;
      pts.push([Math.cos(a) * r, domeY(r) - 0.2, DIM.apseCenterZ - Math.sin(a) * r]);
    }
    b.add('rib', tubeGeo(pts, 0.15, { tubularSegments: 16, radialSegments: 4 }));
  }
  // cornice ring at the springing
  {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI;
      pts.push([Math.cos(a) * (APSE_R - 0.05), SPRING, DIM.apseCenterZ - Math.sin(a) * (APSE_R - 0.05)]);
    }
    b.add('stoneLight', tubeGeo(pts, 0.3, { tubularSegments: 40, radialSegments: 5 }));
  }
  // crown oculus
  const crownPos = apseAt(Math.PI / 2, 0, 0, CROWN - 0.2);
  b.add('rib', xform(torusGeo(1.35, 0.16, 22, 6), { rx: Math.PI / 2, x: 0, y: CROWN - 0.32, z: DIM.apseCenterZ }));
  glow.add('vaultGlow', xform(oculusDisc(1.2), { y: CROWN - 0.26, z: DIM.apseCenterZ }));
  glow.add('poolWarm', xform(new THREE.CircleGeometry(2.8, 20), { rx: Math.PI / 2, y: CROWN - 0.8, z: DIM.apseCenterZ }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add('gold', downCone(0.08, 0.36, 4, Math.cos(a) * 1.6, CROWN - 0.4, DIM.apseCenterZ + Math.sin(a) * 1.6));
  }
  // shaft from the crown into the apse
  glow.add('shaftGold', shaftGeo([0, CROWN - 1.2, DIM.apseCenterZ], [0, 0.6, DIM.apseCenterZ - 2.0], 1.0, 5.6, 12));

  // ------------------------------------------------------- apse arch spandrel
  {
    const half = 15.4;
    const steps = 26;
    const bottom = [];
    const top = [];
    for (let i = 0; i <= steps; i++) {
      const x = -half + (2 * half * i) / steps;
      bottom.push([x, vaultEdgeY(x)]);
      const t = clamp(Math.abs(x) / APSE_R, 0, 1);
      top.push([x, SPRING + (CROWN - SPRING) * Math.pow(1 - t * t, 0.7)]);
    }
    const pts = bottom.concat(top.reverse());
    const spandrelGeo = shapeGeo(pts, 0.85);
    scaleUV(spandrelGeo, 1 / 6, 1 / 6);
    b.add('plaster', xform(spandrelGeo, { z: DIM.apseCenterZ }));
    // Mosaic sunbursts in the haunches (where the wall is deep), gold ribs and a
    // moulding following the vault edge — all on the nave-facing side.
    const FACE = DIM.apseCenterZ + 0.5;
    for (const sx of [-1, 1]) {
      b.add('mosaicGold', xform(starGeo(12, 1.6, 0.7, 0.1), { x: sx * 10.8, y: 33.4, z: FACE }));
    }
    for (const k of [-13.6, -11.6, -9.2, 9.2, 11.6, 13.6]) {
      const x = k;
      const y0 = vaultEdgeY(x) + 0.7;
      const t = clamp(Math.abs(x) / APSE_R, 0, 1);
      const y1 = SPRING + (CROWN - SPRING) * Math.pow(1 - t * t, 0.7) - 0.4;
      if (y1 > y0 + 0.4) b.add('rib', boxGeo(0.3, y1 - y0, 0.55, x, (y0 + y1) / 2, FACE));
    }
    b.add('stoneLight', xform(tubeGeo(
      Array.from({ length: 31 }, (_, i) => {
        const x = -15.4 + (30.8 * i) / 30;
        return [x, vaultEdgeY(x) - 0.1, FACE];
      }), 0.22, { tubularSegments: 30, radialSegments: 4 }),
      {}
    ));
  }

  // -------------------------------------------------------- apse windows (7)
  const chapelAngles = [];
  for (let k = 0; k < DIM.apseChapelCount; k++) {
    const a = ((k + 0.5) / DIM.apseChapelCount) * Math.PI;
    chapelAngles.push(a);
    const win = lancetWindowParts({ w: 2.7, h: 10.5, colors: PALETTE.glassWarm, seed: 91 + k, bands: 2 });
    const at = apseAt(a, APSE_R - 0.12, 0, 9.2);
    b.add('stoneLight', xform(win.stone, at));
    if (win.glass) glow.add('glassWarm', xform(win.glass, at));
    // sill and hood
    const sill = apseAt(a, APSE_R - 0.35, 0, 9.05);
    b.add('stoneLight', xform(boxGeo(3.5, 0.26, 0.55, 0, 0, 0), sill));
    // warm shaft from each window into the apse
    const from = apseAt(a, APSE_R - 1.2, 0, 14.5);
    const to = apseAt(a, 8.2, -0.6, 0.5);
    glow.add('shaftWarm', shaftGeo([from.x, from.y, from.z], [to.x, to.y, to.z], 0.8, 3.0, 10));
    // warm pool on the apse floor
    glow.add('poolWarm', xform(new THREE.CircleGeometry(2.6, 18), { rx: -Math.PI / 2, x: to.x, y: 0.035, z: to.z }));
  }

  // ------------------------------------------------------------ seven chapels
  for (let k = 0; k < DIM.apseChapelCount; k++) {
    const a = chapelAngles[k];
    const seed = 31 + k * 7;

    // altar steps + marble table
    b.add('marbleDark', xform(boxGeo(4.0, 0.13, 1.9, 0, 0.065, 0), apseAt(a, 14.5)));
    b.add('marble', xform(boxGeo(3.4, 0.13, 1.6, 0, 0.19, 0), apseAt(a, 14.5)));
    const tablePos = apseAt(a, 14.55, 0, 0.68);
    b.add('marble', xform(boxGeo(2.7, 0.94, 1.05, 0, 0, 0), tablePos));
    b.add('gold', xform(boxGeo(2.85, 0.08, 1.16, 0, 0.51, 0), tablePos));
    b.add('gold', xform(boxGeo(2.85, 0.08, 1.16, 0, -0.44, 0), tablePos));
    b.add('cloth', xform(boxGeo(2.2, 0.035, 0.62, 0, 0.49, 0), tablePos));
    // reliquary / small tabernacle
    b.add('gold', xform(boxGeo(0.42, 0.5, 0.36, 0, 0.72, 0), tablePos));
    b.add('goldBright', xform(boxGeo(0.3, 0.34, 0.06, 0, 0.7, 0.2), tablePos));

    // retable panel (mosaic + gold frame) on the drum
    const retPos = apseAt(a, APSE_R - 0.22, 0, 4.5);
    b.add('mosaic', xform(boxGeo(3.3, 3.5, 0.12, 0, 0, 0), retPos));
    const frame = [];
    frame.push(boxGeo(3.55, 0.16, 0.2, 0, 1.8, 0));
    frame.push(boxGeo(3.55, 0.16, 0.2, 0, -1.8, 0));
    frame.push(boxGeo(0.16, 3.75, 0.2, 1.7, 0, 0));
    frame.push(boxGeo(0.16, 3.75, 0.2, -1.7, 0, 0));
    b.add('gold', xform(mergeGeos(frame), retPos));
    // crown + rays above the retable
    b.add('gold', xform(starGeo(12, 0.7, 0.3, 0.1), apseAt(a, APSE_R - 0.16, 0, 7.1)));
    b.add('mosaicGold', xform(starGeo(8, 0.5, 0.2, 0.08), apseAt(a, APSE_R - 0.16, 0, 2.4)));

    // statue on a pedestal inside the chapel
    const pedPos = apseAt(a, 15.25, 0, 0.45);
    b.add('marble', xform(boxGeo(0.95, 0.9, 0.8, 0, 0, 0), pedPos));
    b.add('stoneLight', xform(boxGeo(1.15, 0.12, 1.0, 0, 0.5, 0), pedPos));
    const st = statueGeo({ height: 1.75, pose: k % 2 ? 'pray' : 'hold', seed, halo: k % 3 === 0 });
    b.add('marble', xform(st, apseAt(a, 15.25, 0, 0.96)));

    // candlesticks flanking the altar
    for (const u of [-1.55, 1.55]) {
      const p = apseAt(a, 14.6, u, 0.19);
      b.add('bronze', xform(latheGeo([[0.16, 0], [0.2, 0.06], [0.09, 0.12], [0.07, 0.5], [0.15, 0.6], [0.12, 0.64]], 10), p));
      const pc = apseAt(a, 14.6, u, 0.19 + 0.62);
      const c = candle(0.5, 0.055);
      b.add('candle', xform(c.body, pc));
      glow.add('flame', xform(c.flame, pc));
    }
    // votive candle stand at the chapel edge
    const vp = apseAt(a, 13.85, 1.95, 0);
    b.add('iron', xform(boxGeo(0.8, 0.06, 0.6, 0, 0.62, 0), vp));
    b.add('iron', xform(boxGeo(0.06, 0.62, 0.06, -0.34, 0.31, -0.24), vp));
    b.add('iron', xform(boxGeo(0.06, 0.62, 0.06, 0.34, 0.31, -0.24), vp));
    b.add('iron', xform(boxGeo(0.06, 0.62, 0.06, -0.34, 0.31, 0.24), vp));
    b.add('iron', xform(boxGeo(0.06, 0.62, 0.06, 0.34, 0.31, 0.24), vp));
    for (let i = 0; i < 8; i++) {
      const u = -0.3 + (i % 4) * 0.2;
      const cp = apseAt(a, 13.85, 1.95 + u, 0.65);
      const c = candle(0.22, 0.038);
      b.add('candle', xform(c.body, cp));
      glow.add('flame', xform(c.flame, cp));
    }

    // chapel niche behind the drum: side walls, back wall, warm window, vault.

    for (const u of [-2.7, 2.7]) {
      const sp = apseAt(a, 18.5, u, 5.6);
      b.add('plaster', xform(boxGeo(0.42, 11.2, 4.8, 0, 0, 0), sp));
    }
    const back = apseAt(a, 21.0, 0, 5.6);
    b.add('stoneWarm', xform(boxGeo(5.8, 11.2, 0.45, 0, 0, 0), back));
    const nicheWin = lancetWindowParts({ w: 2.2, h: 6.2, colors: PALETTE.glassWarm, seed: 11 + k, bands: 2 });
    const nw = apseAt(a, 20.72, 0, 5.2);
    b.add('stoneWarm', xform(nicheWin.stone, nw));
    if (nicheWin.glass) glow.add('glassWarm', xform(nicheWin.glass, nw));
    // niche vault: a shallow barrel over the niche volume
    b.add('vault', xform(gridSurface(10, 4, (u, v) => {
      const uu = -1 + 2 * u;
      const zz = -1 + 2 * v;
      const yy = 11.2 + 2.1 * (1 - uu * uu);
      return [uu * 2.9, yy, zz * 2.35];
    }, { flip: true }), apseAt(a, 18.6, 0, 0)));

    out.colliders.push(circleCollider(apseAt(a, 14.55).x, apseAt(a, 14.55).z, 1.5, { y0: 0, y1: 2 }));
    out.colliders.push(circleCollider(vp.x, vp.z, 0.55, { y0: 0, y1: 1.2 }));
  }

  // --------------------------------------------------------------- sanctuary
  // A low marble altar rail rings the apse mouth (open at the centre).
  for (const sx of [-1, 1]) {
    const g = [];
    g.push(boxGeo(5.4, 0.18, 0.45, 0, 0.09, 0));
    for (let i = 0; i < 6; i++) g.push(boxGeo(0.16, 0.72, 0.16, -2.3 + i * 0.92, 0.54, 0));
    g.push(boxGeo(5.4, 0.14, 0.3, 0, 0.94, 0));
    b.add('marble', xform(mergeGeos(g), { x: sx * 8.6, z: DIM.apseCenterZ + 0.6 }));
    out.colliders.push(boxCollider(sx * 8.6, DIM.apseCenterZ + 0.6, 2.75, 0.3, { y0: 0, y1: 1 }));
  }

  const meshes = b.flush(parent, mats, { castShadow: true, receiveShadow: true });
  const glowMeshes = glow.flush(parent, mats, { castShadow: false, receiveShadow: false });
  glowMeshes.forEach((m) => {
    m.renderOrder = 3;
  });
  return { chapelAngles };
}
