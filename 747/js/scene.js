// js/scene.js — renderer, procedural sky/IBL, apron, sun and camera presets.
import * as THREE from '../lib/three.module.min.js';
import { makeCanvas, canvasTexture, fbm, clamp, lerp, easeInOut } from './util.js';
import { GROUND_Y } from './gear.js';
import { OrbitControls } from '../lib/OrbitControls.js';

export const PRESETS = [
  { id: 'hero', name: 'Three-quarter', pos: [76, 19, 63], target: [0, -1.4, 0] },
  { id: 'front', name: 'Nose on', pos: [148, 6, 22], target: [8, 0.5, 0] },
  { id: 'side', name: 'Side profile', pos: [4, 3, 106], target: [0, 0.5, 0] },
  { id: 'top', name: 'Planform', pos: [0.5, 148, 6], target: [0, 0, 0] },
  { id: 'below', name: 'Underside', pos: [26, -66, 46], target: [0, -2, 0] },
  { id: 'cockpit', name: 'Flight deck', pos: [46, 4.5, 15], target: [30.5, 1.6, 0] },
  { id: 'engine', name: 'Inboard fan', pos: [13, -3.4, 19], target: [2.5, -2.3, 10.6] },
  { id: 'gear', name: 'Main gear', pos: [16, -8.5, 21], target: [-3.5, -5.4, 4.0] },
  { id: 'tail', name: 'Empennage', pos: [-78, 20, 34], target: [-30, 4, 0] },
  { id: 'winglet', name: 'Winglet', pos: [-34, 8, 46], target: [-18.5, 4.2, 32.5] },
  { id: 'flap', name: 'Flaps', pos: [-16, -1, 34], target: [-8, 0.4, 13] },
  { id: 'title', name: 'Titles', pos: [30, 5.5, 26], target: [4, 1.3, 0] },
  { id: 'port', name: 'Port side', pos: [30, 5.5, -26], target: [4, 1.3, 0] },
  { id: 'nose', name: 'Nose detail', pos: [52, 2.5, 14], target: [31, 1.2, 0] },
];

function paintSky(W = 1024, H = 512) {
  const { canvas, ctx } = makeCanvas(W, H, true);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, '#0d2a55');
  g.addColorStop(0.28, '#2f6ba8');
  g.addColorStop(0.46, '#7fb2d8');
  g.addColorStop(0.52, '#c9dced');
  g.addColorStop(0.62, '#8fa6b8');
  g.addColorStop(1.0, '#5b646d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // sun glow (matches the directional light azimuth)
  const sunX = W * 0.30, sunY = H * 0.20;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.22);
  sg.addColorStop(0, 'rgba(255,247,224,1.0)');
  sg.addColorStop(0.08, 'rgba(255,238,196,0.65)');
  sg.addColorStop(0.45, 'rgba(255,226,180,0.14)');
  sg.addColorStop(1, 'rgba(255,226,180,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  // cloud bands, evaluated on a coarse grid and stamped in blocks
  const step = 2;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const alt = clamp(1 - Math.abs(y / H - 0.55) / 0.34, 0, 1);
      if (alt <= 0.01) continue;
      const n = fbm(x * 0.012, y * 0.04, 5, 3);
      const cov = clamp((n - 0.55) * 3.4, 0, 1) * alt;
      if (cov > 0.004) {
        ctx.fillStyle = 'rgba(255,255,255,' + (cov * 0.85).toFixed(3) + ')';
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  return canvas;
}

function paintApron(W = 2048) {
  const { canvas, ctx } = makeCanvas(W, W, true);
  ctx.fillStyle = '#4a4e54';
  ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * W, y = Math.random() * W, s = 1 + Math.random() * 3;
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, s, s);
  }
  // expansion joints
  ctx.strokeStyle = 'rgba(20,22,26,0.55)';
  ctx.lineWidth = 4;
  const cells = 8;
  for (let i = 0; i <= cells; i++) {
    const p = (i / cells) * W;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
  }
  // centreline and stand markings
  ctx.strokeStyle = 'rgba(240,240,235,0.65)';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(0, W * 0.5); ctx.lineTo(W, W * 0.5); ctx.stroke();
  ctx.setLineDash([60, 40]);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(W * 0.5, 0); ctx.lineTo(W * 0.5, W); ctx.stroke();
  ctx.setLineDash([]);
  // oil stains
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * W, y = Math.random() * W, r = 8 + Math.random() * 40;
    ctx.fillStyle = 'rgba(20,20,22,' + (0.03 + Math.random() * 0.05).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * 3, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fb4d8');
  const panel = (color, intensity, pos, scale, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.material.color.multiplyScalar(intensity);
    m.position.set(pos[0], pos[1], pos[2]);
    m.scale.set(scale[0], scale[1], 1);
    m.rotation.set(rot[0], rot[1], rot[2]);
    scene.add(m);
  };
  panel('#ffffff', 3.4, [60, 70, 40], [220, 160], [0, 0, 0]);
  panel('#dbe9ff', 1.1, [-90, 40, -60], [240, 120], [0, Math.PI / 2, 0]);
  panel('#ffd9a8', 1.5, [90, 20, -90], [200, 100], [0, -Math.PI / 2, 0]);
  panel('#3b4048', 0.5, [0, -40, 0], [300, 300], [Math.PI / 2, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  return env;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // sky: painted equirect used both as the background and as the image-based lighting
  const skyTex = canvasTexture(paintSky(), { srgb: true, flipY: false, aniso: 4 });
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = skyTex;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(skyTex).texture;
  pmrem.dispose();
  scene.environment = envMap;

  // sun: matches the glow painted into the sky
  const sun = new THREE.DirectionalLight('#fff4e2', 3.1);
  sun.position.set(-95, 78, 62);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  const S = 62;
  sun.shadow.camera.left = -S * 1.4; sun.shadow.camera.right = S * 1.4;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.045;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#bcd6f2', '#3a3d42', 0.55));
  const fill = new THREE.DirectionalLight('#cfe2ff', 0.55);
  fill.position.set(80, 40, -90);
  scene.add(fill);

  // apron
  const apronTex = canvasTexture(paintApron(), { srgb: true, repeat: [8, 8], aniso: 8 });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.92, metalness: 0.02, color: '#ffffff' })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y - 0.01;
  ground.receiveShadow = true;
  ground.name = 'apron';
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 3000);
  camera.position.set(103, 27, 86);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -1.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 6;
  controls.maxDistance = 420;
  controls.maxPolarAngle = Math.PI * 0.86;
  controls.autoRotateSpeed = 0.55;
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
      t: 0, dur: 1.25,
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
    const r = 150;
    sun.position.set(Math.cos(el) * Math.cos(az) * r, Math.sin(el) * r, Math.cos(el) * Math.sin(az) * r);
  };

  return {
    renderer, scene, camera, controls, ground, sun, envMap, skyTex,
    presets: PRESETS, setPreset, updateCamera, resize, setSunAngle,
    get transitioning() { return !!transition; },
  };
}
