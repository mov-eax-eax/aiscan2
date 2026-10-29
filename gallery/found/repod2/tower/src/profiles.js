import raw from './tutorial-profile.json';

/* ===========================================================================
 * Two silhouettes for one generator.
 *
 * Both are normalised to a 100-unit tall world so the same camera rig frames
 * either, and both describe themselves the same way:
 *   halfWidth(y)  outer half-width of the envelope
 *   voidHalf(y)   half-width of the open space through the middle (0 = solid)
 *   platforms     [y0, y1, halfWidth] slabs
 *   shaft / campanile / spire / antenna   the stages above the second floor
 * 'style' picks how the legs are built: the sketch draws them as solid bands,
 * the real tower's legs are open box caissons.
 * =========================================================================== */

const lerpTable = (t, step, y) => {
  const f = y / step;
  if (f <= 0) return t[0];
  const last = t.length - 1;
  if (f >= last) return t[last];
  const i = Math.floor(f);
  return t[i] + (t[i + 1] - t[i]) * (f - i);
};

/* ---- 1. the wikiHow sketch, measured off the illustration ---------------- */
const T_OUT = raw.outer, T_IN = raw.inner, T_STEP = raw.kStep;

export const sketch = {
  id: 'sketch',
  label: 'the sketch',
  note: 'wikiHow method 1 &middot; 1.417 : 1',
  style: 'solid',
  height: 100,
  halfWidth: (y) => lerpTable(T_OUT, T_STEP, y) * 100,
  voidHalf: (y) => {
    const v = lerpTable(T_IN, T_STEP, y) * 100;
    return v > 1.0 ? v : 0;
  },
  platforms: [[24.5, 27.0, 18.07], [45.0, 47.0, 8.39]],
  shaft: [47.0, 91.0],
  campanile: [91.0, 95.8],
  spire: [95.8, 100],
  antenna: null,
  midDeck: null,
  plinths: false,
  belts: null,
  panels: { leg: 4, mid: 4, shaft: 16 },
};

/* ---- 2. Eiffel's own elevation, measured off Plate I of 1900 ------------- */
const ENVELOPE = [
  [0, 59.6], [5, 58.64], [10, 53.13], [15, 50.71], [20, 48.29], [25, 45.87],
  [30, 43.44], [35, 40.95], [40, 38.45], [45, 35.89], [50, 33.61], [55, 31.78],
  [60, 30.09], [65, 28.40], [70, 26.79], [75, 25.24], [80, 23.85], [85, 22.60],
  [90, 21.36], [95, 20.18], [100, 19.08], [105, 17.91], [110, 16.73], [115, 15.63],
  [120, 14.97], [125, 14.38], [130, 13.80], [135, 13.21], [140, 12.70], [145, 12.18],
  [150, 11.74], [155, 11.23], [160, 10.79], [165, 10.35], [170, 10.05], [175, 9.69],
  [180, 9.32], [185, 9.10], [190, 8.81], [195, 8.59], [200, 8.37], [205, 8.15],
  [210, 7.93], [215, 7.63], [220, 7.49], [225, 7.19], [230, 6.97], [235, 6.75],
  [240, 6.53], [245, 6.31], [250, 6.02], [255, 5.80], [260, 5.50], [265, 5.55],
  [270, 5.58], [276.13, 5.58],
];

/* monotone cubic - the measured widths are monotone and must stay that way */
function makeProfile(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const n = xs.length;
  const dx = [], dy = [], s = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; dy[i] = ys[i + 1] - ys[i]; s[i] = dy[i] / dx[i]; }
  const m = new Array(n);
  m[0] = s[0]; m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) m[i] = 0;
    else { const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = dx[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] +
           (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const hwM = makeProfile(ENVELOPE);
const H1 = 57.63, H2 = 115.73, H3 = 276.13, CAMP_TOP = 300.51, SPIRE_TOP = 312.21, TIP = 324;
const W = 100 / TIP;
const M = (m) => m * W;

/* the plate stops at the third floor; above it, campanile then spire then mast */
function above(m) {
  if (m <= H3) return hwM(m);
  if (m <= CAMP_TOP) return 5.58 - (m - H3) * 0.020;
  if (m <= SPIRE_TOP) return 5.10 * (1 - (m - CAMP_TOP) / (SPIRE_TOP - CAMP_TOP)) + 0.25;
  return 0.25 * (1 - (m - SPIRE_TOP) / (TIP - SPIRE_TOP)) + 0.10;
}

/* panel heights printed on the sheet, metres above the esplanade */
const BELTS_M = [
  15.81, 26.87, 37.93, 49.00,
  67.31, 76.99, 86.67, 96.35, 106.03,
  126.43, 137.13, 147.73, 158.13, 168.53, 178.53, 188.93, 195.35,
  204.35, 213.55, 222.25, 230.12, 238.12, 245.41, 252.00, 258.10, 264.10, 269.60,
];

export const eiffel = {
  id: 'eiffel',
  label: 'the real tower',
  note: 'Plate I, 1900 &middot; 2.59 : 1',
  style: 'lattice',
  height: 100,
  halfWidth: (y) => M(above(y / W)),
  voidHalf: (y) => {
    const m = y / W;
    if (m >= H2 || m < 0) return 0;
    // the drawing's clear openings between opposite pillars: 82.487 m at 6 m,
    // 71.427 at 16, 60.368 at 24, 49.309 at 39 - i.e. the pillars take 0.29 of
    // the envelope, and the gap between them *is* the great arch.
    return M(Math.min(hwM(m) * 0.71, hwM(m) - 1.0));
  },
  platforms: [
    [M(51.5), M(H1), M(35.85)],     // decks include the girder depth below them
    [M(109.5), M(H2), M(18.95)],
    [M(270.5), M(H3), M(9.30)],
  ],
  shaft: [M(H2), M(H3)],
  campanile: [M(H3), M(CAMP_TOP)],
  spire: [M(CAMP_TOP), M(SPIRE_TOP)],
  antenna: [M(SPIRE_TOP), 100],
  midDeck: M(195.35),
  plinths: true,
  belts: BELTS_M.map(M),
  panels: { leg: 5, mid: 6, shaft: 19 },
};

export const PROFILES = { sketch, eiffel };
export const ORDER = ['sketch', 'eiffel'];
