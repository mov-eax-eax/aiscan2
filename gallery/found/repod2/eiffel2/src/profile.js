/* ===========================================================================
 * Geometry of the Eiffel Tower, measured from Eiffel's own drawing.
 *
 * Source: Gustave Eiffel, "La tour de trois cents mètres", Planches (BnF
 * GR FOL-V-749), Plate I - "DIAGRAMME DE L'ELEVATION", Fig. 2, scale 0.001
 * (= 1:1000). The sheet was scanned at 2600x3852 px; calibrating against the
 * three labelled floor levels (57.63 / 115.73 / 276.13 m) gives 6.813 px per
 * metre, and the drawing's own dimension strings then check out:
 *    - clear opening between opposite pillars: 82.487 m at 6 m, 71.427 at 16,
 *      60.368 at 24, 49.309 at 39  ->  pillar width = 0.30 x envelope
 *    - panel heights read off the sheet: 10.700 (13-14), 11.500, 10.000 x4,
 *      9.000, 9.204, 8.996, 8.133, 7.999, 7.290 (upper pylon)
 *    - arch crown at 39.3 m measured, matching the documented 39 m
 * =========================================================================== */

/** outer half-width of the structure, metres, measured off the plate */
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

/** monotone cubic through the measured widths - no wobble between samples */
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

export const halfWidth = makeProfile(ENVELOPE);

/** pillar box width: the drawing's openings give 0.30 x envelope */
export const pillarHalf = (y) => Math.min(halfWidth(y) * 0.30, 8.9);

// ---- the floors ----------------------------------------------------------
export const H1 = 57.63, H2 = 115.73, H3 = 276.13;
export const MID = 195.35;              // Edoux transfer platform
export const PLINTH = 4.0;              // top of the masonry
export const ARCH_CROWN = 39.3, ARCH_SPAN = 74.24;
export const TOP_DECK = 276.13, CAMPANILE_TOP = 300.51, SPIRE_TOP = 312.21, TIP = 324.0;

/** deck widths (outside the gutter) from Eiffel's dimension tables */
export const DECKS = {
  first: 35.85,      // 71.69 m
  second: 18.95,     // 37.90 m
  mid: 10.6,
  third: 9.3,        // 18.65 m at the widest point of the level
};

/* ---------------------------------------------------------------------------
 * Panel (belt) heights, read straight off the plate: the drawing numbers the
 * 29 panels and prints each one's height. Below the 1st floor the belt
 * elevations are 49.309 / 60.368 / 71.427 / 82.487 m above sea level, i.e.
 * 15.8 / 26.9 / 37.9 / 49.0 m above the esplanade (datum +33.50).
 * ------------------------------------------------------------------------- */
export const BELTS = [
  15.81, 26.87, 37.93, 49.00,          // panels 1-4  (ground -> 1st floor)
  H1,
  67.31, 76.99, 86.67, 96.35, 106.03,  // panels 6-11 (1st -> 2nd floor)
  H2,
  126.43, 137.13, 147.73, 158.13, 168.53, 178.53, 188.93,   // panels 13-19
  MID,
  204.35, 213.55, 222.25, 230.12, 238.12, 245.41, 252.00, 258.10, 264.10, 269.60,
  H3,
];

/** belts only inside a height range */
export function beltsBetween(y0, y1) {
  const out = [y0];
  for (const b of BELTS) if (b > y0 + 0.6 && b < y1 - 0.6) out.push(b);
  out.push(y1);
  return out;
}
