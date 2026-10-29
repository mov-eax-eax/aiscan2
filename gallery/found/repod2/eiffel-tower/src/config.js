import * as THREE from 'three';

/**
 * Real, documented dimensions of the Eiffel Tower, in metres.
 * Sources: official "key figures" of the monument (toureiffel.paris) and the
 * 1889 construction records (18,038 iron parts, 2,500,000 rivets).
 *
 * Everything in this project is modelled at 1 unit = 1 metre, 1:1 scale.
 */
export const DIM = {
  baseSide: 124.9,   // side of the square formed by the four pillars, outer edges
  halfBase: 62.45,
  h1: 57.63,         // 1st floor  (57.63 m)
  h2: 115.73,        // 2nd floor  (115.73 m)
  h3: 276.13,        // summit platform (276.13 m)
  roof: 300.65,      // top of the campanile / highest room
  tip: 330.0,        // top of the radio antenna (since 2022)

  deck1Side: 66.4,   // 1st floor deck, 4,415 m²
  deck2Side: 37.8,   // 2nd floor deck, 1,430 m²
  deck3Side: 15.4,   // summit deck, ~250 m²

  stepsToTop: 1665,
  stepsTo2nd: 674,
  pieces: 18038,
  rivets: 2500000,
  metalTonnes: 7300,
  totalTonnes: 10100,
  projectors: 336,
  bulbs: 20000,
  sway: 0.09,        // top sway in strong wind (m)
};

/** Y of the surrounding ground (the metal frame starts at y = 0 on the masonry). */
export const GROUND_Y = -2.4;

/** Direction of a tower "face" in the model's own (square) frame. */
export const FACE_NAMES = ['SE', 'NE', 'NW', 'SW'];

/**
 * Paint: since 1968 the tower is painted in three shades of the same brown,
 * darkest at the base, lightest at the top (so the silhouette reads evenly
 * against the sky). Stops are in metres.
 */
const PAINT_STOPS = [
  [0, 0x3a2a1c],
  [30, 0x453224],
  [DIM.h1, 0x4d3a26],
  [90, 0x57402a],
  [DIM.h2, 0x614730],
  [160, 0x6d5136],
  [210, 0x7c5b3b],
  [250, 0x8a6743],
  [DIM.h3, 0x967049],
  [DIM.roof, 0xa07d4c],
  [DIM.tip, 0xab8752],
];

const _a = new THREE.Color();
const _b = new THREE.Color();

/** Painted colour of the ironwork at height y (metres). */
export function paint(y, out = new THREE.Color()) {
  const s = PAINT_STOPS;
  if (y <= s[0][0]) return out.setHex(s[0][1]);
  for (let i = 1; i < s.length; i++) {
    if (y <= s[i][0]) {
      const t = (y - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
      _a.setHex(s[i - 1][1]);
      _b.setHex(s[i][1]);
      return out.copy(_a).lerp(_b, t);
    }
  }
  return out.setHex(s[s.length - 1][1]);
}

/** Sky / lighting presets. */
export const SKIES = {
  golden: {
    label: 'Golden hour',
    sun: { elev: 7, azim: 118, color: 0xffb066, intensity: 3.9 },
    hemi: { sky: 0x9dc0ff, ground: 0x54452f, intensity: 0.7 },
    ambient: 0.12,
    skyTop: 0x1d4b8f,
    skyMid: 0x8fb3e0,
    skyLow: 0xffc98a,
    fog: 0xd9c3a4,
    fogNear: 700,
    fogFar: 3400,
    exposure: 0.95,
    env: 0.5,
    lamps: 0,
    bulbs: 0,
    sparkle: 0,
    glow: 0.0,
  },
  day: {
    label: 'Midday',
    sun: { elev: 58, azim: 205, color: 0xfff4e0, intensity: 3.6 },
    hemi: { sky: 0xbcd8ff, ground: 0x6a6a55, intensity: 0.95 },
    ambient: 0.18,
    skyTop: 0x1f5fbf,
    skyMid: 0x8dc0f0,
    skyLow: 0xd8e8f6,
    fog: 0xcfe0ee,
    fogNear: 900,
    fogFar: 4200,
    exposure: 1.0,
    env: 0.55,
    lamps: 0,
    bulbs: 0,
    sparkle: 0,
    glow: 0.0,
  },
  blue: {
    label: 'Blue hour',
    sun: { elev: 1.5, azim: 250, color: 0x8fb0ff, intensity: 0.6 },
    hemi: { sky: 0x5a7bb5, ground: 0x2a2a35, intensity: 0.35 },
    ambient: 0.08,
    skyTop: 0x0a1c3d,
    skyMid: 0x2f5a8f,
    skyLow: 0xe2a173,
    fog: 0x54617a,
    fogNear: 600,
    fogFar: 3000,
    exposure: 1.05,
    env: 0.3,
    lamps: 0.55,
    bulbs: 1,
    sparkle: 0,
    glow: 0.55,
  },
  night: {
    label: 'Night',
    sun: { elev: 12, azim: 20, color: 0xffd9a8, intensity: 0.05 },
    hemi: { sky: 0x22303f, ground: 0x181818, intensity: 0.12 },
    ambient: 0.03,
    skyTop: 0x03060c,
    skyMid: 0x0a1524,
    skyLow: 0x1b2433,
    fog: 0x121a26,
    fogNear: 500,
    fogFar: 2600,
    exposure: 1.15,
    env: 0.07,
    lamps: 1,
    bulbs: 1,
    sparkle: 0,
    glow: 0.9,
  },
  sparkle: {
    label: 'Sparkle',
    sun: { elev: 12, azim: 20, color: 0xffd9a8, intensity: 0.05 },
    hemi: { sky: 0x22303f, ground: 0x181818, intensity: 0.12 },
    ambient: 0.03,
    skyTop: 0x03060c,
    skyMid: 0x0a1524,
    skyLow: 0x1b2433,
    fog: 0x121a26,
    fogNear: 500,
    fogFar: 2600,
    exposure: 1.15,
    env: 0.07,
    lamps: 1,
    bulbs: 1,
    sparkle: 1,
    glow: 1.15,
  },
};


