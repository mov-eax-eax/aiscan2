// js/wings.js — 747-8 wing: 68.4 m span, 37.5° sweep, raked wingtips (no winglets),
// four leading-edge slats, three Fowler flap panels, two ailerons and six spoilers per side.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, cosineSpacing, loft, sampleRow } from './util.js';

export const WING = {
  semiSpan: 34.20, area: 554.0, sweepDeg: 37.5, dihedralDeg: 7.0,
  cBox: 0.13, cFlap: 0.70, cAil: 0.70, tipChord: 1.15, rootChord: 15.60,
};

// z, leading-edge x, chord, t/c, height, twist (deg, positive = nose up)
export const WING_STATIONS = [
  { z: 0.0, xLE: 10.00, chord: 15.60, t: 0.155, y: -0.85, twist: 0.0 },
  { z: 2.2, xLE: 8.31, chord: 14.85, t: 0.150, y: -0.58, twist: 0.0 },
  { z: 3.6, xLE: 7.24, chord: 14.10, t: 0.145, y: -0.40, twist: 0.0 },
  { z: 6.5, xLE: 5.01, chord: 12.55, t: 0.136, y: -0.04, twist: -0.4 },
  { z: 9.5, xLE: 2.71, chord: 11.05, t: 0.128, y: 0.33, twist: -0.8 },
  { z: 11.8, xLE: 0.95, chord: 9.95, t: 0.124, y: 0.61, twist: -1.1 },
  { z: 14.8, xLE: -1.36, chord: 8.55, t: 0.120, y: 0.98, twist: -1.6 },
  { z: 18.5, xLE: -4.20, chord: 7.10, t: 0.116, y: 1.43, twist: -2.2 },
  { z: 22.5, xLE: -7.27, chord: 5.65, t: 0.112, y: 1.92, twist: -2.8 },
  { z: 26.5, xLE: -10.34, chord: 4.35, t: 0.110, y: 2.41, twist: -3.3 },
  { z: 30.0, xLE: -13.02, chord: 3.25, t: 0.108, y: 2.84, twist: -3.7 },
  { z: 31.6, xLE: -14.25, chord: 2.85, t: 0.105, y: 3.04, twist: -3.9 },
  { z: 32.8, xLE: -16.15, chord: 2.05, t: 0.102, y: 3.18, twist: -4.0 },
  { z: 33.6, xLE: -17.35, chord: 1.55, t: 0.100, y: 3.28, twist: -4.1 },
  { z: 34.2, xLE: -18.30, chord: 1.15, t: 0.098, y: 3.35, twist: -4.2 },
];

export const wingStation = (z) => sampleRow(WING_STATIONS, 'z', clamp(z, 0, WING.semiSpan));

// NACA-style thickness plus an aft-loaded supercritical-ish camber line.
export function airfoil(c, t, camber = 0.021) {
  const cc = clamp(c, 0, 1);
  const yt = (t / 0.2) * (0.2969 * Math.sqrt(cc) - 0.1260 * cc - 0.3516 * cc * cc + 0.2843 * cc ** 3 - 0.1015 * cc ** 4);
  const p = 0.42, m = camber;
  const yc = cc < p ? (m / (p * p)) * (2 * p * cc - cc * cc) : (m / ((1 - p) ** 2)) * ((1 - 2 * p) + 2 * p * cc - cc * cc);
  return { yt, yc };
}

// A point on the wing surface; side=-1 mirrors to port, up=true is the upper surface.
export function wingPoint(z, c, side = 1, up = true) {
  const st = wingStation(z);
  const { yt, yc } = airfoil(c, st.t);
  const te = 0.006;
  const off = up ? yc + yt + te * c / 2 : yc - yt - te * c / 2;
  const chord = st.chord;
  const px = c * chord, py = off * chord;
  const ax = 0.30 * chord;
  const a = -(st.twist || 0) * DEG;
  const dx = px - ax, dy = py;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return new THREE.Vector3(st.xLE - (ax + rx), st.y + ry, side * z);
}

export function wingNormalAt(z, c, side = 1, up = true) {
  const d = 0.008;
  const c0 = clamp(c - d, 0.0005, 0.9995), c1 = clamp(c + d, 0.0005, 0.9995);
  const z0 = clamp(z - 0.08, 0.02, WING.semiSpan - 0.02), z1 = clamp(z + 0.08, 0.02, WING.semiSpan - 0.02);
  const t1 = new THREE.Vector3().subVectors(wingPoint(z, c1, side, up), wingPoint(z, c0, side, up));
  const t2 = new THREE.Vector3().subVectors(wingPoint(z1, c, side, up), wingPoint(z0, c, side, up));
  const n = new THREE.Vector3().crossVectors(t1, t2).normalize();
  const mid = new THREE.Vector3().lerpVectors(wingPoint(z, c, side, true), wingPoint(z, c, side, false), 0.5);
  if (n.dot(wingPoint(z, c, side, up).sub(mid)) < 0) n.negate();
  return n;
}

// Closed cross-section loop for the chordwise band [cA, cB].
function bandRing(z, cA, cB, segs, side) {
  const cs = cosineSpacing(segs, cA, cB);
  const pts = [];
  for (const c of cs) pts.push(wingPoint(z, c, side, true));
  for (let i = cs.length - 2; i >= 1; i--) pts.push(wingPoint(z, cs[i], side, false));
  return pts;
}

function loftSpan(z0, z1, cA, cB, segsZ, segsC, side, extra = {}) {
  const rings = [];
  for (let i = 0; i <= segsZ; i++) {
    const t = 0.5 - 0.5 * Math.cos((i / segsZ) * Math.PI);
    rings.push(bandRing(lerp(z0, z1, t), cA, cB, segsC, side));
  }
  return loft(rings, { closed: true, flipNormals: side < 0, capStart: true, capEnd: true, ...extra });
}

// Thin plate hugging the upper surface (spoilers, panels, doors).
function plateOver(z0, z1, c0, c1, thick, segsZ, segsC, side) {
  const rings = [];
  for (let i = 0; i <= segsZ; i++) {
    const z = lerp(z0, z1, i / segsZ);
    const ring = [];
    const cs = cosineSpacing(segsC, c0, c1);
    for (const c of cs) ring.push(wingPoint(z, c, side, true).addScaledVector(wingNormalAt(z, c, side, true), 0.004));
    for (let k = cs.length - 1; k >= 0; k--) {
      const c = cs[k];
      ring.push(wingPoint(z, c, side, true).addScaledVector(wingNormalAt(z, c, side, true), -thick));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, flipNormals: side < 0, capStart: true, capEnd: true });
}

// Spindle pod (flap track canoe fairings).
function pod(x0, x1, y, z, w, h, side) {
  const rings = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(x0, x1, t);
    const s = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.55);
    const sw = w * s * (0.55 + 0.45 * (1 - t)), sh = h * s;
    const ring = [];
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      ring.push(new THREE.Vector3(x, y + sh * Math.sin(a), side * (z + sw * Math.cos(a))));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, flipNormals: side < 0, capStart: true, capEnd: true });
}

export function buildWings(mats) {
  const group = new THREE.Group();
  group.name = 'wings';
  const animate = { flaps: [], slats: [], spoilers: [], ailerons: [] };

  for (const side of [1, -1]) {
    const tag = side > 0 ? 'R' : 'L';
    const wing = new THREE.Group();
    wing.name = 'wing-' + tag;

    // --- fixed torsion box (upper + lower skin between the slat and flap lines)
    const box = new THREE.Mesh(loftSpan(0.12, WING.semiSpan - 0.02, WING.cBox, WING.cFlap, 30, 14, side), mats.wingSkin);
    box.name = 'wing-box-' + tag;
    box.castShadow = true; box.receiveShadow = true;
    wing.add(box);

    // --- fixed trailing-edge wedges (root and the raked tip outboard of the aileron)
    for (const [z0, z1, cA, cB] of [[0.0, 3.25, WING.cFlap, 0.99], [31.15, WING.semiSpan - 0.02, WING.cFlap, 0.995]]) {
      const m = new THREE.Mesh(loftSpan(z0, z1, cA, cB, 6, 10, side), mats.wingSkin);
      m.castShadow = true; m.receiveShadow = true;
      wing.add(m);
    }

    // --- leading-edge slats: four sections of unpainted metal, each on its own track
    const slatSpans = [[3.35, 10.25], [10.45, 17.15], [17.35, 24.25], [24.45, 30.55]];
    for (let i = 0; i < slatSpans.length; i++) {
      const [z0, z1] = slatSpans[i];
      const pivot = wingPoint(lerp(z0, z1, 0.5), WING.cBox, side, true);
      const slat = new THREE.Group();
      slat.name = 'slat-' + i + '-' + tag;
      slat.position.copy(pivot);
      const geo = loftSpan(z0, z1, 0.0, WING.cBox, 12, 9, side);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const mesh = new THREE.Mesh(geo, mats.slat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      slat.add(mesh);
      wing.add(slat);
      animate.slats.push({ group: slat, home: pivot.clone(), side });
    }

    // --- Fowler flaps: inboard, mid and outboard panels
    for (const [z0, z1, label] of [[3.30, 10.40, 'in'], [10.40, 17.40, 'mid'], [22.00, 26.80, 'out']]) {
      const pivot = wingPoint(lerp(z0, z1, 0.5), WING.cFlap, side, true);
      const g = new THREE.Group();
      g.name = 'flap-' + label + '-' + tag;
      g.position.copy(pivot);
      const geo = loftSpan(z0, z1, WING.cFlap - 0.01, 1.0, 10, 11, side);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const mesh = new THREE.Mesh(geo, mats.wingSkin);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      wing.add(g);
      animate.flaps.push({ group: g, home: pivot.clone(), side, kind: label });
    }

    // --- inboard and outboard ailerons
    for (const [z0, z1, label] of [[17.40, 22.00, 'in'], [26.80, 31.15, 'out']]) {
      const pivot = wingPoint(lerp(z0, z1, 0.5), WING.cAil, side, true);
      const g = new THREE.Group();
      g.name = 'aileron-' + label + '-' + tag;
      g.position.copy(pivot);
      const geo = loftSpan(z0, z1, WING.cAil - 0.01, 0.96, 8, 9, side);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const mesh = new THREE.Mesh(geo, mats.wingSkin);
      mesh.castShadow = true;
      g.add(mesh);
      wing.add(g);
      animate.ailerons.push({ group: g, side, kind: label });
    }

    // --- spoiler panels on the upper surface, hinged at their forward edge
    const spoilerZ = [[4.80, 6.35], [6.55, 8.10], [8.30, 9.85], [12.10, 13.65], [13.85, 15.40], [15.60, 17.15]];
    for (const [z0, z1] of spoilerZ) {
      const pivot = wingPoint(lerp(z0, z1, 0.5), 0.38, side, true);
      const g = new THREE.Group();
      g.name = 'spoiler-' + tag;
      g.position.copy(pivot);
      const geo = plateOver(z0, z1, 0.38, 0.64, 0.075, 4, 5, side);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const mesh = new THREE.Mesh(geo, mats.panel);
      mesh.castShadow = true;
      g.add(mesh);
      wing.add(g);
      animate.spoilers.push({ group: g, side });
    }

    // --- flap-track canoe fairings (three per wing)
    for (const z of [6.0, 12.9, 22.2]) {
      const teX = wingPoint(z, 0.99, side, false).x;
      const y = wingPoint(z, 0.82, side, false).y - 0.18;
      const m = new THREE.Mesh(pod(teX + 1.9, teX - 2.7, y, z, 0.17, 0.22, side), mats.panel);
      m.castShadow = true; m.receiveShadow = true;
      wing.add(m);
    }

    group.add(wing);
  }

  // ---------------------------------------------------------------- animation
  const setFlaps = (t) => {
    const e = clamp(t, 0, 1);
    for (const f of animate.flaps) {
      const max = f.kind === 'in' ? 42 : f.kind === 'mid' ? 38 : 30;
      f.group.rotation.z = max * DEG * e;
      f.group.position.set(f.home.x - 0.72 * e, f.home.y - 0.20 * e, f.home.z);
    }
  };
  const setSlats = (t) => {
    const e = clamp(t, 0, 1);
    for (const s of animate.slats) {
      s.group.rotation.z = -6 * DEG * e;
      s.group.position.set(s.home.x + 0.48 * e, s.home.y - 0.055 * e, s.home.z);
    }
  };
  const setSpoilers = (t) => {
    for (const s of animate.spoilers) s.group.rotation.z = -50 * DEG * clamp(t, 0, 1);
  };
  const setAilerons = (t) => {
    const e = clamp(t, -1, 1);
    for (const a of animate.ailerons) a.group.rotation.z = -e * 20 * DEG;
  };

  return { group, animate, setFlaps, setSlats, setSpoilers, setAilerons };
}
