import * as THREE from 'three';
import { clamp } from './rng.js';

export const UP = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------------ *
 * Monotone cubic (Fritsch-Carlson) interpolation of the tower profile.
 * Guarantees a smooth, non-overshooting silhouette through measured
 * landmark widths - no wobble between the platforms.
 * ------------------------------------------------------------------ */
export function makeProfile(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const n = xs.length;
  const dx = new Array(n - 1), dy = new Array(n - 1), slope = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    dy[i] = ys[i + 1] - ys[i];
    slope[i] = dy[i] / dx[i];
  }
  const m = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  return function at(x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = dx[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

/* ------------------------------------------------------------------ *
 * BeamBatch: accumulates oriented boxes (I-beams / lattice members) in
 * world space, then bakes them into a single InstancedMesh. Used for
 * the 18k-odd members of the tower, the truss girders of the platforms
 * and the roof timbers of the city.
 * ------------------------------------------------------------------ */
export class BeamBatch {
  constructor() {
    this.matrices = [];
    this.ao = [];      // baked occlusion / tone variation per member
    this.tint = [];    // optional rgb tint per member
    this.count = 0;
  }
  /** add a box from point a to point b with cross-section w x d */
  add(ax, ay, az, bx, by, bz, w, d = w, ao = 1, tint = null) {
    const a = _v1.set(ax, ay, az), b = _v2.set(bx, by, bz);
    const dir = _v3.subVectors(b, a);
    const len = dir.length();
    if (!(len > 0.02) || !(w > 0) || !(d > 0)) return;
    dir.divideScalar(len);
    _q.setFromUnitVectors(UP, dir);
    _v4.addVectors(a, b).multiplyScalar(0.5);
    _m.compose(_v4, _q, _s.set(w, len, d));
    this.matrices.push(_m.clone());
    this.ao.push(ao);
    if (tint) this.tint.push(tint[0], tint[1], tint[2]);
    this.count++;
  }
  /** axis-aligned helper: a vertical post from y0 to y1 at (x,z) */
  post(x, y0, y1, z, w, d = w, ao = 1) { this.add(x, y0, z, x, y1, z, w, d, ao); }
  /** axis-aligned helper: a horizontal beam along X or Z */
  bar(x0, y, z0, x1, z1, w, d = w, ao = 1) { this.add(x0, y, z0, x1, y, z1, w, d, ao); }
  build(geometry) {
    const g = geometry || new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(g, null, this.count);
    for (let i = 0; i < this.count; i++) mesh.setMatrixAt(i, this.matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    if (this.ao.length === this.count) {
      mesh.geometry = mesh.geometry.clone();
      const arr = new Float32Array(this.ao);
      mesh.geometry.setAttribute('aAO', new THREE.InstancedBufferAttribute(arr, 1));
    }
    if (this.tint.length === this.count * 3) {
      mesh.geometry = mesh.geometry.clone();
      const arr = new Float32Array(this.tint);
      mesh.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(arr, 3));
    }
    mesh.frustumCulled = false;
    this.matrices.length = 0; this.ao.length = 0; this.tint.length = 0;
    return mesh;
  }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();

/* ------------------------------------------------------------------ *
 * InstanceSet: generic instanced-mesh accumulator for props (trees,
 * lamp posts, benches, cars) with per-instance colour.
 * ------------------------------------------------------------------ */
export class InstanceSet {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.items = [];
  }
  add(matrix, color) { this.items.push({ m: matrix.clone(), c: color }); }
  build() {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, Math.max(1, this.items.length));
    for (let i = 0; i < this.items.length; i++) {
      mesh.setMatrixAt(i, this.items[i].m);
      if (this.items[i].c !== undefined) mesh.setColorAt(i, _c.setHex(this.items[i].c).convertSRGBToLinear());
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = this.items.length;
    mesh.frustumCulled = false;
    this.items.length = 0;
    return mesh;
  }
}
const _c = new THREE.Color();

/** merge a list of {geometry, matrix} into one buffer geometry */
export function mergeParts(parts) {
  const geos = [];
  for (const p of parts) {
    const g = p.geometry.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

// Minimal, dependency-free merge for indexed geometries that share the same
// attribute layout (position, normal, uv) - avoids pulling in three's addons.
export function mergeGeometries(geos) {
  if (!geos.length) return new THREE.BufferGeometry();
  let vcount = 0, icount = 0;
  const hasUV = geos.every((g) => g.getAttribute('uv'));
  for (const g of geos) {
    vcount += g.getAttribute('position').count;
    icount += g.index ? g.index.count : g.getAttribute('position').count;
  }
  const pos = new Float32Array(vcount * 3);
  const nor = new Float32Array(vcount * 3);
  const uv = hasUV ? new Float32Array(vcount * 2) : null;
  const idx = vcount > 65535 ? new Uint32Array(icount) : new Uint16Array(icount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    pos.set(p.array.subarray(0, p.count * 3), vo * 3);
    if (n) nor.set(n.array.subarray(0, n.count * 3), vo * 3);
    if (uv && u) uv.set(u.array.subarray(0, u.count * 2), vo * 2);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo;
    else for (let i = 0; i < p.count; i++) idx[io++] = i + vo;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/** rounded-ish box used for platforms and city blocks (cheap bevelled box) */
export function boxGeo(w, h, d, bevel = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (bevel > 0) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      // pull corners inward slightly for a soft silhouette
      p.setXYZ(i, p.getX(i) * (1 - bevel * 0.02), p.getY(i), p.getZ(i) * (1 - bevel * 0.02));
    }
    g.computeVertexNormals();
  }
  return g;
}

export { clamp, lerp, smoothstep } from './rng.js';
