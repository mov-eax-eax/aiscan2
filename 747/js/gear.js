// js/gear.js — landing gear: nose gear plus four four-wheel main bogies, wells and doors.
import * as THREE from '../lib/three.module.min.js';
import { DEG, clamp, lerp, tire, strut, roundedSlab, surfaceBasis, easeInOut } from './util.js';
import { fusePoint, fuseNormalAt } from './fuselage.js';
import { wingPoint, wingNormalAt } from './wings.js';

export const GROUND_Y = -6.45;

export const GEAR = {
  nose: { x: 20.5, trunnionY: -2.60, tyreR: 0.55, tyreW: 0.42, track: 0.36 },
  mains: [
    { id: 'body', x: -1.75, z: 3.35, trunnionY: -1.95, tyreR: 0.62, tyreW: 0.48, bogie: 0.80 },
    { id: 'wing', x: -4.35, z: 5.95, trunnionY: -1.30, tyreR: 0.62, tyreW: 0.48, bogie: 0.80 },
  ],
};

function wheelAssembly(mats, r, w) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(tire(r, w, r * 0.45), mats.rubber);
  t.castShadow = true; t.receiveShadow = true;
  g.add(t);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w * 0.72, 24), mats.hub);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, w * 0.30, 24), mats.brake);
  brake.rotation.x = Math.PI / 2;
  g.add(brake);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, w * 0.86, 8), mats.hub);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, 0);
    g.add(bolt);
  }
  return g;
}

function bogieAssembly(mats, cfg, side) {
  const g = new THREE.Group();
  const z = side * cfg.z;
  const axleY = GROUND_Y + cfg.tyreR;
  const pivotY = axleY + 0.10;
  const trunnion = new THREE.Vector3(cfg.x, cfg.trunnionY, z);
  const pivot = new THREE.Vector3(cfg.x, pivotY, z);

  // shock strut (outer cylinder, piston, gland nut)
  const s1 = new THREE.Mesh(strut(trunnion, new THREE.Vector3(cfg.x, pivotY + 1.0, z), 0.30, 0.26, 18), mats.strut);
  s1.castShadow = true; g.add(s1);
  const s2 = new THREE.Mesh(strut(new THREE.Vector3(cfg.x, pivotY + 1.05, z), new THREE.Vector3(cfg.x, pivotY - 0.12, z), 0.20, 0.20, 18), mats.chrome);
  s2.castShadow = true; g.add(s2);
  const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.20, 18), mats.detail);
  gland.position.set(cfg.x, pivotY + 0.95, z);
  g.add(gland);

  // drag brace and side brace
  const drag = new THREE.Mesh(strut(trunnion.clone().add(new THREE.Vector3(2.4, 0.35, 0)), new THREE.Vector3(cfg.x, pivotY + 1.5, z), 0.13, 0.13, 10), mats.strut);
  g.add(drag);
  const side0 = new THREE.Vector3(cfg.x + 0.2, cfg.trunnionY + 0.10, z - side * cfg.z + side * (cfg.id === 'body' ? 0.35 : 2.2));
  const side1 = new THREE.Vector3(cfg.x, pivotY + 2.3, z);
  g.add(new THREE.Mesh(strut(side0, side1, 0.12, 0.12, 10), mats.strut));
  const actuator = new THREE.Mesh(strut(trunnion.clone().add(new THREE.Vector3(-1.9, 0.2, 0)), new THREE.Vector3(cfg.x, pivotY + 2.9, z), 0.15, 0.11, 10), mats.detail);
  g.add(actuator);

  // bogie beam with the two axles
  const beam = new THREE.Mesh(roundedSlab(2 * cfg.bogie + 0.55, 0.34, 0.40, 0.12, 0.05), mats.detail);
  beam.rotation.z = Math.PI / 2;
  beam.rotation.y = Math.PI / 2;
  beam.position.set(cfg.x, pivotY, z);
  beam.castShadow = true;
  g.add(beam);

  for (const ax of [-cfg.bogie, cfg.bogie]) {
    for (const wz of [-0.52, 0.52]) {
      const w = wheelAssembly(mats, cfg.tyreR, cfg.tyreW);
      w.position.set(cfg.x + ax, axleY, z + wz);
      g.add(w);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.25, 12), mats.chrome);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(cfg.x + ax, axleY, z);
      g.add(axle);
    }
    const link = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.14), mats.detail);
    link.position.set(cfg.x + ax * 0.55, pivotY + 0.35, z);
    g.add(link);
  }
  g.userData.trunnion = trunnion;
  g.userData.openDoor = 82 * DEG;
  return g;
}

function noseAssembly(mats) {
  const cfg = GEAR.nose;
  const g = new THREE.Group();
  const z = 0;
  const axleY = GROUND_Y + cfg.tyreR;
  const trunnion = new THREE.Vector3(cfg.x, cfg.trunnionY, z);

  const s1 = new THREE.Mesh(strut(trunnion, new THREE.Vector3(cfg.x, axleY + 0.75, z), 0.24, 0.20, 16), mats.strut);
  s1.castShadow = true; g.add(s1);
  g.add(new THREE.Mesh(strut(new THREE.Vector3(cfg.x, axleY + 0.80, z), new THREE.Vector3(cfg.x, axleY - 0.08, z), 0.16, 0.16, 16), mats.chrome));
  const drag = new THREE.Mesh(strut(trunnion.clone().add(new THREE.Vector3(2.0, 0.30, 0)), new THREE.Vector3(cfg.x, axleY + 1.5, z), 0.11, 0.11, 10), mats.strut);
  g.add(drag);
  for (const s of [1, -1]) {
    g.add(new THREE.Mesh(strut(new THREE.Vector3(cfg.x - 0.6, cfg.trunnionY + 0.45, s * 0.55), new THREE.Vector3(cfg.x, axleY + 2.1, z), 0.09, 0.09, 8), mats.detail));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.75, 10), mats.detail).translateX(cfg.x - 0.25).translateY(cfg.trunnionY + 0.25).translateZ(s * 0.42));
  }
  const torque = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 0.34), mats.detail);
  torque.position.set(cfg.x + 0.30, axleY + 0.95, 0.16);
  g.add(torque);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.30, 12), mats.chrome);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(cfg.x, axleY, 0);
  g.add(axle);
  for (const wz of [-cfg.track, cfg.track]) {
    const w = wheelAssembly(mats, cfg.tyreR, cfg.tyreW);
    w.position.set(cfg.x, axleY, wz);
    g.add(w);
  }
  g.userData.trunnion = trunnion;
  g.userData.openDoor = 88 * DEG;
  return g;
}

function mainWells(mats, side) {
  const g = new THREE.Group();
  for (const cfg of GEAR.mains) {
    const z = side * cfg.z;
    for (const d of [-1, 1]) {
      const zz = z + d * 1.15;
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
      const door = new THREE.Mesh(roundedSlab(2.9, 1.35, 0.06, 0.08, 0.014), mats.door);
      door.position.set(0, 0, -d * 0.62);
      door.castShadow = true; door.receiveShadow = true;
      const basis = surfaceBasis(new THREE.Vector3(), nor, new THREE.Vector3(1, 0, 0));
      pivot.quaternion.setFromRotationMatrix(basis);
      pivot.add(door);
      pivot.userData.open = -d * 78 * DEG;
      g.add(pivot);
      const well = new THREE.Mesh(roundedSlab(3.1, 1.5, 0.04, 0.08, 0.01), mats.well);
      well.quaternion.copy(pivot.quaternion);
      well.position.copy(hingePos).addScaledVector(nor, -0.01);
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
    const door = new THREE.Mesh(roundedSlab(2.5, 1.05, 0.06, 0.08, 0.014), mats.door);
    door.position.set(0, 0, -d * 0.5);
    door.castShadow = true;
    pivot.add(door);
    pivot.userData.open = -d * 86 * DEG;
    g.add(pivot);
    const well = new THREE.Mesh(roundedSlab(2.7, 1.2, 0.04, 0.08, 0.01), mats.well);
    well.quaternion.copy(pivot.quaternion);
    well.position.copy(pos).addScaledVector(nor, -0.01);
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
    // the fuselage is a closed shell, so a fully retracted gear is simply hidden
    nose.visible = t > 0.02;
    for (const m of mains) m.obj.visible = t > 0.02;
    // nose gear folds aft about the trunnion
    nose.rotation.z = -(1 - k) * 96 * DEG;
    for (const m of mains) {
      const fold = (1 - k) * 86 * DEG;
      m.obj.rotation.x = m.side > 0 ? fold : -fold;
    }
    for (const child of doors.children) {
      if (child.userData.open !== undefined) child.rotation.z = child.userData.open * k;
    }
  };
  setGear(1);
  return { group, setGear, mains, nose, doors };
}
