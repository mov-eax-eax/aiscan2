import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { DIM, GROUND_Y, SKIES } from './config.js';
import { buildTower, updateLift } from './tower.js';
import { makeFriezeTextures } from './frieze.js';
import { createBulbs, createBeacon } from './sparkle.js';
import { createWorld, makeNoiseTexture } from './world.js';

/* ------------------------------- views -------------------------------- */
const VIEWS = {
  overview: { label: 'Overview', pos: [330, 155, 330], target: [0, 120, 0] },
  esplanade: { label: 'Esplanade', pos: [118, 11, 118], target: [0, 60, 0] },
  arches: { label: 'Arches', pos: [96, 34, 96], target: [0, 30, 0] },
  first: { label: '1st floor', pos: [94, 80, 94], target: [0, 57, 0] },
  second: { label: '2nd floor', pos: [56, 142, 56], target: [0, 116, 0] },
  summit: { label: 'Summit', pos: [24, 290, 24], target: [0, 279, 0] },
  aerial: { label: 'Aerial', pos: [-190, 470, 210], target: [0, 150, 0] },
  trocadero: { label: 'Trocadéro', pos: [-330, 108, -330], target: [0, 145, 0] },
  champ: { label: 'Champ de Mars', pos: [370, 46, 370], target: [0, 95, 0] },
};

const state = {
  sky: 'golden',
  filigree: true,
  shadows: true,
  lifts: true,
  spin: false,
  glass: true,
  wire: false,
};

/* Deep links, handy for screenshots and for sharing a view:
   ?sky=night&view=summit&shadows=0&bloom=0&frames=3&dpr=1 */
const params = new URLSearchParams(window.location.search);
const qsFlag = (k, dflt) => (params.has(k) ? params.get(k) !== '0' : dflt);
const qsView = VIEWS[params.get('view')] ? params.get('view') : null;
state.sky = SKIES[params.get('sky')] ? params.get('sky') : 'golden';
state.filigree = qsFlag('filigree', true);
state.shadows = qsFlag('shadows', true);
state.lifts = qsFlag('lifts', true);
state.spin = qsFlag('spin', false);
state.glass = qsFlag('glass', true);
state.wire = qsFlag('wire', false);
const useComposer = qsFlag('bloom', true);
const dprCap = Number(params.get('dpr')) || 2;
const maxFrames = Number(params.get('frames')) || 0;

let preset = SKIES[state.sky];

/* ------------------------------ renderer ------------------------------ */
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = preset.exposure;
renderer.shadowMap.enabled = state.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.4, 16000);
const startView = qsView ? VIEWS[qsView] : VIEWS.overview;
camera.position.set(...startView.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...startView.target);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 2200;
controls.maxPolarAngle = Math.PI * 0.497;
controls.autoRotateSpeed = 0.22;

/* environment reflections */
let envRT = null;
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();
} catch (err) {
  console.warn('environment map unavailable', err);
}

const world = createWorld(scene);
world.setSky(state.sky);

/* -------------------------------- post -------------------------------- */
const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: 4,
});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.0,
  0.6,
  0.85,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ------------------------------- the tower ---------------------------- */
window.__STAGE = 'module loaded';
let tower = null;
let bulbs = null;
let beacon = null;
const glassFloors = [];

async function boot() {
  const loader = document.getElementById('loader');
  const bar = document.getElementById('loadbar');
  const msg = document.getElementById('loadmsg');
  let fake = 0.02;
  const timer = setInterval(() => {
    fake = Math.min(0.8, fake + 0.035);
    bar.style.width = `${(fake * 100).toFixed(0)}%`;
  }, 70);

  msg.textContent = 'drafting the 18,038 parts…';
  window.__STAGE = 'world built';
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 40)));

  const noiseMap = makeNoiseTexture(256, 205, 40);
  const friezeTextures = makeFriezeTextures();

  msg.textContent = 'raising the four pillars…';
  window.__STAGE = 'assembling ironwork';
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20)));

  tower = buildTower({ friezeTextures, noiseMap });
  scene.add(tower.group);

  msg.textContent = 'painting the 72 names in gold…';
  window.__STAGE = 'ironwork placed';
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20)));

  bulbs = createBulbs(tower.builders, DIM.bulbs);
  tower.group.add(bulbs);
  beacon = createBeacon();
  tower.group.add(beacon.group);

  tower.group.traverse((o) => {
    if (o.name && o.name.startsWith('glass-floor')) glassFloors.push(o);
  });

  msg.textContent = 'switching on 336 projectors…';
  window.__STAGE = 'lights';
  applyToggles();
  applySky(state.sky, true);

  clearInterval(timer);
  bar.style.width = '100%';
  setTimeout(() => loader.classList.add('done'), 320);
  window.__STAGE = 'ready';
  window.__APP_READY = true;
  updateHud();
}

/* ------------------------------ interface ----------------------------- */
function buttonRow(host, entries, onPick) {
  for (const [key, label] of entries) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.key = key;
    b.addEventListener('click', () => {
      host.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onPick(key);
    });
    host.appendChild(b);
  }
}

buttonRow(
  document.getElementById('skies'),
  Object.entries(SKIES).map(([k, v]) => [k, v.label]),
  (key) => applySky(key),
);
buttonRow(
  document.getElementById('views'),
  Object.entries(VIEWS).map(([k, v]) => [k, v.label]),
  (key) => flyTo(VIEWS[key]),
);
document.querySelector(`#skies button[data-key="${state.sky}"]`)?.classList.add('on');
document.querySelector(`#views button[data-key="${qsView || 'overview'}"]`)?.classList.add('on');

for (const btn of document.querySelectorAll('#toggles button')) {
  const key = btn.dataset.toggle;
  if (key in state) btn.classList.toggle('on', !!state[key]);
  btn.addEventListener('click', () => {
    state[key] = !state[key];
    btn.classList.toggle('on', state[key]);
    applyToggles();
  });
}

function applySky(name, instant = false) {
  state.sky = name;
  preset = SKIES[name] || SKIES.golden;
  world.setSky(name);
  renderer.toneMappingExposure = preset.exposure;
  bloom.strength = preset.glow;
  scene.environmentIntensity = preset.env ?? 0.5;

  const iron = tower ? tower.materials.iron : null;
  if (iron) {
    const e = preset.lamps;
    iron.emissive.setRGB(e * 0.20, e * 0.12, e * 0.035);
    iron.emissiveIntensity = 1.0;
    tower.materials.filigree.emissive.setRGB(e * 0.16, e * 0.1, e * 0.03);
    tower.materials.panels.emissive.setRGB(e * 0.1, e * 0.09, 0.05 * e);
  }
  if (bulbs) {
    bulbs.userData.mat.uniforms.uOn.value = preset.bulbs * 0.85;
    bulbs.userData.mat.uniforms.uTwinkle.value = preset.sparkle;
  }
  if (instant) updateHud();
}

function applyToggles() {
  if (!tower) return;
  tower.parts.filigree.visible = state.filigree;
  for (const g of glassFloors) g.visible = state.glass;
  if (tower.materials.glass) tower.materials.glass.visible = true;
  for (const l of tower.lifts) l.object.visible = state.lifts;
  controls.autoRotate = state.spin;

  if (renderer.shadowMap.enabled !== state.shadows) {
    renderer.shadowMap.enabled = state.shadows;
    scene.traverse((o) => {
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.needsUpdate = true;
      }
    });
  }

  for (const key of ['iron', 'filigree', 'panels', 'deck', 'masonry']) {
    const m = tower.materials[key];
    if (m) m.wireframe = state.wire;
  }
}

let flight = null;
function flyTo(view) {
  flight = {
    p0: camera.position.clone(),
    t0: controls.target.clone(),
    p1: new THREE.Vector3(...view.pos),
    t1: new THREE.Vector3(...view.target),
    start: performance.now() / 1000,
    dur: 1.5,
  };
  controls.enabled = false;
}

/* --------------------------------- hud -------------------------------- */
const altEl = document.getElementById('alt');
const distEl = document.getElementById('dist');
const statsEl = document.getElementById('stats');

function updateHud() {
  if (!altEl) return;
  const alt = camera.position.y - GROUND_Y;
  const dist = Math.hypot(camera.position.x, camera.position.z);
  altEl.innerHTML = `alt <b>${alt.toFixed(0)} m</b>`;
  distEl.innerHTML = `range <b>${dist.toFixed(0)} m</b>`;
  if (statsEl && tower) {
    statsEl.innerHTML = `members <b>${tower.counts.total.toLocaleString('en-US')}</b>`;
  }
}

/* -------------------------------- loop -------------------------------- */
const clock = new THREE.Clock();
let lastHud = 0;
let frames = 0;

function animate() {
  const dt = Math.min(0.06, clock.getDelta());
  const t = clock.elapsedTime;
  const now = performance.now() / 1000;

  if (flight) {
    const k = Math.min(1, Math.max(0, (now - flight.start) / flight.dur));
    const kk = k * k * (3 - 2 * k);
    camera.position.lerpVectors(flight.p0, flight.p1, kk);
    controls.target.lerpVectors(flight.t0, flight.t1, kk);
    camera.lookAt(controls.target);
    if (k >= 1) {
      flight = null;
      controls.enabled = true;
      controls.update();
    }
  }

  if (tower) {
    if (state.lifts) {
      for (const l of tower.lifts) {
        const span = l.y1 - l.y0;
        const dur = span / l.speed;
        const p = ((t / dur + l.phase) % 2 + 2) % 2;
        const raw = p < 1 ? p : 2 - p;
        const u = raw * raw * (3 - 2 * raw);
        updateLift(l, u);
      }
    }
    if (bulbs) {
      bulbs.userData.mat.uniforms.uTime.value = t;
    }
    if (beacon) beacon.update(t, preset.lamps);
  }

  controls.update();
  if (useComposer) composer.render();
  else renderer.render(scene, camera);

  if (t - lastHud > 0.2) {
    lastHud = t;
    updateHud();
  }
  frames++;
  if (!maxFrames || frames < maxFrames) requestAnimationFrame(animate);
}

/* ------------------------------- resize ------------------------------- */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
}

window.addEventListener('resize', resize);

/* -------------------------------- start ------------------------------- */
boot()
  .then(() => {
    resize();
    requestAnimationFrame(animate);
  })
  .catch((err) => {
    console.error(err);
    document.getElementById('error').hidden = false;
    document.getElementById('error').querySelector('p').textContent = String(err && err.message ? err.message : err);
    document.getElementById('loader').style.display = 'none';
  });

window.addEventListener('keydown', (e) => {
  const keys = Object.keys(VIEWS);
  const i = keys.findIndex((k) => k[0] === e.key.toLowerCase());
  if (i >= 0 && e.key.length === 1 && !e.metaKey && !e.ctrlKey) flyTo(VIEWS[keys[i]]);
});

