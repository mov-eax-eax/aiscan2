// js/wings.js — 747-400 wing: lofted swept planform, slats, Fowler flaps, spoilers,
// ailerons, winglets, flap-track canoes and the wing/body fairing.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, cosineSpacing, loft, roundedSlab, sampleRow, surfaceBasis } from './util.js';
import { fusePoint, fuseNormalAt, FUSE } from './fuselage.js';

export const WING = {
  semiSpan: 32.22, area: 541.2, sweepDeg: 37.5, dihedralDeg: 7.0,
  cBox: 0.13, cFlap: 0.70, cAil: 0.70, tipChord: 2.35, rootChord: 15.6,
};

// z, leading-edge x, chord, t/c, height, twist (deg, positive = nose up)
export const WING_STATIONS = [
  { z: 0.0, xLE: 9.10, chord: 15.60, t: 0.155, y: -0.80, twist: 0.0 },
  { z: 2.2, xLE: 7.55, chord: 14.80, t: 0.150, y: -0.62, twist: 0.0 },
  { z: 3.60, xLE: 6.20, chord: 13.90, t: 0.145, y: -0.45, twist: 0.0 },
  { z: 6.50, xLE: 3.60, chord: 12.30, t: 0.136, y: -0.10, twist: -0.4 },
  { z: 9.50, xLE: 1.10, chord: 10.80, t: 0.128, y: 0.26, twist: -0.8 },
  { z: 11.60, xLE: -0.55, chord: 9.70, t: 0.124, y: 0.52, twist: -1.1 },
  { z: 14.50, xLE: -2.78, chord: 8.30, t: 0.120, y: 0.87, twist: -1.6 },
  { z: 18.00, xLE: -5.45, chord: 7.00, t: 0.116, y: 1.30, twist: -2.2 },
  { z: 22.00, xLE: -8.50, chord: 5.55, t: 0.112, y: 1.79, twist: -2.8 },
  { z: 26.00, xLE: -11.55, chord: 4.20, t: 0.110, y: 2.28, twist: -3.3 },
  { z: 29.50, xLE: -14.20, chord: 3.10, t: 0.108, y: 2.70, twist: -3.7 },
  { z: 32.22, xLE: -16.30, chord: 2.35, t: 0.108, y: 3.05, twist: -4.0 },
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

// A point on the right-hand wing surface; side=-1 mirrors to port, up=true is the upper surface.
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
function bandRing(z, cA, cB, segs, side, upEdge = true) {
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
  const N = 14;
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
    const box = new THREE.Mesh(loftSpan(0.12, WING.semiSpan - 0.02, WING.cBox, WING.cFlap, 26, 12, side), mats.wingSkin);
    box.name = 'wing-box-' + tag;
    box.castShadow = true; box.receiveShadow = true;
    wing.add(box);

    // --- fixed trailing-edge wedges outboard of the aileron and between flap/aileron
    for (const [z0, z1] of [[19.4, 19.95], [30.55, 32.2]]) {
      const m = new THREE.Mesh(loftSpan(z0, z1, WING.cFlap, 0.96, 3, 8, side), mats.wingSkin);
      m.castShadow = true; m.receiveShadow = true;
      wing.add(m);
    }

    // --- leading-edge slats (translate forward and droop)
    const slatPivot = wingPoint(lerp(3.4, 31.9, 0.5), WING.cBox, side, true);
    const slat = new THREE.Group();
    slat.name = 'slat-' + tag;
    slat.position.copy(slatPivot);
    const slatGeo = loftSpan(3.4, 31.9, 0.0, WING.cBox, 22, 8, side);
    slatGeo.translate(-slatPivot.x, -slatPivot.y, -slatPivot.z);
    const slatMesh = new THREE.Mesh(slatGeo, mats.wingSkin);
    slatMesh.castShadow = true; slatMesh.receiveShadow = true;
    slat.add(slatMesh);
    wing.add(slat);
    animate.slats.push(slat);

    // --- Fowler flaps: inboard and outboard
    for (const [z0, z1, label] of [[3.3, 11.4, 'in'], [11.8, 19.4, 'out']]) {
      const pivot = wingPoint(lerp(z0, z1, 0.5), WING.cFlap, side, true);
      const g = new THREE.Group();
      g.name = 'flap-' + label + '-' + tag;
      g.position.copy(pivot);
      const geo = loftSpan(z0, z1, WING.cFlap - 0.01, 1.0, 8, 10, side);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const mesh = new THREE.Mesh(geo, mats.wingSkin);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      wing.add(g);
      animate.flaps.push({ group: g, pivot, side, kind: label });
    }

    // --- ailerons
    {
      const z0 = 19.95, z1 = 30.55;
      const pivot = wingPoint(lerp(z0, z1, 0.5), WING.cAil, side, true);
      const g = new THREE.Group();
      g.name = 'aileron-' + tag;
      g.position.copy(pivot);
      const geo = loftSpan(z0, z1, WING.cAil - 0.01, 0.96, 7, 8, side);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const mesh = new THREE.Mesh(geo, mats.wingSkin);
      mesh.castShadow = true;
      g.add(mesh);
      wing.add(g);
      animate.ailerons.push({ group: g, pivot, side });
    }

    // --- spoiler panels on the upper surface, hinged at their forward edge
    const spoilerZ = [[4.9, 6.6], [6.9, 8.6], [8.9, 10.6], [12.6, 14.3], [14.6, 16.3], [16.6, 18.3]];
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
      animate.spoilers.push({ group: g, pivot, side });
    }

    // --- flap track canoe fairings
    for (const z of [5.6, 9.4, 15.0]) {
      const teX = wingPoint(z, 0.99, side, false).x;
      const y = wingPoint(z, 0.82, side, false).y - 0.16;
      const m = new THREE.Mesh(pod(teX + 1.6, teX - 2.4, y, z, 0.16, 0.20, side), mats.panel);
      m.castShadow = true; m.receiveShadow = true;
      wing.add(m);
    }

    // --- winglet: canted 60 degrees, swept, with a blended base
    {
      const base = wingStation(WING.semiSpan);
      const height = 1.95, cant = 62 * DEG;
      const rings = [];
      const N = 8;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const dz = height * Math.cos(cant) * t, dy = height * Math.sin(cant) * t;
        const blend = Math.pow(t, 0.75);
        const chord = lerp(base.chord, 1.05, blend);
        const xLE = base.xLE - 0.55 * Math.pow(t, 1.3);
        const st = { xLE, chord, t: 0.105, y: base.y + dy, twist: -1.2 * t, z: base.z + dz };
        const cs = cosineSpacing(8, 0, 1);
        const ring = [];
        for (const c of cs) {
          const { yt, yc } = airfoil(c, st.t);
          ring.push(new THREE.Vector3(xLE - c * chord, st.y + (yc + yt) * chord, side * (base.z + dz)));
        }
        for (let k = cs.length - 2; k >= 1; k--) {
          const c = cs[k];
          const { yt, yc } = airfoil(c, st.t);
          ring.push(new THREE.Vector3(xLE - c * chord, st.y + (yc - yt) * chord, side * (base.z + dz)));
        }
        rings.push(ring);
      }
      const g = loft(rings, { closed: true, flipNormals: side < 0, capStart: true, capEnd: true });
      const m = new THREE.Mesh(g, mats.wingSkin);
      m.castShadow = true; m.receiveShadow = true;
      wing.add(m);
    }

    group.add(wing);
  }

  // ---------------------------------------------------------------- animation
  const setFlaps = (t) => {
    for (const f of animate.flaps) {
      const max = f.kind === 'in' ? 40 : 32;
      f.group.rotation.z = max * DEG * t;
      f.group.position.set(f.pivot.x - 0.62 * t, f.pivot.y - 0.16 * t, f.pivot.z);
    }
  };
  const setSlats = (t) => {
    for (const s of animate.slats) {
      s.rotation.z = -6 * DEG * t;
      s.position.x += 0; // translation handled below via userData home
      s.userData.home = s.userData.home || s.position.clone();
      s.position.set(s.userData.home.x + 0.46 * t, s.userData.home.y - 0.03 * t, s.userData.home.z);
    }
  };
  const setSpoilers = (t) => {
    for (const s of animate.spoilers) s.group.rotation.z = -48 * DEG * clamp(t, 0, 1);
  };
  const setAilerons = (t) => {
    for (const a of animate.ailerons) a.group.rotation.z = -clamp(t, -1, 1) * 22 * DEG;
  };

  return { group, animate, setFlaps, setSlats, setSpoilers, setAilerons };
}
