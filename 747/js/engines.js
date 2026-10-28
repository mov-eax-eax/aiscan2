// js/engines.js — four high-bypass turbofans: nacelle, fan, core, pylon, thrust reverser.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, cosineSpacing, loft, revolve, strut } from './util.js';
import { wingPoint, WING } from './wings.js';

export const ENGINE = {
  fanR: 1.10, cowlR: 1.44, length: 5.45, coreR: 0.62,
  blades: 38, positions: [10.6, 17.2], lipX: 3.62, dropY: 2.15,
};

export function engineMount(z, side) {
  const le = wingPoint(z, 0.0, side, true);
  const low = wingPoint(z, 0.42, side, false);
  const pylonTop = wingPoint(z, 0.34, side, false);
  return { z: side * z, xIntake: le.x + ENGINE.lipX, yCenter: low.y - ENGINE.dropY, pylonTop, leX: le.x };
}

// ---------------------------------------------------------------- parts
function shell(profile, segments = 40) {
  const pts = profile.map((p) => ({ r: p[0], y: p[1] }));
  const closed = pts.concat([pts[0]]);
  return revolve(closed, segments, 'x');
}

function fanBladeGeometry(rHub = 0.30, rTip = ENGINE.fanR) {
  const rings = [];
  const N = 7;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = lerp(rHub, rTip, t);
    const chord = lerp(0.46, 0.30, Math.pow(t, 0.8));
    const pitch = lerp(52, 14, Math.pow(t, 0.75)) * DEG;
    const th = lerp(0.11, 0.055, t);
    const cs = cosineSpacing(7, 0, 1);
    const ring = [];
    const put = (c, up) => {
      const yt = (th / 0.2) * (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1015 * c ** 4) * chord;
      const x0 = (c - 0.42) * chord, z0 = up ? yt : -yt;
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
    const m = new THREE.Matrix4()
      .makeRotationX(a)
      .setPosition(x, Math.cos(a) * radius, Math.sin(a) * radius);
    parts.push({ geometry: g, matrix: m });
  }
  return parts;
}

// Outer cowl top line, sampled so the pylon can sit exactly on the nacelle.
const NACELLE_TOP = [
  { x: -4.2, y: 0.98 }, { x: -3.6, y: 1.10 }, { x: -3.0, y: 1.24 }, { x: -2.4, y: 1.34 },
  { x: -1.6, y: 1.43 }, { x: -0.6, y: 1.44 }, { x: 0.2, y: 1.37 }, { x: 0.9, y: 1.06 },
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
function wingLowerAtX(z, worldX, side) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2;
    if (wingPoint(z, m, side, false).x > worldX) lo = m; else hi = m;
  }
  return wingPoint(z, (lo + hi) / 2, side, false).y;
}

// The pylon is a faired strut: thin in span, spanning nacelle crown to wing underside.
function pylonGeometry(mount, side) {
  const rings = [];
  const N = 14;
  const x0 = 0.55, x1 = -8.6;
  const zAbs = Math.abs(mount.z);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(x0, x1, t);
    const yBot = nacelleTop(x) + 0.01;
    const worldX = mount.xIntake + x;
    let yTop = yBot + 0.07;
    if (worldX <= mount.leX - 0.06) yTop = wingLowerAtX(zAbs, worldX, side) - 0.015;
    const endFade = Math.min(1, Math.sin(Math.PI * clamp(t, 0, 1)) / 0.28);
    yTop = yBot + (yTop - yBot) * clamp(endFade, 0, 1);
    const cy = (yTop + yBot) / 2;
    const hy = Math.max(0.035, (yTop - yBot) / 2);
    const hz = 0.30 * Math.pow(Math.max(0.02, Math.sin(Math.PI * clamp(t, 0, 1))), 0.30);
    const ring = [];
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
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

  // --- fan cowl: outer skin from the lip aft, inner duct wall, rounded lip in one closed shell
  const cowl = [
    [1.28, 0.00], [1.39, -0.28], [1.44, -0.95], [1.445, -1.9], [1.42, -2.45],
    [1.30, -2.52], [1.20, -2.52],
    [1.17, -2.40], [1.16, -1.90], [1.155, -1.00], [1.15, -0.35], [1.18, -0.06],
  ];
  const cowlMesh = new THREE.Mesh(shell(cowl, 44), mats.nacelle);
  cowlMesh.name = 'fan-cowl';
  cowlMesh.castShadow = true; cowlMesh.receiveShadow = true;
  g.add(cowlMesh);

  // --- translating sleeve (thrust reverser) + cascade vanes it uncovers
  const sleeveProfile = [
    [1.30, -2.50], [1.34, -3.1], [1.30, -3.55], [1.18, -3.95],
    [1.06, -3.95], [1.12, -3.5], [1.155, -2.95], [1.16, -2.5],
  ];
  const sleeve = new THREE.Group();
  sleeve.name = 'reverser-sleeve';
  const sleeveMesh = new THREE.Mesh(shell(sleeveProfile, 44), mats.nacelle);
  sleeveMesh.castShadow = true; sleeveMesh.receiveShadow = true;
  sleeve.add(sleeveMesh);
  g.add(sleeve);

  const cascades = new THREE.Group();
  cascades.name = 'reverser-cascades';
  for (const p of cascadeRing(-2.75, 22, 1.16)) {
    const m = new THREE.Mesh(p.geometry, mats.cascade);
    m.applyMatrix4(p.matrix);
    cascades.add(m);
  }
  g.add(cascades);

  // --- core cowl, nozzle and plug
  const coreProfile = [
    [0.62, -2.0], [0.68, -3.0], [0.66, -3.7], [0.58, -4.1], [0.54, -4.15],
    [0.50, -4.15], [0.42, -4.45], [0.30, -4.68], [0.14, -4.78],
    [0.11, -4.86], [0.30, -4.90], [0.47, -4.62], [0.53, -4.2], [0.55, -3.6], [0.52, -2.4],
  ];
  const core = new THREE.Mesh(shell(coreProfile, 40), mats.core);
  core.name = 'core-cowl';
  core.castShadow = true; core.receiveShadow = true;
  g.add(core);

  // --- inlet interior: fan face, hub, spinner
  const fanGroup = new THREE.Group();
  fanGroup.name = 'fan';
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.5, 28), mats.fanHub);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = -0.30;
  fanGroup.add(hub);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 28), mats.spinner);
  spinner.rotation.z = -Math.PI / 2;
  spinner.position.x = -0.28;
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
  fanGroup.position.x = -0.80;
  g.add(fanGroup);

  // dark inlet plug so the intake reads deep
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.60, 0.52, 1.4, 24), mats.intakeDark);
  plug.rotation.z = Math.PI / 2;
  plug.position.x = -1.60;
  g.add(plug);

  // --- accessory gearbox, oil tank, plumbing on the core underside
  const acc = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 1.0), mats.detail);
  acc.position.set(-3.3, -0.85, 0.2);
  acc.castShadow = true;
  g.add(acc);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), mats.detail);
  tank.position.set(-3.1, -0.95, -0.65);
  g.add(tank);
  for (const zz of [-0.45, 0.45]) {
    const pipe = new THREE.Mesh(strut(new THREE.Vector3(-2.4, -0.70, zz), new THREE.Vector3(-4.4, -0.62, zz), 0.045, 0.045, 8), mats.pipe);
    g.add(pipe);
  }
  const starter = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 16), mats.detail);
  starter.rotation.z = Math.PI / 2;
  starter.position.set(-2.7, -0.60, 0.85);
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
    for (const s of sleeves) s.position.set(-0.75 * clamp(t, 0, 1), 0, 0);
  };
  const spool = (dt, rate) => {
    for (const f of fans) f.rotation.x += dt * rate;
  };
  return { group, fans, sleeves, setReversers, spool };
}
