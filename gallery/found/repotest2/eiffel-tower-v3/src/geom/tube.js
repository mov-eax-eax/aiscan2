/**
 * tube.js — lofted tubes from rings of points.
 *
 * The workhorse geometry primitive for this model: every structural element is a
 * section swept along a run of stations. three's own `ExtrudeGeometry` with
 * `extrudePath` CANNOT taper (one cap triangulation is reused at every station —
 * verified in the r186 source), so this is hand-rolled.
 *
 * Convention matches three's own: a section's local +x maps to the frame NORMAL
 * and +y to the BINORMAL, so results are interchangeable with extrudePath output.
 */

import * as THREE from 'three';

/**
 * Build a tube from rings.
 * @param {THREE.Vector3[][]} rings  each ring has the SAME number of points
 * @param {object} opts
 *   closed   — connect the last ring back to the first (a torus-like loop)
 *   capStart — fan-cap the first ring
 *   capEnd   — fan-cap the last ring
 *   flip     — invert winding (rarely needed; normals are computed, not assumed)
 */
export function tubeFromRings(rings, opts = {}) {
  const { closed = false, capStart = false, capEnd = false } = opts;
  if (!rings.length || rings[0].length < 3) return new THREE.BufferGeometry();

  const n = rings[0].length;
  for (const r of rings) {
    if (r.length !== n) throw new Error('tubeFromRings: all rings must have the same point count');
  }

  const pos = [];
  const idx = [];
  const segs = closed ? rings.length : rings.length - 1;

  // weld the last ring to the first if closed
  const at = (i) => rings[i % rings.length];

  for (let s = 0; s <= segs; s++) {
    const r = at(s);
    for (let k = 0; k < n; k++) pos.push(r[k].x, r[k].y, r[k].z);
  }

  for (let s = 0; s < segs; s++) {
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const a = s * n + k, b = s * n + k2;
      const c = (s + 1) * n + k2, d = (s + 1) * n + k;
      // consistent winding throughout — three's asymmetric branch can silently
      // invert holes, so we never rely on it
      idx.push(a, b, c, a, c, d);
    }
  }

  const vertexCount = pos.length / 3;
  if (capStart) addCap(rings[0], true, pos, idx, vertexCount);
  if (capEnd) addCap(at(segs), false, pos, idx, pos.length / 3);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();

  // Orientation check. Whether the winding above comes out facing outward depends
  // on the frame handedness and the ring's point order, and getting it wrong is
  // invisible in code but glaring on screen: the member renders as a black
  // silhouette lit only along its grazing edges. So don't reason about it — measure it.
  //
  // Sample a MIDDLE ring, not ring 0: the end rings' vertices also belong to the
  // caps, so computeVertexNormals averages a cap normal into them and the test
  // passes whichever way the sides actually face. A middle ring is pure side.
  const skip = rings.length > 2 ? 1 : 0;
  fixOrientation(g, rings[skip], skip * rings[0].length);
  return g;
}

/** Flip normals AND reverse winding together if the surface faces inward. */
function fixOrientation(g, ring, offset) {
  const nrm = g.attributes.normal;
  const pos = g.attributes.position;
  if (!nrm || !pos) return;

  let cx = 0, cy = 0, cz = 0;
  ring.forEach(p => { cx += p.x; cy += p.y; cz += p.z; });
  cx /= ring.length; cy /= ring.length; cz /= ring.length;

  let dot = 0;
  for (let k = 0; k < ring.length; k++) {
    const i = offset + k;
    dot += nrm.getX(i) * (pos.getX(i) - cx)
         + nrm.getY(i) * (pos.getY(i) - cy)
         + nrm.getZ(i) * (pos.getZ(i) - cz);
  }
  if (dot >= 0) return;                       // already outward

  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  nrm.needsUpdate = true;
  const a = g.index.array;
  for (let t = 0; t + 2 < a.length; t += 3) { const tmp = a[t + 1]; a[t + 1] = a[t + 2]; a[t + 2] = tmp; }
  g.index.needsUpdate = true;
}

function addCap(ring, start, pos, idx, base) {
  const n = ring.length;
  const c = new THREE.Vector3();
  ring.forEach(p => c.add(p));
  c.multiplyScalar(1 / n);
  pos.push(c.x, c.y, c.z);
  const centre = base;
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    if (start) idx.push(centre, base + 1 + k2, base + 1 + k);
    else idx.push(centre, base + 1 + k, base + 1 + k2);
  }
}

/**
 * A square section centred on `c`, in the plane normal to `t`, of side `w`
 * (optionally `d` in the other direction), rolled so its faces stay parallel to
 * the tower's faces.
 */
export function squareRing(c, t, w, d = w, roll = 0) {
  // frame: keep the section axis-aligned in world XZ where possible
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3().crossVectors(up, t);
  if (n.lengthSq() < 1e-9) n.set(1, 0, 0);           // vertical member
  n.normalize();
  const b = new THREE.Vector3().crossVectors(t, n).normalize();
  const cs = Math.cos(roll), sn = Math.sin(roll);
  const hx = w / 2, hy = d / 2;
  return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([x, y]) => {
    const rx = x * cs - y * sn, ry = x * sn + y * cs;
    return c.clone().addScaledVector(n, rx).addScaledVector(b, ry);
  });
}

/** Sweep a square section along a polyline of {p, w, d} stations. */
export function sweptSquare(stations, roll = 0) {
  const rings = stations.map((s, i) => {
    const a = stations[Math.max(0, i - 1)].p, b = stations[Math.min(stations.length - 1, i + 1)].p;
    const t = new THREE.Vector3().subVectors(b, a);
    if (t.lengthSq() < 1e-12) t.set(0, 1, 0);
    t.normalize();
    return squareRing(s.p, t, s.w, s.d ?? s.w, roll);
  });
  return tubeFromRings(rings, { capStart: true, capEnd: true });
}
