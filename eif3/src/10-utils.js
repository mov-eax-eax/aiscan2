/* 10-utils.js — math helpers and the shared world constants.
   Everything in src/ is concatenated into one module scope, so these are
   simply in scope for every other fragment. */
/* ------------------------------------------------------------------ */
/*  small helpers                                                     */
/* ------------------------------------------------------------------ */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;

/** Smooth Hermite interpolation through [y, value] anchors. */
function smoothCurve(anchors) {
  const n = anchors.length;
  const slopes = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) slopes[i] = (anchors[1][1] - anchors[0][1]) / (anchors[1][0] - anchors[0][0]);
    else if (i === n - 1) slopes[i] = (anchors[n - 1][1] - anchors[n - 2][1]) / (anchors[n - 1][0] - anchors[n - 2][0]);
    else slopes[i] = (anchors[i + 1][1] - anchors[i - 1][1]) / (anchors[i + 1][0] - anchors[i - 1][0]);
  }
  return function (y) {
    if (y <= anchors[0][0]) return anchors[0][1];
    if (y >= anchors[n - 1][0]) return anchors[n - 1][1];
    let i = 0;
    while (i < n - 2 && y > anchors[i + 1][0]) i++;
    const y0 = anchors[i][0], v0 = anchors[i][1];
    const y1 = anchors[i + 1][0], v1 = anchors[i + 1][1];
    const h = y1 - y0;
    const t = (y - y0) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0
         + (t3 - 2 * t2 + t) * h * slopes[i]
         + (-2 * t3 + 3 * t2) * v1
         + (t3 - t2) * h * slopes[i + 1];
  };
}

/* Shared layout constants — keep the modules agreeing about the map. */
const WORLD = {
  cityInner: 760,       // radius where the grey city floor starts
  cityOuter: 3400,      // radius of that floor
  ringY: 0.6,           // city-floor height (above ground=0, avoids z-fighting)
  riverZ: -330,         // Seine centre line (behind the tower)
  riverWidth: 220,
  waterY: 1.2,
  mallWidth: 58,        // Champ de Mars allée
  mallStart: 100,
  mallEnd: 740,
  groundY: 0,
};

/* Reserved landmark spots. The city fabric must leave these clearings empty;
   the landmark module builds inside them. Coordinates are world x / z (metres). */
const LANDMARK_SITES = {
  ecoleMilitaire: { x: 0, z: 830, clearing: 170 },
  trocadero:      { x: 0, z: -640, clearing: 210 },
  montparnasse:   { x: 980, z: -172, clearing: 90 },
  defense:        { x: -1280, z: -880, clearing: 200 },
  invalides:      { x: 560, z: 720, clearing: 90 },
};
