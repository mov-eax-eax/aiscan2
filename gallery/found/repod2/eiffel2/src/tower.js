import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './rng.js';
import { BeamBatch, mergeGeometries } from './lib.js';
import common from './glsl/common.glsl';
import {
  halfWidth, pillarHalf, beltsBetween, DECKS,
  H1, H2, H3, MID, PLINTH, ARCH_CROWN, ARCH_SPAN,
  CAMPANILE_TOP, SPIRE_TOP, TIP,
} from './profile.js';

/* ===========================================================================
 * LA TOUR EIFFEL - built to Eiffel's own "Diagramme de l'Elevation".
 *
 * The hierarchy is the drawing's, not an invention:
 *   - four pillar box caissons, each a 4-post column with X-braced faces,
 *     whose inner faces leave the clear opening the sheet dimensions
 *     (82.487 m at 6 m, 71.427 at 16, 60.368 at 24, 49.309 at 39)
 *   - horizontal belt girders at every panel line the sheet numbers
 *   - the four faces BELOW the 2nd floor are open: one St Andrew's cross
 *     spanning the whole opening per panel, so you see straight through
 *   - the four faces ABOVE the 2nd floor are single-bay X-braced panels
 *     between the corner posts, exactly as drawn on panels 13-24
 *   - the 74.24 m arch, the three decks, the Edoux platform at 195.35 m,
 *     the campanile and the spire
 * =========================================================================== */

const SHADES = [0x6a5340, 0x7d6549, 0x917a58];       // the three painted tones
const shadeLinear = SHADES.map((h) => {
  const c = new THREE.Color(h).convertSRGBToLinear();
  return [c.r, c.g, c.b];
});
const shadeAt = (y) => (y < H1 ? 0 : y < H2 ? 1 : 2);

// member sizes: built-up box girders at the base, slender angles on top
const postW = (y) => lerp(2.75, 0.34, smoothstep(0, 290, y));
const beltW = (y) => lerp(1.30, 0.24, smoothstep(0, 290, y));
const diagW = (y) => lerp(1.15, 0.22, smoothstep(0, 290, y));
const railW = (y) => lerp(0.60, 0.14, smoothstep(0, 290, y));

/** outer face of the structure: the drawing measures to the member surface */
const Wenv = (y) => halfWidth(y) - postW(y) * 0.45;

/** centre of a pillar box caisson in plan */
function legCentre(sx, sz, y) {
  const W = Wenv(y), p = pillarHalf(y);
  return [sx * (W - p), sz * (W - p)];
}

class Builder {
  constructor() {
    this.steel = new BeamBatch();
    this.lights = [];
    this._i = 0;
  }
  add(a, b, w, d, ao = 1) {
    const my = (a[1] + b[1]) * 0.5;
    this.steel.add(a[0], a[1], a[2], b[0], b[1], b[2], w, d, ao, shadeLinear[shadeAt(my)]);
    if (this._i++ % 4 === 0 && this.lights.length < 6400 && my > 5) {
      const k = 1.02;
      this.lights.push(((a[0] + b[0]) * 0.5) * k, my, ((a[2] + b[2]) * 0.5) * k);
    }
  }
}

export function createTower(ctx) {
  const B = new Builder();
  const group = new THREE.Group();
  group.name = 'tour-eiffel';
  const decks = [];
  const stone = [];

  /* ---------------- 1. masonry plinths (25 x 25 x 4 m) ------------------ */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [cx, cz] = legCentre(sx, sz, 0);
    const g = new THREE.CylinderGeometry(12.0 * Math.SQRT1_2, 13.4 * Math.SQRT1_2, PLINTH, 4, 1);
    g.rotateY(Math.PI / 4); g.translate(cx, PLINTH * 0.5, cz);
    stone.push(g);
    const cap = new THREE.BoxGeometry(25.0, 0.8, 25.0);
    cap.translate(cx, PLINTH - 0.4, cz);
    stone.push(cap);
  }

  /* ---------------- 2. the four pillars, panel by panel ----------------- */
  // Each pillar is a box caisson: four corner posts, X-braced on all four
  // faces, tapering with the envelope. The drawing's open spans are matched
  // because the inner faces follow pillarHalf().
  const legPanels = beltsBetween(PLINTH, H2);
  for (let pi = 0; pi < legPanels.length - 1; pi++) {
    const y0 = legPanels[pi], y1 = legPanels[pi + 1];
    const W0 = Wenv(y0), W1 = Wenv(y1);
    const p0 = pillarHalf(y0), p1 = pillarHalf(y1);
    const w = postW(y1), b = beltW(y1), d = diagW(y1), r = railW(y1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const [cx0, cz0] = legCentre(sx, sz, y0), [cx1, cz1] = legCentre(sx, sz, y1);
      // four corner posts
      for (const i of [-1, 1]) for (const k of [-1, 1]) {
        B.add([cx0 + i * p0, y0, cz0 + k * p0], [cx1 + i * p1, y1, cz1 + k * p1], w, w, 1.0);
      }
      // the pillars are wide boxes: subdivide each face into bays
      const bays = clamp(Math.round((p0 + p1) / 2.9), 2, 6);
      for (let f = 0; f < 4; f++) {
        const n = [[0, 1], [0, -1], [1, 0], [-1, 0]][f];
        const t = [n[1], n[0]];
        for (let s = 0; s < bays; s++) {
          const u0 = -1 + (2 * s) / bays, u1 = -1 + (2 * (s + 1)) / bays;
          const P = (cx, cz, p, u) => [cx + n[0] * p + t[0] * p * u, 0, cz + n[1] * p + t[1] * p * u];
          const a0 = P(cx0, cz0, p0, u0), a1 = P(cx1, cz1, p1, u0);
          const b0 = P(cx0, cz0, p0, u1), b1 = P(cx1, cz1, p1, u1);
          if (s > 0) B.add([a0[0], y0, a0[2]], [a1[0], y1, a1[2]], r * 1.1, w * 0.8, 0.95);
          B.add([a1[0], y1, a1[2]], [b1[0], y1, b1[2]], b, b * 0.8, 1.0);       // top chord
          B.add([a0[0], y0, a0[2]], [b1[0], y1, b1[2]], d, d * 0.8, 0.9);        // St Andrew
          B.add([b0[0], y0, b0[2]], [a1[0], y1, a1[2]], d, d * 0.8, 0.9);
          // mid rail: the sheet shows each pillar panel split in two
          const ym = (y0 + y1) * 0.5;
          const m0 = [lerp(a0[0], a1[0], 0.5), ym, lerp(a0[2], a1[2], 0.5)];
          const m1 = [lerp(b0[0], b1[0], 0.5), ym, lerp(b0[2], b1[2], 0.5)];
          B.add(m0, m1, r, w * 0.55, 0.9);
        }
      }
      // belt ring closing the panel
      for (let f = 0; f < 4; f++) {
        const n = [[0, 1], [0, -1], [1, 0], [-1, 0]][f];
        const t = [n[1], n[0]];
        const P = (cx, cz, p, u) => [cx + n[0] * p + t[0] * p * u, y1, cz + n[1] * p + t[1] * p * u];
        B.add(P(cx1, cz1, p1, -1), P(cx1, cz1, p1, 1), b * 1.1, b * 0.85, 1.0);
      }
    }
  }

  /* ---------------- 3. belt girders + the open faces -------------------- */
  // Below the 2nd floor the faces carry only a belt and one big cross per
  // panel; above it they are single-bay X-braced walls. Either way the
  // sky is visible straight through the structure.
  for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
    // The sheet is explicit about this: between the 1st and 2nd floors the
    // legs are joined ONLY by the horizontal belts and the two deep girder
    // bands - the space between them is a hole you can see the sky through.
    // (Checked against the plate at 2x: nothing but dimension lines crosses
    // that opening.) Above the 2nd floor the faces are braced as drawn.
    const sections = [
      { list: beltsBetween(ARCH_CROWN, H1), open: true },
      { list: beltsBetween(H1, H2), bare: true },
      { list: beltsBetween(H2, H3), open: false },
    ];
    for (const sec of sections) {
      for (let i = 0; i < sec.list.length - 1; i++) {
        const y0 = sec.list[i], y1 = sec.list[i + 1];
        const W0 = Wenv(y0), W1 = Wenv(y1);
        const s0 = W0 - 2 * pillarHalf(y0), s1 = W1 - 2 * pillarHalf(y1);   // half opening
        const b = beltW(y1), d = diagW(y1), r = railW(y1);
        const P = (u, y, s, W) => (axis === 'x' ? [sign * W, y, u * s] : [u * s, y, sign * W]);
        const a0 = P(-1, y0, s0, W0), a1 = P(-1, y1, s1, W1);
        const b0 = P(1, y0, s0, W0), b1 = P(1, y1, s1, W1);
        if (sec.bare) {
          // belt only: no diagonal, no sub-post, the opening stays a hole
          B.add(a1, b1, b * 1.5, b * 1.15, 1.0);
          continue;
        }
        if (sec.open) {
          // one St Andrew's cross spanning the whole opening
          B.add(a0, b1, d, d * 0.85, 0.92);
          B.add(b0, a1, d, d * 0.85, 0.92);
          // panel posts at the third points so the legs stay braced
          for (const u of [-1 / 3, 1 / 3]) {
            B.add(P(u, y0, s0, W0), P(u, y1, s1, W1), r * 1.3, b * 0.6, 0.95);
          }
          // a second, smaller cross in the wide lower panels
          if (s0 > 16) {
            const uA = -1, uB = 0, uC = 1;
            B.add(P(uA, (y0 + y1) / 2, (s0 + s1) / 2, (W0 + W1) / 2), P(uB, y0, s0, W0), d * 0.7, d * 0.6, 0.88);
            B.add(P(uB, y0, s0, W0), P(uC, (y0 + y1) / 2, (s0 + s1) / 2, (W0 + W1) / 2), d * 0.7, d * 0.6, 0.88);
          }
        } else {
          // The sheet gives the panel LAYOUT; the shop drawings subdivide each
          // of those panels into a fine mesh, which is what the iron actually
          // looks like from the ground. Two bays by two rows of crosses.
          const SUB = 2;
          for (let cu = 0; cu < SUB; cu++) for (let cv = 0; cv < SUB; cv++) {
            const tA = cv / SUB, tB = (cv + 1) / SUB;
            const uA = -1 + (2 * cu) / SUB, uB = -1 + (2 * (cu + 1)) / SUB;
            const yA = lerp(y0, y1, tA), yB = lerp(y0, y1, tB);
            const sA = lerp(s0, s1, tA), sB = lerp(s0, s1, tB);
            const WA = lerp(W0, W1, tA), WB = lerp(W0, W1, tB);
            const q00 = P(uA, yA, sA, WA), q10 = P(uB, yA, sA, WA);
            const q01 = P(uA, yB, sB, WB), q11 = P(uB, yB, sB, WB);
            B.add(q00, q11, d * 0.72, d * 0.6, 0.9);
            B.add(q10, q01, d * 0.72, d * 0.6, 0.9);
            if (cu > 0) B.add(q00, q01, r * 0.9, b * 0.45, 0.9);       // sub vertical
            if (cv > 0) B.add(q01, q11, r * 0.9, b * 0.45, 0.9);       // sub rail
          }
        }
        // the belt itself, full width across the face
        B.add(a1, b1, b * 1.35, b, 1.0);
      }
    }
  }

  /* ---------------- 4. the arch (74.24 m, crown 39.3 m) ----------------- */
  {
    const span = ARCH_SPAN * 0.5, rise = ARCH_CROWN - PLINTH;
    const R = (span * span + rise * rise) / (2 * rise);
    const cy = ARCH_CROWN - R, th0 = Math.asin(clamp(span / R, -1, 1));
    const N = 34;
    for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
      for (let i = 0; i < N; i++) {
        const t0 = th0 * (1 - (2 * i) / N), t1 = th0 * (1 - (2 * (i + 1)) / N);
        const u0 = Math.sin(t0) * R, u1 = Math.sin(t1) * R;
        const v0 = cy + Math.cos(t0) * R, v1 = cy + Math.cos(t1) * R;
        // the band sits in the plane of the face and is ~3.4 m deep radially
        const depth = 4.6, beltT = 1.15;
        const A = (u, v, off) => (axis === 'x'
          ? [sign * (Wenv(v) - off), v, u]
          : [u, v, sign * (Wenv(v) - off)]);
        const a0 = A(u0, v0, 0), a1 = A(u1, v1, 0);
        const b0 = A(u0, v0 - depth, 0), b1 = A(u1, v1 - depth, 0);
        const c0 = A(u0, v0, depth), c1 = A(u1, v1, depth);
        const d0 = A(u0, v0 - depth, depth), d1 = A(u1, v1 - depth, depth);
        B.add(a0, a1, beltT * 1.5, beltT * 1.7, 1.0);        // outer chord
        B.add(b0, b1, beltT * 1.4, beltT * 1.6, 0.8);        // inner chord
        B.add(c0, c1, beltT * 1.3, beltT * 1.5, 0.9);
        B.add(d0, d1, beltT * 1.2, beltT * 1.4, 0.75);
        B.add(a0, b0, beltT, beltT, 0.9);                     // radial webs
        B.add(a1, b1, beltT, beltT, 0.9);
        B.add(c0, d0, beltT, beltT, 0.85);
        B.add(c1, d1, beltT, beltT, 0.85);
        B.add(a0, c0, beltT * 0.8, beltT * 0.8, 0.7);         // cross bracing in plan
        B.add(b0, d0, beltT * 0.8, beltT * 0.8, 0.7);
        B.add(a0, d1, beltT * 0.8, beltT * 0.8, 0.8);
        B.add(b0, c1, beltT * 0.8, beltT * 0.8, 0.8);
      }
    }
  }

  /* ---------------- 5. the four decks ----------------------------------- */
  function ring(y, hw, w, d, ao) {
    for (const [x0, z0, x1, z1] of [[-hw, -hw, hw, -hw], [hw, -hw, hw, hw], [hw, hw, -hw, hw], [-hw, hw, -hw, -hw]]) {
      B.add([x0, y, z0], [x1, y, z1], w, d, ao);
    }
  }
  /** deep lattice girder ring carrying a deck */
  function girder(yTop, depth, hw, chord, sub) {
    const yb = yTop - depth;
    ring(yTop, hw, chord * 1.5, chord, 1.0);
    ring(yb, hw, chord * 1.6, chord * 1.1, 0.7);
    const n = Math.max(3, Math.round((2 * hw) / sub));
    for (let i = 0; i <= n; i++) {
      const t = -hw + (2 * hw * i) / n;
      const side = [[t, -hw], [t, hw], [-hw, t], [hw, t]];
      for (const [px, pz] of side) {
        B.add([px, yb, pz], [px, yTop, pz], chord * 0.8, chord, 0.85);
      }
      if (i < n) {
        const t1 = -hw + (2 * hw * (i + 1)) / n;
        const d = chord;
        for (const [px, pz, qx, qz] of [[t, -hw, t1, -hw], [t, hw, t1, hw]]) {
          B.add([px, yb, pz], [qx, yTop, qz], d, chord * 0.8, 0.8);
          B.add([qx, yb, qz], [px, yTop, pz], d, chord * 0.8, 0.8);
        }
        for (const [px, pz, qx, qz] of [[-hw, t, -hw, t1], [hw, t, hw, t1]]) {
          B.add([px, yb, pz], [qx, yTop, qz], d, chord * 0.8, 0.8);
          B.add([qx, yb, qz], [px, yTop, pz], d, chord * 0.8, 0.8);
        }
      }
    }
  }
  /** deck plate, projecting lip, openwork frieze and railing */
  function deck(y, hw, thick, frieze, rail) {
    const g = new THREE.BoxGeometry(hw * 2, thick, hw * 2);
    g.translate(0, y - thick * 0.5, 0);
    decks.push(g);
    const ribs = Math.max(6, Math.round(hw / 1.6));
    for (let i = 0; i <= ribs; i++) {
      const t = -hw + (2 * hw * i) / ribs;
      B.add([t, y - thick, -hw], [t, y - thick, hw], 0.5, 0.7, 0.45);
      B.add([-hw, y - thick, t], [hw, y - thick, t], 0.5, 0.7, 0.45);
    }
    ring(y - thick * 0.5, hw + 0.4, 0.55, 0.4, 0.9);
    if (frieze > 0) {
      const n = Math.max(4, Math.round((hw * 2) / 2.6));
      for (let i = 0; i <= n; i++) {
        const t = -hw + (2 * hw * i) / n;
        for (const [px, pz] of [[t, -hw], [t, hw], [-hw, t], [hw, t]]) {
          B.add([px, y, pz], [px, y + frieze, pz], 0.3, 0.3, 0.92);
        }
      }
      ring(y + frieze * 0.5, hw, 0.42, 0.34, 0.85);
      ring(y + frieze, hw, 0.5, 0.4, 1.0);
      for (let i = 0; i < n; i++) {
        const t0 = -hw + (2 * hw * i) / n, t1 = -hw + (2 * hw * (i + 1)) / n;
        const d = 0.3;
        for (const [p0, p1] of [[[t0, -hw], [t1, -hw]], [[t0, hw], [t1, hw]], [[-hw, t0], [-hw, t1]], [[hw, t0], [hw, t1]]]) {
          B.add([p0[0], y, p0[1]], [p1[0], y + frieze, p1[1]], d, d, 0.8);
          B.add([p1[0], y, p1[1]], [p0[0], y + frieze, p0[1]], d, d, 0.8);
        }
      }
    }
    if (rail > 0) {
      const n = Math.max(6, Math.round((hw * 2) / 2.2));
      for (let i = 0; i <= n; i++) {
        const t = -hw + (2 * hw * i) / n;
        for (const [px, pz] of [[t, -hw], [t, hw], [-hw, t], [hw, t]]) {
          B.add([px, y + frieze, pz], [px, y + frieze + rail, pz], 0.13, 0.13, 1.0);
        }
      }
      ring(y + frieze + rail, hw, 0.2, 0.18, 1.0);
      ring(y + frieze + rail * 0.5, hw, 0.11, 0.11, 1.0);
    }
  }
  girder(H1, 8.6, DECKS.first, 1.5, 3.0);
  deck(H1, DECKS.first, 1.0, 5.4, 1.4);
  // the sheet hatches two full-width girder bands between the floors: a
  // narrow one in the middle of the shaft and a broad one under the 2nd floor
  girder(96.4, 2.6, Wenv(96.4) - 0.4, 0.85, 2.2);
  girder(106.0, 3.2, Wenv(106.0) - 0.4, 0.95, 2.2);
  girder(H2, 7.0, DECKS.second, 1.35, 2.7);
  deck(H2, DECKS.second, 0.9, 4.4, 1.3);
  girder(MID, 3.0, DECKS.mid, 0.7, 2.2);
  deck(MID, DECKS.mid, 0.45, 1.8, 0.9);
  girder(H3, 3.8, DECKS.third, 0.95, 2.4);
  deck(H3, DECKS.third, 0.6, 2.4, 1.1);

  /* ---------------- 6. the inner core (stairs and lifts) ---------------- */
  // Visible through the open faces, so it has to exist - but it is a shaft,
  // not a second tower: four posts and one cross per panel.
  {
    const core = beltsBetween(H1, H3 - 8);
    for (let i = 0; i < core.length - 1; i++) {
      const y0 = core[i], y1 = core[i + 1];
      const w0 = Math.max(0.7, Wenv(y0) * 0.52), w1 = Math.max(0.6, Wenv(y1) * 0.52);
      const t = railW(y1) * 1.4;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.add([sx * w0, y0, sz * w0], [sx * w1, y1, sz * w1], t * 1.4, t * 1.4, 0.5);
      }
      for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
        const P = (u, y, w) => (axis === 'x' ? [sign * w, y, u * w] : [u * w, y, sign * w]);
        const a = P(-1, y0, w0), b = P(-1, y1, w1), c = P(1, y0, w0), d = P(1, y1, w1);
        B.add(a, d, t * 0.8, t * 0.8, 0.48);
        B.add(c, b, t * 0.8, t * 0.8, 0.48);
        B.add(b, d, t, t, 0.5);
      }
    }
  }

  /* ---------------- 7. campanile, spire, antennas ----------------------- */
  {
    // campanile: the enclosed top level between the 3rd floor and the
    // 300.51 m platform, with the observation room inside the lantern
    const lv = beltsBetween(H3 + 1.2, CAMPANILE_TOP);
    for (let i = 0; i < lv.length - 1; i++) {
      const y0 = lv[i], y1 = lv[i + 1];
      const w0 = lerp(5.0, 3.4, i / (lv.length - 1)), w1 = lerp(5.0, 3.4, (i + 1) / (lv.length - 1));
      const t = 0.28;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.add([sx * w0, y0, sz * w0], [sx * w1, y1, sz * w1], t * 1.3, t * 1.3, 0.95);
      }
      for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
        const P = (u, y, w) => (axis === 'x' ? [sign * w, y, u * w] : [u * w, y, sign * w]);
        B.add(P(-1, y0, w0), P(1, y1, w1), t, t, 0.9);
        B.add(P(1, y0, w0), P(-1, y1, w1), t, t, 0.9);
        B.add(P(-1, y1, w1), P(1, y1, w1), t * 1.2, t * 1.2, 0.95);
      }
    }
    const g = new THREE.CylinderGeometry(3.0 * Math.SQRT1_2, 3.3 * Math.SQRT1_2, (CAMPANILE_TOP - H3) * 0.52, 8, 1);
    g.translate(0, H3 + 1.2 + (CAMPANILE_TOP - H3) * 0.32, 0);
    decks.push(g);

    // openwork spire above the campanile platform
    const y0 = CAMPANILE_TOP + 0.5, y1 = SPIRE_TOP;
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const ya = lerp(y0, y1, t0), yb = lerp(y0, y1, t1);
      const wa = lerp(3.0, 0.5, t0), wb = lerp(3.0, 0.5, t1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.add([sx * wa, ya, sz * wa], [sx * wb, yb, sz * wb], 0.18, 0.18, 0.95);
      }
      for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
        const P = (u, y, w) => (axis === 'x' ? [sign * w, y, u * w] : [u * w, y, sign * w]);
        B.add(P(-1, ya, wa), P(1, yb, wb), 0.12, 0.12, 0.9);
        B.add(P(1, ya, wa), P(-1, yb, wb), 0.12, 0.12, 0.9);
        B.add(P(-1, yb, wb), P(1, yb, wb), 0.14, 0.14, 0.9);
      }
    }
    const mast = new THREE.CylinderGeometry(0.14, 0.4, TIP - SPIRE_TOP, 8, 1);
    mast.translate(0, (SPIRE_TOP + TIP) * 0.5, 0);
    decks.push(mast);
    const mast2 = new THREE.CylinderGeometry(0.05, 0.12, 6, 6, 1);
    mast2.translate(0, TIP + 3, 0);
    decks.push(mast2);
    for (let i = 0; i < 5; i++) {
      const y = SPIRE_TOP + 1.5 + i * 2.2, r = 0.85 - i * 0.13;
      B.add([-r, y, 0], [r, y, 0], 0.09, 0.09, 0.9);
      B.add([0, y, -r], [0, y, r], 0.09, 0.09, 0.9);
    }
    for (const [dx, dz, ry] of [[1.4, 0.4, 0.6], [-1.2, -0.6, -0.5]]) {
      const d = new THREE.CylinderGeometry(0.9, 0.9, 0.3, 10, 1);
      d.rotateX(Math.PI / 2); d.rotateY(ry); d.translate(dx, SPIRE_TOP + 1.0, dz);
      decks.push(d);
    }
  }

  /* ---------------- 8. materials and assembly --------------------------- */
  const steelMat = makeSteel();
  const steelMesh = B.steel.build(new THREE.BoxGeometry(1, 1, 1));
  steelMesh.material = steelMat;
  steelMesh.castShadow = steelMesh.receiveShadow = true;
  steelMesh.name = 'lattice';
  group.add(steelMesh);

  const deckMat = makeSolid(0x2c2824, 'deck');
  const solidMesh = new THREE.Mesh(mergeGeometries(decks), deckMat);
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  solidMesh.name = 'decks';
  group.add(solidMesh);

  const stoneMat = makeSolid(0x8d8578, 'stone');
  const stoneMesh = new THREE.Mesh(mergeGeometries(stone), stoneMat);
  stoneMesh.geometry.computeVertexNormals();
  stoneMesh.castShadow = stoneMesh.receiveShadow = true;
  stoneMesh.name = 'plinths';
  group.add(stoneMesh);

  const sparkle = makeSparkle(B.lights);
  group.add(sparkle.points);

  return {
    group,
    update(tod, time, camera, fog) {
      const p = tod.pal;
      for (const m of [steelMat, deckMat, stoneMat]) {
        const u = m.userData.u;
        u.uSunDir.value.copy(tod.sunDir);
        u.uSunColor.value.copy(p.sun).multiplyScalar(p.sunI);
        u.uAmbColor.value.copy(p.amb).multiplyScalar(p.ambI);
        u.uSkyColor.value.copy(p.zenith).multiplyScalar(p.ambI);
        u.uGroundColor.value.copy(p.ground);
        u.uFogColor.value.copy(fog);
        u.uNight.value = tod.lightsOn ? 1 : 0;
      }
      const cycle = time % 45;
      const on = tod.lightsOn && cycle < 18 ? 1 : 0;
      const ramp = on * Math.min(1, Math.min(cycle, 18 - cycle) * 2.5);
      sparkle.u.uAmount.value = ramp;
      sparkle.u.uTime.value = time;
      sparkle.u.uPixelScale.value = camera.isPerspectiveCamera
        ? (innerHeight * 0.5) / Math.tan((camera.fov * Math.PI) / 360) : 500;
      sparkle.points.visible = ramp > 0.002;
    },
  };
}

/* ======================= materials ======================================== */

function baseUniforms() {
  return {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uAmbColor: { value: new THREE.Color(0.3, 0.35, 0.4) },
    uSkyColor: { value: new THREE.Color(0.3, 0.4, 0.5) },
    uGroundColor: { value: new THREE.Color(0.2, 0.2, 0.2) },
    uFogColor: { value: new THREE.Color(0.7, 0.75, 0.8) },
    uFogDensity: { value: 0.00018 },
    uNight: { value: 0 },
  };
}

function makeSteel() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66, metalness: 0.35 });
  mat.userData.u = baseUniforms();
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAO;\nattribute vec3 aTint;\nvarying float vAO;\nvarying vec3 vTint;\nvarying float vH;\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vAO = aAO; vTint = aTint; vH = instanceMatrix[3].y;\n vW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vAO; varying vec3 vTint; varying float vH; varying vec3 vW;
        uniform vec3 uSunDir, uSunColor, uAmbColor, uSkyColor, uGroundColor, uFogColor;
        uniform float uFogDensity, uNight;
        ${common}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // painted wrought iron: three official tones, grime streaks, rivet dust
        vec3 base = vTint;
        base *= 0.88 + 0.24 * fbm(vW * 0.55, 3);
        base *= 0.85 + 0.28 * vnoise(vec3(vW.x * 2.6, vW.y * 0.08, vW.z * 2.6));
        vec3 nrm = normalize(cross(dFdx(vW), dFdy(vW)) + 1e-5);
        float ndl = max(dot(nrm, uSunDir), 0.0);
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
          float sh = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize,
                     directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius,
                     vDirectionalShadowCoord[0]);
        #else
          float sh = 1.0;
        #endif
        vec3 amb = uAmbColor * (0.72 + 0.4 * (0.5 + 0.5 * normalize(vW + vec3(0.0, 1.0, 0.0)).y));
        vec3 col = base * (amb + uSkyColor * 0.55) * vAO;
        col += base * uSunColor * ndl * 0.72 * vAO * mix(0.28, 1.0, sh);
        col += base * uSkyColor * 0.22 * pow(1.0 - abs(dot(nrm, normalize(cameraPosition - vW))), 2.0);
        // a little specular so the iron reads as painted metal, not chalk
        vec3 V = normalize(cameraPosition - vW);
        vec3 H = normalize(V + uSunDir);
        col += uSunColor * pow(max(dot(nrm, H), 0.0), 42.0) * 0.16 * mix(0.2, 1.0, sh);
        if (uNight > 0.001) {
          float r = length(vW.xz);
          float core = exp(-r * 0.032);
          float lamp = 0.55 + 0.45 * fbm(vec3(vW.xz * 0.4, vW.y * 0.05), 2);
          col += base * vec3(1.0, 0.60, 0.24) * (0.5 + 1.6 * core) * lamp * uNight * (0.6 + 1.6 * vAO);
        }
        gl_FragColor.rgb = applyAerial(col, uFogColor, length(vW - cameraPosition), uFogDensity);`);
  };
  mat.customProgramCacheKey = () => 't2-steel';
  return mat;
}

function makeSolid(hex, tag) {
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: tag === 'stone' ? 0.94 : 0.6, metalness: tag === 'stone' ? 0.0 : 0.2 });
  mat.userData.u = baseUniforms();
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; uniform vec3 uFogColor; uniform float uFogDensity, uNight;
        uniform vec3 uAmbColor;
        ${common}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float n = fbm(vW * (uNight > 0.5 ? 0.9 : 1.1), 4);
        vec3 c = gl_FragColor.rgb * (0.82 + 0.34 * n);
        c += vec3(1.0, 0.68, 0.32) * uNight * 0.20;
        c += uAmbColor * 0.05;
        gl_FragColor.rgb = applyAerial(c, uFogColor, length(vW - cameraPosition), uFogDensity);`);
  };
  mat.customProgramCacheKey = () => 't2-' + tag;
  return mat;
}

function makeSparkle(positions) {
  const geo = new THREE.BufferGeometry();
  const n = Math.max(1, positions.length / 3);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const seeds = new Float32Array(n * 3);
  let s = 9781;
  for (let i = 0; i < n * 3; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; seeds[i] = s / 0x7fffffff; }
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const u = { uAmount: { value: 0 }, uTime: { value: 0 }, uPixelScale: { value: 500 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uAmount, uTime, uPixelScale;
      varying float vGlow;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float flash = fract(aSeed.x * 7.13 + uTime * (5.0 + aSeed.y * 9.0));
        float on = step(0.62, flash) * (0.35 + 0.65 * smoothstep(0.62, 0.95, flash));
        float wave = step(0.08, fract(uTime * 0.5 + aSeed.z));
        vGlow = on * (0.45 + 0.55 * wave) * uAmount;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.15 + 0.10 * vGlow) * uPixelScale / max(-mv.z, 1.0), 0.8, 5.0);
      }`,
    fragmentShader: `
      varying float vGlow;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.25, 0.0, dot(d, d));
        vec3 c = mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.95, 0.78), vGlow);
        gl_FragColor = vec4(c * vGlow * a * 1.05, a * vGlow);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  pts.renderOrder = 5;
  return { points: pts, u };
}
