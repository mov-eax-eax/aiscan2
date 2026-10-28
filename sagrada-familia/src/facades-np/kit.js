// Shared procedural construction kit for the Nativity (east) and Passion (west)
// façades of the Sagrada Família model.
//
// Local façade coordinates, used by every helper here and by the two builders:
//   u = along the wall  (u = 0 at the central portal)
//   y = up              (y = 0 at the crossing floor)
//   w = outward from the wall centre plane (wall occupies w = -0.8 .. +0.8)
//
// A façade group is placed at world x = side * 30.8 and rotated about Y, so local
// (u, y, w) maps to world (side * (30.8 + w), y, -side * u) with side = +1 for the
// Nativity (+X) and -1 for the Passion (-X). `worldOf()` below implements this.
//
// Every helper appends BufferGeometry to plain "buckets" (one array per material).
// finishFacade() merges each bucket into a single mesh — the whole façade ends up
// as roughly a dozen draw calls. Geometry is procedural, seeded and deterministic.

import {
  THREE,
  rng,
  rand,
  pick,
  chance,
  xform,
  boxGeo,
  cylGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  limbGeo,
  tubeGeo,
  shapeGeo,
  archRingGeo,
  archPanelGeo,
  mergeGeos,
  addMerged,
  colorize,
  stoneMat,
  mosaicMat,
  goldMat,
  glassMaterial,
  textTexture,
  figureGeo,
  animalGeo,
  birdGeo,
  pinnacleGeo,
  starGeo,
  crossGeo,
  scaleUV,
  roseWindowParts,
  oculusParts,
} from '../lib.js';
import { PALETTE } from '../config.js';

// ---------------------------------------------------------------------------
// Placement conventions
// ---------------------------------------------------------------------------

export const X0 = 30.8; // world x of the wall centre plane
export const WALL_HALF = 0.8; // half the 1.6 m façade wall thickness
export const WALL_TOP = 45; // top of the main façade wall

/** World position of a local façade point. */
export function worldOf(side, u, y, w) {
  return [side * (X0 + w), y, -side * u];
}

// ---------------------------------------------------------------------------
// Buckets + materials
// ---------------------------------------------------------------------------

const BUCKET_NAMES = [
  'stone',
  'stoneLight',
  'stoneDark',
  'stoneWarm',
  'reveal',
  'mosaic',
  'mosaic2',
  'white',
  'gold',
  'foliage',
  'flat',
  'flatLight',
  'flatDark',
  'glass',
];

export function makeBuckets() {
  const b = { texts: [] };
  for (const k of BUCKET_NAMES) b[k] = [];
  return b;
}

export function nativityMaterials() {
  return {
    stone: stoneMat(0xd9bd8f, { roughness: 0.91, repeat: 2.2, bumpScale: 0.65 }),
    stoneLight: stoneMat(0xf4e1b6, { roughness: 0.88, repeat: 2.0, bumpScale: 0.45 }),
    stoneDark: stoneMat(0x8b6c44, { roughness: 0.95, repeat: 2.2, bumpScale: 0.7 }),
    stoneWarm: stoneMat(0xc19452, { roughness: 0.9, repeat: 1.9, bumpScale: 0.55 }),
    reveal: stoneMat(0x3d3121, { roughness: 0.99, repeat: 2, bumpScale: 0.2 }),
    mosaic: mosaicMat([0x2f5f9e, 0xd9b25e, 0x9a2d33, 0x48a88e, 0x2b7f9e, 0xe0a94a]),
    mosaic2: mosaicMat([0x48a88e, 0x8f1e2c, 0x63b7b1, 0xe0a94a, 0x6b2d62, 0x2f5f9e]),
    white: stoneMat(0xf7f0de, { roughness: 0.78, repeat: 1.3, bumpScale: 0.1 }),
    gold: goldMat(),
    foliage: stoneMat(0x8f9c6f, { roughness: 0.95, repeat: 1.8, bumpScale: 0.3, flat: true }),
    flat: stoneMat(0xcbb488, { roughness: 0.9, flat: true, repeat: 2 }),
    flatLight: stoneMat(0xe0cba8, { roughness: 0.88, flat: true, repeat: 2 }),
    flatDark: stoneMat(0xa88d68, { roughness: 0.92, flat: true, repeat: 2 }),
  };
}

export function passionMaterials() {
  return {
    stone: stoneMat(0xa9b1bb, { roughness: 0.87, repeat: 2.2, bumpScale: 0.55 }),
    stoneLight: stoneMat(0xc4cad2, { roughness: 0.85, repeat: 2.0, bumpScale: 0.42 }),
    stoneDark: stoneMat(0x626a74, { roughness: 0.93, repeat: 2.2, bumpScale: 0.6 }),
    stoneWarm: stoneMat(0x8b939d, { roughness: 0.9, repeat: 1.9, bumpScale: 0.5 }),
    reveal: stoneMat(0x252a30, { roughness: 0.99, repeat: 2, bumpScale: 0.2 }),
    mosaic: mosaicMat([0x8d97a2, 0x66707b, 0xbcc2ca, 0x4f5963, 0xaeb4bc]),
    mosaic2: mosaicMat([0x4f5963, 0xbcc2ca, 0x7d8792, 0x5c646d, 0x8d97a2]),
    white: stoneMat(0xd8dde2, { roughness: 0.8, repeat: 1.3, bumpScale: 0.1 }),
    gold: goldMat(),
    foliage: stoneMat(0x9aa2a8, { roughness: 0.92, repeat: 2.0, bumpScale: 0.3 }),
    flat: stoneMat(0x9ba3ad, { roughness: 0.89, flat: true, repeat: 2 }),
    flatLight: stoneMat(0xb9bfc8, { roughness: 0.86, flat: true, repeat: 2 }),
    flatDark: stoneMat(0x565d66, { roughness: 0.95, flat: true, repeat: 2 }),
  };
}

/** Merge every bucket into one mesh per material and attach to `group`. */
export function finishFacade(group, B, M) {
  for (const key of Object.keys(B)) {
    if (key === 'glass' || key === 'texts') continue;
    const arr = B[key];
    if (!arr || arr.length === 0) continue;
    const mat = M[key];
    if (!mat) {
      console.warn('[facades-np] no material for bucket', key);
      continue;
    }
    addMerged(group, arr, mat, { name: `${group.name || 'facade'}:${key}` });
    arr.length = 0;
  }
  if (B.glass.length) {
    const list = B.glass.map((e) => (e.colored ? e.geo : colorize(e.geo, e.color)));
    const g = mergeGeos(list);
    if (g) {
      const mesh = new THREE.Mesh(g, glassMaterial);
      mesh.name = `${group.name || 'facade'}:glass`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
    }
    B.glass.length = 0;
  }
  for (const t of B.texts) addInscription(group, t);
  B.texts.length = 0;
}

// ---------------------------------------------------------------------------
// Inscriptions
// ---------------------------------------------------------------------------

/**
 * Carved inscription as a lit, alpha-cut plane sitting just in front of the wall.
 * t: { text, u, y, w, size (width in m), color, font, letterSpacing, id }
 */
export function addInscription(group, t) {
  const tex = textTexture(t.text, {
    font: t.font || '600 52px Georgia, "Times New Roman", serif',
    color: t.color || '#4a3a26',
    pad: 8,
    letterSpacing: t.letterSpacing ?? 3,
  });
  const iw = tex.image.width || 1;
  const ih = tex.image.height || 128;
  let width = t.size ?? 8;
  let height = (width * ih) / iw;
  const maxH = t.maxH ?? 1.5;
  if (height > maxH) {
    height = maxH;
    width = (height * iw) / ih;
  }
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.25,
    roughness: 0.94,
    metalness: 0.0,
    color: 0xffffff,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(t.u ?? 0, t.y ?? 0, t.w ?? WALL_HALF + 0.03);
  mesh.name = `inscription:${t.id || t.text.slice(0, 12)}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  group.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Arches: generalized ring + sampling along an arch curve
// ---------------------------------------------------------------------------

/**
 * Arch band (ring) whose inner opening has the same pointed-arch profile used by
 * wallWithOpeningsGeo (including its `pinch`), so rings can be stacked outward in
 * perfect concentric steps. Geometry lies in local XY, extruded along Z.
 */
export function archRingG({
  w,
  h,
  band = 0.8,
  depth = 0.5,
  spring = 0.52,
  pinch = 0.92,
  baseExtend = 1.0,
  curveSegments = 10,
} = {}) {
  const hw = (w + band * 2) / 2;
  const hwIn = w / 2;
  const springY = h * spring;
  const outer = new THREE.Shape();
  outer.moveTo(-hw, -baseExtend);
  outer.lineTo(hw, -baseExtend);
  outer.lineTo(hw, springY);
  outer.quadraticCurveTo(hw * pinch, h * 0.93, 0, h + band);
  outer.quadraticCurveTo(-hw * pinch, h * 0.93, -hw, springY);
  outer.lineTo(-hw, -baseExtend);
  const hole = new THREE.Path();
  hole.moveTo(-hwIn, 0);
  hole.lineTo(-hwIn, springY);
  hole.quadraticCurveTo(-hwIn * pinch, h * 0.93, 0, h);
  hole.quadraticCurveTo(hwIn * pinch, h * 0.93, hwIn, springY);
  hole.lineTo(hwIn, 0);
  hole.closePath();
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Dark lining for a door reveal. Its outer contour matches the wall opening
 * (w x h, same spring/pinch) while its hole is inset by `band`, so the opening
 * reads as a shadowed tunnel without changing the walkable gap.
 */
export function revealLiningGeo(doorW, doorH, { spring = 0.52, pinch = 0.92, band = 0.13, depth = 1.58 } = {}) {
  return archRingG({
    w: doorW - band * 2,
    h: doorH - band * 0.9,
    band,
    depth,
    spring,
    pinch,
    baseExtend: 1.0,
  });
}

/**
 * Points along the upper curve of a pointed arch (from left springing, over the
 * apex, to right springing). Used to scatter archivolt figures / crockets.
 */
export function archSamples({ w, h, spring = 0.52, pinch = 0.92, count = 8, tMin = 0.1, tMax = 0.9 }) {
  const hw = w / 2;
  const springY = h * spring;
  const q = (p0, p1, p2, t) => {
    const mt = 1 - t;
    return {
      x: mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
      y: mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
    };
  };
  const apex = [0, h];
  const ctrlL = [-hw * pinch, h * 0.93];
  const springL = [-hw, springY];
  const ctrlR = [hw * pinch, h * 0.93];
  const springR = [hw, springY];
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : tMin + ((tMax - tMin) * i) / (count - 1);
    if (t <= 0.5) {
      const k = (0.5 - t) / 0.5;
      out.push(q(apex, ctrlL, springL, k));
    } else {
      const k = (t - 0.5) / 0.5;
      out.push(q(apex, ctrlR, springR, k));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Simple primitives / repeated motifs
// ---------------------------------------------------------------------------

/** Flat disc in the XY plane (axis along Z). */
export function discGeo(r, t = 0.12, seg = 40) {
  const g = new THREE.CylinderGeometry(r, r, t, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Circular ring frame in the XY plane. */
export function circleRingGeo(rOuter, rInner, depth = 0.5, seg = 56) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, rInner, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Small stone corbel bracket projecting from the wall at w. */
export function addCorbel(B, key, { u, y, w, size = 0.42 }) {
  B[key].push(boxGeo(size * 1.7, size * 0.5, size, u, y - size * 0.25, w + size * 0.5));
  B[key].push(coneGeo(size * 0.34, size * 1.25, 4, u, y - size * 0.85, w + size * 0.42, Math.PI / 4));
}

/** A row of small corbels beneath a projecting course. */
export function addCorbelRow(B, key, { u0, u1, y, w, step = 2.2, size = 0.4 }) {
  const n = Math.max(2, Math.round(Math.abs(u1 - u0) / step));
  for (let i = 0; i < n; i++) {
    const u = u0 + ((u1 - u0) * i) / (n - 1);
    addCorbel(B, key, { u, y, w, size });
  }
}

/** Soft cloud cluster made of squashed icosahedra. */
export function addCloud(B, key, { u, y, w, scale = 1, seed = 1, count = 5 }) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const s = scale * rand(r, 0.4, 0.85);
    const g = new THREE.SphereGeometry(s, 8, 6);
    xform(g, {
      sy: rand(r, 0.45, 0.62),
      sz: rand(r, 0.62, 0.85),
      x: u + rand(r, -scale * 1.1, scale * 1.1),
      y: y + rand(r, -scale * 0.3, scale * 0.3),
      z: w + rand(r, -0.1, 0.16),
    });
    B[key].push(g);
  }
}

/** Dense leaf mass (icosahedron clumps) for vines and the Tree of Life. */
export function addFoliage(B, key, { u, y, w, scale = 0.8, seed = 1, count = 6 }) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const s = scale * rand(r, 0.45, 1.0);
    const g = new THREE.IcosahedronGeometry(s, 0);
    xform(g, {
      sy: rand(r, 0.7, 1.15),
      sz: rand(r, 0.7, 1.1),
      x: u + rand(r, -scale, scale),
      y: y + rand(r, -scale * 0.7, scale * 0.7),
      z: w + rand(r, -0.16, 0.22),
    });
    B[key].push(g);
  }
}

/** Grape / berry cluster. */
export function addGrapes(B, key, { u, y, w, scale = 1, seed = 1 }) {
  const r = rng(seed);
  for (let i = 0; i < 7; i++) {
    B[key].push(sphereGeo(0.055 * scale, 6, u + rand(r, -0.18, 0.18) * scale, y + rand(r, -0.22, 0.16) * scale, w));
  }
}

/** Sharp angular blade / buttress fin, like Subirachs' stripped planes. */
export function addBlade(B, key, { u, y, w, width = 1.0, height = 6, depth = 0.9, tilt = 0 }) {
  const pts = [
    [-width / 2, 0],
    [width / 2, 0],
    [width * 0.2, height * 0.94],
    [-width * 0.24, height],
  ];
  const g = shapeGeo(pts, depth);
  xform(g, { rz: tilt, x: u, y, z: w + depth / 2 });
  B[key].push(g);
}

/** Dark rectangular "hollow" recess with an angular frame. */
export function addHollowRecess(B, { u, y, w, width = 2.0, height = 4.5, frame = 0.28, depth = 0.7 }) {
  B.reveal.push(boxGeo(width - frame, height - frame, 0.16, u, y + height / 2, w + 0.08));
  B.flat.push(boxGeo(width, frame, depth, u, y + height - frame / 2, w + depth / 2));
  B.flat.push(boxGeo(width, frame, depth, u, y + frame / 2, w + depth / 2));
  B.flat.push(boxGeo(frame, height, depth, u - width / 2 + frame / 2, y + height / 2, w + depth / 2));
  B.flat.push(boxGeo(frame, height, depth, u + width / 2 - frame / 2, y + height / 2, w + depth / 2));
  B.flatDark.push(boxGeo(width + 0.2, 0.16, depth + 0.2, u, y + height + 0.08, w + depth / 2));
}

/** Multiply a geometry's vertex colours (lets glass read brighter than the
 * shared glassMaterial's day tint). */
export function brightenColors(geo, k = 1.3) {
  const c = geo && geo.attributes && geo.attributes.color;
  if (!c) return geo;
  for (let i = 0; i < c.count * 3; i++) c.array[i] *= k;
  c.needsUpdate = true;
  return geo;
}

/** Carved star (four- or eight-pointed) applied to the wall. */
export function addStar(B, key, { u, y, w, r = 0.36, points = 4 }) {
  const g = starGeo(points, r, r * 0.34, 0.09);
  g.translate(u, y, w);
  B[key].push(g);
}

/** Climbing vine: tangled tube plus leaves. */
export function addVine(
  B,
  key,
  { u, y0, y1, w, sway = 0.55, seed = 1, leaves = 16, leafKey = null, radius = 0.055, leafScale = 1 }
) {
  const r = rng(seed);
  const pts = [];
  const n = 10;
  const phase = rand(r, 0, Math.PI * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([
      u + Math.sin(t * 5.4 + phase) * sway * (0.25 + t * 0.75) + rand(r, -0.06, 0.06),
      y0 + (y1 - y0) * t,
      w + rand(r, -0.05, 0.05),
    ]);
  }
  B[key].push(tubeGeo(pts, radius, { tubularSegments: 40, radialSegments: 4 }));
  const lk = leafKey || key;
  for (let i = 1; i < leaves; i++) {
    const leaf = shapeGeo(
      [
        [0, 0],
        [0.15 * leafScale, 0.09 * leafScale],
        [0, 0.24 * leafScale],
        [-0.15 * leafScale, 0.09 * leafScale],
      ],
      0.03
    );
    const t = i / leaves;
    const idx = Math.min(pts.length - 1, Math.round(t * pts.length));
    const p = pts[idx];
    xform(leaf, {
      ry: rand(r, -0.8, 0.8),
      rz: rand(r, -1.2, 1.2),
      x: p[0] + rand(r, -0.12, 0.12),
      y: p[1] + rand(r, -0.06, 0.1),
      z: p[2] + rand(r, 0.02, 0.12),
    });
    B[lk].push(leaf);
  }
}

/**
 * Stylised stone cypress for the Tree of Life: a narrow flame of layered
 * foliage on a visible trunk. Base at y = 0.
 */
export function cypressTreeGeo({ height = 12.6, radius = 1.85, seed = 1 } = {}) {
  const r = rng(seed);
  const parts = [];
  const trunkH = height * 0.36;
  parts.push(cylGeo(radius * 0.11, radius * 0.19, trunkH, 8, 0, trunkH / 2, 0));
  parts.push(cylGeo(radius * 0.26, radius * 0.34, height * 0.05, 8, 0, height * 0.025, 0));
  const layers = 11;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1); // 0 bottom -> 1 top
    const y = height * (0.1 + t * 0.84);
    const rad = radius * (1 - t) * (0.9 - 0.2 * Math.sin(t * Math.PI)) + radius * 0.05;
    const h = height * 0.2;
    const cone = new THREE.ConeGeometry(rad, h, 9, 1, true);
    xform(cone, {
      x: rand(r, -radius * 0.045, radius * 0.045),
      y,
      z: rand(r, -radius * 0.045, radius * 0.045),
      ry: rand(r, 0, Math.PI * 2),
      sz: rand(r, 0.9, 1.05),
      sx: rand(r, 0.9, 1.05),
    });
    parts.push(cone);
  }
  for (let i = 0; i < 18; i++) {
    const t = rand(r, 0.04, 0.94);
    const a = rand(r, 0, Math.PI * 2);
    const rad = radius * (1 - t) * 0.85;
    const g = new THREE.IcosahedronGeometry(radius * rand(r, 0.06, 0.11), 0);
    xform(g, {
      x: Math.cos(a) * rad,
      y: height * (0.12 + t * 0.82) + rand(r, -0.2, 0.2),
      z: Math.sin(a) * rad,
      sy: 1.7,
    });
    parts.push(g);
  }
  parts.push(xform(new THREE.ConeGeometry(radius * 0.09, height * 0.15, 6), { y: height * 0.97 }));
  return mergeGeos(parts);
}

/** Pointed niche (blind recess) with an optional saint. */
export function addNiche(
  B,
  key,
  { u, y, w, width = 1.5, height = 2.7, spring = 0.56, pinch = 0.9, figure = true, seed = 1, hood = false }
) {
  // dark backing
  const back = archPanelGeo(width, height, 0.1, { x: u, y, z: w + 0.05, spring });
  B.reveal.push(back);
  // surrounding frame
  const frame = archRingG({ w: width, h: height, band: 0.22, depth: 0.34, spring, pinch, baseExtend: 0.18 });
  frame.translate(u, y, w + 0.19);
  B[key].push(frame);
  // sill
  B.stoneDark.push(boxGeo(width + 0.5, 0.16, 0.5, u, y + 0.06, w + 0.28));
  if (figure) {
    const fh = height * 0.62;
    const g = figureGeo({
      height: fh,
      pose: pick(rng(seed), ['stand', 'pray', 'hold', 'cross']),
      kind: 'human',
      hood,
      halo: chance(rng(seed + 3), 0.6),
      seed,
    });
    xform(g, { x: u, y: y + 0.14, z: w + 0.2 });
    B[key].push(g);
  }
}

/** Figure standing on a small pedestal, facing outward. */
export function addFigureOnPedestal(
  B,
  {
    u,
    y = 0,
    w,
    height = 2,
    pose = 'stand',
    kind = 'human',
    wings = false,
    halo = false,
    hood = false,
    seed = 1,
    pedestal = 0.72,
    ry = 0,
    key = 'stoneLight',
  }
) {
  B.stoneDark.push(boxGeo(0.86, pedestal, 0.86, u, y + pedestal / 2, w - 0.06));
  B.stoneLight.push(boxGeo(0.96, 0.12, 0.96, u, y + pedestal - 0.05, w - 0.06));
  const g = figureGeo({ height, pose, kind, wings, halo, hood, seed });
  xform(g, { ry, x: u, y: y + pedestal + 0.02, z: w });
  B[key].push(g);
  return pedestal + height;
}

/** Twisted (solomonic) column with base, capital and helical flutes. */
export function addTwistedColumn(B, { u, y = 0, w, height = 9, radius = 0.3, seed = 1, key = 'stoneLight' }) {
  const r = rng(seed);
  B[key].push(cylGeo(radius * 0.84, radius, height, 8, u, y + height / 2, w));
  B.stoneDark.push(boxGeo(radius * 2.7, 0.34, radius * 2.7, u, y + 0.17, w));
  B.stoneLight.push(boxGeo(radius * 2.5, 0.26, radius * 2.5, u, y + height - 0.12, w));
  B.stoneLight.push(boxGeo(radius * 3.0, 0.17, radius * 3.0, u, y + height + 0.12, w));
  for (let s = 0; s < 2; s++) {
    const pts = [];
    const turns = 2.1;
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const a = t * turns * Math.PI * 2 + s * Math.PI + rand(r, -0.05, 0.05);
      const rad = radius * 1.02;
      pts.push([u + Math.cos(a) * rad, y + 0.42 + t * (height - 0.9), w + Math.sin(a) * rad]);
    }
    B[key].push(tubeGeo(pts, radius * 0.17, { tubularSegments: 46, radialSegments: 4 }));
  }
}

/** Ring of small figures standing on an archivolt band. */
export function addRingFigures(
  B,
  key,
  { u, y = 0, wFront, ringW, ringH, band, spring = 0.52, pinch = 0.92, count = 5, hMin = 0.85, hMax = 1.15, seed = 1 }
) {
  const r = rng(seed);
  const pts = archSamples({
    w: ringW + band * 1.05,
    h: ringH + band * 0.55,
    spring,
    pinch,
    count,
    tMin: 0.08,
    tMax: 0.92,
  });
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const height = rand(r, hMin, hMax);
    const pose = pick(r, ['stand', 'pray', 'hold', 'armsUp', 'cross', 'stand']);
    const angel = chance(r, 0.3);
    const g = figureGeo({
      height,
      pose,
      kind: angel ? 'angel' : 'human',
      wings: angel,
      halo: chance(r, 0.3),
      seed: seed + i * 31,
    });
    xform(g, { ry: rand(r, -0.3, 0.3), x: u + p.x, y: y + p.y, z: wFront - 0.04 });
    B[key].push(g);
    // little corbel beneath
    B.stoneWarm.push(boxGeo(0.16, 0.12, 0.16, u + p.x, y + p.y - 0.06, wFront));
  }
}

// ---------------------------------------------------------------------------
// Nativity-specific ornament
// ---------------------------------------------------------------------------

/** White pelican piercing its breast with its beak. */
export function pelicanGeo({ size = 1.2 } = {}) {
  const s = size;
  const parts = [];
  const body = new THREE.SphereGeometry(0.3 * s, 9, 7);
  xform(body, { sy: 0.86, sz: 1.28, y: 0.55 * s });
  parts.push(body);
  parts.push(limbGeo([0.02 * s, 0.62 * s, 0.2 * s], [0.02 * s, 0.98 * s, 0.26 * s], 0.075 * s, 0.06 * s, 6));
  parts.push(limbGeo([0.02 * s, 0.98 * s, 0.26 * s], [0.02 * s, 0.8 * s, 0.46 * s], 0.06 * s, 0.05 * s, 6));
  parts.push(sphereGeo(0.085 * s, 7, 0.02 * s, 0.79 * s, 0.47 * s));
  parts.push(limbGeo([0.02 * s, 0.77 * s, 0.5 * s], [0.02 * s, 0.5 * s, 0.44 * s], 0.045 * s, 0.02 * s, 4));
  for (const dir of [-1, 1]) {
    const wing = new THREE.SphereGeometry(0.22 * s, 7, 5);
    xform(wing, { sx: 0.6, sy: 0.8, sz: 1.2, x: dir * 0.2 * s, y: 0.56 * s, z: -0.02 * s });
    parts.push(wing);
  }
  parts.push(coneGeo(0.1 * s, 0.3 * s, 5, 0, 0.48 * s, -0.42 * s, 0));
  for (const dir of [-1, 1]) {
    parts.push(limbGeo([dir * 0.11 * s, 0.32 * s, 0.02 * s], [dir * 0.13 * s, 0.02 * s, 0.07 * s], 0.03 * s, 0.02 * s, 4));
  }
  return mergeGeos(parts);
}

/** White dove (small bird) used around the Tree of Life. */
export function addDove(B, key, { u, y, w, size = 0.5, seed = 1, ry = 0, rz = 0, rx = 0 }) {
  const g = birdGeo({ size, wings: true, seed });
  xform(g, { rx, ry, rz, x: u, y, z: w });
  B[key].push(g);
}

/** Small snail on a ledge. */
export function addSnail(B, { u, y, w, s = 1, seed = 1 }) {
  const r = rng(seed);
  B.stoneLight.push(sphereGeo(0.14 * s, 8, u, y + 0.11 * s, w));
  const shell = torusGeo(0.1 * s, 0.04 * s, 14, 5);
  shell.rotateX(Math.PI / 2);
  shell.translate(u, y + 0.2 * s, w);
  B.stoneLight.push(shell);
  B.stoneLight.push(limbGeo([u, y + 0.03 * s, w], [u + 0.24 * s, y + 0.05 * s, w + 0.04 * s], 0.05 * s, 0.03 * s, 4));
  B.stoneLight.push(sphereGeo(0.05 * s, 6, u + 0.26 * s, y + 0.06 * s, w + 0.04 * s));
  if (chance(r, 0.7)) B.stoneLight.push(sphereGeo(0.04 * s, 6, u - 0.02 * s, y + 0.26 * s, w + 0.02 * s));
}

/** Angular little lizard / chameleon crawling along a cornice. */
export function addLizard(B, { u, y, w, s = 1, seed = 1 }) {
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.065 * s, 0.36 * s, 3, 6);
  body.rotateZ(Math.PI / 2);
  parts.push(body);
  parts.push(sphereGeo(0.08 * s, 6, 0.24 * s, 0.02 * s, 0));
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push([-0.2 * s - t * 0.34 * s, 0.02 * s + Math.sin(t * 5) * 0.07 * s, 0]);
  }
  parts.push(tubeGeo(pts, 0.032 * s, { tubularSegments: 12, radialSegments: 4 }));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(limbGeo([sx * 0.15 * s, 0.02 * s, sz * 0.02 * s], [sx * 0.25 * s, 0.0, sz * 0.15 * s], 0.015 * s, 0.01 * s, 4));
    }
  }
  const g = mergeGeos(parts);
  xform(g, { ry: 0.55 + rand(rng(seed), -0.3, 0.3), x: u, y, z: w });
  B.stoneLight.push(g);
}

/** Weathered gargoyle with a water spout, facing outward. */
export function addGargoyle(B, key, { u, y, w, scale = 1.2, seed = 1 }) {
  const s = scale;
  const parts = [];
  parts.push(xform(new THREE.IcosahedronGeometry(0.42 * s, 0), { sy: 0.9, sz: 1.3, y: 0.42 * s }));
  parts.push(xform(new THREE.IcosahedronGeometry(0.25 * s, 0), { y: 0.8 * s, z: 0.44 * s }));
  parts.push(coneGeo(0.12 * s, 0.34 * s, 4, 0, 0.75 * s, 0.7 * s, 0));
  for (const dir of [-1, 1]) {
    parts.push(coneGeo(0.05 * s, 0.22 * s, 4, dir * 0.11 * s, 0.94 * s, 0.36 * s, dir * 0.3));
    // folded wings
    parts.push(xform(new THREE.ConeGeometry(0.12 * s, 0.62 * s, 4), { rz: dir * 1.9, x: dir * 0.34 * s, y: 0.95 * s, z: -0.06 * s }));
    // fore legs
    parts.push(limbGeo([dir * 0.2 * s, 0.34 * s, 0.5 * s], [dir * 0.24 * s, 0.02 * s, 0.62 * s], 0.06 * s, 0.05 * s, 4));
  }
  parts.push(tubeGeo(
    [
      [0, 0.78 * s, 0.72 * s],
      [0, 0.6 * s, 1.02 * s],
      [0, 0.3 * s, 1.14 * s],
    ],
    0.075 * s,
    { tubularSegments: 8, radialSegments: 4 }
  ));
  const g = mergeGeos(parts);
  xform(g, { x: u, y, z: w });
  B[key].push(g);
}

/** Small gabled canopy / pediment over a window or portal. */
export function addPediment(B, key, { u, y, w, width = 7, height = 2.6, depth = 0.5, seed = 1 }) {
  const pts = [
    [-width / 2, 0],
    [width / 2, 0],
    [width * 0.42, height * 0.55],
    [0, height],
    [-width * 0.42, height * 0.55],
  ];
  const g = shapeGeo(pts, depth);
  g.translate(u, y, w + depth / 2);
  B[key].push(g);
  // crockets on the slopes
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    for (const sgn of [-1, 1]) {
      const px = sgn * width * 0.5 * (1 - t);
      const py = y + height * t;
      B.stoneLight.push(coneGeo(0.09, 0.3, 4, u + px, py, w + depth * 0.9, Math.PI / 4));
    }
  }
  // finial
  B.stoneDark.push(coneGeo(0.16, 0.9, 4, u, y + height + 0.35, w + depth * 0.55, Math.PI / 4));
  B.stoneLight.push(sphereGeo(0.14, 6, u, y + height + 0.9, w + depth * 0.55));
}

/** Straight gable with slightly concave slopes, as used above the central bays. */
export function addGable(B, key, { u = 0, y, w, width = 22, height = 11, depth = 1.4, pts: custom = null }) {
  const hw = width / 2;
  const pts = custom || [
    [-hw, 0],
    [hw, 0],
    [hw * 0.86, height * 0.22],
    [hw * 0.58, height * 0.55],
    [hw * 0.28, height * 0.84],
    [0, height],
    [-hw * 0.28, height * 0.84],
    [-hw * 0.58, height * 0.55],
    [-hw * 0.86, height * 0.22],
  ];
  const g = shapeGeo(pts, depth);
  g.translate(u, y, w + depth / 2);
  B[key].push(g);
  return { pts, hw };
}

/** Starry sky scatter for the Nativity's upper fields. */
export function addStarField(B, { u0, u1, y0, y1, w, count = 12, seed = 1, key = 'gold', rMin = 0.1, rMax = 0.24 }) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    addStar(B, key, {
      u: rand(r, u0, u1),
      y: rand(r, y0, y1),
      w: w + rand(r, 0, 0.1),
      r: rand(r, rMin, rMax),
      points: 4,
    });
  }
}

// ---------------------------------------------------------------------------
// Passion-specific angular sculpture language (Subirachs)
// ---------------------------------------------------------------------------

/**
 * Angular robed figure built from prisms and 4-sided limbs, flat-shaded.
 * Poses: stand | cross | pray | armsUp | hold | kneel | slump
 */
export function angularFigure({ height = 1.9, pose = 'stand', seed = 1, hood = false, helmet = false, spear = false, shield = false }) {
  const r = rng(seed);
  const s = height / 1.9;
  const P = [];
  const bx = (w, h, d, x, y, z, ry = 0) => boxGeo(w * s, h * s, d * s, x * s, y * s, z * s, ry);
  const kneel = pose === 'kneel' || pose === 'slump';
  const hipY = kneel ? 0.5 : 0.9;
  const shY = kneel ? 1.02 : 1.52;
  const headY = kneel ? 1.18 : 1.7;

  if (kneel) {
    P.push(bx(0.2, 0.2, 0.62, -0.15, 0.32, 0.16));
    P.push(bx(0.2, 0.2, 0.62, 0.15, 0.32, 0.16));
    P.push(bx(0.2, 0.46, 0.22, -0.15, 0.2, 0.44));
    P.push(bx(0.2, 0.46, 0.22, 0.15, 0.2, 0.44));
  } else {
    P.push(bx(0.19, 0.94, 0.23, -0.14, 0.47, 0));
    P.push(bx(0.19, 0.94, 0.23, 0.14, 0.47, 0));
    P.push(bx(0.22, 0.1, 0.32, -0.14, 0.04, 0.06));
    P.push(bx(0.22, 0.1, 0.32, 0.14, 0.04, 0.06));
  }
  // angular torso (4-sided prism rotated 45 deg)
  P.push(xform(new THREE.CylinderGeometry(0.2 * s, 0.31 * s, (shY - hipY + 0.1) * s, 4), { ry: Math.PI / 4, y: ((hipY + shY) / 1.0 / 2) * s }));
  // shoulder bar
  P.push(bx(0.56, 0.17, 0.32, 0, shY, 0));
  // neck + blocky head
  P.push(bx(0.13, 0.14, 0.13, 0, headY - 0.2, 0));
  P.push(bx(0.23, 0.29, 0.24, 0, headY, 0));
  // angular jaw / brow
  P.push(xform(new THREE.ConeGeometry(0.1 * s, 0.16 * s, 4), { ry: 0, x: 0, y: (headY - 0.17) * s, z: 0.1 * s }));
  if (hood) {
    P.push(bx(0.34, 0.36, 0.3, 0, headY + 0.02, -0.04));
    P.push(bx(0.4, 0.16, 0.34, 0, shY - 0.02, -0.02));
  }
  if (helmet) {
    P.push(xform(new THREE.CylinderGeometry(0.1 * s, 0.15 * s, 0.14 * s, 4), { y: (headY + 0.19) * s, ry: Math.PI / 4 }));
    P.push(bx(0.3, 0.045, 0.3, 0, headY + 0.13, 0.02));
    P.push(bx(0.055, 0.2, 0.06, 0, headY + 0.28, 0)); // crest
  }

  // arms
  const armR = 0.055 * s;
  const shL = [-0.27 * s, shY * s, 0.01 * s];
  const shR = [0.27 * s, shY * s, 0.01 * s];
  let hL;
  let hR;
  if (pose === 'cross') {
    hL = [-0.48 * s, (shY + 0.02) * s, 0.06 * s];
    hR = [0.48 * s, (shY + 0.02) * s, 0.06 * s];
  } else if (pose === 'armsUp') {
    hL = [-0.42 * s, (headY + 0.32) * s, 0.08 * s];
    hR = [0.42 * s, (headY + 0.32) * s, 0.08 * s];
  } else if (pose === 'pray') {
    hL = [-0.045 * s, (shY - 0.14) * s, 0.3 * s];
    hR = [0.045 * s, (shY - 0.14) * s, 0.3 * s];
  } else if (pose === 'hold') {
    hL = [-0.09 * s, (shY - 0.3) * s, 0.34 * s];
    hR = [0.09 * s, (shY - 0.3) * s, 0.34 * s];
  } else if (kneel) {
    hL = [-0.19 * s, (shY - 0.22) * s, 0.32 * s];
    hR = [0.19 * s, (shY - 0.22) * s, 0.32 * s];
  } else {
    hL = [-0.3 * s, 0.92 * s, 0.12 * s];
    hR = [0.3 * s, 0.92 * s, 0.12 * s];
  }
  const eL = [shL[0] * 1.22, (shY - 0.22) * s, 0.05 * s];
  const eR = [shR[0] * 1.22, (shY - 0.22) * s, 0.05 * s];
  P.push(limbGeo(shL, eL, armR * 1.1, armR, 4));
  P.push(limbGeo(eL, hL, armR, armR * 0.8, 4));
  P.push(limbGeo(shR, eR, armR * 1.1, armR, 4));
  P.push(limbGeo(eR, hR, armR, armR * 0.8, 4));
  P.push(bx(0.11, 0.11, 0.1, hL[0] / s, hL[1] / s, hL[2] / s));
  P.push(bx(0.11, 0.11, 0.1, hR[0] / s, hR[1] / s, hR[2] / s));

  if (spear) {
    P.push(bx(0.035, 2.35, 0.035, 0.42, 1.18, 0.16));
    P.push(xform(new THREE.ConeGeometry(0.07 * s, 0.28 * s, 4), { y: 2.46 * s, x: 0.42 * s, z: 0.16 * s }));
  }
  if (shield) {
    P.push(bx(0.07, 0.7, 0.5, -0.38, 1.18, 0.2));
    P.push(bx(0.09, 0.16, 0.56, -0.38, 1.5, 0.2));
  }
  // give blocky figures a weathered lean
  const g = mergeGeos(P);
  if (chance(r, 0.3)) xform(g, { rz: rand(r, -0.05, 0.05) });
  return g;
}

/** Sharp angular pinnacle / spike. */
export function angularPinnacle({ base = 1.4, height = 8, seed = 3 } = {}) {
  const r = rng(seed);
  const parts = [];
  parts.push(boxGeo(base * 1.1, base * 0.3, base * 1.1, 0, base * 0.15, 0));
  parts.push(boxGeo(base * 0.68, height * 0.42, base * 0.68, 0, base * 0.3 + height * 0.21, 0));
  parts.push(boxGeo(base * 0.82, height * 0.12, base * 0.82, 0, base * 0.3 + height * 0.45, 0, Math.PI / 4));
  // faceted shaft
  parts.push(xform(new THREE.CylinderGeometry(base * 0.16, base * 0.4, height * 0.42, 4), { y: base * 0.3 + height * 0.72, ry: Math.PI / 4 }));
  // spike
  parts.push(xform(new THREE.ConeGeometry(base * 0.17, height * 0.34, 4), { y: height * 0.92, ry: Math.PI / 4 }));
  parts.push(boxGeo(base * 0.16, base * 0.16, base * 0.16, 0, height * 0.75, 0, Math.PI / 4));
  if (chance(r, 0.6)) parts.push(coneGeo(base * 0.09, base * 0.4, 4, 0, height * 0.82, base * 0.12, Math.PI / 4));
  return mergeGeos(parts);
}

/** Radiating wedge blocks around a circular window (Subirachs sun/crown). */
export function addRadialWedges(
  B,
  key,
  { u, y, w, r0, r1, count = 16, width = 0.85, depth = 0.55, phase = 0, seed = 1, jitter = 0.3 }
) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    const rm = (r0 + r1) / 2;
    const len = r1 - r0;
    const g = boxGeo(len, width * rand(r, 1 - jitter, 1 + jitter), depth * rand(r, 0.75, 1.3));
    xform(g, { rz: a, x: u + Math.cos(a) * rm, y: y + Math.sin(a) * rm, z: w });
    B[key].push(g);
  }
}

/** Thin angular screen wall with rectangular slots. */
export function addScreenedFin(B, key, { u, y, w, width = 3.4, height = 13, depth = 0.32, slots = 3, seed = 1 }) {
  const pts = [
    [-width / 2, 0],
    [width / 2, 0],
    [width / 2, height],
    [-width / 2, height],
  ];
  const holes = [];
  const slotW = width * 0.17;
  for (let i = 0; i < slots; i++) {
    const cx = -width / 2 + (width * (i + 0.5)) / slots;
    const y0 = height * (0.16 + 0.06 * ((i + seed) % 3));
    const hh = height * (0.42 + 0.12 * ((i + seed * 2) % 2));
    holes.push([
      [cx - slotW / 2, y0],
      [cx + slotW / 2, y0],
      [cx + slotW / 2, y0 + hh],
      [cx - slotW / 2, y0 + hh],
    ]);
  }
  const g = shapeGeo(pts, depth, holes);
  g.translate(u, y, w + depth / 2);
  B[key].push(g);
}

/** Rectangular relief scene: deep dark back, hard frame, shelf, shadow hood. */
export function addSceneFrame(B, { u, y, w, width = 5.2, height = 4.4, depth = 0.55, key = 'stone', hood = true } = {}) {
  const backW = width - 0.5;
  const backH = height - 0.5;
  B.reveal.push(boxGeo(backW, backH, 0.14, u, y + height / 2, w + 0.09));
  // deep frame beams
  const t = 0.32;
  B[key].push(boxGeo(width, t, depth, u, y + height - t / 2, w + depth / 2));
  B[key].push(boxGeo(width, t, depth, u, y + t / 2, w + depth / 2));
  B[key].push(boxGeo(t, height, depth, u - width / 2 + t / 2, y + height / 2, w + depth / 2));
  B[key].push(boxGeo(t, height, depth, u + width / 2 - t / 2, y + height / 2, w + depth / 2));
  // dark shadow reveal inside the opening
  const dt = 0.16;
  const zf = w + depth - 0.14;
  B.reveal.push(boxGeo(backW, dt, 0.16, u, y + 0.42 + backH, zf));
  B.reveal.push(boxGeo(backW, dt, 0.16, u, y + 0.44, zf));
  B.reveal.push(boxGeo(dt, backH, 0.16, u - backW / 2, y + height / 2, zf));
  B.reveal.push(boxGeo(dt, backH, 0.16, u + backW / 2, y + height / 2, zf));
  // projecting angular hood -> hard shadow over the station
  if (hood) {
    B.flatDark.push(boxGeo(width + 0.8, 0.46, 1.2, u, y + height + 0.24, w + 0.5));
    B.flat.push(boxGeo(width + 0.35, 0.2, 0.9, u, y + height + 0.05, w + 0.42));
    B.reveal.push(boxGeo(width + 0.1, 0.14, 1.0, u, y + height - 0.02, w + 0.46));
  }
  // shelf
  B.stoneDark.push(boxGeo(backW + 0.4, 0.18, 0.55, u, y + 0.28, w + 0.24));
  return { floorY: y + 0.37, backW, backH };
}

/** Veronica's veil: a slab with a blocky, hollow face. */
export function addVeilRelief(B, { u, y, w, width = 2.6, height = 3.2 }) {
  B.flatLight.push(boxGeo(width, height, 0.22, u, y + height / 2, w + 0.2));
  // face: brow bar, nose wedge, cheek planes, chin block, eye hollows
  const fw = width * 0.52;
  B.flatLight.push(boxGeo(fw, 0.14, 0.12, u, y + height * 0.72, w + 0.33));
  B.flatLight.push(boxGeo(fw * 0.86, 0.1, 0.1, u, y + height * 0.62, w + 0.34));
  B.flat.push(xform(new THREE.ConeGeometry(0.16, 0.5, 4), { x: u, y: y + height * 0.56, z: w + 0.42 }));
  B.flat.push(boxGeo(0.5, 0.1, 0.12, u, y + height * 0.47, w + 0.36));
  B.flat.push(boxGeo(0.62, 0.26, 0.1, u, y + height * 0.36, w + 0.34));
  B.reveal.push(boxGeo(fw * 0.7, 0.1, 0.06, u, y + height * 0.66, w + 0.4));
  // cloth folds
  for (const sgn of [-1, 1]) {
    B.flat.push(boxGeo(0.14, height * 0.9, 0.1, u + sgn * width * 0.38, y + height * 0.46, w + 0.33));
  }
}

/** Ring of thorns: jagged crown motif. */
export function addThornCrown(B, { u, y, w, radius = 0.55, seed = 1 }) {
  const r = rng(seed);
  const ring = torusGeo(radius, 0.06, 18, 4);
  ring.rotateX(Math.PI / 2);
  ring.translate(u, y, w);
  B.flatLight.push(ring);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // build the thorn at the origin, tilt it outward, then place it
    const g = coneGeo(0.05, 0.24, 4);
    xform(g, {
      rx: Math.sin(a) * 0.55,
      rz: -Math.cos(a) * 0.55,
      x: u + Math.cos(a) * radius,
      y,
      z: w + Math.sin(a) * radius,
    });
    B.flatLight.push(g);
  }
  if (chance(r, 0.5)) B.gold.push(coneGeo(0.1, 0.3, 4, u, y + 0.3, w, Math.PI / 4));
}

/** Small rooster (Peter's denial). */
export function addRooster(B, { u, y, w, s = 0.8, seed = 1 }) {
  const parts = [];
  parts.push(xform(new THREE.SphereGeometry(0.2 * s, 7, 5), { sy: 0.9, sz: 1.25, y: 0.4 * s }));
  parts.push(limbGeo([0, 0.45 * s, 0.2 * s], [0, 0.72 * s, 0.3 * s], 0.06 * s, 0.05 * s, 5));
  parts.push(sphereGeo(0.09 * s, 6, 0, 0.74 * s, 0.32 * s));
  parts.push(coneGeo(0.035 * s, 0.16 * s, 4, 0, 0.72 * s, 0.44 * s, 0));
  parts.push(xform(new THREE.ConeGeometry(0.06 * s, 0.2 * s, 4), { y: 0.9 * s, z: 0.3 * s }));
  for (const sgn of [-1, 1]) parts.push(xform(new THREE.ConeGeometry(0.1 * s, 0.34 * s, 4), { rz: sgn * 1.5, x: sgn * 0.18 * s, y: 0.42 * s, z: -0.02 * s }));
  const tail = [0, -0.2, 0.5];
  parts.push(tubeGeo([[0, 0.42 * s, -0.16 * s], [0, 0.62 * s, -0.3 * s], [0, 0.8 * s, -0.34 * s]], 0.03 * s, { tubularSegments: 8, radialSegments: 4 }));
  for (const sgn of [-1, 1]) parts.push(limbGeo([sgn * 0.07 * s, 0.2 * s, 0], [sgn * 0.09 * s, 0, 0.04 * s], 0.02 * s, 0.015 * s, 4));
  const g = mergeGeos(parts);
  xform(g, { x: u, y, z: w });
  B.flatLight.push(g);
}

/** Re-export selected lib helpers so façade modules import from one place. */
export {
  THREE,
  rng,
  rand,
  pick,
  chance,
  xform,
  boxGeo,
  cylGeo,
  sphereGeo,
  coneGeo,
  torusGeo,
  limbGeo,
  tubeGeo,
  latheGeo,
  shapeGeo,
  mergeGeos,
  textTexture,
  wallWithOpeningsGeo,
  figureGeo,
  animalGeo,
  birdGeo,
  cypressGeo,
  pinnacleGeo,
  starGeo,
  crossGeo,
  roseWindowParts,
  oculusParts,
  archRingGeo,
  archPanelGeo,
  scaleUV,
} from '../lib.js';
