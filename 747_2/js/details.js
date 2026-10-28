// js/details.js — aerials, probes, wipers, decals, walkway lines, fuel caps and lights.
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

function decalPatch(mats, x0, x1, th0, th1, mat, offset = 0.014) {
  const m = new THREE.Mesh(skinPatch(x0, x1, th0, th1, 10, 10, offset), mat);
  m.name = 'decal';
  m.renderOrder = 3;
  return m;
}

function flipTexture(mat) {
  const m = mat.clone();
  const t = m.map.clone();
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = -1;
  t.offset.x = 1;
  t.needsUpdate = true;
  m.map = t;
  m.needsUpdate = true;
  return m;
}

export function buildDetails(mats) {
  const group = new THREE.Group();
  group.name = 'details';
  const liv = mats.livery || { title: 'BOEING', sub: '747-8', reg: 'N747BJ', accent: '#0b2e52', accent2: '#c9a96a' };

  // ---------------------------------------------------------------- aerials and domes
  for (const [x, th, w, h] of [
    [11.0, Math.PI / 2, 0.34, 0.34],
    [-10.5, Math.PI / 2, 0.30, 0.30],
    [3.4, Math.PI / 2, 0.26, 0.22],
  ]) group.add(onSkin(bladeAntenna(mats, w, h), x, th, h / 2));
  for (const [x, th] of [[-4.8, Math.PI * 1.5], [13.5, Math.PI * 1.5]]) {
    group.add(onSkin(bladeAntenna(mats, 0.30, 0.26), x, th, 0.13));
  }

  // satcom radome + GPS pucks on the crown
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.detail);
  dome.castShadow = true;
  group.add(onSkin(dome, -7.8, Math.PI / 2));
  for (const x of [5.0, -1.4]) {
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 16), mats.detail);
    puck.rotation.x = Math.PI / 2;
    group.add(onSkin(puck, x, Math.PI / 2, 0.025));
  }

  // ---------------------------------------------------------------- probes and vanes
  for (const s of [1, -1]) {
    const th = s > 0 ? 0.40 : Math.PI - 0.40;
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.66, 10), mats.chrome);
    probe.rotation.z = Math.PI / 2;
    probe.position.x = 0.33;
    group.add(onSkin(probe, 34.10, th, 0.16));
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.17, 0.03), mats.detail);
    vane.position.x = 0.16;
    group.add(onSkin(vane, 33.05, th, 0.10));
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.62, 0.05), mats.detail);
    wiper.rotation.z = 0.48;
    wiper.position.set(0.03, 0.28, 0);
    group.add(onSkin(wiper, 32.85, s > 0 ? 1.02 : Math.PI - 1.02, 0.08));
  }
  const tempProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 10), mats.chrome);
  tempProbe.rotation.z = Math.PI / 2;
  group.add(onSkin(tempProbe, 34.9, Math.PI / 2 - 0.66, 0.17));

  // ---------------------------------------------------------------- decals
  const thLow = 40 * DEG, thHigh = 62 * DEG;      // flank above the main-deck windows
  const titleMat = mats.decal(liv.title, { w: 2048, h: 460, sub: liv.sub, color: liv.accent, subColor: liv.accent2 });
  group.add(decalPatch(mats, 8.0, 26.0, thLow, thHigh, titleMat));
  group.add(decalPatch(mats, 26.0, 8.0, Math.PI - thLow, Math.PI - thHigh, titleMat));

  const subMat = mats.decal('INTERCONTINENTAL', { w: 2048, h: 200, color: liv.accent2, scale: 0.62 });
  group.add(decalPatch(mats, 3.0, 17.0, (thLow + 3) * DEG, (thLow + 9) * DEG, subMat));

  const regMat = mats.decal(liv.reg, { w: 1024, h: 260, color: liv.accent, scale: 0.62 });
  group.add(decalPatch(mats, -27.8, -22.2, 17 * DEG, 29 * DEG, regMat));
  group.add(decalPatch(mats, -22.2, -27.8, Math.PI - 17 * DEG, Math.PI - 29 * DEG, regMat));

  const noseMat = mats.decal('747-8', { w: 1024, h: 300, color: liv.accent, scale: 0.55 });
  group.add(decalPatch(mats, 29.0, 31.4, 33 * DEG, 45 * DEG, noseMat));
  group.add(decalPatch(mats, 31.4, 29.0, Math.PI - 33 * DEG, Math.PI - 45 * DEG, noseMat));

  // fin artwork as flat decals on both sides
  const finMat = mats.decal(liv.finMark, { w: 1400, h: 540, sub: liv.finSub, color: liv.finText, subColor: liv.accent2, scale: 0.82 });
  const finGeo = new THREE.PlaneGeometry(4.6, 1.75);
  const finPos = new THREE.Vector3(-30.6, 8.85, 0);
  const rSide = new THREE.Mesh(finGeo, finMat);
  rSide.position.set(finPos.x, finPos.y, 0.47);
  rSide.renderOrder = 3;
  group.add(rSide);
  const lMat = flipTexture(finMat);
  const lSide = new THREE.Mesh(finGeo, lMat);
  lSide.position.set(finPos.x, finPos.y, -0.47);
  lSide.rotation.y = Math.PI;
  lSide.renderOrder = 3;
  group.add(lSide);

  // ---------------------------------------------------------------- wing walkway lines
  for (const side of [1, -1]) {
    for (const c of [0.20, 0.30]) {
      const rings = [];
      for (let i = 0; i <= 4; i++) {
        const z = lerp(3.8, 8.7, i / 4);
        const ring = [];
        const cs = cosineSpacing(4, c, c + 0.006);
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
    // fuel caps
    for (const [z, c] of [[8.4, 0.30], [12.2, 0.30], [24.6, 0.36]]) {
      const p = wingPoint(z, c, side, true), n = wingNormalAt(z, c, side, true);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 16), mats.detail);
      cap.position.copy(p).addScaledVector(n, 0.012);
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().normalize());
      group.add(cap);
    }
  }

  // ---------------------------------------------------------------- lights
  const lights = { strobe: [], beacon: [], nav: [], landing: [], glows: [] };
  const addGlow = (color, size, pos) => {
    const s = glowSprite(color, size);
    s.position.copy(pos);
    group.add(s);
    lights.glows.push(s);
    return s;
  };
  const bulb = (mat, r = 0.11) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);

  const tipZ = 33.35;
  for (const side of [1, -1]) {
    const p = wingPoint(tipZ, 0.16, side, true);
    const n = wingNormalAt(tipZ, 0.16, side, true);
    const pos = p.clone().addScaledVector(n, -0.05);
    const mat = side > 0 ? mats.lights.navGreen : mats.lights.navRed;
    const b = bulb(mat);
    b.position.copy(pos);
    group.add(b); lights.nav.push(b);
    addGlow(side > 0 ? 'rgba(40,255,120,0.9)' : 'rgba(255,60,60,0.9)', 1.15, pos);
    const st = bulb(mats.lights.strobe, 0.09);
    st.position.copy(pos).addScaledVector(n, -0.10);
    group.add(st); lights.strobe.push(st);
    const stg = addGlow('rgba(255,255,255,0.95)', 1.5, st.position);
    stg.userData.strobe = true;

    // landing light in the wing-root leading edge
    const lp = wingPoint(5.1, 0.05, side, false);
    const ln = wingNormalAt(5.1, 0.05, side, false);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.23, 18), mats.lights.landing);
    lamp.position.copy(lp).addScaledVector(ln, 0.02);
    lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ln.clone().normalize());
    group.add(lamp); lights.landing.push(lamp);
    const gl = addGlow('rgba(255,246,214,0.8)', 1.9, lamp.position.clone().addScaledVector(ln, 0.14));
    gl.userData.landing = true;
  }

  // tail navigation light + strobe
  const tailNav = bulb(mats.lights.navWhite, 0.10);
  tailNav.position.set(-36.4, 2.92, 0);
  group.add(tailNav); lights.nav.push(tailNav);
  addGlow('rgba(255,255,255,0.85)', 1.1, tailNav.position);
  const tailStrobe = bulb(mats.lights.strobe, 0.09);
  tailStrobe.position.set(-36.1, 3.35, 0);
  group.add(tailStrobe); lights.strobe.push(tailStrobe);
  const tsg = addGlow('rgba(255,255,255,0.95)', 1.5, tailStrobe.position);
  tsg.userData.strobe = true;

  // anti-collision beacons
  for (const cfg of [
    { x: 12.5, th: Math.PI / 2, up: true },
    { x: -12.0, th: Math.PI / 2, up: true },
    { x: -3.4, th: Math.PI * 1.5, up: false },
  ]) {
    const p = fusePoint(cfg.x, cfg.th), n = fuseNormalAt(cfg.x, cfg.th);
    const b = bulb(mats.lights.beacon, 0.10);
    b.position.copy(p).addScaledVector(n, 0.10);
    group.add(b); lights.beacon.push(b);
    const gl = addGlow('rgba(255,40,40,0.9)', 1.3, b.position);
    gl.userData.beacon = true;
  }

  // nose taxi light under the radome
  const taxiP = fusePoint(25.6, Math.PI * 1.5), taxiN = fuseNormalAt(25.6, Math.PI * 1.5);
  const taxi = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), mats.lights.landing);
  taxi.position.copy(taxiP).addScaledVector(taxiN, 0.02);
  taxi.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), taxiN.clone().normalize());
  group.add(taxi); lights.landing.push(taxi);

  // static dischargers along the fin and tailplane trailing edges
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const y = lerp(3.6, 13.6, t);
    const x = lerp(-35.4, -36.2, t);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.30, 6), mats.detail);
    wick.rotation.x = Math.PI / 2;
    wick.position.set(x, y, 0);
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
