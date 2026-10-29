import * as THREE from 'three';

export const UP = new THREE.Vector3(0, 1, 0);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ *
 * BeamBatch - accumulates oriented boxes and bakes them into a single
 * InstancedMesh. All the latticing of the tower goes through this.
 * ------------------------------------------------------------------ */
export class BeamBatch {
  constructor() { this.matrices = []; this.count = 0; }
  add(ax, ay, az, bx, by, bz, w, d) {
    const dd = d === undefined ? w : d;
    const a = _v1.set(ax, ay, az), b = _v2.set(bx, by, bz);
    const dir = _v3.subVectors(b, a);
    const len = dir.length();
    if (!(len > 0.02) || !(w > 0) || !(dd > 0)) return;
    dir.divideScalar(len);
    _q.setFromUnitVectors(UP, dir);
    _v4.addVectors(a, b).multiplyScalar(0.5);
    _m.compose(_v4, _q, _s.set(w, len, dd));
    this.matrices.push(_m.clone());
    this.count++;
  }
  post(x, y0, y1, z, w, d) { this.add(x, y0, z, x, y1, z, w, d); }
  bar(x0, y, z0, x1, z1, w, d) { this.add(x0, y, z0, x1, y, z1, w, d); }
  build(geometry) {
    const g = geometry || new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(g, null, Math.max(this.count, 1));
    for (let i = 0; i < this.count; i++) mesh.setMatrixAt(i, this.matrices[i]);
    mesh.count = this.count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.matrices.length = 0;
    return mesh;
  }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();

/* ------------------------------------------------------------------ *
 * loftColumn - skin a stack of axis-aligned rectangles into a closed
 * tapered prism with flat (unshared) normals, so the crisps of the
 * silhouette stay crisp.
 * rings: [{ y, x0, x1, z0, z1 }] ordered by increasing y.
 * ------------------------------------------------------------------ */
const ringCorner = (r, k) => {
  if (k === 0) return [r.x0, r.y, r.z0];
  if (k === 1) return [r.x1, r.y, r.z0];
  if (k === 2) return [r.x1, r.y, r.z1];
  return [r.x0, r.y, r.z1];
};

export function loftColumn(rings) {
  const pos = [];
  const idx = [];
  const push = (p) => { pos.push(p[0], p[1], p[2]); return pos.length / 3 - 1; };

  /* Each of the four walls gets its own strip of vertices. Vertices are shared
   * between neighbouring strips along the taper - so the surface shades as one
   * continuous curve - but not across the vertical edges, which stay crisp. */
  for (let f = 0; f < 4; f++) {
    const f2 = (f + 1) % 4;
    const col = rings.map((r) => [push(ringCorner(r, f)), push(ringCorner(r, f2))]);
    for (let i = 0; i < rings.length - 1; i++) {
      const a = col[i][0], b = col[i][1], c = col[i + 1][1], d = col[i + 1][0];
      idx.push(a, c, b, a, d, c);
    }
  }

  const first = rings[0], last = rings[rings.length - 1];
  const cf = [0, 1, 2, 3].map((k) => push(ringCorner(first, k)));
  const cl = [0, 1, 2, 3].map((k) => push(ringCorner(last, k)));
  idx.push(cf[0], cf[2], cf[1], cf[0], cf[3], cf[2]);
  idx.push(cl[0], cl[1], cl[2], cl[0], cl[2], cl[3]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Even-ratio panel levels: short near y1, tall near y0, as the sheet draws them. */
export function panelLevels(y0, y1, n, ratio) {
  const h = [];
  let t = 1, sum = 0;
  for (let i = 0; i < n; i++) { h.push(t); sum += t; t *= ratio; }
  const out = [y0];
  let acc = y0;
  for (let i = 0; i < n; i++) { acc += (y1 - y0) * h[i] / sum; out.push(acc); }
  out[out.length - 1] = y1;
  return out;
}
