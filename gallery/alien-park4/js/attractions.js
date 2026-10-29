import * as THREE from 'three';
import { mulberry32, range, pick } from './rng.js';
import { bump } from './textures.js';

const TAU = Math.PI * 2;

function textPlate(text, color, width = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.font = '700 96px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 132);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.strokeText(text, 512, 132);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), mat);
}

export function createAttractions() {
  const group = new THREE.Group();
  group.name = 'attractions';
  const updates = [];
  const rng = mulberry32(30511);
  const metal = new THREE.MeshStandardMaterial({ color: 0x8b8c85, roughness: 0.36, metalness: 0.58, emissive: 0x0c1828, emissiveIntensity: 0.9, flatShading: false, bumpMap: bump('panel'), bumpScale: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x403d37, roughness: 0.78, metalness: 0.2, flatShading: false, bumpMap: bump('panel'), bumpScale: 0.12 });
  const cyan = new THREE.MeshBasicMaterial({ color: 0xb7d3c8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const pink = new THREE.MeshBasicMaterial({ color: 0xd39480, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
  const amber = new THREE.MeshBasicMaterial({ color: 0xe2b27b, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });

  function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = false;
    m.receiveShadow = true;
    return m;
  }

  // ------------------------------------------------------------- skyway
  const skyPoints = [];
  const skyCount = 9;
  for (let i = 0; i < skyCount; i++) {
    const a = (i / skyCount) * TAU;
    const r = 48 + Math.sin(i * 1.7) * 5;
    skyPoints.push(new THREE.Vector3(Math.sin(a) * r, 24 + Math.sin(i * 1.9) * 3.4, Math.cos(a) * r));
  }
  const skyCurve = new THREE.CatmullRomCurve3(skyPoints, true, 'catmullrom', 0.28);
  group.add(mesh(new THREE.TubeGeometry(skyCurve, 100, 0.1, 4, true), metal));
  group.add(mesh(new THREE.TubeGeometry(skyCurve, 100, 0.025, 4, true), cyan));
  for (let i = 0; i < skyCount; i++) {
    const p = skyPoints[i];
    const baseY = 1.5;
    const tower = new THREE.Group();
    tower.add(mesh(new THREE.CylinderGeometry(0.24, 0.7, p.y - baseY,24), metal, 0, (p.y - baseY) / 2, 0));
    tower.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, p.y - baseY,24), cyan, 0, (p.y - baseY) / 2, 0));
    tower.add(mesh(new THREE.BoxGeometry(4.2, 0.32, 0.8), metal, 0, p.y - baseY, 0));
    tower.position.set(p.x, baseY, p.z);
    group.add(tower);
  }
  const cabins = new THREE.Group();
  group.add(cabins);
  const cabinList = [];
  for (let i = 0; i < 10; i++) {
    const cabin = new THREE.Group();
    cabin.add(mesh(new THREE.SphereGeometry(0.72,18,12), i % 2 ? cyan : pink, 0, 0, 0));
    cabin.add(mesh(new THREE.ConeGeometry(0.82, 1.1,20), dark, 0, 0.9, 0));
    cabin.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4,24), metal, 0, -1.0, 0));
    const t = i / 10;
    cabin.userData.t = t;
    cabin.userData.offset = 0.03 * (i % 3);
    cabins.add(cabin);
    cabinList.push(cabin);
  }
  updates.push((dt) => {
    for (const cabin of cabinList) {
      cabin.userData.t = (cabin.userData.t + dt * 0.008) % 1;
      const t = (cabin.userData.t + cabin.userData.offset) % 1;
      const p = skyCurve.getPointAt(t);
      const tan = skyCurve.getTangentAt(t);
      cabin.position.copy(p);
      cabin.rotation.y = Math.atan2(tan.x, tan.z);
      cabin.position.y = p.y - 1.6;
    }
  });
  // Station at the first support.
  const station = new THREE.Group();
  station.position.set(skyPoints[0].x, 1.5, skyPoints[0].z);
  station.add(mesh(new THREE.CylinderGeometry(4.4, 5.2, 0.8,24), dark, 0, 0.4, 0));
  station.add(mesh(new THREE.TorusGeometry(4.1, 0.1,10,64), amber, 0, 0.9, 0, Math.PI / 2));
  station.add(mesh(new THREE.BoxGeometry(6.4, 3.2, 3.4), metal, 0, 3, 0));
  group.add(station);

  // --------------------------------------------------------- drop tower
  const drop = new THREE.Group();
  drop.position.set(Math.sin(1.25) * 44, 1.5, Math.cos(1.25) * 44);
  drop.scale.setScalar(1.25);
  drop.rotation.y = -1.25;
  group.add(drop);
  drop.add(mesh(new THREE.CylinderGeometry(4.4, 5.2, 0.9,24), dark, 0, 0.45, 0));
  drop.add(mesh(new THREE.CylinderGeometry(0.8, 1.2, 33,24), metal, 0, 16.5, 0));
  drop.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 33,24), amber, 0.9, 16.5, 0));
  for (const y of [8, 18, 27]) drop.add(mesh(new THREE.TorusGeometry(2.6, 0.12,10,64), pink, 0, y, 0, Math.PI / 2));
  const car = new THREE.Group();
  car.add(mesh(new THREE.SphereGeometry(1.25,18,12), cyan, 0, 0, 0));
  car.add(mesh(new THREE.TorusGeometry(1.5, 0.08,10,64), pink, 0, 0, 0, Math.PI / 2));
  drop.add(car);
  updates.push((dt, time) => {
    const cycle = (time * 0.16) % 1;
    const fall = cycle < 0.18 ? 29 : Math.max(3, 29 - Math.pow((cycle - 0.18) / 0.82, 2) * 26);
    car.position.y = fall + 2;
    car.rotation.y += dt * 0.3;
  });
  const dropSign = textPlate('THE DROP', '#ff7bde', 6.4);
  dropSign.position.set(0, 22, 3.4);
  drop.add(dropSign);

  // ------------------------------------------------------------ carousel
  const carousel = new THREE.Group();
  carousel.position.set(Math.sin(2.55) * 29, 1.5, Math.cos(2.55) * 29);
  group.add(carousel);
  carousel.scale.setScalar(1.35);
  carousel.add(mesh(new THREE.CylinderGeometry(7.4, 8.4, 0.8,24), dark, 0, 0.4, 0));
  carousel.add(mesh(new THREE.TorusGeometry(7.2, 0.12,10,64), cyan, 0, 0.9, 0, Math.PI / 2));
  carousel.add(mesh(new THREE.CylinderGeometry(0.9, 1.2, 5.4,24), metal, 0, 3.8, 0));
  const rotor = new THREE.Group();
  rotor.position.y = 3;
  carousel.add(rotor);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const seat = new THREE.Group();
    seat.add(mesh(new THREE.SphereGeometry(0.9,18,12), i % 2 ? pink : amber, 0, 0, 0));
    seat.add(mesh(new THREE.ConeGeometry(0.5, 1.5,20), metal, 0, -1.0, 0, 0, 0, Math.PI));
    seat.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8,24), metal, 0, -1.8, 0));
    seat.position.set(Math.sin(a) * 5.8, 0.6, Math.cos(a) * 5.8);
    seat.rotation.y = -a;
    rotor.add(seat);
  }
  updates.push((dt) => { rotor.rotation.y += dt * 0.22; });
  const carSign = textPlate('CAROUSEL', '#7dffe6', 7.4);
  carSign.position.set(0, 10, 0);
  carousel.add(carSign);

  // --------------------------------------------------------------- stage
  const stage = new THREE.Group();
  stage.position.set(Math.sin(5.78) * 42, 1.5, Math.cos(5.78) * 42);
  stage.rotation.y = -5.78;
  group.add(stage);
  stage.add(mesh(new THREE.CylinderGeometry(9, 10, 0.8,24), dark, 0, 0.4, 0));
  stage.add(mesh(new THREE.CylinderGeometry(5.2, 5.8, 1.4,24), metal, 0, 1.3, 0));
  stage.add(mesh(new THREE.TorusGeometry(5.4, 0.12,10,64), amber, 0, 2.1, 0, Math.PI / 2));
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + i * 0.5;
    const laser = mesh(new THREE.CylinderGeometry(0.035, 0.08, 15,24), i % 2 ? cyan : pink, Math.sin(a) * 3.4, 8.5, Math.cos(a) * 3.4 + 1.2, 0, a, 0.18);
    stage.add(laser);
  }
  // Amphitheatre benches.
  for (let row = 0; row < 4; row++) {
    const r = 9 + row * 1.2;
    const bench = mesh(new THREE.BoxGeometry(9, 0.4, 0.7), dark, 0, 0.7 + row * 0.5, -r);
    stage.add(bench);
  }
  const stageSign = textPlate('RESONANCE', '#ffc47d', 7.2);
  stageSign.position.set(0, 9, 0);
  stage.add(stageSign);

  // ------------------------------------------------ ticketing / entrance
  const entry = new THREE.Group();
  entry.position.set(Math.sin(0.86) * 81, 1.0, Math.cos(0.86) * 81);
  entry.rotation.y = -0.86;
  group.add(entry);
  entry.add(mesh(new THREE.BoxGeometry(9.2, 0.5, 4.4), dark, 0, 0.2, 0));
  for (const x of [-4.3, 4.3]) {
    entry.add(mesh(new THREE.BoxGeometry(0.75, 6.4, 0.75), metal, x, 3.2, 0));
    entry.add(mesh(new THREE.SphereGeometry(0.22,18,12), pink, x, 6.5, 0));
  }
  entry.add(mesh(new THREE.TorusGeometry(4.3, 0.18, 4, 32, Math.PI), metal, 0, 6.4, 0));
  const entrySign = textPlate('XENOSPHERE', '#7dffe6', 8.4);
  entrySign.position.set(0, 7.8, 0.1);
  entry.add(entrySign);
  for (let i = 0; i < 6; i++) {
    const x = -3.2 + i * 1.28;
    entry.add(mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.2,24), metal, x, 1.1, 2.4));
  }

  // ----------------------------------------------- string lights + stalls
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const r = 46 + (i % 3) * 2;
    const y = 8.8 + Math.sin(i * 2.2) * 1.1;
    const bulb = mesh(new THREE.SphereGeometry(0.14,18,12), i % 3 === 0 ? pink : i % 3 === 1 ? cyan : amber, Math.sin(a) * r, y, Math.cos(a) * r);
    group.add(bulb);
  }
  for (let i = 0; i < 4; i++) {
    const a = 1.1 + i * 1.1;
    const r = 51;
    const stall = new THREE.Group();
    stall.position.set(Math.sin(a) * r, 1.5, Math.cos(a) * r);
    stall.rotation.y = -a;
    stall.add(mesh(new THREE.BoxGeometry(3, 1.1, 2.2), dark, 0, 0.6, 0));
    stall.add(mesh(new THREE.BoxGeometry(3.4, 0.16, 2.6), i % 2 ? amber : pink, 0, 1.3, 0));
    stall.add(mesh(new THREE.ConeGeometry(2.0, 1.2,20), i % 2 ? cyan : pink, 0, 2.4, 0, 0, Math.PI / 4, 0));
    group.add(stall);
  }

  // ------------------------------------------------ the nightly light show
  const bursts = [];
  for (let b = 0; b < 4; b++) {
    const count = 42;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const origin = new THREE.Vector3(Math.sin(b * 1.9 + 0.4) * range(rng, 10, 28), range(rng, 42, 62), Math.cos(b * 1.9 + 0.4) * range(rng, 10, 28));
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const p = rng() * Math.PI - Math.PI / 2;
      const speed = range(rng, 2.5, 7);
      velocities[i * 3] = Math.cos(a) * Math.cos(p) * speed;
      velocities[i * 3 + 1] = Math.sin(p) * speed + 1.4;
      velocities[i * 3 + 2] = Math.sin(a) * Math.cos(p) * speed;
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: pick(rng, [0xd8dfc7, 0xd39480, 0xe2b27b, 0xa9a58f]), size: 0.55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    group.add(points);
    bursts.push({ points, geo, mat, velocities, origin, age: range(rng, 0, 4), life: range(rng, 3.4, 5.2) });
  }
  updates.push((dt) => {
    for (const burst of bursts) {
      burst.age += dt;
      if (burst.age > burst.life) {
        burst.age = 0;
        const a = rng() * TAU;
        const r = range(rng, 12, 32);
        burst.origin.set(Math.sin(a) * r, range(rng, 44, 64), Math.cos(a) * r);
      }
      const pos = burst.geo.attributes.position.array;
      const n = pos.length / 3;
      for (let i = 0; i < n; i++) {
        const age = burst.age;
        pos[i * 3] = burst.origin.x + burst.velocities[i * 3] * age;
        pos[i * 3 + 1] = burst.origin.y + burst.velocities[i * 3 + 1] * age - 1.1 * age * age;
        pos[i * 3 + 2] = burst.origin.z + burst.velocities[i * 3 + 2] * age;
      }
      burst.geo.attributes.position.needsUpdate = true;
      burst.mat.opacity = Math.max(0, Math.sin((burst.age / burst.life) * Math.PI)) * 0.75;
    }
  });

  return { group, updates };
}
