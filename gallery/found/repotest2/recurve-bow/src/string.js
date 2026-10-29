/* ============================================================================
   recurve-bow / src/string.js

   The string is not modelled as "two lines from the nock to the tips". It is
   the TAUT CORD around the limbs, computed as a convex hull of the two tips
   and the belly surfaces.

   That single choice buys the whole recurve mechanism for free: at brace the
   hull lies flat along the straight string groove (so the string visibly sits
   down inside the limb), and as the bow is drawn the groove rotates away and
   the contact point migrates outboard until the string lifts clear. Nobody
   scripts that. It is what a taut cord does.
   ========================================================================== */

import * as M from './mesh.js';
import { STRING } from './param.js';

/* 2-D (z, y) taut path between the two tips, optionally via a nock point. */
export function tautPath(bellyUpper, bellyLower, nock = null) {
  const tipU = bellyUpper[bellyUpper.length - 1];
  const tipL = bellyLower[bellyLower.length - 1];
  const pts = bellyUpper.concat(bellyLower);
  if (nock) pts.push(nock);
  const h = M.hull2(pts);
  if (h.length < 3) return { path: [tipU, tipL], hull: h };

  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  let iu = 0, il = 0, bestU = Infinity, bestL = Infinity;
  for (let i = 0; i < h.length; i++) {
    const du = near(h[i], tipU), dl = near(h[i], tipL);
    if (du < bestU) { bestU = du; iu = i; }
    if (dl < bestL) { bestL = dl; il = i; }
  }
  const walk = dir => {
    const out = [];
    let i = iu;
    for (let guard = 0; guard <= h.length; guard++) {
      out.push(h[i]);
      if (i === il) break;
      i = (i + dir + h.length) % h.length;
    }
    return out;
  };
  const A = walk(1), B = walk(-1);
  let path;
  if (nock) {
    /* Distance must be measured to the chain's SEGMENTS, not its vertices.
       At brace the nock lies exactly on the long straight run of the string,
       so it is not a hull vertex at all -- a vertex-distance test would then
       reject the correct chain by thirty inches. */
    path = chainDistance(A, nock) <= chainDistance(B, nock) ? A : B;
  } else {
    const zA = A.reduce((a, p) => a + p[0], 0) / A.length;
    const zB = B.reduce((a, p) => a + p[0], 0) / B.length;
    path = zA >= zB ? A : B;
  }
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9;
  if (!same(path[0], tipU)) path.reverse();
  return { path, hull: h, tipU, tipL };
}

function chainDistance(chain, p) {
  let d = Infinity;
  for (let k = 0; k < chain.length - 1; k++) d = Math.min(d, segDist(p, chain[k], chain[k + 1]));
  return d;
}

export function pathLength(path) {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return L;
}

/* Where does the string leave the limb?  Reported as a fraction of limb arc
   length, which is the number an archer actually watches: it walks outboard
   as the bow is drawn and the recurve unrolls. */
export function contactFraction(belly, path) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < belly.length; i++) {
    let d = Infinity;
    for (let k = 1; k < path.length; k++) d = Math.min(d, segDist(belly[i], path[k - 1], path[k]));
    if (d < bestD - 1e-9) { bestD = d; best = i; }
  }
  return { s: best / (belly.length - 1), dist: bestD };
}

function segDist(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const L2 = vx * vx + vy * vy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / L2)) : 0;
  return Math.hypot(wx - vx * t, wy - vy * t);
}

/* ------------------------------------------------------------- the mesh --- */

/* The physical string that would be ordered for this bow: 16 strands, served
   at both ends and through the middle, with a nocking point. */
export function stringMesh(path, nockIndex = -1) {
  const p3 = path.map(p => [0, p[1], p[0]]);
  /* split the polyline at its corners so the tube does not round them off */
  const dense = [];
  for (let i = 0; i < p3.length - 1; i++) {
    const a = p3[i], b = p3[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.45));
    for (let k = 0; k < n; k++) dense.push([
      a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n]);
  }
  dense.push(p3[p3.length - 1]);

  const total = pathLength(path);
  let run = 0;
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    run += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1], dense[i][2] - dense[i - 1][2]);
    cum.push(run);
  }
  const half = STRING.centreLen / 2;
  const mid = total / 2;
  const radius = (t, i) => {
    const d = Math.abs(cum[i] - mid);
    if (d < half) return STRING.centreDia / 2;          // centre serving
    if (d < half + 0.22) {
      const u = (d - half) / 0.22;
      return (STRING.centreDia / 2) * (1 - u) + (STRING.legDia / 2) * u;
    }
    return STRING.legDia / 2;
  };
  return M.tube(dense, radius, 8);
}

/* End loop: the served eye that wraps the limb tip. */
export function endLoop(tip, theta, sign) {
  const nz = Math.cos(theta), ny = -Math.sin(theta);
  const b = 0.098;
  const centre = [0, tip[1] + ny * b, tip[0] + nz * b];
  const major = 0.185, minor = STRING.dia / 2;
  const prof = [];
  const N = 14;
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    prof.push([major + minor * Math.cos(a), minor * Math.sin(a)]);
  }
  const t = M.revolve(prof, 26, 'y');
  return M.transform(t, M.alignTo(centre, [1, 0, 0]));
}

/* Nocking point: the brass nocks that pin the arrow onto the string. Built as
   a proper torus -- profiling them as a tube with a hair-thin bore leaves the
   solid open where the bore collapses. */
export function nockSet(point, nockAbove) {
  const parts = [];
  const Rc = 0.110, rt = 0.058;
  const prof = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    prof.push([Rc + rt * Math.cos(a), rt * Math.sin(a)]);
  }
  for (const dy of [nockAbove, nockAbove - 0.130]) {
    parts.push(M.transform(M.revolve(prof, 26, 'y'),
      M.mat4({ t: [0, point[1] + dy, point[0]], axis: [1, 0, 0], angle: Math.PI / 2 })));
  }
  return M.merge(parts);
}

export function silencers(path, total) {
  const parts = [];
  for (const s of [STRING.silencer.from, STRING.silencer.to]) {
    for (const sign of [1, -1]) {
      const target = total / 2 + sign * s;
      let run = 0;
      for (let i = 1; i < path.length; i++) {
        const seg = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        if (run + seg >= target) {
          const t = (target - run) / seg;
          const z = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t;
          const y = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t;
          const r = STRING.silencer.dia / 2;
          /* a HALF disc in (r,h), closed along the axis by the implicit last
             edge. Sweeping a full circle would put two identical points at
             the start and end of the profile and leave the solid open. */
          const prof = [];
          const N = 14;
          for (let k = 0; k <= N; k++) {
            const a = -Math.PI / 2 + (k / N) * Math.PI;
            prof.push([Math.max(0.0002, r * Math.cos(a)), r * Math.sin(a)]);
          }
          parts.push(M.transform(M.revolve(prof, 22, 'y'), M.mat4({ t: [0, y, z] })));
          break;
        }
        run += seg;
      }
    }
  }
  return M.merge(parts);
}
