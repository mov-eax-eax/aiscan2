import * as THREE from 'three';
import { mulberry32, range, pick, chance } from './rng.js';

const TAU = Math.PI * 2;
const hsl = (h, s, l) => new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);

function terraceHeight(radius) {
  if (radius < 17) return 20;
  if (radius < 28) return 14;
  if (radius < 41) return 7.5;
  return 1.5;
}

export function createNature() {
  const group = new THREE.Group();
  group.name = 'nature';
  const updates = [];
  const rng = mulberry32(99041);

  const dark = new THREE.MeshStandardMaterial({ color: 0x18312d, roughness: 0.86, metalness: 0.04, flatShading: true });
  const teal = new THREE.MeshBasicMaterial({ color: 0x75ffd7, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const pink = new THREE.MeshBasicMaterial({ color: 0xff7bde, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });

  function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function alienTree(seed, radius, angle) {
    const treeRng = mulberry32(seed);
    const y = terraceHeight(radius);
    const size = range(treeRng, 0.65, 1.8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: hsl(range(treeRng, 140, 185), 0.35, 0.16), roughness: 0.86, metalness: 0.08, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: hsl(range(treeRng, 150, 210), 0.65, 0.28), emissive: hsl(range(treeRng, 160, 220), 0.8, 0.16), emissiveIntensity: 1.2, roughness: 0.5, flatShading: true });
    const tree = new THREE.Group();
    const height = range(treeRng, 3, 9) * size;
    const bend = range(treeRng, -1.2, 1.2);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + range(treeRng, -0.3, 0.3);
      const branch = new THREE.Group();
      const len = height * range(treeRng, 0.45, 0.8);
      branch.add(mesh(new THREE.CylinderGeometry(0.09 * size, 0.22 * size, len, 5), trunkMat, 0, len / 2, 0, range(treeRng, -0.25, 0.25), 0, bend * 0.2));
      const tip = new THREE.Group();
      tip.position.set(bend * len * 0.2, len, 0);
      tip.add(mesh(new THREE.IcosahedronGeometry(range(treeRng, 0.7, 1.45) * size, 0), leafMat));
      tip.add(mesh(new THREE.ConeGeometry(0.24 * size, 2.3 * size, 4), leafMat, 0, 0.9 * size, 0));
      branch.add(tip);
      branch.rotation.y = a;
      tree.add(branch);
    }
    tree.add(mesh(new THREE.CylinderGeometry(0.32 * size, 0.55 * size, 1.4 * size, 5), trunkMat, 0, 0.7 * size, 0));
    tree.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
    tree.rotation.y = range(treeRng, 0, TAU);
    tree.userData.sway = range(treeRng, 0.2, 0.5);
    tree.userData.phase = range(treeRng, 0, TAU);
    return tree;
  }

  for (let i = 0; i < 34; i++) {
    const angle = range(rng, 0, TAU);
    const radius = range(rng, 20, 52);
    group.add(alienTree(7000 + i, radius, angle));
  }

  // Low coral shelves around the water.
  for (let i = 0; i < 28; i++) {
    const angle = range(rng, 0, TAU);
    const radius = range(rng, 12, 48);
    const y = terraceHeight(radius);
    const h = range(rng, 0.6, 2.8);
    const candel = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * TAU + angle;
      candel.add(mesh(new THREE.CylinderGeometry(0.07, 0.16, h * (0.7 + j * 0.16), 4), dark, Math.sin(a) * 0.4, h * 0.4, Math.cos(a) * 0.4));
      candel.add(mesh(new THREE.SphereGeometry(0.16, 5, 4), j % 2 ? teal : pink, Math.sin(a) * 0.4, h * (0.7 + j * 0.16) + 0.1, Math.cos(a) * 0.4));
    }
    candel.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
    group.add(candel);
  }

  // Falling water sheets from the middle terrace.
  const waterfallMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0x82ffe8) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float time; uniform vec3 color;
      void main(){
        float stripe = sin(vUv.y * 28.0 - time * 4.0 + vUv.x * 8.0) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.84, 1.0, vUv.x));
        gl_FragColor = vec4(color, (0.25 + stripe * 0.38) * edge);
      }
    `,
  });
  const waterfalls = [
    { angle: 0.86, radius: 57.1, y: 1.7, w: 9.2, h: 13.5 },
    { angle: 0.86, radius: 40.9, y: 7.6, w: 8.2, h: 6.2 },
    { angle: 0.62, radius: 39.2, y: 7.6, w: 5.2, h: 6.2 },
    { angle: 2.9, radius: 39.2, y: 7.6, w: 3.8, h: 6.2 },
    { angle: 3.95, radius: 39.2, y: 14.1, w: 2.8, h: 6.5 },
  ];
  const waterfallBases = [];
  for (const wf of waterfalls) {
    const x = Math.sin(wf.angle) * wf.radius;
    const z = Math.cos(wf.angle) * wf.radius;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(wf.w, wf.h, 1, 12), waterfallMat);
    plane.position.set(x, wf.y - wf.h / 2, z);
    plane.rotation.y = wf.angle;
    group.add(plane);
    const glow = new THREE.PointLight(0x66ffe2, 90, 18);
    glow.position.set(x, wf.y - 2.4, z);
    group.add(glow);
    const foam = new THREE.Mesh(new THREE.TorusGeometry(wf.w * 0.55, 0.16, 4, 30), teal);
    foam.rotation.x = Math.PI / 2;
    foam.position.set(x, wf.y - wf.h + 0.2, z);
    group.add(foam);
    waterfallBases.push({ x, z, y: wf.y - wf.h + 0.25, w: wf.w });
  }
  updates.push((dt, time) => { waterfallMat.uniforms.time.value = time; });

  // Streams feeding the falls from the pools.
  const streamMat = new THREE.MeshStandardMaterial({ color: 0x0b7988, emissive: 0x0b4d57, emissiveIntensity: 1.4, transparent: true, opacity: 0.78, roughness: 0.16, metalness: 0.25 });
  const streams = [
    [[21, 17], [26, 27], [26.1, 40.6]],
    [[21, 17], [24, 24], [20.4, 33.1]],
    [[-15, -24], [-20, -30], [-15.1, -36.1]],
  ];
  for (const coords of streams) {
    const curve = new THREE.CatmullRomCurve3(coords.map(([x, z]) => new THREE.Vector3(x, 7.68, z)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.5, 6, false), streamMat));
    const strand = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.12, 4, false), teal);
    strand.position.y = 0.08;
    group.add(strand);
  }

  // Waterfall mist: a looping particle veil at each base.
  const mistCount = 130;
  const mistPositions = new Float32Array(mistCount * 3);
  const mistVelocity = new Float32Array(mistCount);
  const mistBase = [];
  for (let i = 0; i < mistCount; i++) {
    const b = waterfallBases[i % waterfallBases.length];
    const a = range(rng, 0, TAU);
    const r = range(rng, 0, b.w * 0.65);
    mistPositions[i * 3] = b.x + Math.sin(a) * r;
    mistPositions[i * 3 + 1] = b.y + range(rng, 0, 2.4);
    mistPositions[i * 3 + 2] = b.z + Math.cos(a) * r;
    mistVelocity[i] = range(rng, 0.25, 0.9);
    mistBase.push(b);
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: 0xa9fff2, size: 0.16, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(mist);
  updates.push((dt, time) => {
    const pos = mistGeo.attributes.position.array;
    for (let i = 0; i < mistCount; i++) {
      pos[i * 3 + 1] += mistVelocity[i] * dt;
      if (pos[i * 3 + 1] > mistBase[i].y + 3.2) {
        const a = rng() * TAU;
        const r = rng() * mistBase[i].w * 0.65;
        pos[i * 3] = mistBase[i].x + Math.sin(a) * r;
        pos[i * 3 + 1] = mistBase[i].y;
        pos[i * 3 + 2] = mistBase[i].z + Math.cos(a) * r;
      }
    }
    mistGeo.attributes.position.needsUpdate = true;
    mist.material.opacity = 0.25 + Math.sin(time * 0.8) * 0.05;
  });

  // Crowds: the smallest detail is the one that gives the island its scale.
  const crowdRng = mulberry32(55199);
  const visitorCount = 150;
  const bodyGeo = new THREE.CylinderGeometry(0.055, 0.09, 0.34, 4);
  const headGeo = new THREE.SphereGeometry(0.075, 5, 4);
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), visitorCount);
  const headMesh = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), visitorCount);
  const dummy = new THREE.Object3D();
  const palette = [0xff7bde, 0x7dffe6, 0xffd08a, 0x9d8cff, 0xffffff];
  for (let i = 0; i < visitorCount; i++) {
    const cluster = i % 4;
    const angle = range(crowdRng, 0, TAU);
    const radius = cluster === 0 ? range(crowdRng, 16, 24) : cluster === 1 ? range(crowdRng, 27, 39) : range(crowdRng, 42, 52);
    const y = terraceHeight(radius);
    const s = range(crowdRng, 0.7, 1.25);
    dummy.position.set(Math.sin(angle) * radius, y + 0.35 * s, Math.cos(angle) * radius);
    dummy.rotation.set(0, range(crowdRng, 0, TAU), 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    bodyMesh.setMatrixAt(i, dummy.matrix);
    headMesh.setMatrixAt(i, dummy.matrix);
    const c = new THREE.Color(palette[Math.floor(crowdRng() * palette.length)]);
    bodyMesh.setColorAt(i, c);
    headMesh.setColorAt(i, c);
  }
  bodyMesh.instanceMatrix.needsUpdate = true;
  headMesh.instanceMatrix.needsUpdate = true;
  if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
  if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
  group.add(bodyMesh, headMesh);

  // A line of pennants along the edge, catching the bloom light.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + 0.05;
    const r = 40.5;
    const pennant = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.55),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xff7bde : i % 3 === 1 ? 0x7dffe6 : 0xffd08a, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false })
    );
    pennant.position.set(Math.sin(a) * r, 10.5, Math.cos(a) * r);
    pennant.rotation.y = -a;
    pennant.rotation.z = 0.25;
    group.add(pennant);
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 4.5, 3), dark).translateX(Math.sin(a) * r).translateY(9.1).translateZ(Math.cos(a) * r));
  }

  // Low atmosphere: drifting mist sheets between the terraces.
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = 256; mistCanvas.height = 256;
  const mistCtx = mistCanvas.getContext('2d');
  const mistGradient = mistCtx.createRadialGradient(128, 128, 4, 128, 128, 128);
  mistGradient.addColorStop(0, 'rgba(160,140,255,0.18)');
  mistGradient.addColorStop(0.45, 'rgba(110,110,220,0.08)');
  mistGradient.addColorStop(1, 'rgba(110,110,220,0)');
  mistCtx.fillStyle = mistGradient;
  mistCtx.fillRect(0, 0, 256, 256);
  const mistTexture = new THREE.CanvasTexture(mistCanvas);
  const mistSprites = [];
  for (let i = 0; i < 7; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture, color: i % 2 ? 0x8b6dff : 0x4a89a8, transparent: true, opacity: 0.07, depthWrite: false }));
    sprite.scale.set(range(rng, 26, 42), range(rng, 14, 24), 1);
    const a = range(rng, 0, TAU);
    const r = range(rng, 25, 60);
    sprite.position.set(Math.sin(a) * r, terraceHeight(r) + range(rng, 1, 8), Math.cos(a) * r);
    sprite.userData = { baseX: sprite.position.x, baseZ: sprite.position.z, phase: range(rng, 0, TAU) };
    group.add(sprite);
    mistSprites.push(sprite);
  }
  updates.push((dt, time) => {
    for (const sprite of mistSprites) {
      sprite.position.x = sprite.userData.baseX + Math.sin(time * 0.08 + sprite.userData.phase) * 5;
      sprite.position.z = sprite.userData.baseZ + Math.cos(time * 0.06 + sprite.userData.phase) * 4;
    }
  });
  // Fireflies and drifting spores.
  const count = 240;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = range(rng, 0, TAU);
    const r = range(rng, 8, 65);
    const y = terraceHeight(r) + range(rng, 1, 22);
    positions[i * 3] = Math.sin(a) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.cos(a) * r;
    const c = hsl(range(rng, 150, 320), 0.8, 0.6);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    phases[i] = range(rng, 0, TAU);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ size: 0.36, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  group.add(particles);
  updates.push((dt, time) => {
    const array = particleGeo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += Math.sin(time * 0.9 + phases[i]) * dt * 0.18;
    }
    particleGeo.attributes.position.needsUpdate = true;
  });

  // Sky manta — luminous ribbon creatures, not cardboard wings.
  const rays = new THREE.Group();
  group.add(rays);
  const rayColors = [0xff77dd, 0x72ffe0, 0x9d8cff];
  const wingShape = (side) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(side * 2.2, 1.8, side * 6.0, 0.5);
    shape.quadraticCurveTo(side * 3.2, -0.9, side * 0.4, -0.35);
    shape.quadraticCurveTo(0, -0.1, 0, 0);
    return new THREE.ShapeGeometry(shape, 14);
  };
  for (let i = 0; i < 8; i++) {
    const ray = new THREE.Group();
    const color = new THREE.MeshBasicMaterial({ color: rayColors[i % rayColors.length], transparent: true, opacity: 0.32, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const body = mesh(new THREE.SphereGeometry(0.85, 10, 6), color, 0, 0, 0);
    body.scale.set(2.1, 0.3, 0.65);
    ray.add(body);
    const head = mesh(new THREE.SphereGeometry(0.2, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 2.0);
    ray.add(head);
    const wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingShape(side), color);
      wing.position.x = side * 0.4;
      wing.position.z = 0.1;
      wing.rotation.x = -Math.PI / 2;
      wing.rotation.z = side * -0.12;
      ray.add(wing);
      wings.push({ wing, side });
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 3.4, 4), color);
    tail.position.z = -2.4;
    tail.rotation.x = Math.PI / 2;
    ray.add(tail);
    ray.userData = { radius: range(rng, 34, 58), height: range(rng, 28, 52), angle: range(rng, 0, TAU), speed: range(rng, 0.03, 0.075), wings, phase: range(rng, 0, TAU) };
    if (i === 0) {
      ray.scale.setScalar(2.8);
      ray.userData.radius = 36;
      ray.userData.height = 38;
      ray.userData.speed = 0.018;
    }
    rays.add(ray);
  }
  updates.push((dt, time) => {
    for (const ray of rays.children) {
      const { radius, height, angle, speed, wings, phase } = ray.userData;
      ray.userData.angle += dt * speed;
      ray.position.set(Math.sin(ray.userData.angle) * radius, height + Math.sin(time * 0.35 + phase) * 1.4, Math.cos(ray.userData.angle) * radius);
      ray.rotation.y = -ray.userData.angle;
      for (const { wing, side } of wings) {
        wing.rotation.z = side * (-0.12 + Math.sin(time * 0.9 + phase) * 0.26);
        wing.rotation.y = Math.sin(time * 0.45 + phase) * 0.18;
      }
    }
  });

  // A few hanging light pods around the bloom.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.2;
    const r = range(rng, 18, 24);
    const y = range(rng, 25, 37);
    const pod = mesh(new THREE.IcosahedronGeometry(range(rng, 0.35, 0.8), 0), i % 2 ? teal : pink, Math.sin(a) * r, y, Math.cos(a) * r);
    pod.userData.baseY = y;
    pod.userData.phase = range(rng, 0, TAU);
    group.add(pod);
    updates.push((dt, time) => { pod.position.y = pod.userData.baseY + Math.sin(time * 0.6 + pod.userData.phase) * 1.2; });
  }

  return { group, updates };
}
