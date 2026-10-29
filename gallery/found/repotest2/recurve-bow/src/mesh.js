/* ============================================================================
   recurve-bow / src/mesh.js  --  the geometry kernel

   Pure JavaScript. No three.js, no DOM, no globals.  That is deliberate: it
   means src/verify.js can build every single part in bare Node and check that
   each one is a closed, correctly wound, positive-volume solid.  The renderer
   only ever sees the result.

   A mesh here is just { pos: number[], idx: number[] } in inches, plus an
   optional parallel `nor: number[]`.  Builders never worry about winding:
   every part is passed through orient() at the end, which measures the signed
   volume and flips the triangles if the normals came out inward.  That single
   trick removes the most common class of silent geometry bug.
   ========================================================================== */

export const mk = () => ({ pos: [], idx: [] });

/* ------------------------------------------------------------------ misc --- */

export function merge(list) {
  const out = mk();
  for (const m of list) {
    if (!m || !m.idx.length) continue;
    const base = out.pos.length / 3;
    for (let i = 0; i < m.pos.length; i++) out.pos.push(m.pos[i]);
    for (let i = 0; i < m.idx.length; i++) out.idx.push(m.idx[i] + base);
  }
  return out;
}

export function clone(m) {
  const out = { pos: m.pos.slice(), idx: m.idx.slice() };
  if (m.nor) out.nor = m.nor.slice();
  return out;
}

export function flip(m) {
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t + 1]; m.idx[t + 1] = m.idx[t + 2]; m.idx[t + 2] = a;
  }
  if (m.nor) for (let i = 0; i < m.nor.length; i++) m.nor[i] = -m.nor[i];
  return m;
}

export function bounds(m) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = m.pos[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

export function centroid(m) {
  let x = 0, y = 0, z = 0;
  const n = m.pos.length / 3 || 1;
  for (let i = 0; i < m.pos.length; i += 3) { x += m.pos[i]; y += m.pos[i + 1]; z += m.pos[i + 2]; }
  return [x / n, y / n, z / n];
}

/* signed volume by the divergence theorem -- exact for a closed mesh, and it
   is also how we detect an inside-out part. */
export function volume(m) {
  let v = 0;
  const p = m.pos, x = m.idx;
  for (let t = 0; t < x.length; t += 3) {
    const a = x[t] * 3, b = x[t + 1] * 3, c = x[t + 2] * 3;
    const ax = p[a], ay = p[a + 1], az = p[a + 2];
    const bx = p[b], by = p[b + 1], bz = p[b + 2];
    const cx = p[c], cy = p[c + 1], cz = p[c + 2];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

export function orient(m) {
  if (volume(m) < 0) flip(m);
  return m;
}

/* Every edge of a closed orientable surface must be shared by exactly two
   triangles.  Returns the number of edges that are not. */
export function openEdges(m, eps = 1e-6) {
  const key = new Map();
  const q = 1 / eps;
  const id = v => Math.round(m.pos[v * 3] * q) + '|' + Math.round(m.pos[v * 3 + 1] * q) + '|' + Math.round(m.pos[v * 3 + 2] * q);
  const seen = [];
  for (let t = 0; t < m.idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = id(m.idx[t + k]), b = id(m.idx[t + (k + 1) % 3]);
      const k1 = a < b ? a + '>' + b : b + '>' + a;
      const n = (key.get(k1) || 0) + 1;
      key.set(k1, n);
    }
  }
  let bad = 0;
  for (const n of key.values()) if (n !== 2) bad++;
  return bad;
}

export function hasNaN(m) {
  for (let i = 0; i < m.pos.length; i++) if (!Number.isFinite(m.pos[i])) return true;
  return false;
}

/* ------------------------------------------------------------- welding --- */

/* Collapses coincident vertices and drops the degenerate triangles that
   revolutions around an axis inevitably produce at r = 0. */
export function weld(m, eps = 1e-5) {
  const q = 1 / eps, key = new Map(), remap = new Int32Array(m.pos.length / 3);
  const out = mk();
  for (let v = 0; v < m.pos.length / 3; v++) {
    const k = Math.round(m.pos[v * 3] * q) + '|' + Math.round(m.pos[v * 3 + 1] * q) + '|' + Math.round(m.pos[v * 3 + 2] * q);
    let n = key.get(k);
    if (n === undefined) {
      n = out.pos.length / 3; key.set(k, n);
      out.pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
    }
    remap[v] = n;
  }
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = remap[m.idx[t]], b = remap[m.idx[t + 1]], c = remap[m.idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    out.idx.push(a, b, c);
  }
  return out;
}

export function dropDegenerate(m) {
  const out = mk();
  for (let i = 0; i < m.pos.length; i++) out.pos.push(m.pos[i]);
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3;
    const ux = m.pos[b] - m.pos[a], uy = m.pos[b + 1] - m.pos[a + 1], uz = m.pos[b + 2] - m.pos[a + 2];
    const vx = m.pos[c] - m.pos[a], vy = m.pos[c + 1] - m.pos[a + 1], vz = m.pos[c + 2] - m.pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-18) continue;
    out.idx.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]);
  }
  return out;
}

/* ------------------------------------------------------------ transforms --- */

/* M is a row-major 4x4.  Normals get the inverse transpose so that
   non-uniform scaling (a squashed bushing, a flattened vane) stays correct. */
export function transform(m, M) {
  const out = mk();
  for (let i = 0; i < m.pos.length; i += 3) {
    const x = m.pos[i], y = m.pos[i + 1], z = m.pos[i + 2];
    out.pos.push(
      M[0] * x + M[1] * y + M[2] * z + M[3],
      M[4] * x + M[5] * y + M[6] * z + M[7],
      M[8] * x + M[9] * y + M[10] * z + M[11]);
  }
  for (let i = 0; i < m.idx.length; i++) out.idx.push(m.idx[i]);
  if (m.nor) {
    const N = inverseTranspose3(M);
    const nn = [];
    for (let i = 0; i < m.nor.length; i += 3) {
      const x = m.nor[i], y = m.nor[i + 1], z = m.nor[i + 2];
      let a = N[0] * x + N[1] * y + N[2] * z;
      let b = N[3] * x + N[4] * y + N[5] * z;
      let c = N[6] * x + N[7] * y + N[8] * z;
      const l = Math.hypot(a, b, c) || 1;
      nn.push(a / l, b / l, c / l);
    }
    out.nor = nn;
  }
  return out;
}

function inverseTranspose3(M) {
  const a = M[0], b = M[1], c = M[2], d = M[4], e = M[5], f = M[6], g = M[8], h = M[9], i = M[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-12;
  // inverse of the 3x3, then transpose  =>  adjugate / det (already transposed)
  return [A / det, B / det, C / det,
          -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det,
          (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det];
}

export function mat4({ t = [0, 0, 0], axis = [0, 0, 1], angle = 0, s = 1 } = {}) {
  const sc = Array.isArray(s) ? s : [s, s, s];
  const [ax, ay, az] = axis;
  const l = Math.hypot(ax, ay, az) || 1;
  const x = ax / l, y = ay / l, z = az / l;
  const ct = Math.cos(angle), st = Math.sin(angle), t1 = 1 - ct;
  const R = [
    t1 * x * x + ct,     t1 * x * y - st * z, t1 * x * z + st * y,
    t1 * x * y + st * z, t1 * y * y + ct,     t1 * y * z - st * x,
    t1 * x * z - st * y, t1 * y * z + st * x, t1 * z * z + ct,
  ];
  return [
    R[0] * sc[0], R[1] * sc[1], R[2] * sc[2], t[0],
    R[3] * sc[0], R[4] * sc[1], R[5] * sc[2], t[1],
    R[6] * sc[0], R[7] * sc[1], R[8] * sc[2], t[2],
    0, 0, 0, 1,
  ];
}

/* ---------------------------------------------------------------- lofting --- */

/* rings: array of rings, each ring an array of [x,y,z].
   ringClosed  the points of a ring form a loop (a solid section)
   loopClosed  the last ring joins back to the first (a revolution)
   capStart/End  fan-cap the ends (only meaningful for closed rings) */
export function loft(rings, { ringClosed = true, loopClosed = false, capStart = false, capEnd = false } = {}) {
  const out = mk();
  const R = rings.length, N = rings[0].length;
  for (const r of rings) for (const p of r) out.pos.push(p[0], p[1], p[2]);
  const nRings = loopClosed ? R : R - 1;
  const nSeg = ringClosed ? N : N - 1;
  for (let i = 0; i < nRings; i++) {
    const a = i * N, b = ((i + 1) % R) * N;
    for (let j = 0; j < nSeg; j++) {
      const j1 = (j + 1) % N;
      out.idx.push(a + j, a + j1, b + j1, a + j, b + j1, b + j);
    }
  }
  if (ringClosed && !loopClosed) {
    if (capStart) capRing(out, rings[0], rings[1], 0);
    if (capEnd) capRing(out, rings[R - 1], rings[R - 2], (R - 1) * N);
  }
  return out;
}

/* Cap a ring by EAR CLIPPING its own outline.

   The obvious implementation -- fan the ring from its centroid -- is only
   correct for a CONVEX section, and silently produces overlapping triangles
   for anything else. The grip has finger scallops and the limb pocket has a
   dovetail mortise, so both are deeply concave; a centroid fan turned the
   grip into a starburst and still passed the manifold check, because the
   triangles were topologically fine and only geometrically nonsense. */
function capRing(out, ring, neighbour, base) {
  const N = ring.length;
  let cx = 0, cy = 0, cz = 0, nx2 = 0, ny2 = 0, nz2 = 0;
  for (let i = 0; i < N; i++) {
    const a = ring[i], b = ring[(i + 1) % N];
    cx += a[0]; cy += a[1]; cz += a[2];
    nx2 += (a[1] - b[1]) * (a[2] + b[2]);
    ny2 += (a[2] - b[2]) * (a[0] + b[0]);
    nz2 += (a[0] - b[0]) * (a[1] + b[1]);
  }
  cx /= N; cy /= N; cz /= N;
  let nl = Math.hypot(nx2, ny2, nz2) || 1;
  const nrm = [nx2 / nl, ny2 / nl, nz2 / nl];
  let ref = Math.abs(nrm[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(nrm, ref));
  const v = cross(nrm, u);

  /* Clean the projected outline, but keep a MAP back to the original ring
     vertices. Ear clipping returns indices into the polygon it was handed,
     so dropping a duplicate point without remapping silently rewires every
     triangle after it -- which is how the riser body's volume came out at
     0.16 in^3 instead of 34.4 while still looking perfectly fine. */
  const raw = ring.map(p => [dot(sub(p, [cx, cy, cz]), u), dot(sub(p, [cx, cy, cz]), v)]);
  const poly = [], map = [];
  for (let i = 0; i < raw.length; i++) {
    const last = poly[poly.length - 1];
    if (last && Math.hypot(raw[i][0] - last[0], raw[i][1] - last[1]) < 2e-4) continue;
    poly.push(raw[i]); map.push(i);
  }
  while (poly.length > 1 &&
    Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 2e-4) {
    poly.pop(); map.pop();
  }
  const tris = earClip(poly);
  if (!tris.length) return;

  /* outward direction for this cap: away from the neighbouring ring */
  const outward = norm(sub([cx, cy, cz], centroidOf(neighbour)));

  const start = out.idx.length;
  for (let t = 0; t < tris.length; t += 3) {
    out.idx.push(base + map[tris[t]], base + map[tris[t + 1]], base + map[tris[t + 2]]);
  }
  /* orient every cap triangle against the sweep direction.  The sense is
     opposite to the side quads' winding -- measured, not reasoned about: a
     2x2x2 test box lofts to -2.67 with the obvious sign and exactly -8 with
     this one, and -8 is the volume of a 2x2x2 box. */
  for (let k = start; k < out.idx.length; k += 3) {
    const a = out.idx[k] * 3, b = out.idx[k + 1] * 3, c = out.idx[k + 2] * 3;
    const ux = out.pos[b] - out.pos[a], uy = out.pos[b + 1] - out.pos[a + 1], uz = out.pos[b + 2] - out.pos[a + 2];
    const vx = out.pos[c] - out.pos[a], vy = out.pos[c + 1] - out.pos[a + 1], vz = out.pos[c + 2] - out.pos[a + 2];
    const tx = uy * vz - uz * vy, ty = uz * vx - ux * vz, tz = ux * vy - uy * vx;
    if (tx * outward[0] + ty * outward[1] + tz * outward[2] > 0) {
      const tmp = out.idx[k + 1]; out.idx[k + 1] = out.idx[k + 2]; out.idx[k + 2] = tmp;
    }
  }
}

function centroidOf(ring) {
  let x = 0, y = 0, z = 0;
  for (const p of ring) { x += p[0]; y += p[1]; z += p[2]; }
  const n = ring.length || 1;
  return [x / n, y / n, z / n];
}

/* ---------------------------------------------------------------- shapes --- */

/* Rounded rectangle as a closed polyline, counter-clockwise in (a,b).
   n per corner must be >= 1; the straight edges fall out between corners. */
export function roundedRect(hw, hh, r, n = 6) {
  r = Math.max(0, Math.min(r, hw * 0.995, hh * 0.995));
  const pts = [];
  const corners = [
    [hw - r, -hh + r, -Math.PI / 2, 0],
    [hw - r, hh - r, 0, Math.PI / 2],
    [-hw + r, hh - r, Math.PI / 2, Math.PI],
    [-hw + r, -hh + r, Math.PI, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let k = 0; k <= n; k++) {
      const a = a0 + (a1 - a0) * (k / n);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

/* 2-D convex hull (Andrew monotone chain).  Returns the hull in CCW order. */
export function hull2(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  lo.pop(); hi.pop();
  return lo.concat(hi);
}

/* Ear-clipping triangulation of a simple polygon, concave allowed.
   Returns a flat index list into the polygon's own vertices. */
export function earClip(poly) {
  const n = poly.length;
  if (n < 3) return [];
  const area = signedArea(poly);
  const idx = poly.map((_, i) => i);
  if (area < 0) idx.reverse();
  const tris = [];
  const pt = i => poly[idx[i]];
  const inside = (a, b, c, p) => {
    const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const d2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
    const d3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
    return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
  };
  let guard = 0, i = 0;
  while (idx.length > 3 && guard++ < n * n + 64) {
    const i0 = i % idx.length, i1 = (i + 1) % idx.length, i2 = (i + 2) % idx.length;
    const a = pt(i0), b = pt(i1), c = pt(i2);
    const convex = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
    if (!convex) { i++; continue; }
    let clean = true;
    for (let k = 0; k < idx.length && clean; k++) {
      if (k === i0 || k === i1 || k === i2) continue;
      const p = pt(k);
      if (Math.abs(p[0] - a[0]) < 1e-9 && Math.abs(p[1] - a[1]) < 1e-9) continue;
      if (inside(a, b, c, p)) clean = false;
    }
    if (!clean) { i++; continue; }
    tris.push(idx[i0], idx[i1], idx[i2]);
    idx.splice(i1, 1);
    i = 0;
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  return tris;
}

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/* Extrude a closed 2-D polygon along one axis.
   plane 'yz' -> polygon is [z,y] and the extrusion runs along x
   plane 'xy' -> polygon is [x,y] and the extrusion runs along z
   plane 'xz' -> polygon is [x,z] and the extrusion runs along y
   This is the workhorse for every plate, bracket, blade and mortise, because
   a constant cross-section part should never be built as a loft. */
export function extrude(poly, d0, d1, plane = 'yz') {
  const out = mk();
  const n = poly.length;
  const put = (p, d) => plane === 'yz' ? [d, p[1], p[0]]
    : plane === 'xy' ? [p[0], p[1], d]
      : [p[0], d, p[1]];
  for (const p of poly) out.pos.push(...put(p, d0));
  for (const p of poly) out.pos.push(...put(p, d1));
  const tris = earClip(poly);
  for (let i = 0; i < tris.length; i += 3) {
    out.idx.push(tris[i], tris[i + 1], tris[i + 2]);              // far cap
    out.idx.push(n + tris[i + 2], n + tris[i + 1], n + tris[i]);  // near cap
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.idx.push(i, n + i, n + j, i, n + j, j);
  }
  return out;
}

/* Rounded-rect profile as [a,b] for extrude(). */
export function roundedRectPoly(hw, hh, r, n = 5) { return roundedRect(hw, hh, r, n); }

/* ------------------------------------------------------------ revolution --- */

/* profile: CLOSED 2-D polyline in [r, h], revolved about the h axis.
   Use weld() afterwards: profiles that touch r = 0 make degenerate poles. */
export function revolve(profile, segs = 48, axis = 'y') {
  const rings = [];
  const at = (r, h, a) => {
    const c = Math.cos(a) * r, s = Math.sin(a) * r;
    return axis === 'y' ? [c, h, s] : axis === 'z' ? [c, s, h] : [h, c, s];
  };
  for (let k = 0; k < segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    rings.push(profile.map(([r, h]) => at(r, h, a)));
  }
  return weld(loft(rings, { ringClosed: true, loopClosed: true }));
}

/* A cylinder / tapered rod along y, capped. */
export function rod(len, r0, r1, segs = 24, cap = true) {
  const rings = [];
  for (let i = 0; i <= 1; i++) {
    const r = i ? r1 : r0;
    const ring = [];
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      ring.push([Math.cos(a) * r, i * len, Math.sin(a) * r]);
    }
    rings.push(ring);
  }
  return loft(rings, { ringClosed: true, capStart: cap, capEnd: cap });
}

/* Sweep a circular tube along a 3-D polyline using parallel-transport frames,
   which never flips and never gimbals.  Used for the string, cables, rods. */
export function tube(path, radius, segs = 10, opts = {}) {
  const n = path.length;
  const pts = path.map(p => Array.isArray(p) ? p.slice() : [p[0], p[1], p[2]]);
  const rad = typeof radius === 'function' ? radius : () => radius;
  const tans = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(...t) || 1;
    tans.push([t[0] / l, t[1] / l, t[2] / l]);
  }
  let ref = [0, 0, 1];
  if (Math.abs(dot(tans[0], ref)) > 0.9) ref = [1, 0, 0];
  let nrm = norm(cross(tans[0], ref));
  const rings = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) nrm = norm(sub(nrm, scale(tans[i], dot(nrm, tans[i]))));
    const bin = cross(tans[i], nrm);
    const r = rad(i / (n - 1), i);
    const ring = [];
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      const c = Math.cos(a) * r, s = Math.sin(a) * r;
      ring.push([
        pts[i][0] + nrm[0] * c + bin[0] * s,
        pts[i][1] + nrm[1] * c + bin[1] * s,
        pts[i][2] + nrm[2] * c + bin[2] * s]);
    }
    rings.push(ring);
  }
  return loft(rings, { ringClosed: true, capStart: opts.cap !== false, capEnd: opts.cap !== false });
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* ------------------------------------------------------------------ normals --- */

/* Crease-aware normals.  Vertices are split wherever the angle between two
   touching faces exceeds `angleDeg`, so a machined riser keeps crisp edges
   while its fillets stay smooth -- without any per-part special casing.
   Returns a NEW mesh carrying `nor`. */
export function creaseNormals(m, angleDeg = 34) {
  const tri = m.idx.length / 3;
  const fn = new Float64Array(tri * 3);
  for (let t = 0; t < tri; t++) {
    const a = m.idx[t * 3] * 3, b = m.idx[t * 3 + 1] * 3, c = m.idx[t * 3 + 2] * 3;
    const ux = m.pos[b] - m.pos[a], uy = m.pos[b + 1] - m.pos[a + 1], uz = m.pos[b + 2] - m.pos[a + 2];
    const vx = m.pos[c] - m.pos[a], vy = m.pos[c + 1] - m.pos[a + 1], vz = m.pos[c + 2] - m.pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l;
  }
  const inc = new Map();
  for (let t = 0; t < tri; t++) for (let k = 0; k < 3; k++) {
    const v = m.idx[t * 3 + k];
    let a = inc.get(v); if (!a) { a = []; inc.set(v, a); }
    a.push(t);
  }
  const cosT = Math.cos(angleDeg * Math.PI / 180);
  const out = { pos: [], idx: [], nor: [] };
  const vGroup = new Map();       // vertex -> Map(triangle -> new vertex)
  for (const [v, tris] of inc) {
    const done = new Set();
    const perTri = new Map();
    for (const seed of tris) {
      if (done.has(seed)) continue;
      /* every face within the crease angle of the seed joins this group; the
         group normal is their mean, so a fillet shades smoothly while the
         flat next to it keeps its own hard edge. */
      const nx = fn[seed * 3], ny = fn[seed * 3 + 1], nz = fn[seed * 3 + 2];
      const group = [];
      let sx = 0, sy = 0, sz = 0;
      for (const t2 of tris) {
        if (done.has(t2)) continue;
        if (fn[t2 * 3] * nx + fn[t2 * 3 + 1] * ny + fn[t2 * 3 + 2] * nz < cosT) continue;
        done.add(t2);
        group.push(t2);
        sx += fn[t2 * 3]; sy += fn[t2 * 3 + 1]; sz += fn[t2 * 3 + 2];
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      const ni = out.pos.length / 3;
      out.pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
      out.nor.push(sx / l, sy / l, sz / l);
      for (const t2 of group) perTri.set(t2, ni);
    }
    vGroup.set(v, perTri);
  }
  for (let t = 0; t < tri; t++) {
    const g0 = vGroup.get(m.idx[t * 3]).get(t);
    const g1 = vGroup.get(m.idx[t * 3 + 1]).get(t);
    const g2 = vGroup.get(m.idx[t * 3 + 2]).get(t);
    out.idx.push(g0 === undefined ? 0 : g0, g1 === undefined ? 0 : g1, g2 === undefined ? 0 : g2);
  }
  return out;
}

/* --------------------------------------------------------------- finishing --- */

/* Every part goes through this: weld, drop junk, fix winding, shade, report. */
export function finish(m, { angle = 34, eps = 1e-5 } = {}) {
  let out = weld(dropDegenerate(m), eps);
  out = orient(out);
  out = creaseNormals(out, angle);
  out.volume = volume(out);
  out.openEdges = openEdges(out);
  return out;
}

/* ------------------------------------------------- machined-part helpers --- */

/* Rounds the corners of an arbitrary closed polygon, in place of the corner
   vertex, with an arc.  This is what gives every bracket, pocket and blade in
   this model a machined edge break without a single boolean operation. */
export function polyRound(pts, radius, n = 4) {
  const src = cleanPoly(pts);
  const N = src.length;
  const R = Array.isArray(radius) ? radius : new Array(N).fill(radius);
  const out = [];
  const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const len2 = a => Math.hypot(a[0], a[1]) || 1;
  for (let i = 0; i < N; i++) {
    const p = src[(i - 1 + N) % N], v = src[i], q = src[(i + 1) % N];
    if (R[i] <= 1e-9) { out.push(v.slice()); continue; }
    const d1 = sub2(p, v), d2 = sub2(q, v);
    const l1 = len2(d1), l2 = len2(d2);
    const u1 = [d1[0] / l1, d1[1] / l1], u2 = [d2[0] / l2, d2[1] / l2];
    const cosA = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]));
    const half = Math.acos(cosA) / 2;
    if (!(half > 1e-4)) { out.push(v.slice()); continue; }
    const t = Math.min(R[i] / Math.tan(half), l1 * 0.5, l2 * 0.5);
    const r = t * Math.tan(half);
    const bis = [u1[0] + u2[0], u1[1] + u2[1]];
    const bl = len2(bis);
    const cen = [v[0] + (bis[0] / bl) * (r / Math.sin(half)), v[1] + (bis[1] / bl) * (r / Math.sin(half))];
    const a0 = Math.atan2(v[1] + u1[1] * t - cen[1], v[0] + u1[0] * t - cen[0]);
    const a1 = Math.atan2(v[1] + u2[1] * t - cen[1], v[0] + u2[0] * t - cen[0]);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 0; k <= n; k++) {
      const a = a0 + d * (k / n);
      out.push([cen[0] + r * Math.cos(a), cen[1] + r * Math.sin(a)]);
    }
  }
  return cleanPoly(out);
}

/* Drop consecutive near-duplicate vertices. Two things depend on this:
   ear clipping cannot triangulate a polygon with repeated points, and a
   rounded corner on a very short edge produces exactly that. */
export function cleanPoly(poly, eps = 2e-4) {
  const out = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < eps) continue;
    out.push(p);
  }
  while (out.length > 1 &&
    Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < eps) out.pop();
  return out;
}

/* 4x4 that carries +y onto `dir` and then to `pos`. */
export function alignTo(pos, dir, spin = 0) {
  const d = norm(dir);
  let axis = cross([0, 1, 0], d);
  let angle = Math.acos(Math.max(-1, Math.min(1, d[1])));
  let M;
  if (Math.hypot(...axis) < 1e-9) {
    M = d[1] > 0 ? mat4({ t: pos }) : mat4({ t: pos, axis: [1, 0, 0], angle: Math.PI });
  } else {
    M = mat4({ t: pos, axis, angle });
  }
  if (spin) M = mul4(mat4({ axis: d, angle: spin }), M);
  return M;
}

export function mul4(A, B) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += A[r * 4 + k] * B[k * 4 + c];
    o[r * 4 + c] = s;
  }
  return o;
}

/* Extrude with a slight crown on the two end faces, so a constant-section
   machined block does not end in two razor-flat walls. */
export function extrudeBeveled(poly, d0, d1, plane = 'yz', bevel = 0.04, steps = 3) {
  const cz = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const put = (p, d, s) => {
    const a = cz + (p[0] - cz) * s, b = cy + (p[1] - cy) * s;
    return plane === 'yz' ? [d, b, a] : plane === 'xy' ? [a, b, d] : [a, d, b];
  };
  const span = d1 - d0;
  const bv = Math.min(bevel, 0.45);
  const rings = [];
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    const s = 1 - bv * (1 - Math.sin(u * Math.PI));   // full size in the middle
    rings.push(poly.map(p => put(p, d0 + span * u, s)));
  }
  return loft(rings, { ringClosed: true, capStart: true, capEnd: true });
}

export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub, dot, cross, scale, norm,
  len: a => Math.hypot(...a),
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
