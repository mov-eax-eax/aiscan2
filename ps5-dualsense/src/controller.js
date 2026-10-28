// ============================================================
// controller.js - fully procedural PS5 DualSense model
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import {
  buildSurfacePlate,
  canvasTexture,
  extrudeShape,
  makeRadialGlowTexture,
  quaternionForNormal,
  roundedRectShape,
  superellipseShape,
  warpSlabToSurface,
} from './lib.js';
import { makeIconCanvas } from './materials.js';
import {
  buildShellGeometry,
  placeOnSurface as placePart,
  surfaceNormalAt,
  surfaceZ,
} from './deck.js';

const glowTex = makeRadialGlowTexture(256, [
  [0, 'rgba(255,255,255,1)'],
  [0.12, 'rgba(195,250,255,0.9)'],
  [0.34, 'rgba(80,226,255,0.32)'],
  [0.7, 'rgba(20,120,180,0.05)'],
  [1, 'rgba(0,0,0,0)'],
]);

function mesh(geo, mat, name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function lathe(profile, segments = 64) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function iconMaterial(base, kind, size = 0.5, color = 0xffffff) {
  const tex = canvasTexture(makeIconCanvas(kind, 256), { srgb: true });
  const m = base.clone();
  m.map = tex;
  m.emissiveMap = tex;
  m.color = new THREE.Color(color);
  m.emissive = new THREE.Color(color);
  m.emissiveIntensity = 0.2;
  m.needsUpdate = true;
  return m;
}

function iconPlane(base, kind, size = 0.5, z = 0, color = 0xffffff) {
  const g = new THREE.PlaneGeometry(size, size);
  const m = iconMaterial(base, kind, size, color);
  const p = new THREE.Mesh(g, m);
  p.position.z = z;
  p.renderOrder = 4;
  return p;
}

function ovalPad(rx, ry, n, depth, bevel) {
  const s = superellipseShape(rx, ry, n, 96);
  return extrudeShape(s, depth, bevel, 3, 48);
}

function buildBlackPlate(materials) {
  const pts = [
    [-3.62, 3.28], [0, 3.33], [3.62, 3.28], [3.98, 3.06], [4.18, 2.70],
    [4.26, 2.35], [4.49, 1.80], [4.71, 1.16], [4.94, 0.62], [4.90, 0.05],
    [4.62, -0.55], [4.56, -1.00], [4.26, -1.45], [3.68, -1.85], [2.84, -2.14],
    [1.86, -2.28], [0, -2.34], [-1.86, -2.28], [-2.84, -2.14], [-3.68, -1.85],
    [-4.26, -1.45], [-4.56, -1.00], [-4.62, -0.55], [-4.90, 0.05], [-4.94, 0.62],
    [-4.71, 1.16], [-4.49, 1.80], [-4.26, 2.35], [-4.18, 2.78], [-3.98, 3.17],
  ];
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], p[1], 0)),
    true,
    'centripetal',
  );
  const sampled = curve.getPoints(260).slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y));
  const shape = new THREE.Shape(sampled);
  const underShape = new THREE.Shape(sampled.map((p) => new THREE.Vector2(p.x * 1.018, (p.y - 0.52) * 1.018 + 0.52)));
  const underGeo = buildSurfacePlate(
    underShape,
    (x, y) => surfaceZ(x, y, 1) + 0.026,
    (x, y) => surfaceZ(x, y, 1) - 0.03,
    { curveSegments: 260, levels: 2 },
  );
  const geo = buildSurfacePlate(
    shape,
    (x, y) => surfaceZ(x, y, 1) + 0.078,
    (x, y) => surfaceZ(x, y, 1) - 0.14,
    { curveSegments: 260, levels: 3 },
  );
  const plate = mesh(geo, materials.core, 'black-core-plate');
  plate.add(mesh(underGeo, materials.coreMatte, 'core-plate-gasket'));
  return plate;
}

function buildTouchpad(materials) {
  const group = new THREE.Group();
  group.name = 'touchpad';

  const bezelShape = roundedRectShape(6.35, 2.82, 0.28, 0, 1.84);
  const bezelGeo = buildSurfacePlate(
    bezelShape,
    (x, y) => surfaceZ(x, y, 1) + 0.105,
    (x, y) => surfaceZ(x, y, 1) - 0.03,
    { curveSegments: 160, levels: 2 },
  );
  group.add(mesh(bezelGeo, materials.core, 'touchpad-bezel'));

  const gasketShape = roundedRectShape(6.10, 2.58, 0.25, 0, 1.84);
  const gasketGeo = buildSurfacePlate(
    gasketShape,
    (x, y) => surfaceZ(x, y, 1) + 0.128,
    (x, y) => surfaceZ(x, y, 1) + 0.070,
    { curveSegments: 160, levels: 2 },
  );
  group.add(mesh(gasketGeo, materials.coreMatte, 'touchpad-gasket'));

  const padShape = roundedRectShape(5.85, 2.34, 0.22, 0, 1.84);
  const padGeo = buildSurfacePlate(
    padShape,
    (x, y) => surfaceZ(x, y, 1) + 0.205,
    (x, y) => surfaceZ(x, y, 1) + 0.115,
    { curveSegments: 160, levels: 2 },
  );
  group.add(mesh(padGeo, materials.touchpad, 'touchpad-surface'));
  return group;
}

function buildLightbar(materials) {
  const group = new THREE.Group();
  group.name = 'lightbar';
  const glows = [];
  for (const side of [-1, 1]) {
    const x = side * 3.37;
    const geo = new RoundedBoxGeometry(0.105, 1.34, 0.08, 5, 0.035);
    warpSlabToSurface(geo, surfaceZ, 0.158, 1, x, 1.88);
    group.add(mesh(geo, materials.lightbar, 'lightbar-strip'));

    const gp = new THREE.PlaneGeometry(1.7, 3.15);
    const gm = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0x5be7ff,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const glow = new THREE.Mesh(gp, gm);
    const n = surfaceNormalAt(x, 1.96, 1);
    glow.position.set(x + n.x * 0.55, 1.88 + n.y * 0.45, surfaceZ(x, 1.88, 1) + 0.54);
    glow.quaternion.copy(quaternionForNormal(n));
    glow.scale.set(0.7, 1.0, 1);
    glow.renderOrder = 5;
    group.add(glow);
    glows.push(glow);

    const light = new THREE.PointLight(0x59e6ff, 1.6, 6.5, 2);
    light.position.set(x, 1.98, surfaceZ(x, 1.98, 1) + 1.05);
    group.add(light);
    glows.push(light);
  }
  group.userData.glows = glows;
  return group;
}

function buildStick(materials, x, y) {
  const group = new THREE.Group();
  group.name = 'analog-stick';
  placePart(group, x, y, 0.015, 1);

  const pad = mesh(ovalPad(1.48, 1.32, 2.55, 0.17, 0.09), materials.core, 'stick-oval-pad');
  pad.position.z = 0.02;
  group.add(pad);

  const well = mesh(new THREE.CylinderGeometry(0.94, 0.98, 0.22, 56).rotateX(Math.PI / 2), materials.coreMatte, 'stick-well');
  well.position.z = 0.20;
  group.add(well);

  const rim = mesh(new THREE.TorusGeometry(1.00, 0.072, 14, 72), materials.core, 'stick-well-rim');
  rim.position.z = 0.275;
  group.add(rim);

  const shaft = mesh(new THREE.CylinderGeometry(0.34, 0.39, 0.58, 36).rotateX(Math.PI / 2), materials.coreMatte, 'stick-shaft');
  shaft.position.z = 0.52;
  group.add(shaft);

  const collar = mesh(new THREE.TorusGeometry(0.37, 0.027, 12, 48), materials.chrome, 'stick-shaft-ring');
  collar.position.z = 0.62;
  group.add(collar);

  const capProfile = [
    [0.84, 0.0], [0.96, 0.04], [1.01, 0.14], [1.02, 0.28],
    [0.985, 0.40], [0.90, 0.49], [0.77, 0.525], [0.62, 0.51],
    [0.46, 0.478], [0.28, 0.458], [0.11, 0.448], [0.0, 0.444],
  ];
  const capGeo = lathe(capProfile, 112);
  const cp = capGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    const z = cp.getZ(i);
    const rr = Math.hypot(x, y);
    if (rr > 0.70 && z > 0.18 && z < 0.47) {
      const a = Math.atan2(y, x);
      const s = 1 + 0.038 * Math.cos(48 * a);
      cp.setX(i, x * s);
      cp.setY(i, y * s);
    }
  }
  capGeo.computeVertexNormals();
  const cap = mesh(capGeo, materials.rubber, 'stick-cap');
  cap.position.z = 0.56;
  group.add(cap);

  const capBase = mesh(new THREE.CylinderGeometry(0.84, 0.86, 0.05, 64).rotateX(Math.PI / 2), materials.rubber, 'stick-cap-base');
  capBase.position.z = 0.55;
  group.add(capBase);

  const knurlGeo = new THREE.TorusGeometry(0.84, 0.068, 10, 112);
  const kp = knurlGeo.attributes.position;
  for (let i = 0; i < kp.count; i++) {
    const x = kp.getX(i);
    const y = kp.getY(i);
    const a = Math.atan2(y, x);
    const s = 1 + 0.045 * Math.cos(48 * a);
    kp.setX(i, x * s);
    kp.setY(i, y * s);
  }
  knurlGeo.computeVertexNormals();
  const knurlRing = mesh(knurlGeo, materials.rubber, 'stick-knurl-ring');
  knurlRing.position.z = 0.50;
  knurlRing.castShadow = false;
  group.add(knurlRing);
  return group;
}

function dpadPetal() {
  const s = new THREE.Shape();
  s.moveTo(-0.38, 0.17);
  s.lineTo(-0.42, 0.62);
  s.quadraticCurveTo(-0.41, 0.83, -0.20, 0.85);
  s.lineTo(0.20, 0.85);
  s.quadraticCurveTo(0.41, 0.83, 0.42, 0.62);
  s.lineTo(0.38, 0.17);
  s.quadraticCurveTo(0.31, 0.045, 0.16, 0.045);
  s.lineTo(-0.16, 0.045);
  s.quadraticCurveTo(-0.31, 0.045, -0.38, 0.17);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.13,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.045,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.translate(0, 0, -0.065);
  geo.computeVertexNormals();
  return geo;
}

function buildDpad(materials) {
  const group = new THREE.Group();
  group.name = 'd-pad';
  placePart(group, -5.26, 1.12, 0.02, 1);

  const baseH = mesh(new RoundedBoxGeometry(1.88, 0.60, 0.12, 5, 0.22), materials.coreMatte, 'dpad-recess-h');
  baseH.position.z = 0.01;
  const baseV = mesh(new RoundedBoxGeometry(0.60, 1.88, 0.12, 5, 0.22), materials.coreMatte, 'dpad-recess-v');
  baseV.position.z = 0.01;
  group.add(baseH, baseV);
  const center = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 28).rotateX(Math.PI / 2), materials.core, 'dpad-center');
  center.position.z = 0.10;
  group.add(center);

  const petal = dpadPetal();
  const icons = ['arrow-up', 'arrow-left', 'arrow-down', 'arrow-right'];
  const iconPos = [[0, 0.58], [-0.58, 0], [0, -0.58], [0.58, 0]];
  for (let i = 0; i < 4; i++) {
    const key = mesh(petal.clone(), materials.clear, 'dpad-key');
    key.rotation.z = (i * Math.PI) / 2;
    key.position.z = 0.12;
    group.add(key);
    const icon = iconPlane(materials.icon, icons[i], 0.38, 0.245, 0xe4e9ec);
    icon.position.x = iconPos[i][0];
    icon.position.y = iconPos[i][1];
    group.add(icon);
  }
  return group;
}

function buildFaceButtons(materials) {
  const group = new THREE.Group();
  group.name = 'face-buttons';
  placePart(group, 5.26, 1.12, 0.02, 1);

  const defs = [
    { x: 0, y: 0.60, icon: 'triangle' },
    { x: -0.60, y: 0, icon: 'square' },
    { x: 0.60, y: 0, icon: 'circle' },
    { x: 0, y: -0.60, icon: 'cross' },
  ];
  const domeProfile = [
    [0.355, 0.0], [0.375, 0.035], [0.375, 0.08], [0.35, 0.125],
    [0.30, 0.165], [0.22, 0.19], [0.11, 0.205], [0.0, 0.208],
  ];
  for (const d of defs) {
    const base = mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.05, 48).rotateX(Math.PI / 2), materials.coreMatte, 'button-seat');
    base.position.set(d.x, d.y, 0.03);
    group.add(base);
    const b = mesh(lathe(domeProfile, 56), materials.clear, 'face-button');
    b.position.set(d.x, d.y, 0.045);
    group.add(b);
    const icon = iconPlane(materials.icon, d.icon, 0.47, 0.255, 0xe4e9ec);
    icon.position.x = d.x;
    icon.position.y = d.y;
    group.add(icon);
  }
  return group;
}

function buildCreateOptions(materials) {
  const group = new THREE.Group();
  group.name = 'system-small-buttons';
  for (const side of [-1, 1]) {
    const sub = new THREE.Group();
    placePart(sub, side * 4.22, 2.72, 0.02, 1, side * -0.03);
    const base = mesh(new RoundedBoxGeometry(0.64, 0.96, 0.12, 5, 0.22), materials.coreMatte, 'small-button-base');
    base.position.z = 0.01;
    sub.add(base);
    const b = mesh(new RoundedBoxGeometry(0.54, 0.84, 0.20, 6, 0.25), materials.clear, 'small-button');
    b.position.z = 0.10;
    sub.add(b);
    const icon = iconPlane(materials.icon, side < 0 ? 'create' : 'options', 0.45, 0.215, 0xe4e9ec);
    sub.add(icon);
    group.add(sub);
  }
  return group;
}

function buildCenter(materials) {
  const group = new THREE.Group();
  group.name = 'ps-button-and-mute';

  const psGroup = new THREE.Group();
  placePart(psGroup, 0, -0.53, 0.085, 1);
  const baseRing = mesh(new THREE.CylinderGeometry(0.56, 0.575, 0.06, 64).rotateX(Math.PI / 2), materials.core, 'ps-button-ring');
  baseRing.position.z = 0.02;
  psGroup.add(baseRing);
  const profile = [
    [0.49, 0.0], [0.51, 0.03], [0.505, 0.07], [0.465, 0.11],
    [0.385, 0.15], [0.27, 0.178], [0.13, 0.192], [0.0, 0.196],
  ];
  const dome = mesh(lathe(profile, 64), materials.core, 'ps-button');
  dome.position.z = 0.055;
  psGroup.add(dome);

  const glowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.05),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0x52c8ff,
      transparent: true,
      opacity: 0.10,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glowPlane.position.z = 0.27;
  glowPlane.renderOrder = 3;
  psGroup.add(glowPlane);

  const logo = iconPlane(materials.psLogo, 'ps', 0.68, 0.252, 0xd5ecff);
  psGroup.add(logo);
  group.add(psGroup);

  const mute = new THREE.Group();
  placePart(mute, 0, -1.34, 0.085, 1);
  const mb = mesh(new RoundedBoxGeometry(0.77, 0.30, 0.12, 5, 0.13), materials.core, 'mute-button');
  mb.position.z = 0.04;
  mute.add(mb);
  const mi = iconPlane(materials.icon, 'mute', 0.43, 0.105, 0xcfd5d8);
  mute.add(mi);
  const led = mesh(new RoundedBoxGeometry(0.19, 0.065, 0.035, 4, 0.02), materials.led, 'mute-led');
  led.position.set(0, -0.20, 0.10);
  mute.add(led);
  group.add(mute);

  const holes = [
    [-0.36, 0.47], [-0.12, 0.47], [0.12, 0.47], [0.36, 0.47],
    [-0.48, 0.30], [-0.24, 0.30], [0.0, 0.30], [0.24, 0.30], [0.48, 0.30],
  ];
  const holeGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.06, 18).rotateX(Math.PI / 2);
  for (const [x, y] of holes) {
    const n = surfaceNormalAt(x, y, 1);
    const z = surfaceZ(x, y, 1);
    const h = mesh(holeGeo, materials.usbDark, 'speaker-hole');
    h.position.set(x + n.x * 0.075, y + n.y * 0.075, z + 0.075);
    h.quaternion.copy(quaternionForNormal(n));
    group.add(h);
  }
  return group;
}

function triggerGeometry() {
  const pts = [
    [2.22, 2.32], [3.02, 2.55], [3.62, 2.02], [3.68, 1.16],
    [3.42, 0.48], [2.64, 0.38], [2.22, 1.02],
  ];
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], p[1], 0)),
    true,
    'centripetal',
  );
  const shape = new THREE.Shape(curve.getPoints(120).slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 2.75,
    bevelEnabled: true,
    bevelThickness: 0.13,
    bevelSize: 0.13,
    bevelSegments: 4,
    curveSegments: 120,
    steps: 1,
  });
  geo.translate(0, 0, -1.375);
  geo.rotateY(Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = THREE.MathUtils.clamp((y - 0.35) / 2.15, 0, 1);
    p.setX(i, p.getX(i) * (0.62 + 0.38 * t));
  }
  geo.computeVertexNormals();
  return geo;
}

function buildShoulders(materials) {
  const group = new THREE.Group();
  group.name = 'triggers-and-bumpers';
  const trigGeo = triggerGeometry();
  for (const side of [-1, 1]) {
    const bumper = mesh(new RoundedBoxGeometry(2.72, 0.34, 0.62, 7, 0.18), materials.core, 'bumper');
    bumper.position.set(side * 4.90, 1.52, -2.20);
    bumper.rotation.set(-0.28, side * -0.12, side * 0.12);
    group.add(bumper);

    const trigger = mesh(trigGeo.clone(), materials.coreMatte, 'adaptive-trigger');
    trigger.position.set(side * 5.04, -1.18, -1.10);
    trigger.rotation.set(0, side * -0.045, side * 0.02);
    trigger.scale.set(0.88, 0.98, 0.88);
    group.add(trigger);

  }
  return group;
}

function buildBack(materials) {
  const group = new THREE.Group();
  group.name = 'back-details';

  const panel = mesh(new RoundedBoxGeometry(5.00, 2.95, 0.15, 6, 0.20), materials.coreMatte, 'back-panel');
  warpSlabToSurface(panel.geometry, surfaceZ, -0.025, -1, 0, -0.62);
  group.add(panel);

  const label = new THREE.Mesh(new THREE.PlaneGeometry(4.35, 2.05), materials.label);
  const backZ = surfaceZ(0, -0.62, -1);
  label.position.set(0, -0.62, backZ - 0.12);
  label.rotation.y = Math.PI;
  group.add(label);

  const screwGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.035, 20).rotateX(Math.PI / 2);
  for (const [x, y] of [[-1.82, -1.48], [1.82, -1.48], [-1.82, 0.22], [1.82, 0.22]]) {
    const z = surfaceZ(x, y, -1);
    const s = mesh(screwGeo, materials.chrome, 'back-screw');
    s.position.set(x, y, z - 0.12);
    group.add(s);
  }

  const resetZ = surfaceZ(0, -1.90, -1);
  const reset = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 16).rotateX(Math.PI / 2), materials.usbDark, 'reset-pinhole');
  reset.position.set(0, -1.90, resetZ - 0.075);
  group.add(reset);
  return group;
}

function buildBottom(materials) {
  const group = new THREE.Group();
  group.name = 'usb-and-headphone';

  const band = mesh(new RoundedBoxGeometry(3.45, 0.46, 1.15, 6, 0.18), materials.coreMatte, 'bottom-band');
  band.position.set(0, -2.28, 0.85);
  group.add(band);

  const usbTrim = mesh(new RoundedBoxGeometry(0.92, 0.30, 0.06, 5, 0.10), materials.chrome, 'usb-trim');
  usbTrim.position.set(0, -2.28, 1.41);
  group.add(usbTrim);
  const usb = mesh(new RoundedBoxGeometry(0.77, 0.20, 0.05, 5, 0.08), materials.usbDark, 'usb-c-port');
  usb.position.set(0, -2.28, 1.43);
  group.add(usb);

  const jackTrim = mesh(new THREE.TorusGeometry(0.155, 0.030, 10, 32), materials.chrome, 'headphone-ring');
  jackTrim.position.set(-1.04, -2.28, 1.41);
  group.add(jackTrim);
  const jack = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 28).rotateX(Math.PI / 2), materials.usbDark, 'headphone-jack');
  jack.position.set(-1.04, -2.28, 1.40);
  group.add(jack);
  return group;
}

export function createController(materials, settings = {}) {
  const root = new THREE.Group();
  root.name = 'DualSense';
  root.add(mesh(buildShellGeometry(), materials.shell, 'white-outer-shell'));
  root.add(buildBlackPlate(materials));
  root.add(buildTouchpad(materials));
  root.add(buildLightbar(materials));
  root.add(buildStick(materials, -3.12, 0.0));
  root.add(buildStick(materials, 3.12, 0.0));
  root.add(buildDpad(materials));
  root.add(buildFaceButtons(materials));
  root.add(buildCreateOptions(materials));
  root.add(buildCenter(materials));
  root.add(buildShoulders(materials));
  root.add(buildBack(materials));
  root.add(buildBottom(materials));

  const lightbar = root.getObjectByName('lightbar');
  const psGroup = root.getObjectByName('ps-button-and-mute');
  let lightOn = settings.lightbar !== false;

  function setLightbar(on) {
    lightOn = !!on;
    materials.lightbar.emissiveIntensity = on ? 1.25 : 0.0;
    materials.lightbar.color.setHex(on ? 0xa9f6ff : 0x22272a);
    if (lightbar) {
      lightbar.visible = on;
      lightbar.traverse((o) => {
        if (o.isPointLight) o.visible = on;
      });
    }
  }

  function update(t) {
    if (!lightOn) return;
    const pulse = 0.82 + 0.18 * Math.sin(t * 1.35);
    materials.lightbar.emissiveIntensity = 1.05 * pulse + 0.25;
    if (lightbar) {
      for (const obj of lightbar.userData.glows || []) {
        if (obj.isMesh) obj.material.opacity = 0.26 + 0.08 * Math.sin(t * 1.35 + 1.2);
        else if (obj.isLight) obj.intensity = 0.8 + 0.3 * Math.sin(t * 1.35 + 0.8);
      }
    }
    if (psGroup) {
      for (const child of psGroup.children) {
        if (child.isGroup) {
          for (const c of child.children) {
            if (c.isMesh && c.material?.blending === THREE.AdditiveBlending) {
              c.material.opacity = 0.075 + 0.025 * Math.sin(t * 1.1 + 2.4);
            }
          }
        }
      }
    }
  }

  setLightbar(lightOn);
  return { root, setLightbar, update, parts: { lightbar } };
}