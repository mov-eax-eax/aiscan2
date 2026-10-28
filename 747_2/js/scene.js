// js/scene.js — dusk flightline: procedural sky/IBL, wet apron, low sun and camera presets.
import * as THREE from '../lib/three.module.min.js';
import { makeCanvas, canvasTexture, fbm, clamp, lerp, easeInOut } from './util.js';
import { GROUND_Y } from './gear.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { FUSE } from './fuselage.js';

export const PRESETS = [
  { id: 'hero', name: 'Three-quarter', pos: [62, 13, 69], target: [0, 0.5, 0] },
  { id: 'front', name: 'Nose on', pos: [142, 9, 44], target: [10, 1.4, 0] },
  { id: 'side', name: 'Side profile', pos: [2, 4, 116], target: [0, 1.2, 0] },
  { id: 'top', name: 'Planform', pos: [0.2, 152, 6], target: [0, 0, 0] },
  { id: 'low', name: 'Low angle', pos: [52, -3.6, 56], target: [0, 0.4, 0] },
  { id: 'cockpit', name: 'Flight deck', pos: [51, 8.0, 18], target: [33.0, 3.4, 0] },
  { id: 'engine', name: 'GEnx fan', pos: [15, -2.4, 22], target: [7.0, -2.3, 11] },
  { id: 'gear', name: 'Main gear', pos: [15, -8.2, 22], target: [-1.0, -4.4, 4.5] },
  { id: 'tail', name: 'Empennage', pos: [-82, 23, 38], target: [-28, 4.8, 0] },
  { id: 'wingtip', name: 'Raked tip', pos: [-38, 8, 50], target: [-20, 4.4, 34] },
  { id: 'flap', name: 'Flaps', pos: [-10, -1.5, 35], target: [-5.5, 0.9, 15] },
  { id: 'titles', name: 'Titles', pos: [42, 8.5, 32], target: [12, 2.2, 0] },
  { id: 'nose', name: 'Nose detail', pos: [55, 4.0, 17], target: [35, 2.8, 0] },
  { id: 'port', name: 'Port side', pos: [34, 7.0, -34], target: [8, 1.6, 0] },
];

function paintSky(W = 2048, H = 1024) {
  const { canvas, ctx } = makeCanvas(W, H, true);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#06111f');
  g.addColorStop(0.22, '#0f2740');
  g.addColorStop(0.38, '#2c4a66');
  g.addColorStop(0.465, '#7d8a91');
  g.addColorStop(0.492, '#d99a6d');
  g.addColorStop(0.505, '#e8ab78');
  g.addColorStop(0.525, '#9c7a63');
  g.addColorStop(0.60, '#474a4d');
  g.addColorStop(1.00, '#191c1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // low sun, aligned with the key light (azimuth ~205 degrees)
  const sunX = W * 0.235, sunY = H * 0.49;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.20);
  sg.addColorStop(0.00, 'rgba(255,246,224,1.0)');
  sg.addColorStop(0.04, 'rgba(255,232,190,0.95)');
  sg.addColorStop(0.12, 'rgba(255,196,140,0.45)');
  sg.addColorStop(0.42, 'rgba(240,160,110,0.12)');
  sg.addColorStop(1.00, 'rgba(240,160,110,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  // stratified warm clouds
  const step = 2;
  for (let y = 0; y < H * 0.53; y += step) {
    const alt = clamp(1 - Math.abs(y / H - 0.46) / 0.18, 0, 1);
    if (alt <= 0.01) continue;
    for (let x = 0; x < W; x += step) {
      const n = fbm(x * 0.009, y * 0.035, 5, 13);
      const cov = clamp((n - 0.52) * 3.2, 0, 1) * alt;
      if (cov > 0.006) {
        const warm = fbm(x * 0.004, y * 0.01, 2, 7);
        const r = Math.round(210 + warm * 45), gg = Math.round(150 + warm * 55), b = Math.round(120 + warm * 40);
        ctx.fillStyle = 'rgba(' + r + ',' + gg + ',' + b + ',' + (cov * 0.45).toFixed(3) + ')';
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  // thin high cirrus over the zenith
  for (let y = 0; y < H * 0.30; y += step) {
    for (let x = 0; x < W; x += step) {
      const n = fbm(x * 0.006 + 30, y * 0.06, 4, 31);
      if (n > 0.66) {
        ctx.fillStyle = 'rgba(150,175,205,' + ((n - 0.66) * 0.35).toFixed(3) + ')';
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  return canvas;
}

function paintApron(W = 2048) {
  const { canvas, ctx } = makeCanvas(W, W, true);
  ctx.fillStyle = '#3b3e42';
  ctx.fillRect(0, 0, W, W);
  // asphalt grain + aggregate
  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * W, y = Math.random() * W, s = 1 + Math.random() * 3;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.055)';
    ctx.fillRect(x, y, s, s);
  }
  // broad wet/dry patches
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W, y = Math.random() * W, r = 40 + Math.random() * 240;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(18,20,24,' + (0.05 + Math.random() * 0.10).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(18,20,24,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // expansion joints and slab seams
  ctx.strokeStyle = 'rgba(18,20,24,0.55)';
  ctx.lineWidth = 3;
  const cells = 8;
  for (let i = 0; i <= cells; i++) {
    const p = (i / cells) * W;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
  }
  // faded service markings
  ctx.strokeStyle = 'rgba(226,222,205,0.30)';
  ctx.lineWidth = 9;
  ctx.setLineDash([54, 44]);
  ctx.beginPath(); ctx.moveTo(0, W * 0.62); ctx.lineTo(W, W * 0.62); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(214,178,92,0.34)';
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(W * 0.28, 0); ctx.lineTo(W * 0.28, W); ctx.stroke();
  // oil stains and tyre marks
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W, y = Math.random() * W, r = 8 + Math.random() * 44;
    ctx.fillStyle = 'rgba(12,12,14,' + (0.03 + Math.random() * 0.06).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.4 + Math.random()), Math.random() * 3, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

function paintRoughness(W = 512) {
  const { canvas, ctx } = makeCanvas(W, W, true);
  const img = ctx.createImageData(W, W), d = img.data;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = fbm(x * 0.03, y * 0.03, 4, 5);
      const puddle = clamp((fbm(x * 0.009 + 11, y * 0.009, 3, 9) - 0.58) * 5, 0, 1);
      const rough = clamp(0.72 - puddle * 0.52 + (n - 0.5) * 0.16, 0.08, 0.92);
      d[i] = 255; d[i + 1] = Math.round(rough * 255); d[i + 2] = 0; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function paintGroundMarks() {
  const { canvas, ctx } = makeCanvas(2048, 512, true);
  ctx.clearRect(0, 0, 2048, 512);
  ctx.fillStyle = 'rgba(224,190,104,0.85)';
  ctx.fillRect(0, 236, 2048, 22);
  ctx.fillStyle = 'rgba(228,228,220,0.62)';
  for (let i = 0; i < 18; i++) ctx.fillRect(i * 120, 300, 62, 12);
  ctx.save();
  ctx.translate(1500, 70);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(230,230,224,0.55)';
  ctx.font = '900 150px "Segoe UI", Arial';
  ctx.letterSpacing = '18px';
  ctx.fillText('747-8', 0, 0);
  ctx.restore();
  ctx.strokeStyle = 'rgba(224,190,104,0.7)';
  ctx.lineWidth = 16;
  ctx.strokeRect(120, 40, 300, 160);
  return canvas;
}

function contactShadowTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 248);
  g.addColorStop(0, 'rgba(0,0,0,0.42)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.24)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return canvas;
}

function addFloodMasts(scene) {
  const poleMat = new THREE.MeshStandardMaterial({ color: '#22262c', roughness: 0.8, metalness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#fff3d4', emissive: '#ffd9a0', emissiveIntensity: 4.0, roughness: 0.4 });
  for (const [x, z] of [[-150, -105], [-70, 160], [165, 100]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.42, 24, 8), poleMat);
    pole.position.set(x, GROUND_Y + 12, z);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.6), headMat);
    head.position.set(x, GROUND_Y + 24.2, z);
    scene.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: canvasTexture(contactShadowTexture(), { srgb: true }), color: '#ffd9a0',
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5,
    }));
    glow.scale.set(10, 10, 10);
    glow.position.set(x, GROUND_Y + 24.0, z);
    scene.add(glow);
  }
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#2b333c', 0.00155);

  const skyTex = canvasTexture(paintSky(), { srgb: true, flipY: false, aniso: 4 });
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = skyTex;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(skyTex).texture;
  pmrem.dispose();
  scene.environment = envMap;

  // low warm sun
  const sun = new THREE.DirectionalLight('#ffe0c0', 3.3);
  sun.position.set(118, 58, 140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  const S = 72;
  sun.shadow.camera.left = -S * 1.5; sun.shadow.camera.right = S * 1.5;
  sun.shadow.camera.top = S * 1.2; sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

  const skyFill = new THREE.HemisphereLight('#8fb3df', '#3a3833', 0.85);
  scene.add(skyFill);
  const fill = new THREE.DirectionalLight('#8db3e0', 0.85);
  fill.position.set(-95, 55, -110);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffd9b8', 0.55);
  rim.position.set(-70, 16, 55);
  scene.add(rim);

  // apron
  const apronTex = canvasTexture(paintApron(), { srgb: true, repeat: [5, 5], aniso: 8 });
  const roughTex = canvasTexture(paintRoughness(), { srgb: false, repeat: [10, 10], aniso: 8 });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1700, 1700),
    new THREE.MeshStandardMaterial({
      map: apronTex, roughnessMap: roughTex, roughness: 1.0, metalness: 0.08,
      envMapIntensity: 0.75, color: '#ffffff',
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y - 0.01;
  ground.receiveShadow = true;
  ground.name = 'apron';
  scene.add(ground);

  // painted apron markings
  const marks = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 55),
    new THREE.MeshStandardMaterial({ map: canvasTexture(paintGroundMarks(), { srgb: true, aniso: 8 }), transparent: true, roughness: 0.85, metalness: 0.0, depthWrite: false })
  );
  marks.rotation.x = -Math.PI / 2;
  marks.rotation.z = 0.10;
  marks.position.set(2, GROUND_Y + 0.012, -35);
  scene.add(marks);

  // soft contact shadow under the aircraft
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 78),
    new THREE.MeshBasicMaterial({ map: canvasTexture(contactShadowTexture(), { srgb: true }), transparent: true, depthWrite: false, opacity: 0.55 })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, GROUND_Y + 0.02, 0);
  scene.add(contact);

  // addFloodMasts(scene);  // kept as a helper, but the masts read as stray poles at hero scale

  const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 4000);
  camera.position.set(104, 27, 80);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -1.0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 6;
  controls.maxDistance = 430;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.autoRotateSpeed = 0.45;
  controls.update();

  let transition = null;
  const setPreset = (id, instant = false) => {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
    const toPos = new THREE.Vector3().fromArray(p.pos);
    const toTgt = new THREE.Vector3().fromArray(p.target);
    if (instant) {
      camera.position.copy(toPos); controls.target.copy(toTgt); controls.update();
      transition = null;
      return p;
    }
    transition = {
      t: 0, dur: 1.35,
      fromPos: camera.position.clone(), toPos,
      fromTgt: controls.target.clone(), toTgt,
    };
    return p;
  };

  const updateCamera = (dt) => {
    if (transition) {
      transition.t += dt;
      const k = easeInOut(clamp(transition.t / transition.dur, 0, 1));
      camera.position.lerpVectors(transition.fromPos, transition.toPos, k);
      controls.target.lerpVectors(transition.fromTgt, transition.toTgt, k);
      if (transition.t >= transition.dur) transition = null;
    }
    controls.update();
  };

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  resize();

  const setSunAngle = (azimuthDeg, elevationDeg) => {
    const az = (azimuthDeg * Math.PI) / 180, el = (elevationDeg * Math.PI) / 180;
    const r = 190;
    sun.position.set(Math.cos(el) * Math.cos(az) * r, Math.sin(el) * r, Math.cos(el) * Math.sin(az) * r);
  };

  return {
    renderer, scene, camera, controls, ground, sun, envMap, skyTex,
    presets: PRESETS, setPreset, updateCamera, resize, setSunAngle,
    get transitioning() { return !!transition; },
  };
}
