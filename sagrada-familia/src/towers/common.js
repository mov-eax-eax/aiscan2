// Shared building blocks for the tower + roof builder.
// Everything here is local to the tower builder; it leans on src/lib.js for
// materials, the bell group, pinnacles, spiral stairs and geometry merging.

import {
  THREE,
  xform,
  boxGeo,
  cylGeo,
  coneGeo,
  sphereGeo,
  torusGeo,
  latheGeo,
  mergeGeos,
  scaleUV,
  matrixAt,
  instancedMesh,
  bellGroup,
} from '../lib.js';

// ---------------------------------------------------------------------------
// Assembler: collects geometry into material batches and instanced repeats
// ---------------------------------------------------------------------------

/**
 * Batches geometry by material key and collects instance matrices.
 * `finalize` produces one merged mesh per material plus InstancedMeshes.
 */
export class GeoBuilder {
  constructor() {
    this.batches = new Map();
    this.inst = new Map();
  }

  add(key, geo) {
    if (!geo) return;
    if (Array.isArray(geo)) {
      for (const g of geo) this.add(key, g);
      return;
    }
    if (!geo.isBufferGeometry) {
      console.warn('[towers] non-geometry added to batch', key, geo);
      return;
    }
    let list = this.batches.get(key);
    if (!list) {
      list = [];
      this.batches.set(key, list);
    }
    list.push(geo);
  }

  addAll(key, geos) {
    for (const g of geos) this.add(key, g);
  }

  instance(key, geo, material, matrix, { castShadow = false, receiveShadow = true } = {}) {
    if (!geo || !matrix) return;
    let e = this.inst.get(key);
    if (!e) {
      e = { geo, material, matrices: [], castShadow, receiveShadow };
      this.inst.set(key, e);
    }
    e.matrices.push(matrix);
  }

  finalize(group, materials, { noCast = new Set() } = {}) {
    let triangles = 0;
    for (const [key, geos] of this.batches) {
      const material = materials[key];
      if (!material) {
        console.warn('[towers] missing material for batch', key);
        continue;
      }
      const geo = mergeGeos(geos);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = key;
      mesh.castShadow = !noCast.has(key);
      mesh.receiveShadow = true;
      group.add(mesh);
      triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    }
    for (const [key, e] of this.inst) {
      const mesh = instancedMesh(e.geo, e.material, e.matrices, {
        castShadow: e.castShadow,
        receiveShadow: e.receiveShadow,
      });
      if (!mesh) continue;
      mesh.name = key;
      group.add(mesh);
      const n = e.geo.index ? e.geo.index.count : e.geo.attributes.position.count;
      triangles += (n / 3) * e.matrices.length;
    }
    return Math.round(triangles);
  }
}

// ---------------------------------------------------------------------------
// Square / polygonal masses
// ---------------------------------------------------------------------------

/**
 * Axis-aligned square frustum (tapered box). Base sits at `y0`, faces point
 * along +X/-X/+Z/-Z. Returns flat-shaded non-indexed geometry.
 */
export function frustum4(wBottom, wTop, h, y0 = 0) {
  const g = new THREE.CylinderGeometry(wTop / Math.SQRT2, wBottom / Math.SQRT2, h, 4, 1, false);
  g.rotateY(-Math.PI / 4);
  g.translate(0, y0 + h / 2, 0);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  scaleUV(flat, Math.max(0.7, wBottom * 0.9), Math.max(0.7, h / 3.2));
  flat.computeBoundingSphere();
  return flat;
}

/** Regular prism/frustum with `sides` faces; a flat face points toward +Z. */
export function frustumN(sides, rBottom, rTop, h, y0 = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, sides, 1, false);
  g.rotateY(-Math.PI / sides);
  g.translate(0, y0 + h / 2, 0);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  scaleUV(flat, Math.max(0.7, rBottom * 2.4), Math.max(0.7, h / 3.2));
  flat.computeBoundingSphere();
  return flat;
}

/** Square cornice ring: a solid slab that projects `out` beyond a w-wide body. */
export function corniceGeo(w, y, { out = 0.55, h = 0.42 } = {}) {
  return boxGeo(w + out * 2, h, w + out * 2, 0, y, 0);
}

/** Axis-aligned box at a world position. */
export function boxAt(w, h, d, x, y, z, ry = 0) {
  return boxGeo(w, h, d, x, y, z, ry);
}

// ---------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------

/** Four square-plan faces, normals +Z, +X, -Z, -X. */
export const FACES4 = [
  { nx: 0, nz: 1 },
  { nx: 1, nz: 0 },
  { nx: 0, nz: -1 },
  { nx: -1, nz: 0 },
];

/** Eight cardinal/ordinal faces (octagon), normals at 45 degree steps. */
export const FACES8 = [
  { nx: 0, nz: 1 },
  { nx: Math.SQRT1_2, nz: Math.SQRT1_2 },
  { nx: 1, nz: 0 },
  { nx: Math.SQRT1_2, nz: -Math.SQRT1_2 },
  { nx: 0, nz: -1 },
  { nx: -Math.SQRT1_2, nz: -Math.SQRT1_2 },
  { nx: -1, nz: 0 },
  { nx: -Math.SQRT1_2, nz: Math.SQRT1_2 },
];

/** Unit tangential direction for a face normal (nx, nz) -> (nz, -nx). */
export function tangentOf(face) {
  return { tx: face.nz, tz: -face.nx };
}

/**
 * Instance matrix that puts a +Z-facing unit (window, niche, symbol) on a
 * tower face. `off` slides the unit tangentially; `extra` pushes it outward.
 */
export function faceMatrix(cx, cz, halfW, face, y, { off = 0, extra = 0.0, ry = 0 } = {}) {
  const t = tangentOf(face);
  const x = cx + face.nx * (halfW + extra) + t.tx * off;
  const z = cz + face.nz * (halfW + extra) + t.tz * off;
  return matrixAt(x, y, z, { ry: Math.atan2(face.nx, face.nz) + ry });
}

/** Position on a radial face at angle `a` (radians, x=sin a, z=cos a). */
export function radialMatrix(cx, cz, radius, a, y, { extra = 0, spin = 0 } = {}) {
  return matrixAt(cx + Math.sin(a) * radius, y, cz + Math.cos(a) * radius, {
    ry: a + spin,
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/**
 * Cheap pointed-arch frame extruded from a shape, with few curve segments.
 * Local space: opening spans x = -w/2..w/2 and y = 0..h, facing +Z.
 */
export function archFrameGeo(w, h, { band = 0.26, depth = 0.36, spring = 0.55, curveSegments = 3 } = {}) {
  const hw = (w + band * 2) / 2;
  const wi = w / 2;
  const springY = h * spring;
  const outer = new THREE.Shape();
  outer.moveTo(-hw, -0.7);
  outer.lineTo(hw, -0.7);
  outer.lineTo(hw, springY);
  outer.quadraticCurveTo(hw * (wi / hw) * 0.94, h * 0.94, 0, h + band * 0.55);
  outer.quadraticCurveTo(-hw * (wi / hw) * 0.94, h * 0.94, -hw, springY);
  outer.lineTo(-hw, -0.7);
  const hole = new THREE.Path();
  hole.moveTo(-wi, -0.7);
  hole.lineTo(-wi, springY);
  hole.quadraticCurveTo(-wi * 0.94, h * 0.94, 0, h);
  hole.quadraticCurveTo(wi * 0.94, h * 0.94, wi, springY);
  hole.lineTo(wi, -0.7);
  hole.lineTo(-wi, -0.7);
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * A complete lancet window unit. Returns
 *   { stone, glass }  - stone frame/sill/mullion and a recessed glazing panel.
 * Local space: sill at y = 0, faces +Z.
 */
export function windowUnit({ w = 2, h = 7, band = 0.26, depth = 0.36, spring = 0.55, mullion = true } = {}) {
  const stone = [];
  stone.push(archFrameGeo(w, h, { band, depth, spring }));
  stone.push(boxGeo(w + band * 2 + 0.5, 0.3, depth + 0.55, 0, -0.08, 0.1));
  if (mullion) {
    stone.push(boxGeo(0.11, h * 0.68, depth * 0.62, 0, h * 0.36, -depth * 0.2));
    stone.push(boxGeo(w * 0.7, 0.1, depth * 0.62, 0, h * 0.42, -depth * 0.2));
  }
  // glazing panel: pointed-arch pane set just outside the wall plane so it is
  // visible through the frame opening (the frame itself projects from the wall)
  const glass = new THREE.ShapeGeometry(
    (() => {
      const s = new THREE.Shape();
      const wi = w / 2;
      const springY = h * spring;
      s.moveTo(-wi, 0);
      s.lineTo(wi, 0);
      s.lineTo(wi, springY);
      s.quadraticCurveTo(wi * 0.94, h * 0.94, 0, h);
      s.quadraticCurveTo(-wi * 0.94, h * 0.94, -wi, springY);
      s.lineTo(-wi, 0);
      return s;
    })(),
    4
  );
  glass.translate(0, 0.02, 0.02);
  return { stone: mergeGeos(stone), glass };
}

/** Recessed blind niche (dark panelled arch) for a tower face. */
export function nicheUnit({ w = 2.6, h = 6, band = 0.34, depth = 0.5 } = {}) {
  return windowUnit({ w, h, band, depth, mullion: false });
}

// ---------------------------------------------------------------------------
// Balustrades, pinnacles, crests
// ---------------------------------------------------------------------------

let _baluster = null;
/** Turned stone baluster, base at y = 0. */
export function balusterProto() {
  if (_baluster) return _baluster;
  _baluster = latheGeo(
    [
      [0.13, 0],
      [0.13, 0.06],
      [0.075, 0.12],
      [0.15, 0.32],
      [0.105, 0.58],
      [0.08, 0.76],
      [0.135, 0.88],
      [0.135, 0.96],
    ],
    6
  );
  return _baluster;
}

/**
 * Simple, chunky Gaudí-esque pinnacle (no crockets, no Gothic spikes):
 * plinth, smoothly tapered square shaft, collar, four-sided cap and a small
 * stone ball. Base at y = 0.
 */
export function simplePinnacleGeo({ base = 1.0, height = 4.5 } = {}) {
  const parts = [];
  const plinth = base * 0.3;
  parts.push(boxGeo(base * 1.2, plinth, base * 1.2, 0, plinth / 2, 0));
  const shaftH = height * 0.56;
  parts.push(frustum4(base, base * 0.58, shaftH, plinth));
  parts.push(boxGeo(base * 0.74, base * 0.14, base * 0.74, 0, plinth + shaftH + base * 0.07, 0));
  const capY = plinth + shaftH + base * 0.14;
  parts.push(coneGeo(base * 0.44, height * 0.22, 4, 0, capY + height * 0.11, 0, Math.PI / 4));
  parts.push(sphereGeo(base * 0.15, 8, 0, capY + height * 0.22 + base * 0.13, 0));
  return mergeGeos(parts);
}

/**
 * Rectangular balustrade around a square plan: corner posts, base rail, top
 * rail and instanced balusters. `b` is a GeoBuilder, `mats` the material map.
 */
export function balustradeSquare(b, mats, {
  cx = 0,
  cz = 0,
  halfW = 3.8,
  y = 0,
  height = 0.95,
  spacing = 1.5,
  batchKey = 'trim',
  balMaterial = null,
} = {}) {
  const railY = y + height + 0.06;
  const railT = 0.3;
  const len = halfW * 2;
  // corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(batchKey, boxGeo(0.34, height + 0.3, 0.34, cx + sx * halfW, y + (height + 0.3) / 2, cz + sz * halfW));
    }
  }
  // top + base rails on the four sides
  b.add(batchKey, boxGeo(len + 0.42, 0.15, railT, cx, railY + 0.06, cz + halfW));
  b.add(batchKey, boxGeo(len + 0.42, 0.15, railT, cx, railY + 0.06, cz - halfW));
  b.add(batchKey, boxGeo(railT, 0.15, len + 0.42, cx + halfW, railY + 0.06, cz));
  b.add(batchKey, boxGeo(railT, 0.15, len + 0.42, cx - halfW, railY + 0.06, cz));
  b.add(batchKey, boxGeo(len + 0.42, 0.12, railT + 0.05, cx, y + 0.07, cz + halfW));
  b.add(batchKey, boxGeo(len + 0.42, 0.12, railT + 0.05, cx, y + 0.07, cz - halfW));
  b.add(batchKey, boxGeo(railT + 0.05, 0.12, len + 0.42, cx + halfW, y + 0.07, cz));
  b.add(batchKey, boxGeo(railT + 0.05, 0.12, len + 0.42, cx - halfW, y + 0.07, cz));
  const bal = balusterProto();
  const mat = balMaterial || mats.trim;
  const n = Math.max(2, Math.round(len / spacing));
  for (let i = 1; i < n; i++) {
    const off = -halfW + (i / n) * len;
    const yb = y + 0.13;
    b.instance('baluster', bal, mat, matrixAt(cx + off, yb, cz + halfW));
    b.instance('baluster', bal, mat, matrixAt(cx + off, yb, cz - halfW));
    b.instance('baluster', bal, mat, matrixAt(cx + halfW, yb, cz + off));
    b.instance('baluster', bal, mat, matrixAt(cx - halfW, yb, cz + off));
  }
}

let _crest = null;
/** Ridge crest ornament (small finial spikes), base at y = 0. */
export function crestProto({ h = 1.5 } = {}) {
  if (_crest) return _crest;
  const parts = [];
  parts.push(boxGeo(0.42, 0.22, 0.42, 0, 0.11, 0));
  parts.push(xform(new THREE.ConeGeometry(0.26, h, 4), { y: 0.22 + h / 2, ry: Math.PI / 4 }));
  parts.push(sphereGeo(0.16, 8, 0, 0.22 + h + 0.1, 0));
  parts.push(xform(new THREE.ConeGeometry(0.08, 0.34, 4), { y: 0.22 + h + 0.34, ry: Math.PI / 4 }));
  // two little side leaves
  for (const s of [-1, 1]) {
    parts.push(xform(new THREE.ConeGeometry(0.11, 0.5, 4), { x: s * 0.26, y: 0.3, rz: s * 0.7 }));
  }
  _crest = mergeGeos(parts);
  return _crest;
}

// ---------------------------------------------------------------------------
// Bells (uses lib.bellGroup, geometry extracted so bells can be merged)
// ---------------------------------------------------------------------------

const _bellCache = new Map();
/**
 * Extract the bell body / clapper / yoke geometry from lib.bellGroup so a
 * whole belfry of bells can be merged into the tower batches.
 * Local origin = where the group would sit (yoke above, mouth at y + height).
 */
export function bellProtos(radius = 1.05, height = 2.5) {
  const key = `${radius}:${height}`;
  if (_bellCache.has(key)) return _bellCache.get(key);
  const g = bellGroup({ radius, height });
  const [bell, clapper, yoke] = g.children;
  const bellGeo = bell.geometry.clone();
  const clapperGeo = clapper.geometry.clone();
  clapperGeo.translate(0, clapper.position.y, 0);
  const yokeGeo = yoke.geometry.clone();
  yokeGeo.translate(0, yoke.position.y, 0);
  const out = { bellGeo, clapperGeo, yokeGeo, height };
  _bellCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/** Linear interpolation of a tower width at height y, from a section list. */
export function widthAt(sections, y) {
  for (const s of sections) {
    if (y <= s.y1) {
      const t = Math.max(0, Math.min(1, (y - s.y0) / Math.max(1e-6, s.y1 - s.y0)));
      return s.w0 + (s.w1 - s.w0) * t;
    }
  }
  return sections[sections.length - 1].w1;
}

/** Slight rotation about Y for a geometry (then translate), useful for ribs. */
export function radialBox(w, h, d, cx, cz, radius, angle, y) {
  const g = boxGeo(w, h, d);
  const nx = Math.sin(angle);
  const nz = Math.cos(angle);
  return xform(g, { ry: angle, x: cx + nx * radius, y, z: cz + nz * radius });
}

/** Horizontal torus ring (collar) centred at (x, y, z). */
export function collarRing(radius, tube, x, y, z, seg = 16) {
  return xform(torusGeo(radius, tube, seg, 6), { rx: Math.PI / 2, x, y, z });
}

/** Plane geometry sized to a textTexture material's aspect ratio, facing +Z. */
export function textPlaneGeo(material, width) {
  const tex = material && material.map;
  const aspect = tex && tex.image ? tex.image.width / tex.image.height : 4;
  return new THREE.PlaneGeometry(width, width / aspect);
}

/**
 * Octagonal balustrade ring: rails on each of the eight faces, corner posts
 * and instanced balusters.
 */
export function balustradeOctagon(b, mats, {
  cx = 0,
  cz = 0,
  radius = 3,
  y = 0,
  height = 0.85,
  spacing = 1.15,
  batchKey = 'trim',
  balMaterial = null,
} = {}) {
  const bal = balusterProto();
  const mat = balMaterial || mats.trim;
  const faceR = radius * Math.cos(Math.PI / 8);
  const chord = 2 * radius * Math.sin(Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const nx = Math.sin(a);
    const nz = Math.cos(a);
    const px = cx + nx * faceR;
    const pz = cz + nz * faceR;
    const tx = nz;
    const tz = -nx;
    const railTop = boxGeo(chord + 0.12, 0.13, 0.24);
    xform(railTop, { ry: a, x: px, y: y + height + 0.05, z: pz });
    b.add(batchKey, railTop);
    const railBase = boxGeo(chord + 0.12, 0.1, 0.28);
    xform(railBase, { ry: a, x: px, y: y + 0.05, z: pz });
    b.add(batchKey, railBase);
    for (const s of [-1, 1]) {
      const qx = px + tx * (chord / 2) * s;
      const qz = pz + tz * (chord / 2) * s;
      b.add(batchKey, boxGeo(0.22, height + 0.15, 0.22, qx, y + (height + 0.15) / 2, qz));
    }
    const n = Math.max(1, Math.round(chord / spacing));
    for (let i = 1; i < n; i++) {
      const off = -chord / 2 + (i / n) * chord;
      b.instance('baluster', bal, mat, matrixAt(px + tx * off, y + 0.08, pz + tz * off));
    }
  }
}

/** Point on an octagon face at angle `a` (radial unit = sin a, cos a). */
export function octFacePoint(cx, cz, circumR, a, extra = 0) {
  const r = circumR * Math.cos(Math.PI / 8) + extra;
  return { x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r };
}
