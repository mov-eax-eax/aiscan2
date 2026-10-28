// js/tail.js — 747-8 empennage: swept fin with dorsal fillet and rudder, horizontal
// stabiliser with elevators, and the APU exhaust in the tail cone.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, cosineSpacing, loft, revolve } from './util.js';
import { airfoil } from './wings.js';
import { fuseProfile } from './fuselage.js';

export const FIN_STATIONS = [
  { y: 2.80, xLE: -21.50, chord: 14.00, t: 0.115 },
  { y: 5.20, xLE: -23.80, chord: 11.80, t: 0.112 },
  { y: 7.60, xLE: -26.10, chord: 9.60, t: 0.110 },
  { y: 10.00, xLE: -28.30, chord: 7.50, t: 0.108 },
  { y: 12.20, xLE: -30.40, chord: 5.40, t: 0.107 },
  { y: 14.05, xLE: -32.60, chord: 3.00, t: 0.106 },
];

export const STAB_STATIONS = [
  { z: 0.0, xLE: -26.80, chord: 8.00, t: 0.115, y: 2.35 },
  { z: 3.5, xLE: -29.50, chord: 6.70, t: 0.112, y: 2.48 },
  { z: 7.0, xLE: -32.20, chord: 5.20, t: 0.110, y: 2.62 },
  { z: 9.5, xLE: -34.30, chord: 3.90, t: 0.108, y: 2.75 },
  { z: 11.1, xLE: -35.00, chord: 2.50, t: 0.108, y: 2.88 },
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
  const N = 18, M = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(-9.0, -24.0, t);
    const prof = fuseProfile(x);
    const crown = prof.cy + prof.ayT + prof.hump;
    const h = lerp(0.06, 1.85, Math.pow(t, 1.55));
    const w = lerp(0.32, 1.55, Math.pow(t, 0.9));
    const ring = [];
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI;
      ring.push(new THREE.Vector3(x, crown + h * Math.sin(a), w * Math.cos(a)));
    }
    for (let j = M; j >= 0; j--) {
      const a = (j / M) * Math.PI;
      ring.push(new THREE.Vector3(x, crown - 0.28 * Math.sin(a), w * Math.cos(a) * 1.05));
    }
    rings.push(ring);
  }
  const m = new THREE.Mesh(loft(rings, { closed: true, capStart: true, capEnd: true }), mats.wingSkin);
  m.name = 'dorsal-fillet';
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildTail(mats) {
  const group = new THREE.Group();
  group.name = 'tail';

  const fin = new THREE.Mesh(finLoft(0, 0.70, 16, 11), mats.finSkin);
  fin.name = 'fin';
  fin.castShadow = true; fin.receiveShadow = true;
  group.add(fin);
  group.add(dorsalFillet(mats));

  // rudder, hinged about the swept trailing edge at 70 % chord
  const rudder = new THREE.Group();
  rudder.name = 'rudder';
  const yPivot = 8.5;
  const stPivot = sample(FIN_STATIONS, 'y', yPivot);
  const rPivot = new THREE.Vector3(stPivot.xLE - stPivot.chord * 0.70, yPivot, 0);
  rudder.position.copy(rPivot);
  const rGeo = finLoft(0.69, 1.0, 14, 9);
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

    const zPivot = 5.55;
    const st = sample(STAB_STATIONS, 'z', zPivot);
    const ePivot = new THREE.Vector3(st.xLE - st.chord * 0.70, st.y, side * zPivot);
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
    { r: 0.34, y: 0.0 }, { r: 0.38, y: -0.16 }, { r: 0.34, y: -0.44 },
    { r: 0.29, y: -0.46 }, { r: 0.27, y: -0.18 }, { r: 0.27, y: 0.0 },
  ];
  const apu = new THREE.Mesh(revolve(apuProfile.concat([apuProfile[0]]), 24, 'x'), mats.core);
  apu.position.set(-37.95, 2.36, 0);
  apu.castShadow = true;
  group.add(apu);

  const setRudder = (t) => { rudder.rotation.y = clamp(t, -1, 1) * 25 * DEG; };
  const setElevators = (t) => {
    for (const e of elevators) e.group.rotation.z = -clamp(t, -1, 1) * 22 * DEG;
  };
  setRudder(0); setElevators(0);
  return { group, rudder, elevators, setRudder, setElevators };
}
