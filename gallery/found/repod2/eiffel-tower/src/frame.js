import * as THREE from 'three';
import { DIM } from './config.js';
import { halfWidth, legHalf, legCentre } from './profile.js';

/**
 * The tower is modelled in its own square frame:
 *   x/z axes through the middle of the four faces, the four pillars at the
 *   corners (±c, ±c).  The whole group is then rotated 45° about Y so that the
 *   pillars end up at the four points of the compass (Nord, Est, Sud, Ouest)
 *   and each face looks towards the part of Paris it really faces:
 *   local +z = SE (École Militaire), +x = NE (La Bourdonnais),
 *   -z = NW (Trocadéro), -x = SW (Grenelle).
 */
export const LEGS = [
  { sx: 1, sz: 1, name: 'Est' },
  { sx: -1, sz: 1, name: 'Sud' },
  { sx: -1, sz: -1, name: 'Ouest' },
  { sx: 1, sz: -1, name: 'Nord' },
];

export const FACE_ORDER = ['SE', 'NE', 'NW', 'SW'];
export const FACE_ROT = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/**
 * Faces of the tower between two neighbouring pillars. `tag` is the corner
 * signature (dx, dz) shared by the two pillars' chords that lie in the face
 * plane; `legs` are the two pillars bounding the face.
 */
export const FACES = [
  { legs: [[-1, 1], [1, 1]], tag: [-1, 1], axis: 'z', sign: 1 },
  { legs: [[1, 1], [1, -1]], tag: [1, -1], axis: 'x', sign: 1 },
  { legs: [[1, -1], [-1, -1]], tag: [-1, 1], axis: 'z', sign: -1 },
  { legs: [[-1, -1], [-1, 1]], tag: [1, -1], axis: 'x', sign: -1 },
];

const _p = new THREE.Vector3();

/** Corner point of a pillar's square cross-section at height y. */
export function legPoint(out, sx, sz, dx, dz, y) {
  const lh = legHalf(y);
  const c = legCentre(y);
  return out.set(sx * (c + dx * lh), y, sz * (c + dz * lh));
}

/** Centre line point of a pillar at height y. */
export function legCentrePoint(out, sx, sz, y) {
  const c = legCentre(y);
  return out.set(sx * c, y, sz * c);
}

/** Horizontal unit vector perpendicular to a pillar's (diagonal) run. */
export function legLateral(out, sx, sz) {
  return out.set(sz * 0.7071067811865476, 0, -sx * 0.7071067811865476);
}

/** Point in the plane of a face: u = lateral, y = height, d = distance out. */
export function facePoint(out, face, u, y, d) {
  switch (face) {
    case 0: return out.set(u, y, d);       // +z
    case 1: return out.set(d, y, -u);      // +x
    case 2: return out.set(-u, y, -d);     // -z
    default: return out.set(-d, y, u);     // -x
  }
}

/**
 * The chord of the pillar `which` (0 or 1) that belongs to face `face`,
 * at height y, i.e. the point where the face truss meets the pillar.
 */
export function faceChordPoint(out, face, which, y) {
  const f = FACES[face];
  const [sx, sz] = f.legs[which];
  return legPoint(out, sx, sz, f.tag[0], f.tag[1], y);
}

const _fa = new THREE.Vector3();
const _fb = new THREE.Vector3();

/**
 * Point on a face at height y, u = 0 at one pillar and u = 1 at the other.
 * The face is the plane spanned by the two pillars' chords, so it narrows as
 * the tower rises.
 */
export function faceLanePoint(out, face, u, y) {
  faceChordPoint(_fa, face, 0, y);
  faceChordPoint(_fb, face, 1, y);
  return out.lerpVectors(_fa, _fb, u);
}

/** Corner of the tower's envelope square, CCW seen from above. */const CORNERS = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
];

/** Point on the perimeter of the tower square at height y, s in [0,1). */
export function perimeterPoint(out, s, y) {
  const w = halfWidth(y);
  let t = (s - Math.floor(s)) * 4;
  if (t < 1) return out.set(w, y, w - 2 * w * t);
  t -= 1;
  if (t < 1) return out.set(w - 2 * w * t, y, -w);
  t -= 1;
  if (t < 1) return out.set(-w, y, -w + 2 * w * t);
  t -= 1;
  return out.set(-w + 2 * w * t, y, w);
}

/** Corner of the tower square index k (0..3), CCW. */
export function cornerPoint(out, k, y) {
  const w = halfWidth(y);
  const [sx, sz] = CORNERS[k & 3];
  return out.set(sx * w, y, sz * w);
}

export { _p };
