// js/engines.js — four GEnx-2B67 high-bypass turbofans (2.82 m fan, 18 wide-chord blades)
// with translating thrust reversers, serrated core nozzle and 747-8 pylons.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, cosineSpacing, loft, revolve, strut } from './util.js';
import { wingPoint } from './wings.js';

export const ENGINE = {
  fanR: 1.41, cowlR: 1.745, length: 7.4, coreR: 0.78,
  blades: 18, positions: [11.0, 21.2], lipX: 4.85, dropY: 2.85,
};

export function engineMount(z, side) {
  const le = wingPoint(z, 0.0, side, true);
  const low = wingPoint(z, 0.46, side, false);
  return { z: side * z, xIntake: le.x + ENGINE.lipX, yCenter: low.y - ENGINE.dropY, leX: le.x };
}

// ---------------------------------------------------------------- parts
function shell(profile, segments = 48) {
  const pts = profile.map((p) => ({ r: p[0], y: p[1] }));
  const closed = pts.concat([pts[0]]);
  return revolve(closed, segments, 'x');
}

function fanBladeGeometry(rHub = 0.40, rTip = ENGINE.fanR) {
  const rings = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = lerp(rHub, rTip, t);
    const chord = lerp(0.80, 0.52, Math.pow(t, 0.8));
    const pitch = lerp(58, 19, Math.pow(t, 0.72)) * DEG;
    const th = lerp(0.095, 0.045, t);
    const sweep = -0.10 * Math.pow(t, 1.4);
    const cs = cosineSpacing(8, 0, 1);
    const ring = [];
    const put = (c, up) => {
      const yt = (th / 0.2) * (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1015 * c ** 4) * chord;
      const x0 = (c - 0.42) * chord + sweep, z0 = up ? yt : -yt;
      ring.push(new THREE.Vector3(x0 * Math.cos(pitch) + z0 * Math.sin(pitch), r, -x0 * Math.sin(pitch) + z0 * Math.cos(pitch)));
    };
    for (const c of cs) put(c, true);
    for (let k = cs.length - 2; k >= 1; k--) put(cs[k], false);
    rings.push(ring);
  }
  return loft(rings, { closed: true, capStart: true, capEnd: true });
}

function cascadeRing(x, count, radius) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const g = new THREE.BoxGeometry(0.34, 0.10, 0.16);
    const m = new THREE.Matrix4().makeRotationX(a).setPosition(x, Math.cos(a) * radius, Math.sin(a) * radius);
    parts.push({ geometry: g, matrix: m });
  }
  return parts;
}

// chevron ring around the core nozzle, each a little triangular prism
function chevronRing(mats, x, radius, count = 14, size = 0.30) {
  const group = new THREE.Group();
  group.name = 'chevrons';
  const tri = new THREE.Shape();
  tri.moveTo(0, 0);
  tri.lineTo(size, 0);
  tri.lineTo(size * 0.20, size * 0.55);
  tri.lineTo(0, size * 0.55);
  const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.035, bevelEnabled: false });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const m = new THREE.Mesh(geo, mats.core);
    // local x = axial (aft), local y = radially outward; rotate into place
    m.position.set(x, Math.cos(a) * radius, Math.sin(a) * radius);
    m.rotation.x = -a;
    m.rotation.z = -Math.PI / 2;
    group.add(m);
  }
  return group;
}

// Outer nacelle crown line, sampled so the pylon sits exactly on the cowl.
const NACELLE_TOP = [
  { x: -4.30, y: 1.54 }, { x: -3.60, y: 1.63 }, { x: -2.80, y: 1.70 },
  { x: -1.80, y: 1.74 }, { x: -0.90, y: 1.735 }, { x: -0.10, y: 1.66 }, { x: 0.50, y: 1.28 },
];
const nacelleTop = (x) => {
  if (x <= NACELLE_TOP[0].x) return NACELLE_TOP[0].y;
  const last = NACELLE_TOP[NACELLE_TOP.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 0; i < NACELLE_TOP.length - 1; i++) {
    const a = NACELLE_TOP[i], b = NACELLE_TOP[i + 1];
    if (x >= a.x && x <= b.x) return lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
  }
  return last.y;
};

// Height of the wing lower surface at a world x (the wing x decreases with chord fraction).
function wingLowerAtX(zAbs, worldX, side) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (wingPoint(zAbs, m, side, false).x > worldX) lo = m; else hi = m;
  }
  return wingPoint(zAbs, (lo + hi) / 2, side, false).y;
}

// The pylon: a faired strut from the nacelle crown to the wing underside.
function pylonGeometry(mount, side) {
  const rings = [];
  const N = 16;
  const x0 = 1.05, x1 = -9.4;
  const zAbs = Math.abs(mount.z);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(x0, x1, t);
    const yBot = nacelleTop(x) + 0.012;
    const worldX = mount.xIntake + x;
    let yTop = yBot + 0.07;
    if (worldX <= mount.leX - 0.06) yTop = wingLowerAtX(zAbs, worldX, side) - 0.012;
    const endFade = Math.min(1, Math.sin(Math.PI * clamp(t, 0, 1)) / 0.26);
    yTop = yBot + (yTop - yBot) * clamp(endFade, 0, 1);
    const cy = (yTop + yBot) / 2;
    const hy = Math.max(0.035, (yTop - yBot) / 2);
    const hz = 0.34 * Math.pow(Math.max(0.02, Math.sin(Math.PI * clamp(t, 0, 1))), 0.30);
    const ring = [];
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * Math.PI * 2;
      ring.push(new THREE.Vector3(x, cy + hy * Math.sin(a), hz * Math.cos(a)));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, capStart: true, capEnd: true });
}

function buildOneEngine(mats, mount, side) {
  const g = new THREE.Group();
  g.name = 'engine';
  g.position.set(mount.xIntake, mount.yCenter, mount.z);

  // --- fan cowl: outer skin from the lip aft, inner duct wall, rounded lip in one shell
  const cowl = [
    [1.52, 0.30], [1.62, 0.12], [1.70, -0.25], [1.745, -0.85], [1.755, -1.80],
    [1.74, -2.80], [1.68, -3.55], [1.57, -4.05],
    [1.42, -4.00], [1.40, -3.20], [1.42, -2.20], [1.44, -1.20], [1.46, -0.45],
    [1.47, -0.05], [1.48, 0.12],
  ];
  const cowlMesh = new THREE.Mesh(shell(cowl, 52), mats.nacelle);
  cowlMesh.name = 'fan-cowl';
  cowlMesh.castShadow = true; cowlMesh.receiveShadow = true;
  g.add(cowlMesh);

  // polished inlet lip ring
  const lip = [
    [1.505, 0.33], [1.53, 0.40], [1.60, 0.30], [1.63, 0.14], [1.61, 0.055],
    [1.56, 0.09], [1.54, 0.20], [1.515, 0.29],
  ];
  const lipMesh = new THREE.Mesh(shell(lip, 52), mats.chrome);
  lipMesh.name = 'inlet-lip';
  g.add(lipMesh);

  // --- translating sleeve (thrust reverser) + cascade vanes it uncovers
  const sleeveProfile = [
    [1.57, -4.04], [1.58, -4.55], [1.53, -5.15], [1.42, -5.55],
    [1.27, -5.55], [1.33, -5.10], [1.385, -4.55], [1.39, -4.04],
  ];
  const sleeve = new THREE.Group();
  sleeve.name = 'reverser-sleeve';
  const sleeveMesh = new THREE.Mesh(shell(sleeveProfile, 52), mats.nacelle);
  sleeveMesh.castShadow = true; sleeveMesh.receiveShadow = true;
  sleeve.add(sleeveMesh);
  g.add(sleeve);

  const cascades = new THREE.Group();
  cascades.name = 'reverser-cascades';
  for (const p of cascadeRing(-4.15, 24, 1.36)) {
    const m = new THREE.Mesh(p.geometry, mats.cascade);
    m.applyMatrix4(p.matrix);
    cascades.add(m);
  }
  g.add(cascades);

  // --- core cowl, nozzle and plug
  const coreProfile = [
    [0.88, -3.90], [0.98, -4.45], [1.01, -5.10], [0.94, -5.75], [0.84, -6.05],
    [0.77, -6.18], [0.73, -6.40], [0.62, -6.62], [0.48, -6.75],
    [0.43, -6.80], [0.50, -6.62], [0.56, -6.20], [0.58, -5.60], [0.60, -4.80], [0.62, -4.10],
  ];
  const core = new THREE.Mesh(shell(coreProfile, 44), mats.core);
  core.name = 'core-cowl';
  core.castShadow = true; core.receiveShadow = true;
  g.add(core);
  g.add(chevronRing(mats, -6.55, 0.74, 14, 0.30));

  // --- inlet interior: fan face, hub, spinner
  const fanGroup = new THREE.Group();
  fanGroup.name = 'fan';
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.62, 30), mats.fanHub);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = -0.55;
  fanGroup.add(hub);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.44, 1.38, 32), mats.spinner);
  spinner.rotation.z = -Math.PI / 2;
  spinner.position.x = -0.72;
  fanGroup.add(spinner);
  const blades = new THREE.InstancedMesh(fanBladeGeometry(), mats.fanBlade, ENGINE.blades);
  const bm = new THREE.Matrix4();
  for (let i = 0; i < ENGINE.blades; i++) {
    bm.makeRotationX((i / ENGINE.blades) * Math.PI * 2);
    blades.setMatrixAt(i, bm);
  }
  blades.instanceMatrix.needsUpdate = true;
  blades.castShadow = true;
  fanGroup.add(blades);
  fanGroup.position.x = -1.15;
  g.add(fanGroup);

  // dark inlet plug so the intake reads deep
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.66, 1.8, 28), mats.intakeDark);
  plug.rotation.z = Math.PI / 2;
  plug.position.x = -2.15;
  g.add(plug);

  // --- accessory gearbox, oil tank, plumbing on the core underside
  const acc = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.72, 1.1), mats.detail);
  acc.position.set(-4.25, -1.00, 0.15);
  acc.castShadow = true;
  g.add(acc);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), mats.detail);
  tank.position.set(-4.0, -1.08, -0.78);
  g.add(tank);
  for (const zz of [-0.52, 0.52]) {
    const pipe = new THREE.Mesh(strut(new THREE.Vector3(-3.1, -0.82, zz), new THREE.Vector3(-5.9, -0.74, zz), 0.05, 0.05, 8), mats.pipe);
    g.add(pipe);
  }
  const starter = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 18), mats.detail);
  starter.rotation.z = Math.PI / 2;
  starter.position.set(-3.65, -0.72, 0.95);
  g.add(starter);

  g.userData.fan = fanGroup;
  g.userData.sleeve = sleeve;
  return g;
}

export function buildEngines(mats) {
  const group = new THREE.Group();
  group.name = 'engines';
  const fans = [], sleeves = [];
  for (const side of [1, -1]) {
    for (const z of ENGINE.positions) {
      const mount = engineMount(z, side);
      const e = buildOneEngine(mats, mount, side);
      group.add(e);
      fans.push(e.userData.fan);
      sleeves.push(e.userData.sleeve);
      const pyl = new THREE.Mesh(pylonGeometry(mount, side), mats.pylon);
      pyl.position.set(mount.xIntake, mount.yCenter, mount.z);
      pyl.castShadow = true; pyl.receiveShadow = true;
      group.add(pyl);
    }
  }
  const setReversers = (t) => {
    for (const s of sleeves) s.position.set(-0.95 * clamp(t, 0, 1), 0, 0);
  };
  const spool = (dt, rate) => {
    for (const f of fans) f.rotation.x += dt * rate;
  };
  return { group, fans, sleeves, setReversers, spool };
}
