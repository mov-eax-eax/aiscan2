// ---------------------------------------------------------------------------
// Single source of truth for the world layout (metres, Y up, tower at origin).
//   +Z = south-east, towards the Champ de Mars and the Ecole Militaire
//   -Z = north-west, towards the Seine, the Trocadero and the Palais de Chaillot
// Every generator (ground, trees, city, props) reads these constants so the
// park, the river, the streets and the buildings can never disagree.
// ---------------------------------------------------------------------------

export const TOWER = {
  baseHalf: 62.5,          // 125 m square between the four pillar feet (outer faces)
  plinthTop: 6.0,          // masonry plinths under the legs
  level1: 57.6,            // 1st floor
  level2: 115.7,           // 2nd floor
  level3: 276.1,           // top / 3rd floor
  spireTop: 324.0,         // top of the spire
  antennaTop: 330.0,       // radio antennas
};

export const CHAMP = {
  xHalf: 112,              // half width of the whole esplanade strip
  z0: 150, z1: 960,        // along the axis
  alleyHalf: 13,           // central gravel alley, |x| < alleyHalf
  lawnOuter: 74,           // lawns run from alleyHalf to lawnOuter
  pathOuter: 96,           // side path / tree belt to pathOuter
  crossPaths: [370, 560, 750],   // cross alleys dividing the lawns
  crossHalf: 9,
};

// pavements, quays and avenues that ring the park
export const PARK_EDGE = 112;      // outer edge of the Champ de Mars strip
export const AVENUE = 22;          // width of the avenues framing the park

export const SEINE = {
  zNear: -235,             // bank on the tower side
  zFar: -425,              // bank on the Trocadero side
  waterY: -7.5,
  quayY: 0,
  bridgeWidth: 34,         // Pont d'Iena
};

export const TROCADERO = {
  z0: -440, z1: -700,      // gardens
  basin: { z0: -520, z1: -650, xHalf: 24 },   // long water basin on the axis
  palaceZ: -745,           // Palais de Chaillot facade
  palaceDepth: 55,
  palaceHalfWidth: 130,
};

export const ECOLE_MILITAIRE = { z: 1230, halfWidth: 95, depth: 70, domeH: 45 };

// Haussmann block grid outside the park / river corridor
export const CITY = {
  block: 88,               // typical block side
  street: 19,              // street width
  maxRadius: 2600,         // city extends this far
  cornice: 20.5,           // classical cornice height (ground + 5 floors)
  mansard: 5.4,            // zinc roof height
};

// --- zone tests used by the ground shader and by the generators -------------
export function inChamp(x, z) {
  return Math.abs(x) <= CHAMP.xHalf + AVENUE * 0.5 && z >= CHAMP.z0 - 40 && z <= CHAMP.z1 + 40;
}
export function inSeine(z) { return z <= SEINE.zNear && z >= SEINE.zFar; }
export function inTrocadero(x, z) {
  return z <= TROCADERO.z0 + 10 && z >= TROCADERO.z1 - 10 && Math.abs(x) < TROCADERO.palaceHalfWidth + 60;
}
/** the great axis corridor (park + river + gardens) - no city blocks here */
export function inCorridor(x, z) {
  const w = (z > 0 ? CHAMP.xHalf + AVENUE : 165);
  return Math.abs(x) < w && z < CHAMP.z1 + 60 && z > -820;
}
export function cityAllowed(x, z) {
  if (inCorridor(x, z)) return false;
  if (inSeine(z) || inTrocadero(x, z)) return false;
  if (z > TROCADERO.palaceZ - 90 && z < TROCADERO.palaceZ + 20 && Math.abs(x) < TROCADERO.palaceHalfWidth + 40) return false;
  if (Math.hypot(x, z - ECOLE_MILITAIRE.z) < 150) return false;
  return true;
}

/** street grid: true where a street (rather than a block) runs */
export function isStreet(x, z) {
  const p = CITY.block + CITY.street;
  const fx = ((x % p) + p) % p, fz = ((z % p) + p) % p;
  return fx < CITY.street || fz < CITY.street;
}
