/**
 * profile.js — the tower's outer envelope as a FACETED POLYLINE.
 *
 * No three.js dependency: this module is pure geometry so that the harness and any
 * 2-D tool can use it without a renderer.
 *
 * The rule (APPROACH §4, PLAN Rule 4). Eiffel, 1900: « La courbe extérieure est
 * donnée par des changements d'inclinaison… de deux en deux panneaux » — the outer
 * "curve" is piecewise-linear, with a slope break every two panels, and it is a
 * plotted bending-moment diagram. So: DO NOT fit a smooth curve as the definition.
 *
 * The three-segment exponential below is a SAMPLER only — it is used to evaluate the
 * envelope at the facet boundaries, and it reproduces the four attested half-widths
 * to 0.012 %. Everything downstream reads `profileHalf()`, which evaluates the
 * POLYLINE, so a smooth curve cannot leak back in.
 */

/* ------------------------------------------------------------------ *
 * Attested anchors — the profile MUST pass through these
 * ------------------------------------------------------------------ */
export const ANCHORS = [
  { y: 0,      half: 62.45,  source: 'ATTESTED 124.90 m base (official table + dimensioned elevation)' },
  { y: 57.63,  half: 35.345, source: 'ATTESTED 70.69 m deck side' },
  { y: 115.73, half: 20.48,  source: 'ATTESTED 40.96 m deck side' },
  { y: 276.13, half: 9.325,  source: 'ATTESTED 18.65 m deck side' }
];

export const OFFICIAL = {
  height: 330.0,          // with antenna
  ironTop: 300.65,        // top of the ironwork
  baseOuter: 124.906,     // dimensioned elevation
  baseInner: 74.238,      // clear gap between piers
  pierWidth: 25.335,
  L1: 57.63, L2: 115.73, L3: 276.13,   // platform heights AGL
  legWidthAtL2: 10.41,    // documented: the leg's face width at the 2nd platform
  arch: { springing: 4.6, riseSpan: 39.0 }
};

/* ------------------------------------------------------------------ *
 * The sampler: three exponential segments, exact through the anchors.
 * Decay constants 0.009876 / 0.009397 / 0.004902 — the rate HALVES above
 * platform 2. A single exponential cannot describe this tower.
 * ------------------------------------------------------------------ */
const SEGMENTS = [
  { y0: 0.00,   y1: 57.63,  k: 0.009876, w0: 62.45  },
  { y0: 57.63,  y1: 115.73, k: 0.009397, w0: 35.345 },
  { y0: 115.73, y1: 276.13, k: 0.004902, w0: 20.48  }
];

export function sampledHalf(y) {
  if (y <= 0) return SEGMENTS[0].w0;
  for (const s of SEGMENTS) {
    if (y <= s.y1) return s.w0 * Math.exp(-s.k * (y - s.y0));
  }
  // Above the third platform the exponential is an extrapolation and overshoots,
  // so the summit is tapered explicitly to the ironwork top.
  const t = Math.min(1, Math.max(0, (y - 276.13) / (OFFICIAL.ironTop - 276.13)));
  const s = t * t * (3 - 2 * t);
  return 9.325 * (1 - 0.72 * s);
}

/* ------------------------------------------------------------------ *
 * Facet boundaries — where the slope is allowed to change.
 *
 * Per APPROACH §4: the panel schedule is only partly read, so it is NOT used to
 * place these. The profile is driven by the attested anchors; the panels supply
 * only the RHYTHM. An error in the schedule therefore produces a slightly wrong
 * rhythm, never a wrong silhouette.
 *
 * Breaks at every platform level, plus even subdivisions within each zone → 15 facets.
 * ------------------------------------------------------------------ */
export const FACET_LEVELS = [0, 57.63, 115.73, 226.13, 276.13, OFFICIAL.ironTop];
const SUBDIVISIONS = [4, 3, 4, 2, 2];

function buildBounds() {
  const out = [];
  for (let z = 0; z < FACET_LEVELS.length - 1; z++) {
    const a = FACET_LEVELS[z], b = FACET_LEVELS[z + 1], n = SUBDIVISIONS[z];
    for (let i = 0; i < n; i++) out.push(a + (b - a) * (i / n));
  }
  out.push(FACET_LEVELS[FACET_LEVELS.length - 1]);
  return out;
}

export const FACET_BOUNDS = buildBounds();

/** The faceted profile: straight segments between sampled boundary widths. */
export const FACETS = (() => {
  const pts = FACET_BOUNDS.map((y) => ({ y, half: sampledHalf(y) }));
  // force the attested anchors exactly (they are already hit by construction)
  for (const a of ANCHORS) {
    const near = pts.reduce((best, p) => (Math.abs(p.y - a.y) < Math.abs(best.y - a.y) ? p : best), pts[0]);
    if (Math.abs(near.y - a.y) < 1e-6) near.half = a.half;
  }
  return pts;
})();

/** Evaluate the POLYLINE — the definition. Never the exponential. */
export function profileHalf(y) {
  if (y <= FACETS[0].y) return FACETS[0].half;
  if (y > OFFICIAL.ironTop) {
    // antenna: a thin tapering spike 300.65 → 330 m
    // Continue from the shaft top so there is no step at 300.65 m.
    const t = Math.min(1, (y - OFFICIAL.ironTop) / (OFFICIAL.height - OFFICIAL.ironTop));
    return 1.15 * (1 - 0.74 * t);
  }
  for (let i = 0; i < FACETS.length - 1; i++) {
    const a = FACETS[i], b = FACETS[i + 1];
    if (y <= b.y) return a.half + (b.half - a.half) * ((y - a.y) / (b.y - a.y));
  }
  return FACETS[FACETS.length - 1].half;
}

/* ------------------------------------------------------------------ *
 * The arch — DERIVED FROM CONSTRAINTS, not from a contested number.
 *
 * APPROACH §4: the published span (74 m) and the number on Plate XI
 * (« Portée de l'arc 30,246 ») disagree, and the plate attribution is suspect
 * because the scans carry bleed-through from facing pages. So derive it:
 *
 *   1. it springs from BOTH legs' inner faces;
 *   2. the legs are prismatic below L1 with a documented width of 25.335 m;
 *   3. Eiffel states it is a CIRCLE.
 *
 * Those three facts fix it. Half-span = baseOuter/2 − pierWidth = 37.115 m, which is
 * exactly the clear inner gap / 2 (74.238/2 = 37.119) — so the published 74 m and the
 * measured 74.24 m agree with each other AND with the leg geometry. The Plate XI
 * number is therefore a sub-element, not the arch span.
 * ------------------------------------------------------------------ */
export const ARCH = (() => {
  // EIFFEL'S OWN DIMENSION: « Des arcs de 74 mètres de DIAMÈTRE se développent entre les
  // montants à l'étage inférieur » (L2118) — a DIAMETER, so the arch is a SEMICIRCLE:
  // R = the half-span, rise = R, included angle exactly 180°.
  //
  // This replaces R 37.17 / rise 39 / 185.7°, which came from a "39 m above ground"
  // figure carried by Wikipedia. The research's own note flags that figure as
  // **NOT FOUND in Eiffel 1900**, and a 185.7° arc is not a semicircle of any diameter.
  const a = OFFICIAL.baseInner / 2;                 // half-span = the semicircle's radius
  const yE = OFFICIAL.arch.springing;               // springing height
  const R = a;
  const yc = yE;                                    // centre AT the springing level
  const phi = Math.PI / 2;                          // exactly a semicircle
  return {
    halfSpan: a, R, centreY: yc, springingY: yE, crownY: yE + R,
    centreAboveSpringing: 0,
    includedAngleDeg: 180,
    points: (n = 64) => {
      // y = yc + R·cos θ, NOT yc − R·cos θ. With the minus the arc bows DOWNWARD,
      // the endpoints land at 2·yc − yE instead of at the springing, and the void
      // falls below ground — which silently removes the opening from the silhouette.
      const out = [];
      for (let i = 0; i <= n; i++) {
        const th = -phi + (2 * phi) * (i / n);
        out.push({ x: R * Math.sin(th), y: yc + R * Math.cos(th) });
      }
      return out;
    }
  };
})();

/* ==================================================================== *
 * THE VOIDS — the part I keep getting wrong.
 *
 * A recurring fault in my renders: putting members (poles and wires) into
 * spaces that are EMPTY in the building. Eiffel is explicit about where the
 * emptiness is:
 *
 *  « la partie supérieure de la Tour, dans laquelle tous les arbalétriers sont
 *    réunis solidairement par un treillis, ou la partie inférieure formée par
 *    quatre montants isolés, dont chacun est constitué par quatre arbalétriers
 *    réunis par des treillis »   (L2226–2229)
 *
 *  « il est inutile d'entretoiser la Tour dans les divers plans horizontaux »  (L10147)
 *
 * So the boundary is the 2nd PLATFORM, not the 1st:
 *
 *   GROUND → 115.73 m   FOUR ISOLATED UPRIGHTS. The space between them is VOID.
 *                       The only members crossing it are the two belts
 *                       (L1 at 57.63, L2 at 115.73) and the decorative arches.
 *   ABOVE 115.73 m      ONE CLOSED CAISSON — a hollow box. Walls latticed,
 *                       interior empty and dark.
 *
 * And every leg is itself a hollow box (a caisson, 800 mm clear internally).
 *
 * Getting this wrong is not subtle: it fills the tower's most characteristic
 * void — the one you see straight through, ground to 2nd platform — with a
 * solid mass. Which is exactly what stage 1 drew.
 * ==================================================================== */

/* ====================================================================
 * THE LEG — rebuilt from Eiffel's own figures, which outrank every surveyed value.
 *
 *   « Depuis le sol jusqu'au niveau inférieur des grandes poutres en treillis qui
 *     supportent le premier étage […] ces montants ont une inclinaison constante et
 *     leurs faces une largeur également constante de 15 mètres »      (L2104–2106)
 *   Leg width at the 2nd floor: 10.41 m, down from a constant 15.00 m.  (L2110)
 *
 * So: face width CONSTANT 15.00 m from the ground to L1, then tapering to 10.41 m at L2.
 *
 * RECORDED SO IT IS NOT REPEATED. The previous model used `legWidth = 25.335`
 * prismatic, from the dimensioned elevation's base chain `25,335 | 74,238 | 25,335`.
 * That chain is drawn at *« Niveau des centres des appuis 36,00 m »* and it is a
 * **`pilier`** dimension — the masonry FEET, 0→4 m, 25 m square. The official
 * 124.90 / 74.24 pair describes the same feet, not the iron. `pile` is the leg.
 * Using a plinth width as a prismatic leg collapsed the clear gap to 20.02 m — 28 %
 * of the width — where frontal photographs show roughly half. A note had dismissed
 * this as a "2.84 m false problem" rather than reconciling it; it is no conflict at
 * all, because the two figures measure two different objects.
 * ==================================================================== */
export const LEG = {
  widthAtGround: 15.00,   // Eiffel L2106 — the IRON leg, constant up to L1
  widthAtL2: 10.41,       // Eiffel L2110
  archInner: 37.119,      // the clear gap / 2 — and where the arch springs
  innerAtL1: 15.75,       // DERIVED: outline at L1 (deck 70.69 less a 4.60 m overhang) − 15.00
  innerAtL2: 5.44         // the caisson half (31.70 / 2) − 10.41
};

/**
 * The inner face is ONE STRAIGHT LINE below L1 — Eiffel's *plan* — anchored at the arch
 * springing, so the arc always meets both legs exactly and the two can never drift apart.
 * (Anchoring it at y=0 instead left the arch 1.71 m clear of the leg.)
 */
const INNER_SLOPE = (LEG.innerAtL1 - LEG.archInner) / (OFFICIAL.L1 - OFFICIAL.arch.springing);

/** Cardinal width of one iron leg: constant 15.00 m to L1, then tapering to 10.41 m. */
export function legWidth(y) {
  if (y <= OFFICIAL.L1) return LEG.widthAtGround;
  if (y >= OFFICIAL.L2) return LEG.widthAtL2;
  const t = (y - OFFICIAL.L1) / (OFFICIAL.L2 - OFFICIAL.L1);
  return LEG.widthAtGround + (LEG.widthAtL2 - LEG.widthAtGround) * t;
}

/** The leg's inner face — a PLANE below L1 (Eiffel); a taper above. */
export function legInnerFaceHalf(y) {
  if (y <= OFFICIAL.L1) return LEG.archInner + INNER_SLOPE * (y - OFFICIAL.arch.springing);
  if (y >= OFFICIAL.L2) return LEG.innerAtL2;
  const t = (y - OFFICIAL.L1) / (OFFICIAL.L2 - OFFICIAL.L1);
  return LEG.innerAtL1 + (LEG.innerAtL2 - LEG.innerAtL1) * t;
}

/** Outer edge of the iron leg. The decks overhang it; the plinths stand outside it. */
export function legOuterHalf(y) {
  return legInnerFaceHalf(y) + legWidth(y);
}

/** Distance of a leg's centre from the tower axis. */
export function legCentreHalf(y) { return legInnerFaceHalf(y) + legWidth(y) / 2; }

/** Above L2: one hollow caisson. Walls latticed; interior void. */
export function caissonAt(y) {
  if (y <= OFFICIAL.L2) return null;
  const outer = shaftHalf(y);
  const wall = Math.min(1.6, outer * 0.30);
  return { outerHalf: outer, wall, innerHalf: Math.max(0, outer - wall) };
}

/**
 * Material bands across a vertical section through the tower's axis.
 * Anything not covered is VOID.
 */
export function sectionBands(y) {
  const eps = 0.01;
  const beltT = 3.6;
  if (Math.abs(y - OFFICIAL.L1) < beltT / 2 || Math.abs(y - OFFICIAL.L2) < beltT / 2) {
    return [{ x0: -legOuterHalf(y), x1: legOuterHalf(y), kind: 'belt' }];
  }
  if (y <= OFFICIAL.L2) {
    const inner = legInnerFaceHalf(y), outer = legOuterHalf(y);
    if (inner <= eps) return [{ x0: -outer, x1: outer, kind: 'leg' }];
    return [{ x0: -outer, x1: -inner, kind: 'leg' }, { x0: inner, x1: outer, kind: 'leg' }];
  }
  const c = caissonAt(y);
  if (!c) return [];
  return [
    { x0: -c.outerHalf, x1: -c.innerHalf, kind: 'caissonWall' },
    { x0: c.innerHalf, x1: c.outerHalf, kind: 'caissonWall' }
  ];
}

/**
 * Material rectangles in PLAN. Below L2: FOUR legs with a cross-shaped void
 * between them. Above L2: a hollow square ring.
 */
export function planRects(y) {
  if (y <= OFFICIAL.L2) {
    const c = legCentreHalf(y), w = legWidth(y), out = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      out.push({ x: sx * c, z: sz * c, w, d: w, kind: 'leg' });
    }
    return out;
  }
  const ca = caissonAt(y);
  if (!ca) return [];
  const o = ca.outerHalf, i = ca.innerHalf, t = o - i;
  return [
    { x: 0, z: (o + i) / 2, w: 2 * o, d: t, kind: 'caissonWall' },
    { x: 0, z: -(o + i) / 2, w: 2 * o, d: t, kind: 'caissonWall' },
    { x: (o + i) / 2, z: 0, w: t, d: 2 * o, kind: 'caissonWall' },
    { x: -(o + i) / 2, z: 0, w: t, d: 2 * o, kind: 'caissonWall' }
  ];
}

/** Is this plan point inside the great void? Used as a generator assertion. */
export function isVoidAt(x, z, y) {
  if (y > OFFICIAL.L2) {
    const ca = caissonAt(y);
    if (!ca) return false;
    return Math.max(Math.abs(x), Math.abs(z)) < ca.innerHalf;
  }
  if (Math.abs(y - OFFICIAL.L1) < 2.0 || Math.abs(y - OFFICIAL.L2) < 2.0) return false; // belts
  const inner = legInnerFaceHalf(y);
  return Math.abs(x) < inner && Math.abs(z) < inner;
}

/** Fraction of the plan square that is EMPTY, on a grid. */
export function voidFraction(y, n = 64) {
  const half = y <= OFFICIAL.L2 ? legOuterHalf(y) : (caissonAt(y)?.outerHalf ?? 0);
  if (half <= 0) return 1;
  const rects = planRects(y);
  let empty = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -half + 2 * half * ((i + 0.5) / n);
    const z = -half + 2 * half * ((j + 0.5) / n);
    const solid = rects.some(r => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2);
    if (!solid) empty++;
  }
  return empty / (n * n);
}

/* ------------------------------------------------------------------ *
 * The SHAFT is not the envelope.
 *
 * The four anchors are DECK EDGES (PLAN Rule 2). The lattice shaft sits inside
 * them — and the amount is documented, not guessed: Eiffel's single upper caisson
 * is 31.70 m at 114.73 m and 10.00 m at 276.13 m, against decks of 40.96 and 18.65.
 * So the decks overhang by (40.96−31.70)/2 = 4.63 m and (18.65−10.00)/2 = 4.325 m
 * per side. Drawing the deck envelope as a continuous outline (which stage 1 did)
 * therefore makes the tower uniformly too fat between decks AND removes the three
 * horizontal accents that carry its identity.
 * ------------------------------------------------------------------ */
const OVERHANG = [
  { y: 57.63,  m: 1.50,  source: 'INFERRED — the legs converge to roughly the deck width at L1' },
  { y: 115.73, m: 4.63,  source: 'ATTESTED — (40.96 − 31.70)/2' },
  { y: 276.13, m: 4.325, source: 'ATTESTED — (18.65 − 10.00)/2' },
  { y: 300.65, m: 1.50,  source: 'INFERRED — taper toward the antenna base' }
];

export function overhangAt(y) {
  // BELOW L1 the legs ARE the envelope: there is nothing to inset them from.
  // Subtracting an overhang there folds the legs inward and puts a hard kink at the
  // 1st platform, which is what stage 1 looked like.
  if (y <= OFFICIAL.L1) return 0;
  for (let i = 0; i < OVERHANG.length - 1; i++) {
    const a = OVERHANG[i], b = OVERHANG[i + 1];
    if (y <= b.y) return a.m + (b.m - a.m) * ((y - a.y) / (b.y - a.y));
  }
  return OVERHANG[OVERHANG.length - 1].m;
}

/**
 * The lattice shaft — taken DIRECTLY from the documented caisson, not derived from the
 * envelope. Deriving it (envelope minus the deck overhang) ran 4–10 % narrow through the
 * middle of the upper tower, which reads as the whole shaft being too thin.
 *   DOCUMENTED: 31.70 m at 114.73  ->  10.00 m at 276.13
 */
const CAISSON = { y0: 114.73, w0: 15.85, y1: 276.13, w1: 5.00 };   // half-widths
export function shaftHalf(y) {
  if (y <= 0) return profileHalf(0);
  const slope = (CAISSON.w1 - CAISSON.w0) / (CAISSON.y1 - CAISSON.y0);
  if (y <= CAISSON.y1) return Math.max(CAISSON.w1, CAISSON.w0 + slope * (y - CAISSON.y0));
  // above the 3rd platform the caisson runs out; the campanile takes over
  return Math.max(1.55, CAISSON.w1 + slope * (y - CAISSON.y1));
}

export const DECKS = [
  { y: 57.63,  half: 35.345, thick: 2.4,  name: '1st' },
  { y: 115.73, half: 20.48,  thick: 2.1,  name: '2nd' },
  { y: 276.13, half: 9.325,  thick: 1.55, name: '3rd' }
];

/* ------------------------------------------------------------------ *
 * Metrics — the numbers the eye is checking
 * ------------------------------------------------------------------ */
export function metrics() {
  const baseToHeight = OFFICIAL.baseOuter / OFFICIAL.height;

  // How much WIDER a naive straight base-to-apex chord is than the truth.
  const chordHalf = (y) => (OFFICIAL.baseOuter / 2) * (1 - y / OFFICIAL.height);
  const concavity = ANCHORS.filter((a) => a.y > 0).map((a) => ({
    y: a.y,
    real: a.half,
    straightChord: chordHalf(a.y),
    ratio: chordHalf(a.y) / a.half
  }));

  // Anchor fidelity of the SAMPLER (the polyline is exact by construction).
  const samplerErr = ANCHORS.map((a) => ({
    y: a.y,
    want: a.half,
    got: sampledHalf(a.y),
    errPct: Math.abs(sampledHalf(a.y) - a.half) / a.half * 100
  }));

  return { baseToHeight, concavity, samplerErr, facetCount: FACETS.length - 1 };
}
