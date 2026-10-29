import * as THREE from 'three';
import { GROUND_Y } from './config.js';
import { legHalf, legCentre } from './profile.js';
import { V } from './beam.js';
import { LEGS, legPoint } from './frame.js';

const STONE = new THREE.Color(0x9a9184);
const STONE_DARK = new THREE.Color(0x6f6960);
const DARK = new THREE.Color(0x14161a);
const ROOF = new THREE.Color(0x2b2f36);

/**
 * Masonry: the four stone pedestals each pillar stands on, their steps, and
 * the cast-iron "sabots" through which the four chords are bolted down.
 */
export function addBase(ctx) {
  const { main, detail, stone } = ctx;

  for (const leg of LEGS) {
    const { sx, sz } = leg;
    const lh = legHalf(0);
    const c = legCentre(0);
    const cx = sx * c;
    const cz = sz * c;
    const side = lh * 2;

    // stone pedestal (about 2.4 m visible above the esplanade)
    stone.box(cx, GROUND_Y + 1.0, cz, side + 3.6, 2.0, side + 3.6, 0, STONE_DARK);
    stone.box(cx, -0.55, cz, side + 2.4, 3.1, side + 2.4, 0, STONE);
    stone.box(cx, 0.06, cz, side + 3.0, 0.6, side + 3.0, 0, STONE_DARK);
    stone.box(cx, GROUND_Y + 0.18, cz, side + 9.0, 0.36, side + 9.0, 0, STONE);

    // cast-iron shoe ("sabot")
    detail.box(cx, 0.65, cz, side - 1.2, 1.5, side - 1.2, 0, DARK);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const a = legPoint(V(), sx, sz, dx, dz, 1.35);
      const b = V(cx + dx * (lh - 1.4), -0.05, cz + dz * (lh - 1.4));
      main.beamV(a, b, 1.15);
    }

    // three concentric steps around the pedestal
    for (let s = 1; s <= 3; s++) {
      const w = side + 3.6 + s * 1.6;
      stone.box(cx, GROUND_Y + 0.18 + s * 0.3, cz, w, 0.3, w, 0, STONE_DARK);
    }
  }
}

/**
 * The four ground-level pavilions (ticket offices, shops) at the foot of the
 * pillars, and the low wall of the pillar gardens.
 */
export function addPavilions(ctx) {
  const { stone, detail } = ctx;
  const c = legCentre(0);
  const lh = legHalf(0);

  for (const leg of LEGS) {
    const { sx, sz } = leg;
    // 6.5 m further out along the pillar diagonal = 4.6 m on both axes
    const out = c + lh + 4.6;
    const px = sx * out;
    const pz = sz * out;
    const yaw = Math.atan2(sx, sz);
    const h = 4.4;
    stone.box(px, GROUND_Y + h / 2, pz, 17, h, 11, yaw, STONE);
    stone.box(px, GROUND_Y + h + 0.3, pz, 17.8, 0.6, 11.8, yaw, STONE_DARK);
    detail.box(px, GROUND_Y + h * 0.66, pz, 15.4, 1.5, 11.4, yaw, DARK);
    detail.box(px, GROUND_Y + h + 0.9, pz, 15.0, 0.6, 9.0, yaw, ROOF);

    // pillar garden: a low hedge box on the inner side of the pillar
    const g = c - lh - 11.3;
    const gx = sx * g;
    const gz = sz * g;
    stone.box(gx, GROUND_Y + 0.35, gz, 22, 0.7, 7, yaw, new THREE.Color(0x3d5128));
  }
}
