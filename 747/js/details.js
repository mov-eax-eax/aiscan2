// js/details.js — aerials, probes, position lights, decals and surface odds and ends.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, roundedSlab, surfaceBasis, glowSprite, loft, cosineSpacing } from './util.js';
import { fusePoint, fuseNormalAt, skinPatch, FUSE, thetaForY } from './fuselage.js';
import { wingPoint, wingNormalAt } from './wings.js';

// Place a small mesh on the fuselage skin. forward = local +x, up = local +y, +z = outward.
function onSkin(mesh, x, theta, lift = 0) {
  const p = fusePoint(x, theta), n = fuseNormalAt(x, theta);
  mesh.applyMatrix4(surfaceBasis(p.clone().addScaledVector(n, lift), n, new THREE.Vector3(1, 0, 0)));
  return mesh;
}

function bladeAntenna(mats, w = 0.34, h = 0.34, d = 0.04) {
  const m = new THREE.Mesh(roundedSlab(w, h, d, 0.02, 0.006), mats.detail);
  m.castShadow = true;
  return m;
}

function decalPatch(mats, x0, x1, th0, th1, mat, offset = 0.02) {
  const m = new THREE.Mesh(skinPatch(x0, x1, th0, th1, 6, 6, offset), mat);
  m.name = 'decal';
  m.renderOrder = 2;
  return m;
}

export function buildDetails(mats) {
  const group = new THREE.Group();
  group.name = 'details';
  const liv = mats.livery || { title: 'SKYLARK', reg: 'N747SL' };
  const R = FUSE.R;

  // ---------------------------------------------------------------- aerials
  for (const [x, th, w, h] of [
    [6.4, Math.PI / 2, 0.34, 0.34],
    [-13.0, Math.PI / 2, 0.30, 0.30],
    [2.0, Math.PI / 2, 0.26, 0.22],
  ]) group.add(onSkin(bladeAntenna(mats, w, h), x, th, h / 2));
  for (const [x, th] of [[-5.6, Math.PI * 1.5], [7.2, Math.PI * 1.5]]) {
    group.add(onSkin(bladeAntenna(mats, 0.30, 0.26), x, th, 0.13));
  }

  // satcom dome + GPS pucks on the crown
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2), mats.detail);
  dome.castShadow = true;
  group.add(onSkin(dome, -9.5, Math.PI / 2));
  for (const x of [3.6, -2.4]) {
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 16), mats.detail);
    puck.rotation.x = Math.PI / 2;
    group.add(onSkin(puck, x, Math.PI / 2, 0.025));
  }

  // ---------------------------------------------------------------- probes
  for (const s of [1, -1]) {
    const th = s > 0 ? 0.36 : Math.PI - 0.36;
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.62, 10), mats.chrome);
    probe.rotation.z = Math.PI / 2;
    probe.position.x = 0.31;
    group.add(onSkin(probe, 31.35, th, 0.16));
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.03), mats.detail);
    vane.position.x = 0.15;
    group.add(onSkin(vane, 30.15, th, 0.10));
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.04), mats.detail);
    wiper.rotation.z = 0.5;
    wiper.position.set(0.05, 0.22, 0);
    group.add(onSkin(wiper, 30.35, s > 0 ? 1.02 : Math.PI - 1.02, 0.06));
  }
  const tempProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.40, 10), mats.chrome);
  tempProbe.rotation.z = Math.PI / 2;
  group.add(onSkin(tempProbe, 32.0, Math.PI / 2 - 0.62, 0.16));

  // ---------------------------------------------------------------- decals
  const titleMat = mats.decal(liv.title, { w: 2048, h: 300, sub: '747-400', color: liv.accent, subColor: liv.accent2 });
  const regMat = mats.decal(liv.reg, { w: 1024, h: 256, color: liv.accent, scale: 0.52 });
  const noseMat = mats.decal('747-400', { w: 1024, h: 256, color: liv.accent, scale: 0.5 });
  const thLow = 49 * DEG, thHigh = 70 * DEG;      // flank of the upper deck, above the windows
  group.add(decalPatch(mats, 10.5, 22.0, thLow, thHigh, titleMat));
  group.add(decalPatch(mats, 22.0, 10.5, Math.PI - thLow, Math.PI - thHigh, titleMat));
  const rLow = 16 * DEG, rHigh = 33 * DEG;        // below the window line, aft of the wing
  group.add(decalPatch(mats, -25.5, -19.5, rLow, rHigh, regMat));
  group.add(decalPatch(mats, -19.5, -25.5, Math.PI - rLow, Math.PI - rHigh, regMat));
  const nLow = 46 * DEG, nHigh = 56 * DEG;
  group.add(decalPatch(mats, 27.0, 29.2, nLow, nHigh, noseMat));
  group.add(decalPatch(mats, 29.2, 27.0, Math.PI - nLow, Math.PI - nHigh, noseMat));

  // ---------------------------------------------------------------- wing walkway lines
  for (const side of [1, -1]) {
    for (const c of [0.24, 0.46]) {
      const rings = [];
      for (let i = 0; i <= 4; i++) {
        const z = lerp(3.6, 8.6, i / 4);
        const ring = [];
        const cs = cosineSpacing(4, c, c + 0.004);
        for (const cc of cs) ring.push(wingPoint(z, cc, side, true).addScaledVector(wingNormalAt(z, cc, side, true), 0.008));
        for (let k = cs.length - 1; k >= 0; k--) {
          const cc = cs[k];
          ring.push(wingPoint(z, cc, side, true).addScaledVector(wingNormalAt(z, cc, side, true), -0.01));
        }
        rings.push(ring);
      }
      const m = new THREE.Mesh(loft(rings, { closed: true, flipNormals: side < 0, capStart: true, capEnd: true }), mats.detail);
      group.add(m);
    }
  }

  // ---------------------------------------------------------------- lights
  const lights = { strobe: [], beacon: [], nav: [], landing: [], glows: [] };
  const addGlow = (parent, color, size, pos) => {
    const s = glowSprite(color, size);
    s.position.copy(pos);
    parent.add(s);
    lights.glows.push(s);
    return s;
  };

  const bulb = (mat, r = 0.11) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);

  // navigation lights at the wing tips
  for (const side of [1, -1]) {
    const p = wingPoint(32.0, 0.10, side, true);
    const n = wingNormalAt(32.0, 0.10, side, true);
    const pos = p.clone().addScaledVector(n, -0.06);
    const mat = side > 0 ? mats.lights.navGreen : mats.lights.navRed;
    const b = bulb(mat);
    b.position.copy(pos);
    group.add(b);
    lights.nav.push(b);
    addGlow(group, side > 0 ? 'rgba(40,255,120,0.9)' : 'rgba(255,60,60,0.9)', 1.1, pos);
    const st = bulb(mats.lights.strobe, 0.09);
    st.position.copy(pos).addScaledVector(n, -0.10);
    group.add(st);
    lights.strobe.push(st);
    const stg = addGlow(group, 'rgba(255,255,255,0.95)', 1.5, st.position);
    stg.userData.strobe = true;
  }

  // tail navigation + strobe + beacons
  const tailNav = bulb(mats.lights.navWhite, 0.10);
  tailNav.position.set(-35.15, 2.05, 0);
  group.add(tailNav);
  lights.nav.push(tailNav);
  addGlow(group, 'rgba(255,255,255,0.85)', 1.1, tailNav.position);
  const tailStrobe = bulb(mats.lights.strobe, 0.09);
  tailStrobe.position.set(-34.9, 2.55, 0);
  group.add(tailStrobe);
  lights.strobe.push(tailStrobe);
  const tsg = addGlow(group, 'rgba(255,255,255,0.95)', 1.5, tailStrobe.position);
  tsg.userData.strobe = true;

  for (const cfg of [
    { x: 13.5, th: Math.PI / 2, up: true },
    { x: -8.0, th: Math.PI / 2, up: true },
    { x: -3.0, th: Math.PI * 1.5, up: false },
  ]) {
    const p = fusePoint(cfg.x, cfg.th), n = fuseNormalAt(cfg.x, cfg.th);
    const b = bulb(mats.lights.beacon, 0.10);
    b.position.copy(p).addScaledVector(n, 0.10);
    group.add(b);
    lights.beacon.push(b);
    const gl = addGlow(group, 'rgba(255,40,40,0.9)', 1.3, b.position);
    gl.userData.beacon = true;
  }

  // landing lights in the wing root leading edge
  for (const side of [1, -1]) {
    const p = wingPoint(4.6, 0.045, side, false);
    const n = wingNormalAt(4.6, 0.045, side, false);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), mats.lights.landing);
    lamp.position.copy(p).addScaledVector(n, 0.02);
    lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize());
    group.add(lamp);
    lights.landing.push(lamp);
    const gl = addGlow(group, 'rgba(255,246,214,0.8)', 1.8, lamp.position.clone().addScaledVector(n, 0.12));
    gl.userData.landing = true;
    lights.glows.push(gl);
  }

  // static dischargers along the fin trailing edge
  for (let i = 0; i < 6; i++) {
    const y = lerp(3.4, 12.2, i / 5);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.30, 6), mats.detail);
    wick.rotation.x = Math.PI / 2;
    const t = i / 5;
    wick.position.set(lerp(-33.4, -34.2, t), y, 0);
    group.add(wick);
  }

  // light state machine
  const state = { nav: true, strobe: true, beacon: true, landing: true };
  const apply = () => {
    for (const b of lights.strobe) b.visible = state.strobe;
    for (const b of lights.beacon) b.visible = state.beacon;
    for (const b of lights.nav) b.visible = state.nav;
    for (const b of lights.landing) b.visible = state.landing;
    for (const g of lights.glows) {
      if (g.userData.strobe) g.visible = state.strobe;
      else if (g.userData.beacon) g.visible = state.beacon;
      else if (g.userData.landing) g.visible = state.landing;
      else g.visible = state.nav;
    }
  };
  const setLights = (opts) => { Object.assign(state, opts); apply(); };
  const update = (time) => {
    const strobeOn = state.strobe && (time % 1.35) < 0.075;
    const beaconOn = state.beacon && (time % 1.1) < 0.5;
    mats.lights.strobe.emissiveIntensity = strobeOn ? 7.0 : 0.06;
    mats.lights.beacon.emissiveIntensity = beaconOn ? 5.0 : 0.08;
    for (const g of lights.glows) {
      if (g.userData.strobe) g.visible = strobeOn;
      if (g.userData.beacon) g.visible = beaconOn;
    }
  };
  apply();
  return { group, lights, setLights, update, state };
}
