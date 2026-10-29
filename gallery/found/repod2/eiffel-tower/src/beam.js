import * as THREE from 'three';
import { paint } from './config.js';

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

// scratch for the bilinear subdivision (no allocation per bar)
const _ba = new THREE.Vector3();
const _bb = new THREE.Vector3();
const _bq = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * Collects boxes/beams and turns them into a single InstancedMesh.
 * Every beam is a unit box scaled to (t, length, t) and rotated onto its axis,
 * so a whole tower of ~40 000 members costs one draw call.
 */
export class BeamBuilder {
  constructor(name = 'beams') {
    this.name = name;
    this.items = [];
  }

  get count() {
    return this.items.length;
  }

  _push(m, y, colorAt) {
    const c = new THREE.Color();
    if (typeof colorAt === 'function') colorAt(y, c);
    else if (colorAt) c.copy(colorAt);
    else paint(y, c);
    this.items.push({ m: m.clone(), c });
  }

  /** Beam from a to b with a square cross-section t. */
  beam(ax, ay, az, bx, by, bz, t, colorAt) {
    _dir.set(bx - ax, by - ay, bz - az);
    const len = _dir.length();
    if (!(len > 1e-4) || !(t > 0)) return;
    _dir.divideScalar(len);
    _q.setFromUnitVectors(_up, _dir);
    _mid.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
    _s.set(t, len, t);
    this._push(_m.compose(_mid, _q, _s), _mid.y, colorAt);
  }

  /** Beam between two Vector3-ish objects. */
  beamV(a, b, t, colorAt) {
    this.beam(a.x, a.y, a.z, b.x, b.y, b.z, t, colorAt);
  }

  /** Free box: size (sx, sy, sz), yaw around Y. */
  box(cx, cy, cz, sx, sy, sz, yaw = 0, colorAt) {
    _q.setFromAxisAngle(_up, yaw);
    _mid.set(cx, cy, cz);
    _s.set(sx, sy, sz);
    this._push(_m.compose(_mid, _q, _s), cy, colorAt);
  }

  /** Orientated box: full quaternion. */
  oriented(pos, quat, size, colorAt) {
    _s.copy(size);
    this._push(_m.compose(pos, quat, _s), pos.y, colorAt);
  }

  polyline(pts, t, colorAt) {
    for (let i = 0; i < pts.length - 1; i++) this.beamV(pts[i], pts[i + 1], t, colorAt);
  }

  ring(pts, t, colorAt) {
    const n = pts.length;
    for (let i = 0; i < n; i++) this.beamV(pts[i], pts[(i + 1) % n], t, colorAt);
  }

  build(material, geometry, opts = {}) {
    const n = this.items.length;
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(n, 1));
    for (let i = 0; i < n; i++) {
      mesh.setMatrixAt(i, this.items[i].m);
      mesh.setColorAt(i, this.items[i].c);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    mesh.frustumCulled = false;
    mesh.name = this.name;
    mesh.userData.builders = this;
    return mesh;
  }
}

/** Bilinear point of a quad (p00,p10,p11,p01) at (u,v) — writes into `out`. */
function bil(out, p00, p10, p11, p01, u, v) {
  _ba.lerpVectors(p00, p10, u);
  _bb.lerpVectors(p01, p11, u);
  return out.lerpVectors(_ba, _bb, v);
}

/**
 * Fills a four-sided panel with the classic Eiffel pattern: two main
 * diagonals (St Andrew's cross) plus an `sub × sub` web of finer crosses.
 * The vertical edges of the panel are the tower's own chords; the horizontal
 * edges are added by the caller (`edges`).
 */
export function addFaceLattice(main, fine, p00, p10, p11, p01, o = {}) {
  const tm = o.mainT ?? 0.2;
  const tf = o.fineT ?? 0.07;
  const sub = o.sub ?? 2;
  const su = Math.max(0, o.subU ?? sub);
  const sv = Math.max(0, o.subV ?? sub);
  const colorAt = o.colorAt;
  if (o.edges) {
    main.beamV(p00, p10, o.edgeT ?? tm, colorAt);
    main.beamV(p10, p11, o.edgeT ?? tm, colorAt);
    main.beamV(p11, p01, o.edgeT ?? tm, colorAt);
    main.beamV(p01, p00, o.edgeT ?? tm, colorAt);
  }
  if (o.cross !== false) {
    main.beamV(p00, p11, tm, colorAt);
    main.beamV(p10, p01, tm, colorAt);
  }
  if (fine && su > 0 && sv > 0 && tf > 0) {
    for (let i = 0; i < su; i++) {
      for (let j = 0; j < sv; j++) {
        const u0 = i / su;
        const u1 = (i + 1) / su;
        const v0 = j / sv;
        const v1 = (j + 1) / sv;
        bil(_bq[0], p00, p10, p11, p01, u0, v0);
        bil(_bq[1], p00, p10, p11, p01, u1, v0);
        bil(_bq[2], p00, p10, p11, p01, u1, v1);
        bil(_bq[3], p00, p10, p11, p01, u0, v1);
        fine.beamV(_bq[0], _bq[2], tf, colorAt);
        fine.beamV(_bq[1], _bq[3], tf, colorAt);
      }
    }
  }
}

/** Roughly square web cells: how many sub-panels fit in w × h. */
export function latticeCells(w, h, target = 2.6) {
  return {
    subU: Math.max(1, Math.min(4, Math.round(w / target))),
    subV: Math.max(1, Math.min(4, Math.round(h / target))),
  };
}

/** Evenly sampled points along a parametric segment (t in [0,1]). */
export function sampleSegment(fn, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(fn(i / n));
  return out;
}
