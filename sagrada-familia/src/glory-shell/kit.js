// Sagrada Família — shared kit for the Glory façade + outer-shell builder.
//
// Everything here works in a *local* frame:
//   +X / +Y are along the wall face, +Z is outward from the wall.
// Callers place a sub-assembly by transforming its local geometry with
// lib.xform({ x, y, z, ry }) so that +Z points out of the wall they are on.
//
// Geometry is accumulated into named material buckets; the orchestrator merges
// each bucket into a single mesh at the end (one draw call per material).

import {
  THREE,
  xform,
  stoneMat,
  marbleMat,
  roofMat,
  mosaicMat,
  goldMat,
  bronzeMat,
  ironMat,
  woodMat,
  scaleUV,
  boxGeo,
  boxCollider,
  circleCollider,
} from '../lib.js';
import { PALETTE } from '../config.js';

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export function createMaterials() {
  return {
    // Glory façade — warm honey limestone, the celebratory face.
    glory: stoneMat(PALETTE.stoneGlory, { repeat: 3, bumpScale: 0.34 }),
    // Outer shell walls (nave / transept) — a touch cooler/darker than Glory.
    shell: stoneMat(0xc6b69e, { repeat: 4, bumpScale: 0.3 }),
    // Aisle / chapel lower stone.
    aisle: stoneMat(PALETTE.stoneAisle, { repeat: 3, bumpScale: 0.34 }),
    // Light trim: cornices, tracery surrounds, niche frames.
    trim: stoneMat(0xdccdb2, { repeat: 2.4, bumpScale: 0.16 }),
    trim2: stoneMat(0xc3b096, { repeat: 2.4, bumpScale: 0.22 }),
    // Recess stone.
    dark: stoneMat(PALETTE.stoneDark, { repeat: 2, bumpScale: 0.42 }),
    shadow: stoneMat(PALETTE.stoneShadow, { repeat: 2, bumpScale: 0.5 }),
    marble: marbleMat(),
    roof: roofMat(),
    mosaic: mosaicMat([0xd9b25e, 0x2f5f9e, 0x9a2d33, 0x48a88e, 0xe6ddca, 0xcbb9a0, 0xcf6a2c]),
    gold: goldMat(),
    bronze: bronzeMat(),
    iron: ironMat(),
    wood: woodMat(),
  };
}

// ---------------------------------------------------------------------------
// Kit: geometry buckets + output channels
// ---------------------------------------------------------------------------

export function createKit() {
  const parts = new Map(); // material key -> BufferGeometry[]
  return {
    parts,
    glass: { cool: [], warm: [], rose: [], apse: [] },
    colliders: [],
    hotspots: [],
    textMeshes: [],
    add(key, geo) {
      if (!geo) return null;
      let list = parts.get(key);
      if (!list) {
        list = [];
        parts.set(key, list);
      }
      list.push(geo);
      return geo;
    },
    addGlass(region, geo, color) {
      if (!geo) return;
      (this.glass[region] || this.glass.cool).push({ geo, color });
    },
    box(x, z, hw, hd, y0, y1, ry = 0) {
      this.colliders.push(boxCollider(x, z, hw, hd, { y0, y1, ry }));
    },
    circle(x, z, r, y0 = 0, y1 = 60) {
      this.colliders.push(circleCollider(x, z, r, { y0, y1 }));
    },
  };
}

// ---------------------------------------------------------------------------
// Shape helpers (local XY plane, thickness along Z)
// ---------------------------------------------------------------------------

/**
 * Sample the same pointed-arch curve that lib.wallWithOpeningsGeo carves:
 * vertical jambs to `spring`, then two quadratic arcs to the apex.
 * Returns points from the left springing, over the apex, to the right springing.
 */
export function archCurvePoints(w, h, y0 = 0, { bow = 0.52, pinch = 0.92, steps = 18 } = {}) {
  const hw = w / 2;
  const springY = y0 + h * bow;
  const ctrlY = y0 + h * 0.93;
  const apexY = y0 + h;
  const half = (t, sign) => {
    const mt = 1 - t;
    const x = sign * (mt * mt * hw + 2 * mt * t * hw * pinch);
    const y = mt * mt * springY + 2 * mt * t * ctrlY + t * t * apexY;
    return [x, y];
  };
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(half(i / steps, -1));
  for (let i = steps - 1; i >= 0; i--) out.push(half(i / steps, 1));
  return out;
}

/** Closed polygon for an arched door/window hole, bottom at y0. */
export function archHolePoints(cx, w, h, y0 = 0, opts = {}) {
  const hw = w / 2;
  const curve = archCurvePoints(w, h, y0, opts);
  const springY = y0 + h * (opts.bow ?? 0.52);
  const pts = [
    [cx - hw, y0],
    [cx - hw, springY],
  ];
  for (let i = 1; i < curve.length; i++) pts.push([cx + curve[i][0], curve[i][1]]);
  pts.push([cx + hw, y0]);
  return pts;
}

/** Closed polygon for a circular hole (rose window, oculus). */
export function circleHolePoints(cx, cy, r, steps = 56) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/**
 * A rectangular wall panel (local XY) with polygon holes, thickness centred on
 * local z = 0. Gives exact control over openings of any shape (e.g. a rose
 * window hole) that wallWithOpeningsGeo cannot express.
 */
export function panelGeoWithHoles({ x0, x1, y0, y1, depth = 1, holes = [] }) {
  const shape = new THREE.Shape();
  shape.moveTo(x0, y0);
  shape.lineTo(x1, y0);
  shape.lineTo(x1, y1);
  shape.lineTo(x0, y1);
  shape.closePath();
  for (const hole of holes) {
    if (!hole || hole.length < 3) continue;
    const p = new THREE.Path();
    p.moveTo(hole[0][0], hole[0][1]);
    for (let i = 1; i < hole.length; i++) p.lineTo(hole[i][0], hole[i][1]);
    p.closePath();
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 10,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function dedupePoints(pts, eps = 1e-4) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps) out.pop();
  }
  return out;
}

/**
 * Solid tympanum field: the part of an arched opening above a horizontal
 * lintel. Matches archHolePoints exactly so it seals the wall opening.
 */
export function tympanumGeo(w, h, lintelY, depth = 0.45, opts = {}) {
  const hw = w / 2;
  const bow = opts.bow ?? 0.52;
  const springY = h * bow;
  const curve = archCurvePoints(w, h, 0, opts);
  const raw = [];
  if (lintelY < springY - 1e-4) raw.push([-hw, lintelY], [-hw, springY]);
  for (const p of curve) if (p[1] >= Math.max(lintelY, springY) - 1e-4) raw.push(p);
  if (lintelY < springY - 1e-4) raw.push([hw, lintelY]);
  const pts = dedupePoints(raw);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Flat annulus (washer) with given inner/outer radius, centred on z = 0. */
export function annulusGeo(r0, r1, depth = 0.4, seg = 48) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, Math.max(0.001, r0), 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Parabolic/ogival gable outline (base at y = 0, apex at y = height). */
export function parabolicGableGeo(width, height, depth = 1, samples = 10) {
  const hw = width / 2;
  const raw = [[-hw, 0]];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    raw.push([-hw * (1 - u), height * Math.sin((u * Math.PI) / 2)]);
  }
  for (let i = samples; i >= 0; i--) {
    const u = i / samples;
    raw.push([hw * (1 - u), height * Math.sin((u * Math.PI) / 2)]);
  }
  raw.push([hw, 0]);
  const pts = dedupePoints(raw);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Long horizontal/vertical band (cornice, string course, coping). Box UVs are
 * 0..1 per face, so a 30 m band would stretch the stone texture into streaks;
 * this rescales UVs to keep the grain roughly constant.
 */
export function bandGeo(w, h, d, x = 0, y = 0, z = 0, ry = 0) {
  const geo = boxGeo(w, h, d, x, y, z, ry);
  const span = Math.max(w, h, d);
  const s = Math.max(1, Math.round(span / 3.2));
  return scaleUV(geo, s, Math.max(1, Math.round(Math.min(h, d) / 1.2)));
}

/**
 * Place geometry built in a wall-local frame into the world.
 * Local frame: +X along the wall, +Y up, +Z outward; wall face at local origin.
 */
export function place(kit, key, geo, frame) {
  if (!geo) return null;
  return kit.add(key, xform(geo, { x: frame.x || 0, y: frame.y || 0, z: frame.z || 0, ry: frame.ry || 0 }));
}

/**
 * Frame helper: a point on a wall face + outward rotation.
 * `out` is the distance along the outward normal (used for windows' layering).
 */
export function wallFrame(kind, opts = {}) {
  switch (kind) {
    case 'facade': // Glory façade: outward +Z, face at z = 45 + out
      return { x: opts.x || 0, y: opts.y || 0, z: 45 + (opts.out || 0), ry: 0 };
    case 'east': // +X nave/transept wall: outward +X
      return { x: 15 + (opts.out || 0), y: opts.y || 0, z: opts.z || 0, ry: Math.PI / 2 };
    case 'west':
      return { x: -15 - (opts.out || 0), y: opts.y || 0, z: opts.z || 0, ry: -Math.PI / 2 };
    case 'transept-south': // z = +15 wall: outward +Z
      return { x: opts.x || 0, y: opts.y || 0, z: 15 + (opts.out || 0), ry: 0 };
    case 'transept-north':
      return { x: opts.x || 0, y: opts.y || 0, z: -15 - (opts.out || 0), ry: Math.PI };
    case 'radial': // apse radial wall at world angle a
      {
        const a = opts.angle || 0;
        const r = opts.r || 16.2;
        return {
          x: Math.cos(a) * r,
          y: opts.y || 0,
          z: -45 + Math.sin(a) * r,
          ry: Math.PI / 2 - a,
        };
      }
    default:
      return { x: 0, y: 0, z: 0, ry: 0 };
  }
}
