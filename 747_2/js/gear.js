// js/gear.js — landing gear: nose gear plus four four-wheel main bogies (16 wheels),
// shock struts, drag/side braces, torque links, brake packs, wells and doors.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, tire, strut, roundedSlab, surfaceBasis, easeInOut } from './util.js';
import { fusePoint, fuseNormalAt } from './fuselage.js';
import { wingPoint, wingNormalAt } from './wings.js';

export const GROUND_Y = -5.35;

export const GEAR = {
  nose: { x: 26.00, trunnionY: -2.20, tyreR: 0.56, tyreW: 0.44, track: 0.40 },
  mains: [
    { id: 'body', x: -2.70, z: 3.05, trunnionY: -1.95, tyreR: 0.64, tyreW: 0.50, bogie: 0.82 },
    { id: 'wing', x: 0.70, z: 5.75, trunnionY: -1.05, tyreR: 0.64, tyreW: 0.50, bogie: 0.82 },
  ],
};

function wheelAssembly(mats, r, w) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(tire(r, w, r * 0.45), mats.rubber);
  t.castShadow = true; t.receiveShadow = true;
  g.add(t);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w * 0.72, 28), mats.hub);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, w * 0.30, 28), mats.brake);
  brake.rotation.x = Math.PI / 2;
  g.add(brake);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, w * 0.88, 8), mats.hub);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33, 0);
    g.add(bolt);
  }
  return g;
}

function bogieAssembly(mats, cfg, side) {
  const g = new THREE.Group();
  const z = side * cfg.z;
  const trunnion = new THREE.Vector3(cfg.x, cfg.trunnionY, z);
  g.position.copy(trunnion);
  const axleY = GROUND_Y + cfg.tyreR;
  const localAxle = axleY - trunnion.y;
  const pivotY = localAxle + 0.10;

  // shock strut (outer cylinder, piston, gland nut)
  const s1 = new THREE.Mesh(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, pivotY + 1.0, 0), 0.32, 0.27, 20), mats.strut);
  s1.castShadow = true; g.add(s1);
  const s2 = new THREE.Mesh(strut(new THREE.Vector3(0, pivotY + 1.05, 0), new THREE.Vector3(0, localAxle - 0.12, 0), 0.21, 0.21, 20), mats.chrome);
  s2.castShadow = true; g.add(s2);
  const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.20, 20), mats.detail);
  gland.position.set(0, pivotY + 0.95, 0);
  g.add(gland);

  // drag brace and side brace
  const drag = new THREE.Mesh(strut(new THREE.Vector3(2.5, 0.30, 0), new THREE.Vector3(0.05, pivotY + 1.55, 0), 0.14, 0.14, 12), mats.strut);
  g.add(drag);
  const side0 = new THREE.Vector3(0.15, 0.10, -side * (cfg.id === 'body' ? 0.25 : 2.1));
  const side1 = new THREE.Vector3(0.02, pivotY + 2.25, 0);
  g.add(new THREE.Mesh(strut(side0, side1, 0.13, 0.13, 12), mats.strut));
  const actuator = new THREE.Mesh(strut(new THREE.Vector3(-2.0, 0.18, 0), new THREE.Vector3(0, pivotY + 2.8, 0), 0.16, 0.12, 12), mats.detail);
  g.add(actuator);

  // bogie beam with the two axles
  const beam = new THREE.Mesh(roundedSlab(2 * cfg.bogie + 0.60, 0.36, 0.42, 0.12, 0.05), mats.detail);
  beam.position.set(0, pivotY, 0);
  beam.castShadow = true;
  g.add(beam);

  for (const ax of [-cfg.bogie, cfg.bogie]) {
    for (const wz of [-0.54, 0.54]) {
      const w = wheelAssembly(mats, cfg.tyreR, cfg.tyreW);
      w.position.set(ax, localAxle, wz);
      g.add(w);
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.30, 14), mats.chrome);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(ax, localAxle, 0);
    g.add(axle);
    const link = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.52, 0.15), mats.detail);
    link.position.set(ax * 0.55, pivotY + 0.35, 0);
    g.add(link);
    const brakeLine = new THREE.Mesh(strut(new THREE.Vector3(ax, localAxle + 0.1, 0.70), new THREE.Vector3(ax * 0.4, pivotY + 0.9, 0.55), 0.025, 0.025, 6), mats.pipe);
    g.add(brakeLine);
  }
  g.userData.trunnion = trunnion;
  return g;
}

function noseAssembly(mats) {
  const cfg = GEAR.nose;
  const trunnion = new THREE.Vector3(cfg.x, cfg.trunnionY, 0);
  const g = new THREE.Group();
  g.position.copy(trunnion);
  const axleY = GROUND_Y + cfg.tyreR;
  const localAxle = axleY - trunnion.y;

  const s1 = new THREE.Mesh(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, localAxle + 0.72, 0), 0.26, 0.21, 18), mats.strut);
  s1.castShadow = true; g.add(s1);
  g.add(new THREE.Mesh(strut(new THREE.Vector3(0, localAxle + 0.78, 0), new THREE.Vector3(0, localAxle - 0.08, 0), 0.17, 0.17, 18), mats.chrome));
  const drag = new THREE.Mesh(strut(new THREE.Vector3(2.1, 0.32, 0), new THREE.Vector3(0.04, localAxle + 1.6, 0), 0.12, 0.12, 12), mats.strut);
  g.add(drag);
  for (const s of [1, -1]) {
    g.add(new THREE.Mesh(strut(new THREE.Vector3(-0.55, 0.45, s * 0.58), new THREE.Vector3(0, localAxle + 2.15, 0), 0.10, 0.10, 10), mats.detail));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.80, 12), mats.detail).translateX(-0.25).translateY(0.25).translateZ(s * 0.44));
  }
  const torque = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.05, 0.36), mats.detail);
  torque.position.set(0.31, localAxle + 0.95, 0.16);
  g.add(torque);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.35, 14), mats.chrome);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, localAxle, 0);
  g.add(axle);
  for (const wz of [-cfg.track, cfg.track]) {
    const w = wheelAssembly(mats, cfg.tyreR, cfg.tyreW);
    w.position.set(0, localAxle, wz);
    g.add(w);
  }
  // steering actuators
  for (const s of [1, -1]) {
    g.add(new THREE.Mesh(strut(new THREE.Vector3(-0.45, 0.10, s * 0.35), new THREE.Vector3(-0.15, localAxle + 1.5, s * 0.42), 0.075, 0.075, 8), mats.detail));
  }
  g.userData.trunnion = trunnion;
  return g;
}

function mainWells(mats, side) {
  const g = new THREE.Group();
  for (const cfg of GEAR.mains) {
    const z = side * cfg.z;
    for (const d of [-1, 1]) {
      const zz = z + d * 1.18;
      const onWing = cfg.id === 'wing';
      const pos = onWing
        ? wingPoint(Math.abs(zz), 0.80, side, false)
        : fusePoint(cfg.x, Math.PI * 1.5 + d * 0.26);
      const nor = onWing
        ? wingNormalAt(Math.abs(zz), 0.80, side, false)
        : fuseNormalAt(cfg.x, Math.PI * 1.5 + d * 0.26);
      const hingePos = pos.clone().addScaledVector(nor, 0.02);
      const pivot = new THREE.Group();
      pivot.position.copy(hingePos);
      const door = new THREE.Mesh(roundedSlab(3.0, 1.40, 0.06, 0.08, 0.014), mats.door);
      door.position.set(0, 0, -d * 0.64);
      door.castShadow = true; door.receiveShadow = true;
      const basis = surfaceBasis(new THREE.Vector3(), nor, new THREE.Vector3(1, 0, 0));
      pivot.quaternion.setFromRotationMatrix(basis);
      pivot.add(door);
      pivot.userData.open = -d * 80 * DEG;
      g.add(pivot);
      const well = new THREE.Mesh(roundedSlab(3.2, 1.55, 0.04, 0.08, 0.01), mats.well);
      well.quaternion.copy(pivot.quaternion);
      well.position.copy(hingePos).addScaledVector(nor, -0.012);
      g.add(well);
    }
  }
  return g;
}

function noseWells(mats) {
  const g = new THREE.Group();
  const cfg = GEAR.nose;
  for (const d of [-1, 1]) {
    const theta = Math.PI * 1.5 + d * 0.30;
    const pos = fusePoint(cfg.x, theta), nor = fuseNormalAt(cfg.x, theta);
    const pivot = new THREE.Group();
    pivot.position.copy(pos).addScaledVector(nor, 0.02);
    pivot.quaternion.setFromRotationMatrix(surfaceBasis(new THREE.Vector3(), nor, new THREE.Vector3(1, 0, 0)));
    const door = new THREE.Mesh(roundedSlab(2.6, 1.10, 0.06, 0.08, 0.014), mats.door);
    door.position.set(0, 0, -d * 0.52);
    door.castShadow = true;
    pivot.add(door);
    pivot.userData.open = -d * 86 * DEG;
    g.add(pivot);
    const well = new THREE.Mesh(roundedSlab(2.8, 1.25, 0.04, 0.08, 0.01), mats.well);
    well.quaternion.copy(pivot.quaternion);
    well.position.copy(pos).addScaledVector(nor, -0.012);
    g.add(well);
  }
  return g;
}

export function buildGear(mats) {
  const group = new THREE.Group();
  group.name = 'gear';
  const nose = noseAssembly(mats);
  group.add(nose);
  const mains = [];
  for (const side of [1, -1]) {
    for (const cfg of GEAR.mains) {
      const b = bogieAssembly(mats, cfg, side);
      group.add(b);
      mains.push({ obj: b, cfg, side });
    }
  }
  const doors = mainWells(mats, 1).add(mainWells(mats, -1)).add(noseWells(mats));
  group.add(doors);

  const setGear = (t) => {
    const k = easeInOut(clamp(t, 0, 1));
    const travel = 1 - k;
    nose.visible = t > 0.035;
    for (const m of mains) m.obj.visible = t > 0.035;
    // nose gear folds forward about its trunnion
    nose.rotation.z = -travel * 98 * DEG;
    for (const m of mains) {
      const fold = travel * 88 * DEG;
      m.obj.rotation.x = m.side > 0 ? fold : -fold;
    }
    // doors open only while the gear is in transit
    const open = Math.sin(Math.PI * clamp(t, 0, 1));
    for (const child of doors.children) {
      if (child.userData.open !== undefined) child.rotation.z = child.userData.open * open;
    }
  };
  setGear(1);
  return { group, setGear, mains, nose, doors };
}
