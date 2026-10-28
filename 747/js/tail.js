// js/tail.js — vertical fin (with dorsal fillet and rudder) and horizontal tail (elevators).
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, cosineSpacing, loft, revolve } from './util.js';
import { airfoil } from './wings.js';
import { fuseProfile } from './fuselage.js';

export const FIN_STATIONS = [
  { y: 2.40, xLE: -20.50, chord: 13.60, t: 0.115 },
  { y: 4.50, xLE: -22.60, chord: 11.60, t: 0.112 },
  { y: 6.60, xLE: -24.70, chord: 9.60, t: 0.110 },
  { y: 8.70, xLE: -26.80, chord: 7.70, t: 0.108 },
  { y: 10.80, xLE: -28.90, chord: 5.90, t: 0.107 },
  { y: 12.95, xLE: -31.05, chord: 3.40, t: 0.106 },
];

export const STAB_STATIONS = [
  { z: 0.0, xLE: -26.00, chord: 6.30, t: 0.115, y: 2.54 },
  { z: 3.20, xLE: -28.00, chord: 5.30, t: 0.112, y: 2.84 },
  { z: 6.40, xLE: -30.00, chord: 4.10, t: 0.110, y: 3.14 },
  { z: 9.00, xLE: -31.80, chord: 3.05, t: 0.108, y: 3.40 },
  { z: 11.10, xLE: -33.40, chord: 2.25, t: 0.108, y: 3.62 },
];

const sample = (rows, key, v) => {
  if (v <= rows[0][key]) return { ...rows[0] };
  const last = rows[rows.length - 1];
  if (v >= last[key]) return { ...last };
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (v >= a[key] && v <= b[key]) {
      const t = (v - a[key]) / (b[key] - a[key]), o = {};
      for (const k in a) o[k] = lerp(a[k], b[k], t);
      return o;
    }
  }
  return { ...last };
};

// --- fin loft: sections stacked in Y, airfoil thickness along Z
function finLoft(cA, cB, segsS, segsC) {
  const rings = [];
  for (let i = 0; i <= segsS; i++) {
    const t = 0.5 - 0.5 * Math.cos((i / segsS) * Math.PI);
    const st = sample(FIN_STATIONS, 'y', lerp(FIN_STATIONS[0].y, FIN_STATIONS[FIN_STATIONS.length - 1].y, t));
    const cs = cosineSpacing(segsC, cA, cB);
    const ring = [];
    const pt = (c, up) => {
      const { yt } = airfoil(c, st.t, 0);
      return new THREE.Vector3(st.xLE - c * st.chord, st.y, (up ? yt : -yt) * st.chord);
    };
    for (const c of cs) ring.push(pt(c, true));
    for (let k = cs.length - 2; k >= 1; k--) ring.push(pt(cs[k], false));
    rings.push(ring);
  }
  return loft(rings, { closed: true, flipNormals: true, capStart: true, capEnd: true });
}

// --- stabiliser loft for one side
function stabLoft(side, cA, cB, segsS, segsC) {
  const rings = [];
  for (let i = 0; i <= segsS; i++) {
    const t = 0.5 - 0.5 * Math.cos((i / segsS) * Math.PI);
    const st = sample(STAB_STATIONS, 'z', lerp(0.15, STAB_STATIONS[STAB_STATIONS.length - 1].z, t));
    const cs = cosineSpacing(segsC, cA, cB);
    const ring = [];
    const pt = (c, up) => {
      const { yt } = airfoil(c, st.t, 0);
      return new THREE.Vector3(st.xLE - c * st.chord, st.y + (up ? yt : -yt) * st.chord, side * st.z);
    };
    for (const c of cs) ring.push(pt(c, true));
    for (let k = cs.length - 2; k >= 1; k--) ring.push(pt(cs[k], false));
    rings.push(ring);
  }
  return loft(rings, { closed: true, flipNormals: side < 0, capStart: true, capEnd: true });
}

function dorsalFillet(mats) {
  const rings = [];
  const N = 16, M = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(-11.5, -22.6, t);
    const prof = fuseProfile(x);
    const crown = prof.cy + prof.ayT + prof.hump;
    const h = lerp(0.08, 1.52, Math.pow(t, 1.45));
    const w = lerp(0.35, 1.30, Math.pow(t, 0.85));
    const ring = [];
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI;
      ring.push(new THREE.Vector3(x, crown + h * Math.sin(a), w * Math.cos(a)));
    }
    for (let j = M; j >= 0; j--) {
      const a = (j / M) * Math.PI;
      ring.push(new THREE.Vector3(x, crown - 0.30 * Math.sin(a), w * Math.cos(a) * 1.04));
    }
    rings.push(ring);
  }
  const m = new THREE.Mesh(loft(rings, { closed: true, capStart: true, capEnd: true }), mats.wingSkin);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildTail(mats) {
  const group = new THREE.Group();
  group.name = 'tail';

  const fin = new THREE.Mesh(finLoft(0, 0.70, 14, 10), mats.finSkin);
  fin.name = 'fin';
  fin.castShadow = true; fin.receiveShadow = true;
  group.add(fin);
  group.add(dorsalFillet(mats));

  // rudder, hinged on the fin trailing edge
  const rudder = new THREE.Group();
  rudder.name = 'rudder';
  const rPivot = new THREE.Vector3(-31.79, 7.6, 0);
  rudder.position.copy(rPivot);
  const rGeo = finLoft(0.69, 1.0, 12, 8);
  rGeo.translate(-rPivot.x, -rPivot.y, -rPivot.z);
  const rMesh = new THREE.Mesh(rGeo, mats.finPaint);
  rMesh.castShadow = true;
  rudder.add(rMesh);
  group.add(rudder);

  // horizontal stabiliser halves + elevators
  const elevators = [];
  for (const side of [1, -1]) {
    const stab = new THREE.Mesh(stabLoft(side, 0, 0.70, 10, 10), mats.wingSkin);
    stab.name = 'stab-' + (side > 0 ? 'R' : 'L');
    stab.castShadow = true; stab.receiveShadow = true;
    group.add(stab);

    const ePivot = new THREE.Vector3(-32.35, 3.06, side * 5.6);
    const g = new THREE.Group();
    g.name = 'elevator-' + (side > 0 ? 'R' : 'L');
    g.position.copy(ePivot);
    const geo = stabLoft(side, 0.69, 1.0, 8, 8);
    geo.translate(-ePivot.x, -ePivot.y, -ePivot.z);
    const m = new THREE.Mesh(geo, mats.wingSkin);
    m.castShadow = true;
    g.add(m);
    group.add(g);
    elevators.push({ group: g, side });
  }

  // APU exhaust at the tail cone
  const apuProfile = [
    { r: 0.30, y: 0.0 }, { r: 0.34, y: -0.18 }, { r: 0.30, y: -0.42 },
    { r: 0.26, y: -0.44 }, { r: 0.24, y: -0.20 }, { r: 0.24, y: 0.0 },
  ];
  const apu = new THREE.Mesh(revolve(apuProfile.concat([apuProfile[0]]), 22, 'x'), mats.core);
  apu.position.set(-35.30, 1.92, 0);
  apu.castShadow = true;
  group.add(apu);

  const setRudder = (t) => { rudder.rotation.y = clamp(t, -1, 1) * 26 * DEG; };
  const setElevators = (t) => {
    for (const e of elevators) e.group.rotation.z = -clamp(t, -1, 1) * 24 * DEG;
  };
  setRudder(0); setElevators(0);
  return { group, rudder, elevators, setRudder, setElevators };
}
