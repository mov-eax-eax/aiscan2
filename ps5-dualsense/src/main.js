// ============================================================
// main.js - scene, camera, interaction and interface
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { createMaterials } from './materials.js';
import { createController } from './controller.js';
import { createStudio } from './environment.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const errors = [];
window.__errors = errors;
window.addEventListener('error', (e) => errors.push(String(e.message || e.error || e)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason?.stack || e.reason || e)));

const loader = $('#loader');
const bar = $('#loader-bar');
const pct = $('#loader-pct');
const statusEl = $('#loader-status');
function progress(value, label) {
  const p = clamp(value, 0, 1);
  if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
  if (pct) pct.textContent = String(Math.round(p * 100)).padStart(2, '0');
  if (label && statusEl) statusEl.textContent = label;
}
function fail(message, err) {
  console.error(message, err);
  if (err) errors.push(String(err?.stack || err));
  if (statusEl) statusEl.textContent = 'RENDERER ERROR — SEE CONSOLE';
  if (bar) bar.style.background = '#ff5c5c';
  const fallback = $('#fallback');
  if (fallback) fallback.hidden = false;
}

const params = new URLSearchParams(location.search);
const initialView = params.get('view');
const stillMode = params.has('still');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const VIEWS = {
  hero: { pos: [14.2, 8.7, 26.8], target: [0, -1.05, 0] },
  front: { pos: [0.0, 1.8, 31.2], target: [0, -0.9, 0] },
  top: { pos: [0.2, 30.0, 12.0], target: [0, -1.3, 0] },
  back: { pos: [8.6, 8.6, -30.0], target: [0, -0.8, 0] },
  sticks: { pos: [0.0, 3.0, 17.2], target: [0, -0.2, 0] },
  trigger: { pos: [13.0, 7.0, -24.0], target: [1.8, 0.3, -0.5] },
};

const state = {
  colorway: params.get('color') || 'white',
  lightbar: params.get('lightbar') !== '0',
  turntable: params.has('turntable'),
  view: 'hero',
  ready: false,
};

const container = $('#app');
const canvas = $('#scene');
let renderer;
let scene;
let camera;
let controls;
let materials;
let controller;
let studio;
let transition = null;
let introDone = false;
let autoRotateResume = null;
let lastInteract = 0;
let clock;

function viewVectors(name) {
  const v = VIEWS[name] || VIEWS.hero;
  const target = new THREE.Vector3(...v.target);
  const pos = new THREE.Vector3(...v.pos);
  const aspect = camera?.aspect || 1.78;
  if (aspect < 1.08) {
    const fit = Math.min(2.45, 1.18 / aspect);
    pos.sub(target).multiplyScalar(fit).add(target);
    target.y -= 1.35;
  }
  return { pos, target };
}

function cancelTransition() {
  if (transition) {
    transition = null;
    if (controls) controls.enabled = true;
  }
}

function setView(name, { instant = false, duration = 1.15 } = {}) {
  const v = VIEWS[name] || VIEWS.hero;
  if (!v || !camera || !controls) return;
  state.view = name;
  const fitted = viewVectors(name);
  const toPos = fitted.pos;
  const toTarget = fitted.target;
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.view === name);
  });
  if (instant || reducedMotion) {
    cancelTransition();
    camera.position.copy(toPos);
    controls.target.copy(toTarget);
    controls.update();
    return;
  }
  transition = {
    elapsed: 0,
    duration,
    fromPos: camera.position.clone(),
    toPos,
    fromTarget: controls.target.clone(),
    toTarget,
  };
  controls.enabled = false;
}

function setColorway(name) {
  if (!materials) return;
  state.colorway = name;
  const c = materials.setColorway(name);
  document.documentElement.style.setProperty('--accent', c.ui);
  document.querySelectorAll('[data-color]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.color === name);
  });
}

function setLightbar(on) {
  state.lightbar = !!on;
  controller?.setLightbar(on);
  const btn = document.querySelector('[data-toggle="lightbar"]');
  if (btn) {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
}

function setTurntable(on) {
  state.turntable = !!on;
  if (controls) controls.autoRotate = on;
  const btn = document.querySelector('[data-toggle="turntable"]');
  if (btn) {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
}

function wireUI() {
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.addEventListener('click', () => setView(b.dataset.view));
  });
  document.querySelectorAll('[data-color]').forEach((b) => {
    b.addEventListener('click', () => setColorway(b.dataset.color));
  });
  document.querySelectorAll('[data-toggle]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.toggle === 'lightbar') setLightbar(!state.lightbar);
      if (b.dataset.toggle === 'turntable') setTurntable(!state.turntable);
    });
  });
  document.querySelector('[data-reset]')?.addEventListener('click', () => {
    setTurntable(false);
    setView('hero');
  });
  canvas.addEventListener('dblclick', () => {
    setTurntable(false);
    setView('hero');
  });
  canvas.addEventListener('pointerdown', () => {
    cancelTransition();
    lastInteract = performance.now();
    if (state.turntable) {
      controls.autoRotate = false;
      clearTimeout(autoRotateResume);
      autoRotateResume = setTimeout(() => {
        if (state.turntable) controls.autoRotate = true;
      }, 4200);
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    if (key === 'r') { setTurntable(false); setView('hero'); }
    if (key === 'l') setLightbar(!state.lightbar);
    if (key === 't') setTurntable(!state.turntable);
    const map = { '1': 'hero', '2': 'front', '3': 'top', '4': 'back', '5': 'sticks', '6': 'trigger' };
    if (map[key]) setView(map[key]);
  });
}

async function boot() {
  const test = document.createElement('canvas');
  const gl = test.getContext('webgl2');
  if (!gl) {
    fail('WebGL 2 unavailable');
    return;
  }

  progress(0.04, 'INITIALISING RENDERER');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 140);
  camera.position.set(22, 14, 40);

  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, -1.0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.7;
  controls.panSpeed = 0.55;
  controls.enablePan = false;
  controls.minDistance = 8.5;
  controls.maxDistance = 48;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.autoRotateSpeed = 0.55;
  controls.autoRotate = state.turntable;
  controls.update();

  await nextFrame();
  progress(0.12, 'CALIBRATING STUDIO');
  studio = createStudio(renderer, scene);

  await nextFrame();
  progress(0.32, 'MIXING MATERIALS');
  materials = createMaterials(renderer);
  await nextFrame();

  progress(0.48, 'MILLING SHELL');
  controller = createController(materials, { lightbar: state.lightbar });
  controller.root.rotation.set(-0.055, -0.17, 0.012);
  scene.add(controller.root);

  // Ground the model precisely on the studio floor.
  controller.root.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(controller.root);
  controller.root.position.y = -6.31 - bbox.min.y;
  controller.root.updateMatrixWorld(true);
  if (studio.contact) {
    const size = new THREE.Vector3();
    bbox.getSize(size);
    studio.contact.scale.set(size.x / 11.5, size.z / 8.0, 1);
    studio.contact.position.set(0, -6.332, 0.2);
  }

  progress(0.70, 'ASSEMBLING CONTROLS');
  await nextFrame();
  progress(0.84, 'FINAL LIGHTING');
  setColorway(state.colorway);
  setLightbar(state.lightbar);
  setTurntable(state.turntable);
  wireUI();

  // Compile shaders before the reveal, so the first visible frame is clean.
  try {
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } catch (e) {
    console.warn('Shader precompile skipped', e);
  }
  progress(0.93, 'FIRST FRAME');
  renderer.render(scene, camera);
  progress(1.0, 'READY');
  clock = new THREE.Clock();

  controls.addEventListener('start', () => {
    lastInteract = performance.now();
  });

  // initial camera transition
  const initial = initialView && VIEWS[initialView] ? initialView : 'hero';
  setView(initial, { instant: true });
  camera.position.set(22, 14, 40.0);
  controls.target.set(0, -1.2, 0);
  controls.update();
  setView(initial, { duration: stillMode ? 0.001 : 2.1 });

  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(container);

  renderer.setAnimationLoop(animate);
  state.ready = true;

  window.__dualsense = {
    ready: true,
    get state() { return { ...state }; },
    setView: (name, instant = true) => setView(name, { instant }),
    focus: (name, instant = true) => setView(name, { instant }),
    setColorway,
    setLightbar,
    setTurntable,
    camera,
    controls,
    scene,
    renderer,
    controller,
    materials,
    errors,
    get stats() {
      const info = renderer.info;
      return {
        calls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        views: Object.keys(VIEWS),
      };
    },
  };

  // QA / deep-link mode: no intro, immediately usable.
  if (stillMode) {
    cancelTransition();
    setView(initial, { instant: true });
    loader?.classList.add('is-done');
    setTimeout(() => loader?.remove(), 900);
  } else {
    await sleep(120);
    loader?.classList.add('is-done');
    setTimeout(() => loader?.remove(), 1100);
  }
}

function onResize() {
  if (!renderer || !camera) return;
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  const wasPortrait = camera.aspect < 1.08;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  if (window.__dualsense?.ready && !transition && (wasPortrait !== (camera.aspect < 1.08))) {
    setView(state.view, { instant: true });
  }
}

function animate() {
  if (!clock) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (transition) {
    transition.elapsed += dt;
    const p = clamp(transition.elapsed / transition.duration, 0, 1);
    const k = 1 - Math.pow(1 - p, 3);
    camera.position.lerpVectors(transition.fromPos, transition.toPos, k);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, k);
    camera.lookAt(controls.target);
    if (p >= 1) {
      transition = null;
      controls.enabled = true;
      controls.update();
    }
  } else {
    controls.update();
  }

  controller?.update(t);
  const shoulders = controller?.root?.getObjectByName('triggers-and-bumpers');
  if (shoulders) shoulders.visible = camera.position.z < -4.0;
  renderer.info.reset();
  renderer.render(scene, camera);
}

boot().catch((e) => fail('Boot failed', e));