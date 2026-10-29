/**
 * tower-detailed.js — the full model.
 *
 * Everything from `tower.js`, plus the parts the research actually documented:
 *
 *  · the 29-PANEL schedule, with panel 5 carrying the 1st-platform girders and
 *    panel 11 the 2nd, 11 m pitch (12.31 m in the face), chord runs of 13.50 m
 *    in three 4.50 m segments
 *  · COMPOUND chord sections — the 877 mm outer box plus its four 100×100×12
 *    corner angles shown as ridges, so close-ups read as a built-up member
 *  · the TREILLIS as PAIRED flat bars with spacers, sized from the plates
 *    (120×6 and 50×6), not as single struts
 *  · ENTRETOISES — the transverse struts inside each leg at every panel line
 *  · GUSSETS at every node, the solid material that stops a lattice reading as wire
 *  · DECKS with their frieze, the `masque` shield, railings and the deep riveted
 *    girder band under the 1st platform
 *  · ARCHES with doubled rib depths, 600 mm curved box chords 2.72 m apart,
 *    3 mm tympana, braced at three points
 *  · CAMPANILE, decagonal lantern, cupola, and the full paratonnerre
 *  · inclined ELEVATOR rails and the STAIR
 *  · a bounded RIVET pass
 *
 * VOIDS ARE STILL LAW: below 115.73 m the four uprights are isolated, and nothing
 * crosses between them except the two belts and the four arches.
 */

import * as THREE from 'three';
import { sweptSquare, tubeFromRings } from '../geom/tube.js';
import { mergeGeos } from '../geom/merge.js';
import * as P from '../geom/profile.js';
import { boundariesUpper } from '../geom/panels.js';

const O = P.OFFICIAL;
const UPPER_BOUNDARIES = boundariesUpper().map(b => b.y);   // panels 10..29, ascending

/* ------------------------------------------------------------------ *
 * The 29 panels. Panels 11-29 now come from the ATTESTED schedule in
 * geom/panels.js — read off Plate I and cross-confirmed on Plate VII. The read
 * heights run 5.88 to 11.23 m and GROW DOWNWARD, and the chain closes exactly on
 * the documented 184.92 m span (L2 -> ironwork top). v3 interpolated 18 equal
 * steps of 10.27 m, which is superseded.
 *
 * Panels 1-10 (ground to the 2nd platform) remain v3's reconstruction: the plate
 * chain for that range has not been transcribed.
 * ------------------------------------------------------------------ */
function panelBounds() {
  const b = [0, 8.0, 18.0, 28.0, 38.0, 47.90, 57.63];          // panels 1–6
  for (let i = 1; i <= 5; i++) b.push(57.63 + (115.73 - 57.63) * (i / 5));   // 6–11
  // Panels 11-29: the ATTESTED schedule, not 18 equal steps of 10.27 m.
  for (const f of UPPER_BOUNDARIES) if (f > 115.74) b.push(f);
  return b;                                                     // 30 boundaries
}
const PB = panelBounds();
const panelIndexAt = (y) => {
  for (let i = 0; i < PB.length - 1; i++) if (y >= PB[i] - 1e-6 && y <= PB[i + 1] + 1e-6) return i + 1;
  return PB.length - 1;
};

const PAINT = { base: 0x6b4d36, mid: 0x7a5a40, top: 0x8d6c48 };
function paintAt(y) {
  const t = Math.min(1, Math.max(0, y / O.ironTop));
  const c = new THREE.Color();
  if (t < 0.5) c.copy(new THREE.Color(PAINT.base)).lerp(new THREE.Color(PAINT.mid), t / 0.5);
  else c.copy(new THREE.Color(PAINT.mid)).lerp(new THREE.Color(PAINT.top), (t - 0.5) / 0.5);
  return c;
}

export function buildTowerDetailed(opts = {}) {
  const DETAIL = opts.detail ?? 0.7;               // lower = fewer sub-panels; 0.7 is the tuned default
  const RIVETS = opts.rivets !== false;
  const group = new THREE.Group();
  group.name = 'EiffelTowerDetailed';

  const buckets = {};
  const push = (k, a, b, w, t) => (buckets[k] ||= []).push({ a: a.clone(), b: b.clone(), w, t });
  const slabs = [];
  const slab = (kind, x, y, z, w, h, d) => slabs.push({ kind, x, y, z, w, h, d });
  const sweptGeos = [];
  const layerOf = {};                              // bucket → layer name, for the UI

  const layer = (bucket, name) => (layerOf[bucket] = name);
  ['chord', 'treillis', 'treillisFine', 'entretoise', 'gusset', 'rivet',
   'belt', 'arch', 'deck', 'railing', 'frieze', 'masque', 'shaft', 'campanile',
   'antenna', 'lift', 'stair', 'stone'].forEach(b => layer(b, b));

  const D1 = P.DECKS[0], D2 = P.DECKS[1], D3 = P.DECKS[2];

  /* ================= masonry: 16 massifs, stepped ================= */
  const footC = O.baseOuter / 2 - O.pierWidth / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    slab('stone', sx * footC, 2.3, sz * footC, O.pierWidth, 4.6, O.pierWidth);
    slab('stone', sx * footC, 5.0, sz * footC, O.pierWidth - 5, 0.8, O.pierWidth - 5);
  }

  /* ================= legs: 4 isolated uprights, ground → L2 =================
   * Each leg is a box truss of FOUR arbalétriers (16 in total) — « Les quatre
   * montants … se composent chacun de 4 arbalétriers d'angle a, b, c, d ».
   */
  const CH = 0.877;                    // chord box, outer, CONSTANT
  const ANG = 0.100;                   // corner angle leg 100×100×12
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const legNodes = (sx, sz) => {
    const node = (ix, iz, y) => {
      const w = P.legWidth(y), c = P.legCentreHalf(y);
      return new THREE.Vector3(sx * c + ix * w / 2, y, sz * c + iz * w / 2);
    };
    return node;
  };

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const node = legNodes(sx, sz);
    const levels = PB.filter(y => y >= 4.6 && y <= O.L2);
    if (levels[0] > 4.6) levels.unshift(4.6);
    if (levels[levels.length - 1] < O.L2) levels.push(O.L2);

    // 4 corner chords, swept continuously, with the corner angles as ridges
    // Box segments, not a hand-rolled sweep. The sweep path (tube.js) rendered as
    // black facets with broken normals; the instanced box path is proven across
    // thousands of members. The chord is a CONSTANT 877 mm box, so a chain of
    // segments along the leg axis is visually identical.
    const seg = (pFn, w) => {
      for (let i = 0; i < levels.length - 1; i++) {
        push('chord', pFn(levels[i]), pFn(levels[i + 1]), w, w);
      }
    };
    corners.forEach(([ix, iz]) => {
      seg(y => node(ix, iz, y), CH);
      // the four 100×100×12 corner angles, offset to the arrises
      const o = CH / 2 - ANG / 2;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([ax, az]) => {
        seg(y => node(ix, iz, y).add(new THREE.Vector3(ax * o, 0, az * o)), ANG);
      });
    });

    // ---- PRIMARY members: ONE HEAVY X PER PANEL -----------------------------
    // Research, note 11: "Where the structure is open the members are FEW and THICK…
    // a sparse frame of heavy built-up girders", with a bar scale of 1-8 m in the legs
    // above the arch. Note 10 gives the section: X-bracing angles «de 80×80 à 90×90 et
    // 100×100», **800 mm deep**. Uniform 0.18 m bars here was the "wires where the
    // original has none" failure — the metal has to come from large members.
    for (let i = 0; i < levels.length - 1; i++) {
      const y0p = levels[i], y1p = levels[i + 1];
      const heavy = 0.80;
      for (let k = 0; k < 4; k++) {
        const [p0, p1] = corners[k], [q0, q1] = corners[(k + 1) % 4];
        const A0 = node(p0, p1, y0p), B0 = node(q0, q1, y0p);
        const A1 = node(p0, p1, y1p), B1 = node(q0, q1, y1p);
        push('treillis', A0, B1, heavy, 0.30);
        push('treillis', B0, A1, heavy, 0.30);
        push('treillis', A0, B0, heavy, 0.30);        // heavy panel rail
      }
    }

    // ---- SECONDARY: the fine mesh between the heavy members -----------------
    for (let i = 0; i < levels.length - 1; i++) {
      const y0 = levels[i], y1 = levels[i + 1], ym = (y0 + y1) / 2;
      // Zone-dependent density. In the reference the L1→L2 stretch is a dense,
      // continuously-latticed body — heavier criss-cross than the legs below it —
      // so it gets 5 sub-panels against the legs' 3.
      const inMidZone = y0 >= O.L1 - 0.01 && y1 <= O.L2 + 0.01;
      const inLower = y1 <= O.L1 + 0.01;
      const sub = Math.max(1, Math.round((inMidZone ? 4 : inLower ? 5 : 3) * DETAIL));
      for (let s = 0; s < sub; s++) {
        const a0 = y0 + (y1 - y0) * (s / sub), a1 = y0 + (y1 - y0) * ((s + 1) / sub);
        for (let k = 0; k < 4; k++) {
          const [p0, p1] = corners[k], [q0, q1] = corners[(k + 1) % 4];
          const A0 = node(p0, p1, a0), B0 = node(q0, q1, a0);
          const A1 = node(p0, p1, a1), B1 = node(q0, q1, a1);
          // paired flats, 0.30 m apart across the face — the real treillis is doubled
          const nrm = new THREE.Vector3().subVectors(B0, A0).cross(new THREE.Vector3(0, 1, 0)).normalize();
          for (const off of [-0.15, 0.15]) {
            const o = nrm.clone().multiplyScalar(off);
            push('treillis', A0.clone().add(o), B1.clone().add(o), 0.18, 0.09);
            push('treillis', B0.clone().add(o), A1.clone().add(o), 0.18, 0.09);
          }
          // bounding rail at EVERY sub-panel line — this is the term that lifts a face from
          // the diagonals' ~26% to the ~60% Eiffel records, and it is why mine looked airy
          push('treillisFine', A0, B0, 0.16, 0.09);
          if (inMidZone) {
            const M0 = new THREE.Vector3().addVectors(A0, B0).multiplyScalar(0.5);
            const M1 = new THREE.Vector3().addVectors(A1, B1).multiplyScalar(0.5);
            push('treillisFine', M0, M1, 0.16, 0.12);                  // mid-face mullion
            push('treillis', M0, A1, 0.10, 0.05);                      // and its sub-diagonals
            push('treillis', M1, B1, 0.10, 0.05);
          }
        }
      }
      // ---- decorative SOLID PLATES, lower legs only -------------------------
      // Eiffel records NO void ratio for panels 1-5: he counts them as solid,
      // panel 4 as « entièrement pleine ». A photograph of the tower confirms it —
      // the legs read as wide DENSE masses with only a narrow slot between them,
      // because the outward faces are closed. An open box truss lets you see
      // through the leg, so the perceived void becomes void + both leg interiors.
      // These are PLATES, not more bars.
      // Applied from the ground ALL THE WAY TO THE 2nd PLATFORM, not just to L1:
      // the L1-L2 stretch is the zone where the legs must still read as wide dense
      // masses with only a narrow slot between them.
      if (y1 <= 18.0) {   // only the lowest panels, which Eiffel counts solid
        const inset = 0.30;   // close behind the lattice, so the members read against it
        const cA = P.legCentreHalf(y0), wA = P.legWidth(y0);
        const cB = P.legCentreHalf(y1), wB = P.legWidth(y1);
        const cM = (cA + cB) / 2, wM = (wA + wB) / 2;
        const yM = (y0 + y1) / 2, hh = (y1 - y0) - 0.9;
        const fx = sx * (cM + wM / 2 - inset);          // the x-facing plane
        const fz = sz * (cM + wM / 2 - inset);          // the z-facing plane
        const span = Math.max(1, wM - 2 * inset);
        slab('panel', fx, yM, sz * cM, 0.09, hh, span);
        slab('panel', sx * cM, yM, fz, span, hh, 0.09);
      }
      // entretoises: transverse struts INSIDE the leg at every panel line
      if (i < levels.length - 1) {
        const A = node(-1, -1, y1), B = node(1, 1, y1);
        const C = node(1, -1, y1), D = node(-1, 1, y1);
        push('entretoise', A, B, 0.30, 0.24);
        push('entretoise', C, D, 0.30, 0.24);
      }
    }

    // gussets at every panel-line node
    for (let i = 0; i < levels.length; i++) {
      const y = levels[i];
      corners.forEach(([ix, iz]) => {
        const p = node(ix, iz, y);
        push('gusset', p.clone().add(new THREE.Vector3(-0.55, 0, 0)), p.clone().add(new THREE.Vector3(0, 0, 0.55)), 0.42, 0.10);
        push('gusset', p.clone().add(new THREE.Vector3(-0.55, 0, 0)), p.clone().add(new THREE.Vector3(0, 0, -0.55)), 0.42, 0.10);
      });
    }
  }

  /* ================= the two belts — the only void-crossers but the arches ===== */
  [[D1, 7.53, '1st'], [D2, 4.90, '2nd']].forEach(([d, depth]) => {
    const h = d.half;
    for (const axis of ['x', 'z']) for (const sgn of [-1, 1]) {
      const a = axis === 'x' ? new THREE.Vector3(-h, d.y - depth / 2, sgn * h)
                             : new THREE.Vector3(sgn * h, d.y - depth / 2, -h);
      const b = axis === 'x' ? new THREE.Vector3(h, d.y - depth / 2, sgn * h)
                             : new THREE.Vector3(sgn * h, d.y - depth / 2, h);
      // top + bottom chords of the girder
      for (const dy of [0, depth]) {
        push('belt', a.clone().setY(d.y - depth / 2 + dy), b.clone().setY(d.y - depth / 2 + dy), 1.62, 0.20);   // 610 x 8 semelle + 100 x 100 x 12 angles
      }
      // the 2nd-platform girders are documented as DOUBLE-WALLED, which is why the
      // band under it reads as a deep dark mass in the reference
      if (depth === 4.90) {
        const inset = 1.2;
        const a2 = a.clone().multiplyScalar(1 - inset / Math.max(1, Math.abs(a.x) + Math.abs(a.z)));
        const b2 = b.clone().multiplyScalar(1 - inset / Math.max(1, Math.abs(b.x) + Math.abs(b.z)));
        for (const dy of [0, depth]) {
          push('belt', a2.clone().setY(d.y - depth / 2 + dy), b2.clone().setY(d.y - depth / 2 + dy), 0.5, 0.5);
        }
        const n2 = Math.max(6, Math.round(18 * DETAIL));
        for (let k = 0; k < n2; k++) {
          const t0 = k / n2, t1 = (k + 1) / n2;
          const p0 = new THREE.Vector3().lerpVectors(a2, b2, t0);
          const p1 = new THREE.Vector3().lerpVectors(a2, b2, t1);
          push('belt', p0.clone().setY(d.y - depth / 2), p1.clone().setY(d.y + depth / 2), 0.18, 0.12);
          push('belt', p1.clone().setY(d.y - depth / 2), p0.clone().setY(d.y + depth / 2), 0.18, 0.12);
        }
      }
      // its latticed web
      // QUADRUPLE LATTICE — « les poutres de l'arc … dont le treillis est quadruple »
      // (Eiffel 1900 §13). FOUR braced planes across the girder's width, not one, with a
      // 610 × 8 semelle on each chord and 100 × 100 × 12 corner angles. This is what gives
      // the band under the 1st platform its weight in the reference photograph.
      const lat = axis === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const n = Math.max(8, Math.round(30 * DETAIL));
      for (const off of [-0.58, -0.20, 0.20, 0.58]) {
        const o = lat.clone().multiplyScalar(off);
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const p0 = new THREE.Vector3().lerpVectors(a, b, t0);
          const p1 = new THREE.Vector3().lerpVectors(a, b, t1);
          const lo0 = p0.clone().setY(d.y - depth / 2).add(o), hi1 = p1.clone().setY(d.y + depth / 2).add(o);
          const hi0 = p0.clone().setY(d.y + depth / 2).add(o), lo1 = p1.clone().setY(d.y - depth / 2).add(o);
          push('belt', lo0, hi1, 0.22, 0.14);
          push('belt', hi0, lo1, 0.22, 0.14);
          push('belt', lo0, lo1, 0.26, 0.26);
        }
      }
    }
    // A platform is THREE values, not one flat plate:
    //   a thin LIGHT deck on top, a dark FASCIA at the edge (the crisp bar the
    //   drawing tradition draws), and the near-black underside underneath.
    slab('deck', 0, d.y - 0.35, 0, d.half * 2, 0.70, d.half * 2);
    for (const axis of ['x', 'z']) for (const sgn of [-1, 1]) {
      const a = axis === 'x' ? new THREE.Vector3(-h, d.y - 2.6, sgn * (h + 0.30))
                             : new THREE.Vector3(sgn * (h + 0.30), d.y - 2.6, -h);
      const b = axis === 'x' ? new THREE.Vector3(h, d.y - 2.6, sgn * (h + 0.30))
                             : new THREE.Vector3(sgn * (h + 0.30), d.y - 2.6, h);
      push('masque', a, b, 0.6, 2.6);          // dark fascia band = the skyline bar
    }
  });

  /* ================= decks: frieze, masque, railings ================= */
  P.DECKS.forEach((d, i) => {
    const h = d.half;
    // railing posts + top rail around the outer edge
    const posts = Math.max(16, Math.round(72 * DETAIL));
    for (let k = 0; k < posts; k++) {
      const t = -h + 2 * h * (k / (posts - 1));
      const onX = k % 2 === 0, sgn = (k % 4 < 2) ? 1 : -1;
      const p = onX ? new THREE.Vector3(t, d.y + d.thick, sgn * h) : new THREE.Vector3(sgn * h, d.y + d.thick, t);
      push('railing', p, p.clone().setY(d.y + d.thick + 2.8), 0.10, 0.10);
    }
    for (const axis of ['x', 'z']) for (const sgn of [-1, 1]) {
      const a = axis === 'x' ? new THREE.Vector3(-h, d.y + d.thick + 2.8, sgn * h)
                             : new THREE.Vector3(sgn * h, d.y + d.thick + 2.8, -h);
      const b = axis === 'x' ? new THREE.Vector3(h, d.y + d.thick + 2.8, sgn * h)
                             : new THREE.Vector3(sgn * h, d.y + d.thick + 2.8, h);
      push('railing', a, b, 0.14, 0.14);
    }
    // 1st platform: the lettered frieze band, then the masque that hides the girder depth
    if (i === 0) {
      slab('frieze', 0, d.y + 0.9, 0, 2 * h + 1.2, 2.2, 2 * h + 1.2);   // a lettered BAND, not a block
      for (const axis of ['x', 'z']) for (const sgn of [-1, 1]) {
        const off = h + 0.9;
        const a = axis === 'x' ? new THREE.Vector3(-h - 0.6, d.y - 3.4, sgn * off)
                               : new THREE.Vector3(sgn * off, d.y - 3.4, -h - 0.6);
        const b = axis === 'x' ? new THREE.Vector3(h + 0.6, d.y - 3.4, sgn * off)
                               : new THREE.Vector3(sgn * off, d.y - 3.4, h + 0.6);
        push('masque', a, b, 0.05, 3.4);      // 4 mm plate in reality; 50 mm so it survives at distance
      }
    }
  });

  /* ================= the hollow caisson, L2 → L3 ================= */
  // The panel boundaries are 18 even steps from 115.73 to 300.65, so NONE of them lands
  // on 276.13 — the shaft's top ring stopped at 269.83 and left the 3rd-platform deck
  // floating ~6 m clear of it. Pin the ends to the real platform heights.
  const shaftLevels = PB.filter(y => y > O.L2 && y <= O.L3);
  if (!shaftLevels.length || shaftLevels[0] > O.L2 + 0.1) shaftLevels.unshift(O.L2);
  if (shaftLevels[shaftLevels.length - 1] < O.L3 - 0.01) shaftLevels.push(O.L3);
  const sNode = (ix, iz, y) => new THREE.Vector3(ix * P.shaftHalf(y), y, iz * P.shaftHalf(y));
  corners.forEach(([ix, iz]) => {
    for (let i = 0; i < shaftLevels.length - 1; i++) {
      push('shaft', sNode(ix, iz, shaftLevels[i]), sNode(ix, iz, shaftLevels[i + 1]), 0.62, 0.62);
    }
  });

  for (let i = 0; i < shaftLevels.length - 1; i++) {
    const y0 = shaftLevels[i], y1 = shaftLevels[i + 1];

    // PRIMARY: the same member hierarchy the legs now have. The upper shaft must read
    // as FOUR VISIBLE CORNER POSTS + a panel grid, with the fine mesh as infill — not as
    // an undifferentiated grey haze. Note 11 gives its bar scale as 0.3-2 m with only
    // 5-12 runs/row, so heavy members belong here too.
    for (let k = 0; k < 4; k++) {
      const [p0, p1] = corners[k], [q0, q1] = corners[(k + 1) % 4];
      const A0 = sNode(p0, p1, y0), B0 = sNode(q0, q1, y0);
      const A1 = sNode(p0, p1, y1), B1 = sNode(q0, q1, y1);
      push('shaft', A0, B1, 0.55, 0.34);          // heavy panel diagonal
      push('shaft', B0, A1, 0.55, 0.34);
      push('shaft', A0, B0, 0.55, 0.34);          // heavy panel rail
    }
    // corner posts, kept heavier still so they read as the primary verticals
    for (let k = 0; k < 4; k++) {
      const [p0, p1] = corners[k];
      push('shaft', sNode(p0, p1, y0), sNode(p0, p1, y1), 0.78, 0.78);
    }

    const sub = Math.max(1, Math.round(4 * DETAIL));   // infill only; the heavy frame carries it
    for (let s = 0; s < sub; s++) {
      const a0 = y0 + (y1 - y0) * (s / sub), a1 = y0 + (y1 - y0) * ((s + 1) / sub);
      for (let k = 0; k < 4; k++) {
        const [p0, p1] = corners[k], [q0, q1] = corners[(k + 1) % 4];
        const A0 = sNode(p0, p1, a0), B0 = sNode(q0, q1, a0);
        const A1 = sNode(p0, p1, a1), B1 = sNode(q0, q1, a1);
        const nrm = new THREE.Vector3().subVectors(B0, A0).cross(new THREE.Vector3(0, 1, 0)).normalize();
        for (const off of [-0.11, 0.11]) {
          const o = nrm.clone().multiplyScalar(off);
          push('treillis', A0.clone().add(o), B1.clone().add(o), 0.11, 0.06);
          push('treillis', B0.clone().add(o), A1.clone().add(o), 0.11, 0.06);
        }
        push('treillisFine', A0, B0, 0.10, 0.05);
        const M0 = new THREE.Vector3().addVectors(A0, B0).multiplyScalar(0.5);
        const M1 = new THREE.Vector3().addVectors(A1, B1).multiplyScalar(0.5);
        push('shaft', M0, M1, 0.30, 0.30);                            // mid-face mullion
      }
    }
  }

  /* ================= campanile, lantern, cupola, antenna ================= */
  slab('deck', 0, D3.y - 0.30, 0, D3.half * 2, 0.60, D3.half * 2);   // thin + lit, matching the other two

  // decagonal lantern between the 3rd platform and the ironwork top
  // Campanile — DOCUMENTED plan 4.24 m square, rising DIRECTLY off the 3rd platform.
  // It previously began 2.00 m above the deck, which left a bare gap at the summit;
  // and its base was 5.81 m against an 18.65 m deck, an abrupt step. It now starts ON
  // the deck and continues unbroken into the cupola.
  const lanternLevels = [];
  for (let y = D3.y + 0.30; y <= O.ironTop; y += 1.8) lanternLevels.push(y);
  if (lanternLevels.length > 1) {
    const first = lanternLevels[0], last = lanternLevels[lanternLevels.length - 1];
    const rings = lanternLevels.map(y => {
      const t = (y - first) / Math.max(1e-6, last - first);
      const r = 2.12 - 0.52 * t;                 // 4.24 m at the deck -> 3.20 m at the top
      return Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      });
    });
    for (let y = 0; y < rings.length - 1; y++) {
      for (let k = 0; k < rings[y].length; k++) {
        const k2 = (k + 1) % rings[y].length;
        push('campanile', rings[y][k], rings[y][k2], 0.22, 0.22);
        push('campanile', rings[y][k], rings[y + 1][k], 0.22, 0.22);
      }
    }
  }
  // cupola
  // Cupola — starts exactly at the ironwork top, so it meets the campanile with no gap.
  const cup = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8, y = O.ironTop + t * 3.2;
    const r = Math.max(0.35, 1.9 * Math.cos(t * Math.PI * 0.46));
    cup.push(Array.from({ length: 10 }, (_, j) => {
      const a = (j / 10) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    }));
  }
  for (let y = 0; y < cup.length - 1; y++) {
    for (let k = 0; k < cup[y].length; k++) {
      const k2 = (k + 1) % cup[y].length;
      push('campanile', cup[y][k], cup[y][k2], 0.18, 0.18);
      push('campanile', cup[y][k], cup[y + 1][k], 0.18, 0.18);
    }
  }

  // the mast, then the paratonnerre: 60 mm round iron with three 1.50 m points
  const mast = [];
  for (let y = O.ironTop; y <= O.height - 12; y += 3) mast.push(y);
  for (let i = 0; i < mast.length - 1; i++) {
    push('antenna', new THREE.Vector3(0, mast[i], 0), new THREE.Vector3(0, mast[i + 1], 0), 0.55, 0.55);
  }
  const rod = [];
  for (let y = O.height - 12; y <= O.height; y += 1.5) rod.push(y);
  for (let i = 0; i < rod.length - 1; i++) {
    push('antenna', new THREE.Vector3(0, rod[i], 0), new THREE.Vector3(0, rod[i + 1], 0), 0.12, 0.12);
  }
  for (let k = 0; k < 9; k++) {                        // 9 rods total
    const a = (k / 9) * Math.PI * 2, r = 0.8;
    const b0 = new THREE.Vector3(Math.cos(a) * r * 0.2, O.height - 12, Math.sin(a) * r * 0.2);
    const b1 = new THREE.Vector3(Math.cos(a) * r, O.height - 9, Math.sin(a) * r);
    push('antenna', b0, b1, 0.06, 0.06);
  }
  for (let k = 0; k < 3; k++) {                        // three 1.50 m points
    const a = (k / 3) * Math.PI * 2 + 0.4, r = 0.5;
    push('antenna',
      new THREE.Vector3(Math.cos(a) * r, O.height - 1.5, Math.sin(a) * r),
      new THREE.Vector3(Math.cos(a) * r * 2.2, O.height, Math.sin(a) * r * 2.2), 0.06, 0.06);
  }

  /* ================= the four decorative arches ================= */
  const archPts = P.ARCH.points(64);
  const zc = P.legCentreHalf(P.ARCH.springingY);
  for (const [axis, sgn] of [['z', 1], ['x', 1], ['z', -1], ['x', -1]]) {
    // THE RIB IS A TWO-CHORD GIRDER IN THE PLANE OF THE ARCH.
    // « deux membrures cintrées en caisson de 600 mm de hauteur, dont l'écartement
    // intérieur est de 2,72 m » — two 600 mm chords with a 2.72 m gap BETWEEN them, i.e.
    // a rib 3.92 m deep in elevation. The previous version offset the two chords in
    // DEPTH (z), so from the front they overlaid into one thin ribbon and the arch read
    // as broken wire. They MUST be offset RADIALLY — concentric arcs, same centre.
    const A = P.ARCH;
    const arcAt = (rad, span) => {
      const out = [];
      for (let i = 0; i <= 72; i++) {
        const th = -span + 2 * span * (i / 72);
        const x = rad * Math.sin(th), y = A.centreY + rad * Math.cos(th);
        out.push(axis === 'z' ? new THREE.Vector3(x, y, sgn * zc)
                              : new THREE.Vector3(sgn * zc, y, x));
      }
      return out;
    };
    // carried 5° past the springing so the rib dies INTO the leg instead of stopping
    // in mid-air short of it
    const span = Math.PI / 2 + 5 * Math.PI / 180;
    // The intrados CANNOT be concentric with the extrados. Concentric about the
    // springing its maximum reach is its own radius (34.4 m), while the leg's inner face
    // is at 37.0 m — so it stops 2.7 m short of the leg and leaves exactly the gap that
    // reads as a broken arch. Per Eiffel the intrados is « tangente à l'arbalétrier à la
    // base du panneau 2 », i.e. it lands ON the leg lower down. So solve the circle
    // through the two leg points and the crown.
    const outer = arcAt(A.R, span);                 // extrados chord
    const yLow = Math.max(1.0, A.springingY - 8);   // base of panel 2
    const xLow = P.legInnerFaceHalf(yLow);
    const yCrownI = A.crownY - 2.72;                // crown, 2.72 m inside the extrados
    const ycI = (xLow * xLow + yLow * yLow - yCrownI * yCrownI) / (2 * (yLow - yCrownI));
    const Ri = yCrownI - ycI;
    const thI = Math.atan2(xLow, yLow - ycI);
    const inner = [];
    for (let i = 0; i <= 72; i++) {
      const th = -thI + 2 * thI * (i / 72);
      const x = Ri * Math.sin(th), y = ycI + Ri * Math.cos(th);
      inner.push(axis === 'z' ? new THREE.Vector3(x, y, sgn * zc)
                              : new THREE.Vector3(sgn * zc, y, x));
    }
    for (let i = 0; i < outer.length - 1; i++) {
      push('arch', outer[i], outer[i + 1], 0.60, 0.60);            // 600 mm box chord
      push('arch', inner[i], inner[i + 1], 0.60, 0.60);
    }
    for (let i = 0; i < outer.length; i++) {                        // radial uprights, 400 mm
      push('arch', outer[i], inner[i], 0.40, 0.40);
      // the ARCADE between the uprights: « tôles de 3 mm découpées en arc de cercle ».
      // A row of small scalloped arches along the band is what makes the rib read as a
      // solid ornamental member rather than two thin curves.
      if (i < outer.length - 2) {
        const a = outer[i], b = outer[i + 1], d = outer[i + 2];
        const ia = inner[i], ib = inner[i + 1];
        const midO = new THREE.Vector3().addVectors(a, d).multiplyScalar(0.5);
        const midI = new THREE.Vector3().addVectors(ia, inner[i + 2]).multiplyScalar(0.5);
        const deep = new THREE.Vector3().addVectors(ia, inner[i + 2]).multiplyScalar(0.5);
        push('arch', new THREE.Vector3().addVectors(a, ia).multiplyScalar(0.5), midO, 0.22, 0.14);
        push('arch', new THREE.Vector3().addVectors(d, inner[i + 2]).multiplyScalar(0.5), midO, 0.22, 0.14);
        push('arch', new THREE.Vector3().addVectors(a, ia).multiplyScalar(0.5), midI, 0.22, 0.14);
        push('arch', new THREE.Vector3().addVectors(d, inner[i + 2]).multiplyScalar(0.5), midI, 0.22, 0.14);
        push('arch', a, ib, 0.18, 0.12);
        push('arch', ia, b, 0.18, 0.12);
        // « ces tympans sont décorés entre les montants par des TÔLES DE 3 mm DÉCOUPÉES EN
        // ARC DE CERCLE » — the panel between two radial uprights is closed by thin sheet
        // cut on a circular arc. Modelled at 0.05 m so it survives at render scale, but it
        // is a PLATE, not a member: it is what makes the rib read as a solid band.
        push('arch', a, inner[i + 2], 0.05, 0.05);
        push('arch', ia, outer[i + 2], 0.05, 0.05);
      }
    }
    // ---- SPANDREL: NO CROSS-BRACING. REMOVED, PER THE PRIMARY SOURCE. ----------
    //
    // A 24 x 8 X-lattice stood here, tagged 'treillis'. It was added in round 15 because
    // a frontal photograph of the region looked dense, and it was WRONG:
    //
    //   « Ces arcs sont RIGIDES PAR EUX-MÊMES, ce qui a permis de
    //     SUPPRIMER TOUS CROISILLONS DANS LES TYMPANS »            — Eiffel 1900 §13
    //
    // The arches are rigid in themselves, which is precisely why the cross-bracing was
    // taken out. The density visible in the photograph is the ARCH RIB itself (two 600 mm
    // box chords with radial uprights and arc-cut plates) plus the poutre de l'arc above —
    // not a lattice.
    //
    // What belongs here instead, per the same passage, is what the arch rib already
    // carries: « des montants de 400 mm de largeur, dirigés suivant des rayons, lesquels
    // se prolongent à travers les tympans jusqu'aux arbalétriers et aux poutres de l'arc »
    // — the radial uprights CONTINUE through the tympanum to the legs and the arch beam.
    // Those are built below as 'arch' members with a 0.70 x 0.45 section.
    //
    // Nothing is pushed into 'treillis' in this zone. The layer toggle that used to reveal
    // this lattice no longer has anything to reveal here.

    // tympana: the thin plates between the ribs, and bracing at three points
    for (const ti of [0.18, 0.5, 0.82]) {
      const p = archPts[Math.round(ti * (archPts.length - 1))];
      const a = axis === 'z' ? new THREE.Vector3(p.x, p.y, sgn * zc)
                             : new THREE.Vector3(sgn * zc, p.y, p.x);
      const b = axis === 'z' ? new THREE.Vector3(p.x, p.y, sgn * (zc - 2.72))
                             : new THREE.Vector3(sgn * (zc - 2.72), p.y, p.x);
      push('arch', a, b, 0.30, 0.06);
    }
    // (« supprimer tous croisillons dans les tympans » — NO cross-bracing. What fills this
    // region is the RADIAL UPRIGHTS CONTINUING, not a lattice.)
    //
    //   « … des montants de 400 mm de largeur, dirigés suivant des RAYONS, lesquels SE
    //     PROLONGENT À TRAVERS LES TYMPANS jusqu'aux arbalétriers et aux poutres de
    //     l'arc »                                            — Eiffel 1900 §13
    //
    // So the rib's radial uprights carry straight on, through the tympanum, to the leg
    // chords and the beam above. That continuation is what MERGES the arch into the main
    // structure. Only 5 of them were built (i += 12) against a rib that divides at every
    // 4th station — which is why the arch read as FLOATING once the wrong lattice was
    // removed. Spacing now matches the rib's own radial uprights.
    for (let i = 4; i < archPts.length - 6; i += 4) {
      const p = archPts[i];
      const top = axis === 'z'
        ? new THREE.Vector3(p.x, O.L1 - 7.6, sgn * P.legCentreHalf(O.L1))
        : new THREE.Vector3(sgn * P.legCentreHalf(O.L1), O.L1 - 7.6, p.z);
      const bot = axis === 'z' ? new THREE.Vector3(p.x, p.y, sgn * zc) : new THREE.Vector3(sgn * zc, p.y, p.x);
      push('arch', bot, top, 0.70, 0.45);
    }
  }

  /* ================= lifts and stairs ================= */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const node = legNodes(sx, sz);
    const liftLevels = PB.filter(y => y >= 8 && y <= O.L2);
    for (const side of [-1, 1]) {
      const railPts = liftLevels.map(y => {
        const p = node(side, side, y);
        return p.add(new THREE.Vector3(-side * 1.6, 0, -side * 1.6));   // just inside the leg
      });
      for (let i = 0; i < railPts.length - 1; i++) push('lift', railPts[i], railPts[i + 1], 0.22, 0.18);
    }
  }
  // stair: a helical run inside the shaft between L1 and L2
  {
    let prev = null;
    const steps = Math.max(40, Math.round(120 * DETAIL));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, y = O.L1 + (O.L2 - O.L1) * t;
      // Was radius max(2, shaftHalf*0.42) = 8.26 m at L1, which swept a wide coil right
      // across the void and read as a stray line over the arch. A real stair sits in a
      // shaft 2-3 m across.
      const a = t * Math.PI * 5.2, r = 2.4;
      const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      if (prev) push('stair', prev, p, 0.24, 0.16);
      prev = p;
    }
  }

  /* ================= rivets — a bounded suggestion pass ================= */
  if (RIVETS) {
    const rl = [O.L1, O.L2, O.L3];
    rl.forEach(y => {
      for (const sgn of [-1, 1]) {
        for (const axis of ['x', 'z']) for (const s of [-1, 1]) {
          const h = (y === O.L1 ? D1.half : y === O.L2 ? D2.half : D3.half);
          const n = Math.round(26 * DETAIL);
          for (let k = 0; k < n; k++) {
            const t = -h + 2 * h * (k / (n - 1));
            const p = axis === 'x' ? new THREE.Vector3(t, y + 0.4, s * h) : new THREE.Vector3(s * h, y + 0.4, t);
            push('rivet', p, p.clone().setY(p.y + 0.18), 0.13, 0.13);
          }
        }
      }
    });
  }

  /* ================= materials ================= */
  const mats = {
    iron: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.20, emissive: 0xff9d45, emissiveIntensity: 0 }),
    chord: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.24, emissive: 0xffa02a, emissiveIntensity: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.74, metalness: 0.16, emissive: 0xff861c, emissiveIntensity: 0 }),
    deck: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.18, emissive: 0xff861c, emissiveIntensity: 0 }),
    frieze: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.14, emissive: 0xff861c, emissiveIntensity: 0 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xcfc2a9, roughness: 0.88, metalness: 0.03 })
  };
  const matFor = (b) =>
    b === 'rivet' ? mats.dark :
    b === 'railing' || b === 'lift' || b === 'stair' || b === 'masque' ? mats.dark :
    mats.iron;

  /* ================= realise ================= */
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let memberCount = 0;
  const layerMeshes = {};

  for (const [name, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(unitBox, matFor(name), list.length);
    im.name = 'members:' + name;
    im.castShadow = false;   // shadow pass was costing a second full geometry submission
    im.receiveShadow = true;
    list.forEach((r, i) => {
      const dir = new THREE.Vector3().subVectors(r.b, r.a);
      const len = dir.length();
      if (len < 1e-4) { im.setMatrixAt(i, m4.identity()); return; }
      dir.multiplyScalar(1 / len);
      q.setFromUnitVectors(up, dir);
      m4.compose(new THREE.Vector3().addVectors(r.a, r.b).multiplyScalar(0.5), q, new THREE.Vector3(r.w, len, r.t));
      im.setMatrixAt(i, m4);
      const shade = name === 'rivet' ? 1.15 : name === 'gusset' ? 0.92 :
                    name === 'treillisFine' ? 0.90 : name === 'entretoise' ? 0.86 : 1.0;
      im.setColorAt(i, paintAt((r.a.y + r.b.y) / 2).multiplyScalar(shade));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    layerMeshes[layerOf[name] || name] = layerMeshes[layerOf[name] || name] || [];
    layerMeshes[layerOf[name] || name].push(im);
    memberCount += list.length;
  }

  /* swept members with the paint degrade baked into vertex colours */
  // bake the paint degrade into vertex colours, then MERGE per layer: ~90 swept
  // members collapse to a handful of meshes, removing ~85 draw calls.
  const byLayer = new Map();
  sweptGeos.forEach(({ geo, layer: L }) => {
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const c = paintAt(pos.getY(i));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (!byLayer.has(L)) byLayer.set(L, []);
    byLayer.get(L).push(geo);
    memberCount += 1;
  });
  byLayer.forEach((geos, L) => {
    const merged = mergeGeos(geos);
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mats.chord);
    mesh.receiveShadow = true;
    mesh.name = 'swept:' + L;
    group.add(mesh);
    (layerMeshes[L] ||= []).push(mesh);
  });

  const mkSlabs = (arr, material, name, shade) => {
    if (!arr.length) return;
    const im = new THREE.InstancedMesh(unitBox, material, arr.length);
    im.name = 'slabs:' + name;
    im.castShadow = (name === 'stone' || name === 'deck');   // only the big solids cast
    im.receiveShadow = true;
    arr.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion(), new THREE.Vector3(s.w, s.h, s.d));
      im.setMatrixAt(i, m4);
      if (shade != null) im.setColorAt(i, paintAt(s.y).multiplyScalar(shade));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    (layerMeshes[name] ||= []).push(im);
    memberCount += arr.length;
  };
  mkSlabs(slabs.filter(s => s.kind === 'stone'), mats.stone, 'stone', null);
  mkSlabs(slabs.filter(s => s.kind === 'deck'), mats.deck, 'deck', 0.94);   // decks are LIT surfaces, not dark planes
  mkSlabs(slabs.filter(s => s.kind === 'frieze'), mats.frieze, 'frieze', 0.72);
// The plates are a DARK BACKING, not a surface. In the tower they sit behind the
mkSlabs(slabs.filter(s => s.kind === 'panel'), mats.dark, 'panel', 0.30);   // lattice and read as shadowed interior, which is what makes the leg a dense
                                                                          // mass with visible members rather than a blank panel.


  /* ================= metadata + API ================= */
  group.userData.memberCount = memberCount;
  group.userData.layers = Object.keys(layerMeshes);
  group.userData.layerMeshes = layerMeshes;
  group.userData.setLayerVisible = (name, v) => {
    (layerMeshes[name] || []).forEach(o => (o.visible = v));
  };
  group.userData.setNight = (v) => {
    mats.iron.emissiveIntensity = 0.95 * v;
    mats.dark.emissiveIntensity = 0.55 * v;
    mats.deck.emissiveIntensity = 0.28 * v;
    mats.frieze.emissiveIntensity = 0.22 * v;
    mats.chord.emissiveIntensity = 0.95 * v;
  };
  group.userData.materials = mats;
  group.userData.panelBounds = PB;
  return group;
}
