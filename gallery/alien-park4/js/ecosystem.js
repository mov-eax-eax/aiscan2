import * as THREE from 'three';
import { mulberry32, range, pick, chance } from './rng.js';
import { bump } from './textures.js';

const TAU = Math.PI * 2;

function terraceHeight(radius) {
  if (radius < 17) return 20;
  if (radius < 28) return 14;
  if (radius < 41) return 7.5;
  return 1.5;
}

export function createEcosystem() {
  const group = new THREE.Group();
  group.name = 'ecosystem';
  const updates = [];
  const rng = mulberry32(61777);
  const organic = bump('organic');
  const panel = bump('panel');
  const unknown = bump('unknown');

  const skin = new THREE.MeshStandardMaterial({ color: 0x2a6c62, roughness: 0.55, metalness: 0.06, flatShading: false, bumpMap: organic, bumpScale: 0.18, emissive: 0x071f1c, emissiveIntensity: 0.5 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x3a3150, roughness: 0.6, metalness: 0.2, flatShading: false, bumpMap: organic, bumpScale: 0.12 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x8dffe3, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffc27d, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });

  function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // ------------------------------------------------------- organic grazers
  const grazers = [];
  for (let i = 0; i < 8; i++) {
    const r = range(rng, 24, 48);
    const a = range(rng, 0, TAU);
    const y = terraceHeight(r);
    const g = new THREE.Group();
    const scale = range(rng, 1.15, 1.7);
    const body = mesh(new THREE.SphereGeometry(2.6, 16, 10), skin, 0, 2.2, 0);
    body.scale.set(1.7, 0.8, 1.0);
    g.add(body);
    const neck = mesh(new THREE.CylinderGeometry(0.55, 1.1, 2.8, 8), skin, 0, 3.6, 1.6, -0.6);
    g.add(neck);
    const head = mesh(new THREE.SphereGeometry(0.85, 10, 7), shell, 0, 5.0, 2.4);
    head.scale.set(1.2, 0.8, 1.5);
    g.add(head);
    g.add(mesh(new THREE.SphereGeometry(0.16, 6, 4), glow, 0.4, 5.1, 3.0));
    g.add(mesh(new THREE.SphereGeometry(0.16, 6, 4), glow, -0.4, 5.1, 3.0));
    for (const side of [-1, 1]) {
      for (const row of [-0.7, 0.4]) {
        g.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.5, 5), shell, side * 1.0, 1.1, row, 0.15 * side, 0, 0.13 * side));
      }
    }
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.18, 3.2, 5), skin, 0, 2.0, -2.7, 0.45));
    g.add(mesh(new THREE.SphereGeometry(0.22, 6, 4), glow, 0, 2.0, -4.3));
    g.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    g.rotation.y = range(rng, 0, TAU);
    g.scale.setScalar(scale);
    g.userData = { origin: g.position.clone(), phase: range(rng, 0, TAU), speed: range(rng, 0.04, 0.1), radius: range(rng, 1, 4) };
    group.add(g);
    grazers.push(g);
  }
  updates.push((dt, time) => {
    for (const g of grazers) {
      const d = g.userData;
      g.position.x = d.origin.x + Math.sin(time * d.speed + d.phase) * d.radius;
      g.position.z = d.origin.z + Math.cos(time * d.speed * 0.7 + d.phase) * d.radius;
      g.rotation.y = Math.atan2(Math.cos(time * d.speed + d.phase) * d.radius, -Math.sin(time * d.speed * 0.7 + d.phase) * d.radius);
    }
  });

  // ------------------------------------------------------ mechanical drones
  const drones = [];
  for (let i = 0; i < 14; i++) {
    const drone = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b748c, roughness: 0.32, metalness: 0.65, emissive: 0x152239, emissiveIntensity: 1.1, flatShading: false, bumpMap: panel, bumpScale: 0.08 });
    drone.add(mesh(new THREE.CylinderGeometry(0.28, 0.45, 1.4, 6), bodyMat, 0, 0, 0, Math.PI / 2));
    for (const side of [-1, 1]) {
      drone.add(mesh(new THREE.TorusGeometry(0.7, 0.06, 4, 18), glow, side * 0.8, 0, 0, 0, Math.PI / 2));
      drone.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 4), bodyMat, side * 0.65, 0, 0, 0, 0, Math.PI / 2));
    }
    drone.add(mesh(new THREE.SphereGeometry(0.14, 6, 4), warm, 0, 0, 0.75));
    drone.userData = {
      radius: range(rng, 20, 45),
      height: range(rng, 18, 34),
      angle: range(rng, 0, TAU),
      speed: range(rng, 0.12, 0.3),
      phase: range(rng, 0, TAU),
    };
    group.add(drone);
    drones.push(drone);
  }
  updates.push((dt, time) => {
    for (const drone of drones) {
      const d = drone.userData;
      d.angle += dt * d.speed;
      drone.position.set(Math.sin(d.angle) * d.radius, d.height + Math.sin(time * 0.7 + d.phase) * 1.4, Math.cos(d.angle) * d.radius);
      drone.rotation.y = -d.angle;
      drone.rotation.z = Math.sin(time * 0.5 + d.phase) * 0.28;
    }
  });

  // --------------------------------------------------------- the unknown
  const unknownGroup = new THREE.Group();
  const unknownMat = new THREE.MeshPhysicalMaterial({
    color: 0x08060d,
    metalness: 0.72,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    iridescence: 1,
    iridescenceIOR: 1.8,
    iridescenceThicknessRange: [120, 520],
    bumpMap: unknown,
    bumpScale: 0.12,
  });
  const monolith = mesh(new THREE.BoxGeometry(4.6, 16, 4.6), unknownMat, 0, 8, 0, 0.04, 0.2, -0.03);
  unknownGroup.add(monolith);
  const voidEye = mesh(new THREE.SphereGeometry(1.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0x010103 }), 0, 11.5, 2.35);
  unknownGroup.add(voidEye);
  for (let i = 0; i < 3; i++) {
    const ring = mesh(new THREE.TorusGeometry(2.2 + i * 0.8, 0.035, 4, 52), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff6fd8 : 0x75ffe2, transparent: true, opacity: 0.3 - i * 0.06, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 11.5, 2.6, Math.PI / 2, 0, i * 0.3);
    ring.userData.spin = 0.04 + i * 0.025;
    unknownGroup.add(ring);
    updates.push((dt) => { ring.rotation.z += dt * ring.userData.spin; });
  }
  unknownGroup.position.set(Math.sin(5.62) * 47, 1.6, Math.cos(5.62) * 47);
  unknownGroup.rotation.y = -5.62;
  unknownGroup.scale.setScalar(1.25);
  group.add(unknownGroup);
  updates.push((dt, time) => {
    unknownGroup.position.y = 1.6 + Math.sin(time * 0.35) * 0.28;
    unknownGroup.rotation.y += dt * 0.004;
  });

  // -------------------------------------------------- mechanical service roots
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x596276, roughness: 0.36, metalness: 0.55, emissive: 0x172338, emissiveIntensity: 0.8, bumpMap: panel, bumpScale: 0.1 });
  for (let i = 0; i < 14; i++) {
    const a = range(rng, 0, TAU);
    const r = range(rng, 30, 53);
    const y = terraceHeight(r);
    const p = mesh(new THREE.CylinderGeometry(0.12, 0.2, range(rng, 2, 7), 6), pipeMat, Math.sin(a) * r, y + 1.2, Math.cos(a) * r, 0, range(rng, -0.2, 0.2), range(rng, -0.3, 0.3));
    group.add(p);
    group.add(mesh(new THREE.TorusGeometry(0.24, 0.06, 4, 14), glow, p.position.x, p.position.y + 2.8, p.position.z, Math.PI / 2));
  }

  return { group, updates, unknown: unknownGroup };
}
