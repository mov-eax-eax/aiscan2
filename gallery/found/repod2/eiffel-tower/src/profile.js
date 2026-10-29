import { DIM } from './config.js';

/**
 * The silhouette of the tower.
 *
 * The outer half-width w(y) (half the side of the tower's square at height y)
 * follows the famous "exponential" profile Eiffel's engineers computed so that
 * the wind load is met with a constant stress in the ironwork.
 *
 * Measured anchors used here:
 *   y = 0        w = 62.45 m  (124.9 m square at the base)
 *   y = 57.63    w = 31.50 m  (1st floor, 66.4 m deck)
 *   y = 115.73   w = 17.50 m  (2nd floor, 37.8 m deck)
 *   y = 276.13   w =  5.20 m  (summit platform)
 *   y = 300.65   w =  2.90 m  (campanile roof)
 *
 * Between the anchors the curve is a smooth monotone cubic (PCHIP) through
 * points sampled from a piecewise exponential fitted to those anchors; the
 * taper constant grows with height, which is what gives the real tower its
 * strongly curved legs and its much straighter upper spire.
 */

const CTRL = [
  [0.0, 62.450],
  [10.0, 55.460],
  [20.0, 49.250],
  [30.0, 43.730],
  [40.0, 38.830],
  [50.0, 34.480],
  [DIM.h1, 31.500],
  [70.0, 27.790],
  [85.0, 23.880],
  [100.0, 20.520],
  [DIM.h2, 17.500],
  [140.0, 14.570],
  [170.0, 11.610],
  [200.0, 9.250],
  [230.0, 7.370],
  [260.0, 5.880],
  [DIM.h3, 5.200],
  [285.0, 4.210],
  [295.0, 3.320],
  [DIM.roof, 2.900],
];

/* ---- monotone cubic interpolation (Fritsch–Carlson) ---------------------- */
const X = CTRL.map((p) => p[0]);
const Y = CTRL.map((p) => p[1]);
const N = X.length;
const H = new Array(N - 1);
const D = new Array(N - 1);
const M = new Array(N);

for (let i = 0; i < N - 1; i++) {
  H[i] = X[i + 1] - X[i];
  D[i] = (Y[i + 1] - Y[i]) / H[i];
}
M[0] = D[0];
M[N - 1] = D[N - 2];
for (let i = 1; i < N - 1; i++) {
  if (D[i - 1] * D[i] <= 0) {
    M[i] = 0;
  } else {
    const w1 = 2 * H[i] + H[i - 1];
    const w2 = H[i] + 2 * H[i - 1];
    M[i] = (w1 + w2) / (w1 / D[i - 1] + w2 / D[i]);
  }
}

/** Half-width of the tower's structural square at height y (metres). */
export function halfWidth(y) {
  if (y <= X[0]) return Y[0];
  if (y >= X[N - 1]) return Y[N - 1];
  let i = N - 2;
  while (i > 0 && y < X[i]) i--;
  const h = H[i];
  const t = (y - X[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * Y[i] + h10 * h * M[i] + h01 * Y[i + 1] + h11 * h * M[i + 1];
}

/* ---- pillar (leg) box ---------------------------------------------------- */

const LEG_HALF = [
  [0, 6.80],
  [DIM.h1, 2.75],
  [DIM.h2, 2.05],
];

/** Half-size of a pillar's square cross-section at height y. */
export function legHalf(y) {
  const p = LEG_HALF;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) {
      const t = (y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    }
  }
  return p[p.length - 1][1];
}

/** Distance from the tower axis to the centre line of a pillar at height y. */
export function legCentre(y) {
  return Math.max(0.6, halfWidth(y) - legHalf(y));
}

/** Thicknesses of the iron members as a function of height. */
export const thickness = {
  chord: (y) => 0.34 + 0.78 * Math.pow(1 - clamp01(y / DIM.h2), 1.7),
  main: (y) => 0.24 + 0.60 * Math.pow(1 - clamp01(y / DIM.h2), 1.7),
  ring: (y) => 0.20 + 0.52 * Math.pow(1 - clamp01(y / DIM.h2), 1.7),
  fine: (y) => Math.max(0.05, 0.3 * thickness.main(y)),
};

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Evenly spaced panel levels from y0 to y1 (inclusive), step ≈ desired. */
export function levels(y0, y1, step) {
  const n = Math.max(1, Math.round((y1 - y0) / step));
  const out = new Array(n + 1);
  for (let i = 0; i <= n; i++) out[i] = y0 + ((y1 - y0) * i) / n;
  return out;
}

/** Levels for a span given as [y0, y1, step] pieces, welded at the joints. */
export function levelChain(spans) {
  const out = [];
  for (const [y0, y1, step] of spans) {
    const l = levels(y0, y1, step);
    for (let i = out.length ? 1 : 0; i < l.length; i++) out.push(l[i]);
  }
  return out;
}
