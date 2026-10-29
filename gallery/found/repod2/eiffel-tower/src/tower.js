import * as THREE from 'three';
import { DIM } from './config.js';
import { BeamBuilder, V } from './beam.js';
import { legCentrePoint } from './frame.js';
import { addBase, addPavilions } from './base.js';
import { addLegs } from './legs.js';
import { addArcs } from './arcs.js';
import { addMidSection } from './mid.js';
import { addShaft } from './shaft.js';
import { addPlatforms, addFrieze } from './platforms.js';
import { addSummit } from './summit.js';

export function createMaterials(noiseMap = null) {
  // Painted puddled iron is a dielectric: a high metalness would kill the
  // diffuse term and the tower would read as a black silhouette.
  const iron = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.16,
    roughness: 0.62,
    roughnessMap: noiseMap,
    envMapIntensity: 0.8,
  });
  const filigree = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.12,
    roughness: 0.72,
    envMapIntensity: 0.6,
  });
  const masonry = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.02,
    roughness: 0.95,
    envMapIntensity: 0.35,
  });
  const panels = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.3,
    roughness: 0.35,
    envMapIntensity: 0.8,
  });
  const deck = new THREE.MeshStandardMaterial({
    color: 0x9b8d76,
    metalness: 0.05,
    roughness: 0.85,
    envMapIntensity: 0.35,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xa9d0e2,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.26,
    transmission: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.1,
  });
  const dish = new THREE.MeshStandardMaterial({ color: 0xd5d9dc, metalness: 0.45, roughness: 0.45 });
  const friezePlain = new THREE.MeshStandardMaterial({ color: 0x4a3524, metalness: 0.4, roughness: 0.6 });
  const car = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.6, roughness: 0.4 });
  return { iron, filigree, masonry, panels, deck, glass, dish, friezePlain, car };
}

const CAR_UP = new THREE.Vector3(0, 1, 0);

/** A double-deck cabin (the 1899 lifts) or the summit car. */
function liftCar(materials, w, h, d) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.car);
  body.castShadow = true;
  g.add(body);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.42, d * 1.02), materials.glass);
  gl.position.y = h * 0.06;
  g.add(gl);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.16, d * 1.08), materials.car);
  roof.position.y = h / 2;
  g.add(roof);
  return g;
}

/**
 * Builds the complete tower.
 * Returns the group (already rotated 45° so the pillars sit at the cardinal
 * points) plus the instanced meshes, the moving lifts and the raw builders
 * (used to scatter the 20,000 sparkle bulbs on real members).
 */
export function buildTower({ friezeTextures = null, noiseMap = null } = {}) {
  const group = new THREE.Group();
  group.name = 'tour-eiffel';
  const materials = createMaterials(noiseMap);

  const ctx = {
    main: new BeamBuilder('ironwork'),
    fine: new BeamBuilder('filigree'),
    detail: new BeamBuilder('fittings'),
    stone: new BeamBuilder('masonry'),
    glass: new BeamBuilder('panels'),
    group,
    materials,
  };

  addBase(ctx);
  const liftPaths = addLegs(ctx);
  addArcs(ctx);
  addMidSection(ctx);
  addShaft(ctx);
  addPlatforms(ctx);
  addSummit(ctx);
  addPavilions(ctx);
  addFrieze(ctx, friezeTextures);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const parts = {
    ironwork: ctx.main.build(materials.iron, box),
    filigree: ctx.fine.build(materials.filigree, box),
    fittings: ctx.detail.build(materials.iron, box),
    masonry: ctx.stone.build(materials.masonry, box),
    panels: ctx.glass.build(materials.panels, box),
  };
  for (const key of Object.keys(parts)) group.add(parts[key]);

  // ---- moving lifts -----------------------------------------------------
  const lifts = [];
  for (const path of liftPaths) {
    const car = liftCar(materials, 4.0, 5.6, 3.4);
    group.add(car);
    lifts.push({ object: car, ...path, height: 5.6, speed: 5.4, phase: lifts.length / 4 });
  }
  // summit lift inside the shaft
  {
    const car = liftCar(materials, 3.0, 3.6, 2.6);
    group.add(car);
    lifts.push({ sx: 0, sz: 0, y0: DIM.h2 + 2.5, y1: DIM.h3 - 5.5, summit: true, object: car, height: 3.6, speed: 7.2, phase: 0.4 });
  }

  // park the cars on their tracks straight away
  lifts.forEach((l, i) => updateLift(l, 0.08 + i * 0.18));

  group.rotation.y = Math.PI / 4;

  const counts = {
    ironwork: ctx.main.count,
    filigree: ctx.fine.count,
    fittings: ctx.detail.count,
    masonry: ctx.stone.count,
    panels: ctx.glass.count,
  };
  counts.total = counts.ironwork + counts.filigree + counts.fittings + counts.masonry + counts.panels;

  return { group, parts, materials, lifts, builders: ctx, counts };
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
const _xAx = new THREE.Vector3();
const _yAx = new THREE.Vector3();
const _zAx = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();

/**
 * Animates one lift along its inclined track.
 * u = 0 at the bottom, 1 at the top (ping-pong).
 */
export function updateLift(lift, u) {
  const y = lift.y0 + (lift.y1 - lift.y0) * u;
  if (lift.summit) {
    _tmpA.set(0, y, 0);
    _yAx.set(0, 1, 0);
    _xAx.set(1, 0, 0);
  } else {
    legCentrePoint(_tmpA, lift.sx, lift.sz, y);
    const y2 = y + 1;
    legCentrePoint(_tmpB, lift.sx, lift.sz, y2);
    _tmpC.subVectors(_tmpB, _tmpA).normalize(); // travel direction
    _yAx.copy(CAR_UP).addScaledVector(_tmpC, -CAR_UP.dot(_tmpC)).normalize();
    _xAx.set(lift.sz, 0, -lift.sx).multiplyScalar(0.7071067811865476);
    _xAx.addScaledVector(_yAx, -_xAx.dot(_yAx)).normalize();
  }
  _zAx.crossVectors(_xAx, _yAx);
  _basis.makeBasis(_xAx, _yAx, _zAx);
  _quat.setFromRotationMatrix(_basis);
  lift.object.position.copy(_tmpA);
  lift.object.quaternion.copy(_quat);
}
