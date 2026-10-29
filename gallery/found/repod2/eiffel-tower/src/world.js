import * as THREE from 'three';
import { DIM, GROUND_Y, SKIES } from './config.js';

const SE = new THREE.Vector3(0.7071067811865476, 0, 0.7071067811865476);
const NE = new THREE.Vector3(0.7071067811865476, 0, -0.7071067811865476);
const NW = SE.clone().negate();

/** Small procedural noise canvas, used for roughness maps and ground texture. */
export function makeNoiseTexture(size = 256, base = 128, spread = 26) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = base + (Math.random() - 0.5) * spread;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function groundQuad(w, l, cx, cz, yaw, material, y) {
  const geo = new THREE.PlaneGeometry(w, l);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, y, cz);
  mesh.rotation.y = yaw;
  mesh.receiveShadow = true;
  return mesh;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop, uMid, uLow, uSun, uSunDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uLow, uMid, smoothstep(0.44, 0.52, h));
    col = mix(col, uTop, smoothstep(0.5, 0.98, h));
    col = mix(col * 0.72, col, smoothstep(0.35, 0.5, h));
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSun * (pow(s, 480.0) * 2.4 + pow(s, 9.0) * 0.28);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = 'world';

  /* ------------------------------- sky ------------------------------- */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(0x1d4b8f) },
      uMid: { value: new THREE.Color(0x8fb3e0) },
      uLow: { value: new THREE.Color(0xffc98a) },
      uSun: { value: new THREE.Color(0xffd9a8) },
      uSunDir: { value: new THREE.Vector3(0, 0.2, -1) },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 20), skyMat);
  sky.frustumCulled = false;
  sky.name = 'sky';
  group.add(sky);

  /* ------------------------------ ground ----------------------------- */
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d6136, roughness: 1, metalness: 0 });
  const ground = groundQuad(9000, 9000, 0, 0, 0, grassMat, GROUND_Y);
  ground.name = 'ground';
  group.add(ground);

  const plazaMat = new THREE.MeshStandardMaterial({ color: 0x9d9789, roughness: 0.95, metalness: 0 });
  const plaza = groundQuad(320, 320, 0, 0, Math.PI / 4, plazaMat, GROUND_Y + 0.04);
  group.add(plaza);

  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x46612f, roughness: 1 });
  const lawn = groundQuad(230, 780, SE.x * 450, SE.z * 450, Math.PI / 4, lawnMat, GROUND_Y + 0.05);
  group.add(lawn);

  const pathMat = new THREE.MeshStandardMaterial({ color: 0xb4ac9c, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const off = NE.clone().multiplyScalar(side * 132);
    const p = groundQuad(16, 820, SE.x * 450 + off.x, SE.z * 450 + off.z, Math.PI / 4, pathMat, GROUND_Y + 0.06);
    group.add(p);
  }
  for (let i = 0; i < 4; i++) {
    const off = SE.clone().multiplyScalar(160 + i * 160);
    const p = groundQuad(230, 14, off.x, off.z, Math.PI / 4, pathMat, GROUND_Y + 0.06);
    group.add(p);
  }

  /* ------------------------------- Seine ----------------------------- */
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f4a63,
    roughness: 0.16,
    metalness: 0.55,
    envMapIntensity: 1.2,
  });
  const quayMat = new THREE.MeshStandardMaterial({ color: 0x8a8577, roughness: 0.95 });
  {
    const off = NW.clone().multiplyScalar(250);
    const yaw = Math.PI / 4 + Math.PI / 2;
    group.add(groundQuad(110, 3000, off.x, off.z, yaw, waterMat, GROUND_Y + 0.04));
    for (const side of [-1, 1]) {
      const q = NW.clone().multiplyScalar(250).addScaledVector(NE, side * 62);
      group.add(groundQuad(14, 3000, q.x, q.z, yaw, quayMat, GROUND_Y + 0.07));
    }
    // Pont d'Iéna
    group.add(groundQuad(30, 60, off.x, off.z, Math.PI / 4, pathMat, GROUND_Y + 0.5));
  }

  // Palais de Chaillot, across the river — a hint of the city
  const palMat = new THREE.MeshStandardMaterial({ color: 0xc9c0ac, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const c = NW.clone().multiplyScalar(520).addScaledVector(NE, side * 150);
    const b = new THREE.Mesh(new THREE.BoxGeometry(120, 26, 70), palMat);
    b.position.set(c.x, GROUND_Y + 13, c.z);
    b.rotation.y = Math.PI / 4;
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
  }

  /* ------------------------------- trees ----------------------------- */
  {
    const spots = [];
    for (let i = 0; i < 22; i++) {
      const d = 150 + i * 28;
      for (const side of [-1, 1]) {
        const p = SE.clone().multiplyScalar(d).addScaledVector(NE, side * 150);
        spots.push([p.x + (Math.random() - 0.5) * 12, p.z + (Math.random() - 0.5) * 12]);
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 175 + Math.random() * 55;
      spots.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const n = spots.length;
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 4.2, 6).translate(0, 2.1, 0);
    const leafGeo = new THREE.IcosahedronGeometry(3.4, 0).translate(0, 6.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x35522b, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const sc = 0.85 + Math.random() * 0.5;
      p.set(spots[i][0], GROUND_Y, spots[i][1]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      trunks.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    trunks.castShadow = true;
    leaves.castShadow = true;
    trunks.receiveShadow = true;
    leaves.receiveShadow = true;
    group.add(trunks, leaves);
  }

  /* ------------------------------ lights ----------------------------- */
  const sun = new THREE.DirectionalLight(0xffb066, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 80;
  sun.shadow.camera.far = 2400;
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 360;
  sun.shadow.camera.bottom = -140;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.45;
  sun.target.position.set(0, 130, 0);
  group.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0x9dc0ff, 0x54452f, 0.55);
  group.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.12);
  group.add(ambient);

  // the 336 projectors that light the tower at night (a handful of spotlights)
  const spots = [];
  const spotDefs = [
    [0.0, 18, 0.55],
    [1.0, 30, 0.65],
    [2.0, 34, 0.6],
    [3.0, 58, 0.6],
    [0.0, 150, 0.65],
    [2.0, 250, 0.6],
  ];
  for (const [dirIndex, aimY, intensity] of spotDefs) {
    const dir = [SE, NE, NW, NE.clone().negate()][dirIndex];
    const l = new THREE.SpotLight(0xffcf8f, 0, 900, 0.62, 0.85, 1.0);
    l.position.set(dir.x * 150, GROUND_Y + 6, dir.z * 150);
    l.target.position.set(dir.x * 8, aimY, dir.z * 8);
    l.castShadow = false;
    l.userData.baseIntensity = intensity * 700;
    group.add(l, l.target);
    spots.push(l);
  }

  scene.add(group);

  let current = 'golden';

  function setSky(name) {
    const s = SKIES[name] || SKIES.golden;
    current = name;
    skyMat.uniforms.uTop.value.setHex(s.skyTop);
    skyMat.uniforms.uMid.value.setHex(s.skyMid);
    skyMat.uniforms.uLow.value.setHex(s.skyLow);
    skyMat.uniforms.uSun.value.setHex(s.sun.color);

    const phi = THREE.MathUtils.degToRad(90 - s.sun.elev);
    const theta = THREE.MathUtils.degToRad(s.sun.azim);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    skyMat.uniforms.uSunDir.value.copy(dir);

    sun.position.copy(dir).multiplyScalar(900);
    sun.color.setHex(s.sun.color);
    sun.intensity = s.sun.intensity;
    hemi.color.setHex(s.hemi.sky);
    hemi.groundColor.setHex(s.hemi.ground);
    hemi.intensity = s.hemi.intensity;
    ambient.intensity = s.ambient;

    for (const l of spots) {
      l.intensity = l.userData.baseIntensity * s.lamps;
      l.visible = s.lamps > 0.001;
    }

    scene.fog = new THREE.Fog(s.fog, s.fogNear, s.fogFar);
    scene.background = null;
    return s;
  }

  return { group, setSky, skyMat, sun, hemi, ambient, spots, get current() { return current; } };
}
