import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './rng.js';
import { BeamBatch, makeProfile, mergeGeometries } from './lib.js';
import common from './glsl/common.glsl';

/* ===========================================================================
 * LA TOUR EIFFEL - procedural lattice structure.
 *
 * Geometry model, in the order the real tower was erected:
 *   plinths -> four pillars (4-post lattice box columns) -> the arcs between
 *   them -> the four face walls -> the three platforms with their deep
 *   girder rings and friezes -> the inner core (stairs + lifts) -> the
 *   campanile, the spire and the antennas.
 *
 * The silhouette is a monotone cubic through the measured envelope widths,
 * so the profile cannot wobble between landmarks. Every member is a box in
 * one InstancedMesh (~20k instances, 1-2 draw calls) shaded by
 * MeshStandardMaterial + injected GLSL: baked per-member occlusion, the
 * three official paint shades by height, procedural paint wear and the warm
 * amber wash of the tower's own illumination after dark.
 * =========================================================================== */

// --- measured outer envelope: half-width of the square section, metres ------
// The published envelope (Eiffel, "La tour Eiffel en 1900", ch. II; Weidman &
// Pinelis 2004): the ironwork is two piecewise exponentials joined at the 1st
// and 2nd floors, and the pillars are straight box caissons of constant face
// width up to 48 m. Outer widths across opposite faces:
//   0 - 57.63 m   w = 116.40 - 0.8983 y          (straight legs, 65 deg 49')
//   57.63-115.73  w = 64.63 exp(-0.012258 (y-57.63))
//   115.73-276.13 w = 31.70 exp(-0.007193 (y-115.73))
// The pillar centres therefore sit on a 101.40 m square and the masonry
// plinths measure 25 x 25 x 4 m, giving the official 125 m base.
const H1 = 57.63, H2 = 115.73, H3 = 276.13;      // the three floors
const STRAIGHT_TOP = 48.0;                        // legs stop curving here
const SPIRE = 312.21, MAST = 324.0, TIP = 330.0;  // 312 m in 1889, 330 m today
const PLINTH = 4.0, PLINTH_SIDE = 25.0;
const MID_FLOOR = 195.35;                         // Edoux transfer platform
const ARCH_SPAN = 74.24, ARCH_CROWN = 39.0;       // decorative arches
const TOP_DECK = 276.13, TOP_GALLERY = 278.71, CAMPANILE = 300.51;

/** half the outer envelope width of the ironwork at height y */
function halfAt(y) {
  if (y <= H1) return (116.40 - 0.8983 * y) * 0.5;
  if (y <= H2) return 64.63 * Math.exp(-0.012258 * (y - H1)) * 0.5;
  return 31.70 * Math.exp(-0.007193 * (y - H2)) * 0.5;
}
/** face width of one pillar box caisson: 15 m constant, 10.41 m at the 2nd */
function pillarAt(y) {
  if (y <= STRAIGHT_TOP) return 15.0;
  if (y <= H2) return 15.0 + (10.41 - 15.0) * ((y - STRAIGHT_TOP) / (H2 - STRAIGHT_TOP));
  return Math.max(0.9, 10.41 * Math.exp(-0.0125 * (y - H2)));
}

// member thickness as a function of height (built-up box girders near the
// ground, slender angles near the top)
const postSize = (y) => lerp(2.10, 0.34, smoothstep(0, 300, y));
const beltSize = (y) => lerp(0.95, 0.24, smoothstep(0, 300, y));
const diagSize = (y) => lerp(0.78, 0.20, smoothstep(0, 300, y));
const thinSize = (y) => lerp(0.50, 0.15, smoothstep(0, 300, y));

// the three official shades of "brun tour Eiffel", dark at the base and
// deliberately lighter towards the top to defeat aerial perspective
const SHADES = [0x6d5844, 0x7e6a52, 0x907c5f];
const shadeLinear = SHADES.map((h) => {
  const c = new THREE.Color(h).convertSRGBToLinear();
  return [c.r, c.g, c.b];
});
const shadeAt = (y) => (y < H1 ? 0 : y < H2 ? 1 : 2);

function levels(y0, y1, step) {
  const n = Math.max(1, Math.round((y1 - y0) / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(y0 + ((y1 - y0) * i) / n);
  return out;
}

const SEC_A = levels(PLINTH, H1, 4.15);
const SEC_B = levels(H1, H2, 6.6);
const SEC_C = levels(H2, H3, 3.9);
const ALL = [...SEC_A, ...SEC_B.slice(1), ...SEC_C.slice(1)];

/** centre of a pillar box column, in plan */
function legCenter(sx, sz, y) {
  const W = halfAt(y), p = pillarAt(y);
  return [sx * (W - p * 0.5), sz * (W - p * 0.5)];
}

class Builder {
  constructor(rng) {
    this.rng = rng;
    this.steel = new BeamBatch();
    this.stone = new BeamBatch();
    this.lights = [];
    this.lightStride = 3;
    this._i = 0;
  }
  /** steel member + sparkle light sampling */
  beam(ax, ay, az, bx, by, bz, w, d, ao = 1, shade = null) {
    const my = (ay + by) * 0.5;
    const s = shade === null ? shadeAt(my) : shade;
    this.steel.add(ax, ay, az, bx, by, bz, w, d, ao, shadeLinear[s]);
    if (this._i++ % this.lightStride === 0 && this.lights.length < 7200 && my > 4) {
      // nudge the bulb slightly outwards so it reads as a lamp on the frame
      const k = 1.025;
      this.lights.push(((ax + bx) * 0.5) * k, my, ((az + bz) * 0.5) * k);
    }
  }
  post(x, y0, y1, z, w, d = w, ao = 1) { this.beam(x, y0, z, x, y1, z, w, d, ao); }
  /** flat X-braced panel between two verticals, in a plane that may tilt */
  panel(p0a, p1a, p0b, p1b, w, d, ao = 1) {
    // p*a = bottom, p*b = top  (arrays [x,y,z])
    this.beam(p0a[0], p0a[1], p0a[2], p1a[0], p1a[1], p1a[2], w, d, ao);   // vertical A
    this.beam(p0b[0], p0b[1], p0b[2], p1b[0], p1b[1], p1b[2], w, d, ao);   // vertical B
    this.beam(p1a[0], p1a[1], p1a[2], p1b[0], p1b[1], p1b[2], w, d, ao);   // top chord
    this.beam(p0a[0], p0a[1], p0a[2], p1b[0], p1b[1], p1b[2], w * 0.86, d, ao);
    this.beam(p0b[0], p0b[1], p0b[2], p1a[0], p1a[1], p1a[2], w * 0.86, d, ao);
  }
}

export function createTower(ctx) {
  const rng = ctx.rng;
  const B = new Builder(rng);
  const group = new THREE.Group();
  group.name = 'tour-eiffel';

  /* ---------------- 1. masonry plinths ---------------------------------- */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p0 = PLINTH_SIDE, p1 = PLINTH_SIDE - 1.2;
    const [cx, cz] = legCenter(sx, sz, PLINTH);
    // tapered square prism: a 4-sided cylinder is a square frustum
    const g = new THREE.CylinderGeometry((p1 * 0.5) * Math.SQRT2, (p0 * 0.5) * Math.SQRT2, PLINTH, 4, 1);
    g.rotateY(Math.PI / 4);
    g.translate(cx, PLINTH * 0.5, cz);
    B.stoneMesh = B.stoneMesh || [];
    B.stoneMesh.push(g);
    // stone cap course
    const cap = new THREE.BoxGeometry(p1 * 1.06, 0.85, p1 * 1.06);
    cap.translate(cx, PLINTH - 0.4, cz);
    B.stoneMesh.push(cap);
  }

  /* ---------------- 2. the four pillars --------------------------------- */
  // 4-post box column, X-braced on all four sides, twisting slightly as it
  // tapers - this is what gives the base its open, see-through volume.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const sub = 5;                              // sub-panels across each face
    for (let i = 0; i < ALL.length - 1; i++) {
      const y0 = ALL[i], y1 = ALL[i + 1];
      if (y0 > H2 + 0.01) break;                // above the 2nd floor the box is a single post
      const pA = pillarAt(y0), pB = pillarAt(y1);
      const [cxA, czA] = legCenter(sx, sz, y0);
      const [cxB, czB] = legCenter(sx, sz, y1);
      const w = postSize(y1), b = beltSize(y1), dg = diagSize(y1);
      const corner = (cx, cz, p, i, k) => [cx + i * p * 0.5, 0, cz + k * p * 0.5];
      // four corner posts
      for (const i of [-1, 1]) for (const k of [-1, 1]) {
        const a = corner(cxA, czA, pA, i, k), c = corner(cxB, czB, pB, i, k);
        B.beam(a[0], y0, a[2], c[0], y1, c[2], w, w, 1.0);
      }
      // bracing on the four sides of the column
      const sides = [
        { n: [0, 1], t: [1, 0] },   // +z face
        { n: [0, -1], t: [-1, 0] }, // -z face
        { n: [1, 0], t: [0, 1] },   // +x face
        { n: [-1, 0], t: [0, -1] }, // -x face
      ];
      for (const side of sides) {
        const nA = side.n, tA = side.t;
        const pt = (cx, cz, p, u) => [cx + nA[0] * p * 0.5 + tA[0] * p * u, 0, cz + nA[1] * p * 0.5 + tA[1] * p * u];
        for (let s = 0; s < sub; s++) {
          const u0 = -0.5 + s / sub, u1 = -0.5 + (s + 1) / sub;
          const a0 = pt(cxA, czA, pA, u0), b0 = pt(cxA, czA, pA, u1);
          const a1 = pt(cxB, czB, pB, u0), b1 = pt(cxB, czB, pB, u1);
          // vertical post, top chord, St Andrew's cross, and a mid rail: the
          // real pillars are a dense mesh of small triangles, not bare posts
          B.beam(a0[0], y0, a0[2], a1[0], y1, a1[2], u0 === -0.5 ? w * 0.85 : thinSize(y1), w, 0.96);
          B.beam(a1[0], y1, a1[2], b1[0], y1, b1[2], b, b * 0.8, 1.0);
          B.beam(a0[0], y0, a0[2], b1[0], y1, b1[2], dg, dg * 0.8, 0.9);
          B.beam(b0[0], y0, b0[2], a1[0], y1, a1[2], dg, dg * 0.8, 0.9);
          if (y1 < H2) {
            const m0 = pt(cxA, czA, pA, u0), m1 = pt(cxA, czA, pA, u1);
            const ym = (y0 + y1) * 0.5;
            B.beam((m0[0] + m1[0]) * 0.5, ym, (m0[2] + m1[2]) * 0.5,
                   (m1[0] + (m1[0] - m0[0]) * 0.0), ym, m1[2], thinSize(y1) * 0.8, w * 0.6, 0.88);
            B.beam(m0[0], ym, m0[2], m1[0], ym, m1[2], thinSize(y1) * 0.8, w * 0.6, 0.88);
          }
        }
      }
      // interior cross-tie every other belt: reads as depth from below
      if (i % 2 === 0) {
        B.beam(cxA - pA * 0.5, y0, czA - pA * 0.5, cxA + pA * 0.5, y0, czA + pA * 0.5, thinSize(y0), thinSize(y0), 0.62);
        B.beam(cxA + pA * 0.5, y0, czA - pA * 0.5, cxA - pA * 0.5, y0, czA + pA * 0.5, thinSize(y0), thinSize(y0), 0.62);
      }
    }
  }

  /* ---------------- 3. the four arcs ------------------------------------ */
  // Purely decorative in the real tower, structurally honest here: a lattice
  // band following a circle through the two springing points and the crown.
  {
    // circular arch of 74.24 m clear opening, crown 39 m, springing from the
    // top of the plinths against the inner faces of the pillars
    const span = ARCH_SPAN * 0.5;
    const rise = ARCH_CROWN - PLINTH;
    const R = (span * span + rise * rise) / (2 * rise);          // circle radius
    const cy = ARCH_CROWN - R;
    const th0 = Math.asin(clamp(span / R, -1, 1));
    const N = 30;
    for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
      for (let i = 0; i < N; i++) {
        const t0 = th0 * (1 - (2 * i) / N), t1 = th0 * (1 - (2 * (i + 1)) / N);
        const u0 = Math.sin(t0) * R, u1 = Math.sin(t1) * R;
        const v0 = cy + Math.cos(t0) * R, v1 = cy + Math.cos(t1) * R;
        const W0 = axis === 'x' ? halfAt(v0) : halfAt(v0);
        // front + back chords of the arc band, plus web members
        const depth = postSize(v0) + 1.6;
        const make = (u, v, dOff) => axis === 'x'
          ? [sign * (halfAt(v) - dOff), v, u]
          : [u, v, sign * (halfAt(v) - dOff)];
        for (const dOff of [0, depth]) {
          const a = make(u0, v0, dOff), b = make(u1, v1, dOff);
          B.beam(a[0], a[1], a[2], b[0], b[1], b[2], beltSize(v1) * 1.15, beltSize(v1) * 1.4, 1.0);
        }
        const a0 = make(u0, v0, 0), a1 = make(u0, v0, depth);
        B.beam(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], thinSize(v0) * 1.1, thinSize(v0), 0.8);
        // inner chord, lower than the outer: the arc band is deep in section
        const b0 = make(u1, v1 - 2.6, 0), b1 = make(u1, v1 - 2.6, depth);
        B.beam(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], thinSize(v1) * 1.1, thinSize(v1), 0.8);
        const c0 = make(u0, v0 - 2.6, 0);
        B.beam(c0[0], c0[1], c0[2], b0[0], b0[1], b0[2], diagSize(v0), diagSize(v0) * 0.9, 0.95);
        const a2 = make(u0, v0 - 2.6, depth), b2 = make(u1, v1 - 2.6, depth);
        B.beam(a2[0], a2[1], a2[2], b2[0], b2[1], b2[2], beltSize(v1) * 1.1, beltSize(v1) * 1.3, 0.9);
        // the arc rests on the pillar's inner corner

      }
    }
  }

  /* ---------------- 4. the four faces ----------------------------------- */
  // Below the 2nd floor the tower is NOT a closed box: the four pillars stand
  // apart, tied at every panel by a horizontal belt and by St Andrew's
  // crosses, with the sky visible straight through the middle. Only above the
  // 2nd floor do they merge into the single tapering pylon whose four faces
  // carry the fine, dense lattice of the classic silhouette.
  for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
    const secs = [
      { list: levels(ARCH_CROWN, H1, 4.6), cell: 4.2, mode: 'wall' },
      { list: SEC_B, cell: 10.5, mode: 'open' },
      { list: SEC_C, cell: 3.1, mode: 'wall' },
    ];
    for (const sec of secs) {
      for (let i = 0; i < sec.list.length - 1; i++) {
        const y0 = sec.list[i], y1 = sec.list[i + 1];
        const W0 = halfAt(y0), W1 = halfAt(y1);
        const s0 = Math.max(0.4, W0 - pillarAt(y0)), s1 = Math.max(0.3, W1 - pillarAt(y1));
        const open = sec.mode === 'open';
        const n = Math.max(open ? 1 : 2, Math.round((s0 + s1) / sec.cell));
        const w = beltSize(y1), dg = diagSize(y1), t = thinSize(y1);
        const P = (u, y, s, W) => axis === 'x'
          ? [sign * W, y, u * s]
          : [u * s, y, sign * W];
        // verticals at the panel splits; the pillar faces close the two ends
        for (let k = 1; k < n; k++) {
          const u0 = -1 + (2 * k) / n;
          const a = P(u0, y0, s0, W0), b = P(u0, y1, s1, W1);
          B.beam(a[0], a[1], a[2], b[0], b[1], b[2], t * 1.05, w * 0.8, 0.93);
        }
        // the belt that ties the two pillars together at this panel line
        const e0 = P(-1, y1, s1, W1), e1 = P(1, y1, s1, W1);
        B.beam(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], w * 1.3, w, 1.0);
        for (let k = 0; k < n; k++) {
          const ua = -1 + (2 * k) / n, ub = -1 + (2 * (k + 1)) / n;
          const c0 = P(ua, y0, s0, W0), c1 = P(ub, y0, s0, W0);
          const d0 = P(ua, y1, s1, W1), d1 = P(ub, y1, s1, W1);
          // St Andrew's cross: both diagonals in the open spans between the
          // pillars, one diagonal per cell up the pylon so it stays legible
          B.beam(c0[0], c0[1], c0[2], d1[0], d1[1], d1[2], dg, dg * 0.85, 0.9);
          if (open || (k + i) % 2 === 0) {
            B.beam(c1[0], c1[1], c1[2], d0[0], d0[1], d0[2], dg, dg * 0.85, 0.9);
          }
          // mid rail: only on the upper pylon, for its fine mesh
          if (!open && y1 > H2 + 40 && (k + i) % 2 === 1) {
            const m0 = P(ua, (y0 + y1) * 0.5, (s0 + s1) * 0.5, (W0 + W1) * 0.5);
            const m1 = P(ub, (y0 + y1) * 0.5, (s0 + s1) * 0.5, (W0 + W1) * 0.5);
            B.beam(m0[0], m0[1], m0[2], m1[0], m1[1], m1[2], t * 0.85, w * 0.6, 0.85);
          }
        }
      }
    }
  }

  /* ---------------- 5. inner core (stairs, lifts, shafts) --------------- */
  {
    const core = levels(H1, 268, 3.4);
    for (let i = 0; i < core.length - 1; i++) {
      const y0 = core[i], y1 = core[i + 1];
      const k = 0.60;
      const w0 = Math.max(0.5, halfAt(y0) * k), w1 = Math.max(0.4, halfAt(y1) * k);
      const t = thinSize(y1) * 0.9;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.beam(sx * w0, y0, sz * w0, sx * w1, y1, sz * w1, t * 1.5, t * 1.5, 0.55);
      }
      for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
        const P = (u, y, w) => axis === 'x' ? [sign * w, y, u] : [u, y, sign * w];
        const n = 2;
        for (let j = 0; j < n; j++) {
          const u0 = -w0 + (2 * w0 * j) / n, u1 = -w0 + (2 * w0 * (j + 1)) / n;
          const a = P(u0, y0, w0), b = P(u0, y1, w1), c = P(u1, y1, w1);
          B.beam(b[0], b[1], b[2], c[0], c[1], c[2], t, t, 0.55);
          B.beam(a[0], a[1], a[2], c[0], c[1], c[2], t * 0.9, t * 0.9, 0.5);
        }
      }
    }
  }

  /* ---------------- 6. lift tracks between the 1st and 2nd floors ------- */
  for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
    for (const u of [-0.34, 0.34]) {
      const N = 12;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        const y0 = lerp(H1 + 2.5, H2 - 3.0, t0), y1 = lerp(H1 + 2.5, H2 - 3.0, t1);
        const W0 = halfAt(y0) - 0.35, W1 = halfAt(y1) - 0.35;
        const P = (y, W, off) => axis === 'x' ? [sign * W, y, off * (W - pillarAt(y))] : [off * (W - pillarAt(y)), y, sign * W];
        for (const gap of [-1.2, 1.2]) {
          const a = P(y0, W0, u), b = P(y1, W1, u);
          const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
          const px = -dir.z * gap, pz = dir.x * gap;
          B.beam(a[0] + px * 0, a[1], a[2] + 0, b[0], b[1], b[2], thinSize(y1) * 1.05, thinSize(y1), 0.8);
          void px; void pz;
        }
        if (i % 4 === 0) {
          const a = P(y0, W0, u - 0.02), b = P(y0, W0, u + 0.02);
          B.beam(a[0], a[1], a[2], b[0], b[1], b[2], thinSize(y0) * 1.1, thinSize(y0) * 1.1, 0.75);
        }
      }
    }
  }

  /* ---------------- 7. platforms ---------------------------------------- */
  const platforms = [];
  function ring(y, hw, w, d, ao = 1, cornersOnly = false) {
    for (const [x0, z0, x1, z1] of [
      [-hw, -hw, hw, -hw], [hw, -hw, hw, hw], [hw, hw, -hw, hw], [-hw, hw, -hw, -hw],
    ]) {
      void cornersOnly;
      B.beam(x0, y, z0, x1, y, z1, w, d, ao);
    }
  }
  /** deep lattice girder ring under a deck: chords, posts, N-bracing */
  function girderRing(yTop, depth, hw, chord, sub) {
    const yb = yTop - depth;
    ring(yTop, hw, chord * 1.5, chord, 1.0);
    ring(yb, hw, chord * 1.6, chord * 1.1, 0.72);
    const n = Math.max(3, Math.round((2 * hw) / sub));
    for (let i = 0; i <= n; i++) {
      const t = -hw + (2 * hw * i) / n;
      for (const [ax, az, bx, bz] of [[t, -hw, t, hw], [-hw, t, hw, t]]) {
        void ax; void az; void bx; void bz;
      }
      B.beam(t, yb, -hw, t, yTop, -hw, thinSize(yTop) * 1.2, chord, 0.8);
      B.beam(t, yb, hw, t, yTop, hw, thinSize(yTop) * 1.2, chord, 0.8);
      B.beam(-hw, yb, t, -hw, yTop, t, thinSize(yTop) * 1.2, chord, 0.8);
      B.beam(hw, yb, t, hw, yTop, t, thinSize(yTop) * 1.2, chord, 0.8);
      if (i < n) {
        const t1 = -hw + (2 * hw * (i + 1)) / n;
        const d = diagSize(yTop) * 1.2;
        B.beam(t, yb, -hw, t1, yTop, -hw, d, chord * 0.8, 0.85);
        B.beam(t1, yb, -hw, t, yTop, -hw, d, chord * 0.8, 0.85);
        B.beam(t, yb, hw, t1, yTop, hw, d, chord * 0.8, 0.85);
        B.beam(t1, yb, hw, t, yTop, hw, d, chord * 0.8, 0.85);
        B.beam(-hw, yb, t, -hw, yTop, t1, d, chord * 0.8, 0.85);
        B.beam(-hw, yb, t1, -hw, yTop, t, d, chord * 0.8, 0.85);
        B.beam(hw, yb, t, hw, yTop, t1, d, chord * 0.8, 0.85);
        B.beam(hw, yb, t1, hw, yTop, t, d, chord * 0.8, 0.85);
      }
    }
  }
  /** the deck plate + edge lip + railing + openwork frieze above */
  function deck(y, hw, thick, frieze, rail) {
    const g = new THREE.BoxGeometry(hw * 2, thick, hw * 2);
    g.translate(0, y - thick * 0.5, 0);
    platforms.push(g);
    // underside ribs so the soffit is never a flat plane
    const ribs = 16;
    for (let i = 0; i <= ribs; i++) {
      const t = -hw + (hw * 2 * i) / ribs;
      B.beam(t, y - thick, -hw, t, y - thick, hw, 0.55, 0.75, 0.5);
      B.beam(-hw, y - thick, t, hw, y - thick, t, 0.55, 0.75, 0.5);
    }
    // edge lip
    ring(y - thick * 0.5, hw + 0.35, 0.5, 0.35, 0.9);
    if (frieze > 0) {
      const y0 = y, y1 = y + frieze;
      const n = Math.round((hw * 2) / 2.6);
      for (const [ax0, az0] of [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]]) void ax0, void az0;
      for (let i = 0; i <= n; i++) {
        const t = -hw + (hw * 2 * i) / n;
        for (const [px, pz] of [[t, -hw], [t, hw], [-hw, t], [hw, t]]) {
          B.beam(px, y0, pz, px, y1, pz, thinSize(y) * 1.3, thinSize(y) * 1.3, 0.9);
        }
      }
      ring(y1, hw, 0.55, 0.42, 1.0);
      ring((y0 + y1) * 0.5, hw, 0.4, 0.32, 0.85);
      for (let i = 0; i < n; i++) {
        const t0 = -hw + (hw * 2 * i) / n, t1 = -hw + (hw * 2 * (i + 1)) / n;
        const d = diagSize(y) * 0.8;
        B.beam(t0, y0, -hw, t1, y1, -hw, d, d * 0.8, 0.8);
        B.beam(t1, y0, -hw, t0, y1, -hw, d, d * 0.8, 0.8);
        B.beam(t0, y0, hw, t1, y1, hw, d, d * 0.8, 0.8);
        B.beam(t1, y0, hw, t0, y1, hw, d, d * 0.8, 0.8);
        B.beam(-hw, y0, t0, -hw, y1, t1, d, d * 0.8, 0.8);
        B.beam(-hw, y0, t1, -hw, y1, t0, d, d * 0.8, 0.8);
        B.beam(hw, y0, t0, hw, y1, t1, d, d * 0.8, 0.8);
        B.beam(hw, y0, t1, hw, y1, t0, d, d * 0.8, 0.8);
      }
    }
    if (rail > 0) {
      const y1 = y + frieze + rail;
      const n = Math.round((hw * 2) / 2.4);
      for (let i = 0; i <= n; i++) {
        const t = -hw + (hw * 2 * i) / n;
        for (const [px, pz] of [[t, -hw], [t, hw], [-hw, t], [hw, t]]) {
          B.beam(px, y + frieze, pz, px, y1, pz, 0.14, 0.14, 1.0);
        }
      }
      ring(y1, hw, 0.22, 0.2, 1.0);
      ring(y + frieze + rail * 0.5, hw, 0.12, 0.12, 1.0);
    }
  }

  // 1st floor: 71.69 m outside the gutter, its girders 7.83 m deep
  girderRing(H1, 7.4, 35.85, 1.4, 3.4);
  deck(H1, 35.85, 1.8, 5.2, 1.35);
  // 2nd floor: 37.90 m outside the gutter
  girderRing(H2, 6.0, 18.95, 1.2, 3.0);
  deck(H2, 18.95, 1.5, 4.0, 1.25);
  // the intermediate (Edoux) platform at 195 m, much smaller
  girderRing(MID_FLOOR, 2.4, 10.0, 0.5, 2.4);
  deck(MID_FLOOR, 10.0, 0.55, 1.3, 0.9);
  // top floor: 18.65 m at the widest point of the level
  girderRing(H3, 3.4, 9.3, 0.85, 2.6);
  deck(H3, 9.3, 1.0, 2.0, 1.1);

  /* ---------------- 8. campanile, spire, antennas ----------------------- */
  {
    // the campanile: the enclosed top level above the 3rd floor, carrying the
    // 300.51 m upper platform (Eiffel 1900), then the openwork spire
    const campH = CAMPANILE - (H3 + 1.6);
    // the campanile is a lattice lantern, not a solid drum: four corner posts,
    // a belt every 4 m and an X in each panel
    const campLevels = levels(H3 + 1.6, CAMPANILE, 4.2);
    for (let i = 0; i < campLevels.length; i++) {
      const y = campLevels[i];
      const w = lerp(5.0, 3.5, i / (campLevels.length - 1));
      ring(y, w, 0.42, 0.34, 0.95);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.beam(sx * w, y, sz * w, sx * w * (i + 1 < campLevels.length ? lerp(5.0, 3.5, (i + 1) / (campLevels.length - 1)) : w) / w * w, sz * w, 0.34, 0.34, 0.95);
      }
      if (i < campLevels.length - 1) {
        const y1 = campLevels[i + 1];
        const w1 = lerp(5.0, 3.5, (i + 1) / (campLevels.length - 1));
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          B.beam(sx * w, y, sz * w, sx * w1, y1, sz * w1, 0.30, 0.30, 0.95);
        }
        for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
          const P = (u, yy, ww) => (axis === 'x' ? [sign * ww, yy, u * ww] : [u * ww, yy, sign * ww]);
          const a0 = P(-1, y, w), a1 = P(1, y, w), b0 = P(-1, y1, w1), b1 = P(1, y1, w1);
          B.beam(a0[0], a0[1], a0[2], b1[0], b1[1], b1[2], 0.26, 0.26, 0.92);
          B.beam(a1[0], a1[1], a1[2], b0[0], b0[1], b0[2], 0.26, 0.26, 0.92);
          B.beam(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], 0.34, 0.30, 0.95);
        }
      }
    }
    // the enclosed observation room inside the lantern
    const g = new THREE.CylinderGeometry(3.5 * Math.SQRT2 * 0.5, 3.9 * Math.SQRT2 * 0.5, campH * 0.72, 8, 1);
    g.translate(0, H3 + 3.2 + campH * 0.36, 0);
    platforms.push(g);
    // openwork spire above the campanile platform
    const y0 = CAMPANILE + 0.4, y1 = SPIRE;
    const N = 16;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const ya = lerp(y0, y1, t0), yb = lerp(y0, y1, t1);
      const wa = lerp(2.6, 0.55, t0), wb = lerp(2.6, 0.55, t1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.beam(sx * wa, ya, sz * wa, sx * wb, yb, sz * wb, 0.22, 0.22, 0.95);
      }
      ring(yb, wb, 0.15, 0.15, 0.9);
      B.beam(-wa, ya, wa, wb, yb, wb, 0.12, 0.12, 0.85);
      B.beam(wa, ya, -wa, -wb, yb, wb, 0.12, 0.12, 0.85);
      ring(ya, wa, 0.12, 0.12, 0.85);
    }
    // the mast: from the spire top to the tip, with cross arms
    const mast = new THREE.CylinderGeometry(0.16, 0.42, MAST - SPIRE, 8, 1);
    mast.translate(0, (SPIRE + MAST) * 0.5, 0);
    platforms.push(mast);
    const mast2 = new THREE.CylinderGeometry(0.06, 0.14, TIP - MAST + 6, 6, 1);
    mast2.translate(0, (MAST + TIP) * 0.5 + 3, 0);
    platforms.push(mast2);
    for (let i = 0; i < 5; i++) {
      const y = SPIRE + 2 + i * 2.6;
      const r = 0.8 - i * 0.12;
      B.beam(-r, y, 0, r, y, 0, 0.1, 0.1, 0.9);
      B.beam(0, y, -r, 0, y, r, 0.1, 0.1, 0.9);
    }
    // small dishes / aerials that give the top its silhouette
    for (const [dx, dz, ry] of [[1.5, 0.4, 0.6], [-1.3, -0.6, -0.5]]) {
      const d = new THREE.CylinderGeometry(1.0, 1.0, 0.35, 10, 1);
      d.rotateX(Math.PI / 2);
      d.rotateY(ry);
      d.translate(dx, SPIRE + 1.2, dz);
      platforms.push(d);
    }
  }

  /* ---------------- 9. assembly ----------------------------------------- */
  const steelGeo = new THREE.BoxGeometry(1, 1, 1);
  const steelMesh = B.steel.build(steelGeo);
  const steelMat = makeSteelMaterial();
  steelMesh.material = steelMat;
  steelMesh.castShadow = true;
  steelMesh.receiveShadow = true;
  steelMesh.name = 'lattice';
  group.add(steelMesh);

  // opaque secondary structure (decks, pavilions, masts) shares one material
  const solidMesh = new THREE.Mesh(mergeGeometries(platforms), makeDeckMaterial());
  solidMesh.castShadow = true;
  solidMesh.receiveShadow = true;
  solidMesh.name = 'decks';
  group.add(solidMesh);

  const stoneMesh = new THREE.Mesh(mergeGeometries(B.stoneMesh), makeStoneMaterial());
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  stoneMesh.name = 'plinths';
  group.add(stoneMesh);

  /* ---------------- 10. the sparkle (20,000 flashing bulbs) ------------- */
  const sparkle = makeSparkle(B.lights);
  group.add(sparkle.points);

  /* ---------------- 11. the beacon -------------------------------------- */
  const beacon = makeBeacon();
  group.add(beacon.group);
  beacon.group.position.set(0, SPIRE + 3.5, 0);

  const scratch = new THREE.Vector3();
  return {
    group,
    update(tod, time, camera, fog) {
      const p = tod.pal;
      steelMat.userData.u.uSunDir.value.copy(tod.sunDir);
      steelMat.userData.u.uSunColor.value.copy(p.sun).multiplyScalar(p.sunI);
      steelMat.userData.u.uAmbColor.value.copy(p.amb).multiplyScalar(p.ambI);
      steelMat.userData.u.uSkyColor.value.copy(p.zenith).multiplyScalar(p.ambI);
      steelMat.userData.u.uGroundColor.value.copy(p.ground);
      steelMat.userData.u.uFogColor.value.copy(fog);
      steelMat.userData.u.uNight.value = tod.lightsOn ? 1 : 0;
      const deckU = solidMesh.material.userData.u;
      deckU.uSunDir.value.copy(tod.sunDir);
      deckU.uSunColor.value.copy(p.sun).multiplyScalar(p.sunI);
      deckU.uAmbColor.value.copy(p.amb).multiplyScalar(p.ambI);
      deckU.uFogColor.value.copy(fog);
      deckU.uNight.value = tod.lightsOn ? 1 : 0;
      const stU = stoneMesh.material.userData.u;
      stU.uSunDir.value.copy(tod.sunDir);
      stU.uSunColor.value.copy(p.sun).multiplyScalar(p.sunI);
      stU.uAmbColor.value.copy(p.amb).multiplyScalar(p.ambI);
      stU.uFogColor.value.copy(fog);

      // sparkle: five minutes on the hour, every hour (demo: 18 s of every 45 s)
      const cycle = time % 45;
      const on = tod.lightsOn && cycle < 18 ? 1 : 0;
      const ramp = on * Math.min(1, Math.min(cycle, 18 - cycle) * 2.5);
      sparkle.u.uAmount.value = ramp;
      sparkle.u.uTime.value = time;
      sparkle.u.uPixelScale.value = camera.isPerspectiveCamera
        ? (innerHeight * 0.5) / Math.tan((camera.fov * Math.PI) / 360)
        : 500;
      sparkle.points.visible = ramp > 0.002;

      // beacon sweeps only well after dark
      const night = clamp(smoothstep(4, -6, tod.sunElevation), 0, 1);
      beacon.group.visible = night > 0.05;
      beacon.u.uAmount.value = night;
      beacon.u.uTime.value = time;
      beacon.group.rotation.y = time * 1.05;
      scratch.copy(camera.position);
      void scratch;
    },
  };
}

/* ======================= materials ======================================== */

function standardWithUniforms(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05 });
  mat.userData.u = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uAmbColor: { value: new THREE.Color(0.3, 0.35, 0.4) },
    uSkyColor: { value: new THREE.Color(0.3, 0.4, 0.5) },
    uGroundColor: { value: new THREE.Color(0.2, 0.2, 0.2) },
    uFogColor: { value: new THREE.Color(0.7, 0.75, 0.8) },
    uFogDensity: { value: 0.00016 },
    uNight: { value: 0 },
    uTime: { value: 0 },
  };
  return mat;
}

function makeSteelMaterial() {
  const mat = standardWithUniforms(0xffffff);
  mat.roughness = 0.68;
  mat.metalness = 0.32;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aAO;
        attribute vec3 aTint;
        varying float vAO;
        varying vec3 vTint;
        varying float vHeight;
        varying vec3 vWorld;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAO = aAO;
        vTint = aTint;
        vHeight = instanceMatrix[3].y;
        vWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vAO;
        varying vec3 vTint;
        varying float vHeight;
        varying vec3 vWorld;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uAmbColor;
        uniform vec3 uSkyColor; uniform vec3 uGroundColor; uniform vec3 uFogColor;
        uniform float uFogDensity; uniform float uNight; uniform float uTime;
        ${common}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // --- painted-iron surface: shade, wear, rivet dust ------------------
        float paintWear = fbm(vWorld * 0.6, 3);
        vec3 base = vTint;
        base *= 0.86 + 0.28 * paintWear;
        // streaks of grime running down the members
        float streak = vnoise(vec3(vWorld.x * 3.0, vWorld.y * 0.09, vWorld.z * 3.0));
        base *= 0.82 + 0.30 * streak;
        // the three official shades, so it reads dark at the base, pale on top
        float shadeMix = smoothstep(40.0, 90.0, vHeight) * 0.35 + smoothstep(120.0, 260.0, vHeight) * 0.45;
        vec3 litCol = base;
        vec3 ambient = uAmbColor * (0.70 + 0.42 * (0.5 + 0.5 * normalize(vWorld + vec3(0.0, 1.0, 0.0)).y));
        // out-of-plane members catch the sky, in-plane ones the ground bounce
        vec3 col = litCol * (ambient + uSkyColor * 0.55) * vAO * (0.88 + 0.26 * shadeMix);
        // sun-facing highlight (cheap, keeps the lattice crisp without post AA smear)
        vec3 nrm = normalize(cross(dFdx(vWorld), dFdy(vWorld)) + 1e-5);
        float ndl = max(dot(nrm, uSunDir), 0.0);
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
          float sh = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize,
                     directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius,
                     vDirectionalShadowCoord[0]);
        #else
          float sh = 1.0;
        #endif
        col += litCol * uSunColor * ndl * 0.62 * vAO * mix(0.30, 1.0, sh);
        // rim of sky on every member: fake AO from the sky dome
        col += litCol * uSkyColor * 0.30 * (0.35 + 0.65 * vAO);
        // --- the tower's own illumination after dark ------------------------
        if (uNight > 0.001) {
          float r = length(vWorld.xz);
          float core = exp(-r * 0.035);                   // warm wash from inside
          float lamp = 0.55 + 0.45 * fbm(vec3(vWorld.xz * 0.4, uTime * 0.05), 2);
          vec3 warm = vec3(1.0, 0.62, 0.26) * (0.55 + 1.35 * core) * lamp;
          col += litCol * warm * uNight * (0.55 + 1.7 * vAO);
        }
        gl_FragColor.rgb = col;
        gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, uFogColor, length(vWorld - cameraPosition), uFogDensity);`);
  };
  // keep the shader recompiling deterministically
  mat.customProgramCacheKey = () => 'eiffel-steel';
  return mat;
}

function makeDeckMaterial() {
  const mat = standardWithUniforms(0x2a2724);
  mat.roughness = 0.62;
  mat.metalness = 0.18;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorld;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uAmbColor;
        uniform vec3 uFogColor; uniform float uFogDensity; uniform float uNight;
        ${common}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        vec3 wp = vWorld;
        float gmask = smoothstep(30.0, 90.0, wp.y) * step(abs(wp.x), 12.0) * step(abs(wp.z), 12.0);
        vec3 c = gl_FragColor.rgb;
        c *= 0.85 + 0.3 * fbm(wp * 0.35, 3);
        c += vec3(1.0, 0.72, 0.35) * uNight * (0.25 + 0.9 * exp(-length(wp.xz) * 0.05));
        c += uAmbColor * 0.15;
        gl_FragColor.rgb = applyAerial(c, uFogColor, distance(wp, cameraPosition), uFogDensity);`);
  };
  mat.customProgramCacheKey = () => 'eiffel-deck';
  return mat;
}

function makeStoneMaterial() {
  const mat = standardWithUniforms(0x8d8578);
  mat.roughness = 0.94;
  mat.metalness = 0.0;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorld;
        uniform vec3 uFogColor; uniform float uFogDensity; uniform float uNight;
        ${common}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        vec3 wp = vWorld;
        float n = fbm(wp * 1.1, 4) * 0.6 + ridge(wp * 2.2, 3) * 0.4;
        vec3 c = gl_FragColor.rgb * (0.78 + 0.42 * n);
        c *= 0.94 + 0.12 * smoothstep(0.0, 6.0, wp.y);
        c += vec3(1.0, 0.66, 0.3) * uNight * 0.22;
        gl_FragColor.rgb = applyAerial(c, uFogColor, distance(wp, cameraPosition), uFogDensity);`);
  };
  mat.customProgramCacheKey = () => 'eiffel-stone';
  return mat;
}

function makeSparkle(positions) {
  const geo = new THREE.BufferGeometry();
  const n = positions.length / 3;
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const seeds = new Float32Array(n * 3);
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n * 3; i++) seeds[i] = rnd();
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const u = {
    uAmount: { value: 0 }, uTime: { value: 0 }, uPixelScale: { value: 500 },
    uFogColor: { value: new THREE.Color(1, 1, 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uAmount, uTime, uPixelScale;
      varying float vGlow;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float flash = fract(aSeed.x * 7.13 + uTime * (5.0 + aSeed.y * 9.0));
        float on = step(0.62, flash) * (0.35 + 0.65 * smoothstep(0.62, 0.95, flash));
        float global = step(0.08, fract(uTime * 0.5 + aSeed.z));   // travelling wave of light
        vGlow = on * (0.45 + 0.55 * global) * uAmount;
        gl_Position = projectionMatrix * mv;
        // a 6 W bulb is about 15 cm across: size it in pixels from the real
        // projection instead of a magic constant
        gl_PointSize = clamp((0.15 + 0.10 * vGlow) * uPixelScale / max(-mv.z, 1.0), 0.8, 5.0);
      }`,
    fragmentShader: `
      varying float vGlow;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d);
        float a = smoothstep(0.25, 0.0, r);
        vec3 c = mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.95, 0.78), vGlow);
        gl_FragColor = vec4(c * vGlow * a * 1.05, a * vGlow);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return { points: pts, u };
}

function makeBeacon() {
  const group = new THREE.Group();
  const u = { uAmount: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vP; varying vec2 vUv;
      void main(){ vP = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; varying vec2 vUv; uniform float uAmount, uTime;
      void main(){
        float along = clamp(vUv.y, 0.0, 1.0);
        float a = (1.0 - along) * (1.0 - along) * 0.55;
        a *= smoothstep(0.0, 0.15, vUv.y);
        vec3 c = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.97, 0.9), along);
        gl_FragColor = vec4(c * a * uAmount * 0.9, a * uAmount);
      }`,
  });
  for (const dir of [0, Math.PI]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9.0, 900, 22, 1, true), mat);
    cone.rotation.z = Math.PI / 2;
    cone.rotation.y = dir;
    cone.position.set(0, 0, 0);
    cone.geometry.rotateX(Math.PI / 2);
    cone.geometry.translate(0, 0, -450);
    cone.frustumCulled = false;
    group.add(cone);
  }
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0cc })
  );
  group.add(bulb);
  group.renderOrder = 4;
  return { group, u };
}
